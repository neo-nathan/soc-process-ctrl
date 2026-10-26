/**
 * 进程管控 · 名单进程视图（PL-04；设计文档 01 §7.3、§8.6、§9.1.7）
 *
 * 一、它是什么（大白话）
 *   名单列表页（list.js）展开行点「进程」后，名单页里换成本视图：看这条白名单 / 黑名单里有哪些进程，添加、移除、恢复进程。
 *   不新开路由（PL-04 Q1）：list.js 隐藏列表、显示空容器 .js_procm_procpane，调本模块 open(容器, opts)；
 *   点「返回」时 list.js 调 release()，再把列表显示回来（条件、页码不变）。
 *   opts = {cfg, row, onBack, onOverview}
 *     cfg        list.js 的白 / 黑配置（用 type 2 白 / 3 黑、name「白名单」/「黑名单」）
 *     row        名单列表里这一行（bwlistAdapter.toRow 之后的数据：PID、PNAME、EPTYPE、PUBSTATUS、PROCNUM、ADDNUM、DELNUM、GROUPNUM、EPNUM、CREATETIME）
 *     onBack     点「返回」或面包屑「白名单」时调（list.js 负责 release + 显示列表）
 *     onOverview 点面包屑「进程管控」时调（list.js 的 goOverview）
 *
 * 二、数据从哪来（全部真接口，经 RsCore.ajax，PL-04 §三）
 *   进程行  Procmanager/showWBList     {pid, policytype}                         → bwlistAdapter.toProcList 转换、排序、筛选
 *   信息条  Procmanager/getWBList      bwlistAdapter.toQuery(type, 空条件)        → 找 PID 相同的那行，toRow 后画（PL-04 Q2：以后端为准）
 *   添加    Procmanager/addProcToWBList {pid, policytype, propath, filehash, algo}
 *   移除    Procmanager/delProcFromBW   {pid, policytype, ids: 'ID'}（后端还没登记 ACL，调了会被拒，PL-04 F-2）
 *   恢复    Procmanager/resProcFromBW   {id, policytype}（后端 12:19 版只收单条，不带 pid）
 *   取数时机：进入、点「刷新」、添加 / 移除 / 恢复成功后，同时发进程行和信息条两个请求，都回来再一起重画（PL-04 §3.2）；
 *     哪个成功就重画哪部分，失败的那部分保留原样；表格不会卡在加载中。
 *     每次取数带序号，只认最近一次；离开本视图（release）后回来的结果全部丢掉。
 *   接口失败时 core.js 已经弹过提示（code 1「系统异常」；403 ACL 拒绝由全局钩子弹一句；其余弹「错误」+ 后端原因），这里不再弹第二次。
 *
 * 三、前端检查（后端还没做，PL-04 D-3）
 *   添加：按顺序检查路径、哈希、查重（checkAdd，§3.5、§3.3），第一个不通过就红字显示在弹窗里、不发请求
 *   移除：已发布过的名单至少保留 1 个进程（removeBlockMsg，§3.4）；没发布过的可以删光
 *   这几段和分页退页（clampPage）写成不依赖 jQuery 的纯函数，放在 _test 下导出，给 node 单测
 *
 * 四、防撞名（PL-04 §5.6）
 *   名单列表页的事件委托挂在同一个页面容器上，所以本视图的钩子类都用 js_procm_proc_ 开头、id 都用 procmProc 开头，
 *   事件都挂在本视图自己的容器上，命名空间 .procmProc（窗口大小变化挂在 window 上，也用这个命名空间），release 时全部解掉。
 *
 * 写法：RequireJS AMD 模块（模块名 processManage/bwlistProc），只用 ES5（不用 let / const / 箭头函数 / 模板字符串 / class）。
 *       模块最外层不碰 jQuery、RsCore 等页面全局变量，所以能在 node 里加载、单测纯函数。
 */
define(function (require) {
    var tpl = require('text!processManage/bwlistProc.html');
    var mustache = require('mustache');
    /** 名单列表、名单进程的字段转换（PL-03 / PL-04）：后端字段再变只改它 */
    var bwlistAdapter = require('processManage/bwlistAdapter');
    // 下面几个 list.js 已经加载过，这里再写一遍只是说明本模块要用（RequireJS 不会重复加载）
    require('table');
    require('datetimepicker');
    require('selectric');

    // =====================================================================
    // 常量
    // =====================================================================

    /** 接口地址（PL-04 §3.1；后端再改名只改这里） */
    var URL_PROCS = 'Procmanager/showWBList';         // 进程行：pid、policytype
    var URL_LIST = 'Procmanager/getWBList';           // 名单列表（信息条用）：policytype、timeRange=0
    var URL_ADD = 'Procmanager/addProcToWBList';      // 添加：pid、policytype、propath、filehash、algo
    var URL_DEL = 'Procmanager/delProcFromBW';        // 移除：pid、policytype、ids
    var URL_RESTORE = 'Procmanager/resProcFromBW';    // 恢复：id、policytype

    /** 事件命名空间 */
    var NS = '.procmProc';

    /** 每页条数（照 demo） */
    var PAGE_SIZE = 15;

    /** 进程路径最长多少个字（后端列宽 varchar(500)） */
    var PATH_MAX = 500;

    /** 筛选条件的初始值（条件名见 bwlistAdapter 第六节） */
    var EMPTY_COND = { time: '', from: '', to: '', chg: '', field: 'path', kw: '' };

    /** 系统类型：EPTYPE 1 = Windows、2 = Linux/信创 */
    var EPTYPE_TEXT = { '1': 'Windows', '2': 'Linux/信创' };

    /** 发布状态 PUBSTATUS 0～3 的文字（颜色在样式 procm-st0～3：灰 / 蓝 / 绿 / 橙，同列表页） */
    var PUB_TEXT = ['--', '待发布', '已发布', '有变更'];

    /** 关键字框的占位文字（按选的字段） */
    var KW_PLACEHOLDER = { path: '请输入进程路径关键字', hash: '请输入文件哈希关键字' };

    // =====================================================================
    // 纯函数（不碰 jQuery、RsCore，node 单测用；_test 导出）
    // =====================================================================

    /** 转整数，转不了按 0 */
    function toInt(v) {
        var n = parseInt(v, 10);
        return isNaN(n) ? 0 : n;
    }

    /** 去首尾空格；undefined / null 当空串 */
    function trim(v) {
        return (v === undefined || v === null) ? '' : String(v).replace(/^\s+|\s+$/g, '');
    }

    /**
     * 随白 / 黑、系统类型变的文案（PL-04 §五、S-9）
     * @param cfg    list.js 的配置（type、name）
     * @param eptype 名单的系统类型（1 Windows，其他按 Linux/信创）
     */
    function texts(cfg, eptype) {
        var name = (cfg && cfg.name) ? cfg.name : '白名单';
        var isWin = toInt(eptype) === 1;
        var verb = (cfg && toInt(cfg.type) === 3) ? '拦截' : '放行';   // 黑名单拦截、白名单放行
        return {
            name: name,
            verb: verb,
            osName: isWin ? 'Windows' : 'Linux/信创',
            pathEg: isWin ? 'C:\\Windows\\System32\\svchost.exe' : '/usr/bin/python3',
            // 「新增」标签悬停（照 demo；黑名单「放行」换「拦截」）
            newTip: '上次发布之后新加入的进程，回' + name + '列表点「发布」后，终端才会' + verb,
            // 「移除」标签悬停（Q4：后端还没有「谁、何时标记移除」，先只写这一句）
            pendingTip: '已标记移除，回' + name + '列表点「发布」后才会从终端上移除',
            // 至少保留 1 个（照 demo :696）
            keepOne: name + '至少要保留 1 个进程，不能把进程全部移除；要清掉这条' + name + '请直接删除它',
            // 发布状态悬停：列表页状态说明框的 4 句（list.html 表头说明），换成在进程页里的说法
            stTips: [
                '还没有任何进程，不能发布；先点「添加进程」添加',
                '加了进程，还没发布过；回' + name + '列表点「发布」定稿，之后才能设置应用范围',
                '内容定稿了，没有待发布的增减。应用范围是 -- 的还没下发到终端，选了应用范围就自动下发；改应用范围也自动下发，不用再发布',
                '发布过，之后进程有增减（+N / -N）还没发布，终端上还是旧版本；回' + name + '列表点「发布」自动下发。有变更时不能改应用范围；已发布的名单至少保留 1 个进程'
            ]
        };
    }

    /** 路径最后一段 = 进程名（Linux 只按 / 切；Windows 按 \ 和 / 切，PL-04 Q7） */
    function nameOf(path, eptype) {
        var p = trim(path);
        var segs = toInt(eptype) === 1 ? p.split(/[\\\/]/) : p.split('/');
        return trim(segs[segs.length - 1]);
    }

    /** 按长度认哈希算法：32 位十六进制 = 0（MD5）、64 位 = 8（SHA256），认不出 = -1 */
    function algoOf(hash) {
        var h = trim(hash);
        if (/^[0-9a-fA-F]{32}$/.test(h)) {
            return 0;
        }
        if (/^[0-9a-fA-F]{64}$/.test(h)) {
            return 8;
        }
        return -1;
    }

    /** 弹窗里「哈希算法」那一格的文字：没填 / 认出 / 认不出 */
    function algoText(hash) {
        if (trim(hash) === '') {
            return '填写文件哈希后自动识别';
        }
        var a = algoOf(hash);
        return a === 0 ? 'MD5' : (a === 8 ? 'SHA256' : '识别不出（应为 32 位或 64 位十六进制）');
    }

    /** 查重用的路径写法：Linux 原样（区分大小写）；Windows 不分大小写、/ 与 \ 当同一个（照 demo normPath） */
    function normPath(path, eptype) {
        var p = trim(path);
        return toInt(eptype) === 1 ? p.replace(/\//g, '\\').toLowerCase() : p;
    }

    /**
     * 在名单全部进程行里找「算法 + 哈希 + 路径」都相同的那一行（PL-04 §3.3）；找不到返回 null
     * @param allRows 名单全部进程行（toProcRow 之后的，筛选前）；不是数组按空
     */
    function findDup(allRows, algo, hash, path, eptype) {
        var list = Object.prototype.toString.call(allRows) === '[object Array]' ? allRows : [];
        var h = trim(hash).toLowerCase();
        var p = normPath(path, eptype);
        for (var i = 0; i < list.length; i++) {
            var r = list[i];
            if (toInt(r.ALGO) === algo && trim(r.FILEHASH).toLowerCase() === h && normPath(r.PROCPATH, eptype) === p) {
                return r;
            }
        }
        return null;
    }

    /**
     * 点「添加」时的检查（PL-04 §3.5，按顺序，第一个不通过就返回它的提示）
     * @return {err, path, hash, algo, name}：err 空 = 通过；path 去首尾空格；hash 去首尾空格并转小写；algo 0 / 8；name 进程名
     */
    function checkAdd(pathIn, hashIn, eptype, allRows) {
        var isWin = toInt(eptype) === 1;
        var path = trim(pathIn);
        var hash = trim(hashIn).toLowerCase();
        var name = nameOf(path, eptype);
        var algo = algoOf(hash);
        var res = { err: '', path: path, hash: hash, algo: algo, name: name };
        var pathOk = isWin ? /^[A-Za-z]:[\\\/]/.test(path) : path.charAt(0) === '/';
        if (path === '') {
            res.err = '请填写进程路径';
        } else if (path.length > PATH_MAX) {
            res.err = '进程路径不能超过 ' + PATH_MAX + ' 个字符';
        } else if (!pathOk || name === '') {
            res.err = isWin
                ? 'Windows 名单请填写完整的进程路径，示例：C:\\Windows\\System32\\svchost.exe'
                : 'Linux/信创 名单请填写完整的进程路径，示例：/usr/bin/python3';
        } else if (hash === '') {
            res.err = '请填写文件哈希';
        } else if (algo < 0) {
            res.err = '文件哈希应为 32 位（MD5）或 64 位（SHA256）十六进制字符';
        } else {
            var dup = findDup(allRows, algo, hash, path, eptype);
            if (dup) {
                res.err = dup.STATE === 'pending'
                    ? '名单里已有路径和哈希都相同的「' + dup.PROCNAME + '」，它已被标记移除，点它的「恢复」即可'
                    : '名单里已有路径和哈希都相同的「' + dup.PROCNAME + '」，不用重复添加';
            }
        }
        return res;
    }

    /**
     * 点「移除」时的「至少保留 1 个」检查（PL-04 §3.4）；返回空串 = 可以移除，否则是要弹的提示
     *   发布过 = 名单里有 STATUS 为 0 或 2 的行（和后端「发布过」等价，不看名单状态，PL-04 F-3）
     *   发布过，且「不是待移除的行数 − 1」< 1 → 拦住；没发布过的名单可以删光
     * @param allRows 名单全部进程行（toProcRow 之后的）
     * @param keepOneMsg 要弹的提示（texts().keepOne）
     */
    function removeBlockMsg(allRows, keepOneMsg) {
        var list = Object.prototype.toString.call(allRows) === '[object Array]' ? allRows : [];
        var published = false;
        var alive = 0;   // 不是待移除（STATUS 不为 2）的行数
        for (var i = 0; i < list.length; i++) {
            var s = toInt(list[i].STATUS);
            if (s === 0 || s === 2) {
                published = true;
            }
            if (s !== 2) {
                alive++;
            }
        }
        return (published && alive - 1 < 1) ? keepOneMsg : '';
    }

    /** 当前页超出总页数时退到最后一页；没有数据时是第 1 页 */
    function clampPage(page, total, size) {
        var pages = Math.max(1, Math.ceil(toInt(total) / Math.max(1, toInt(size))));
        var p = toInt(page);
        return p < 1 ? 1 : (p > pages ? pages : p);
    }

    /** 有没有设任何筛选条件（field 不算条件：没有关键字时选哪个字段都一样） */
    function hasCond(c) {
        return !!(c && (c.time || c.from || c.to || c.chg || trim(c.kw)));
    }

    // =====================================================================
    // 页面状态
    // =====================================================================
    var S = {
        $pane: null,     // 本视图的容器 .js_procm_procpane（open 时记下，release 后清空）
        token: null,     // 这一次打开的标记：release 时换掉，之前发出的请求回来就丢掉
        seq: 0,          // 取数序号：只认最近一次
        cfg: null,       // list.js 的白 / 黑配置
        tx: null,        // texts() 的结果
        pid: 0,          // 名单 PID
        eptype: 2,       // 名单系统类型
        row: null,       // 信息条用的名单行（toRow 之后）
        procs: null,     // 最近一次 showWBList 成功返回的全部进程行（toProcRow、排好序，筛选前）；还没成功过是 null
        loadFailed: false, // 进程行一次都没取到过、且最近一次取数失败（表格空文案用）
        stale: false,    // 移除 / 恢复成功后、进程行还没重新取到之前为 true：这时页面上的进程行是旧的，不能拿来算「至少保留 1 个」
        cond: null,      // 当前生效的筛选条件
        busy: false,     // 移除 / 恢复处理中（同一时刻只处理一个）
        addCtx: null,    // 添加弹窗这一次打开的上下文 {busy}；弹窗关掉时清空
        onBack: null,
        onOverview: null
    };

    /** 转义后输出到页面（路径、哈希、名单名等用户数据，防 XSS） */
    function esc(v) {
        return util_b.escapeHTML(v === null || v === undefined ? '' : String(v));
    }

    function $find(sel) {
        return S.$pane ? S.$pane.find(sel) : $();
    }

    // =====================================================================
    // 信息条（PL-04 §5.2）
    // =====================================================================

    /** 按名单行（toRow 之后）+ 进程行的新增 / 待移除数重画信息条 */
    function drawInfo() {
        var row = S.row || {};
        var tx = S.tx;
        var s = toInt(row.PUBSTATUS);
        if (s < 0 || s > 3) {
            s = 0;
        }
        // 新增 / 待移除数：进程行取到过就用进程行算的（和表格一致），还没取到用名单行的
        var add = toInt(row.ADDNUM);
        var del = toInt(row.DELNUM);
        if (S.procs) {
            add = 0;
            del = 0;
            for (var i = 0; i < S.procs.length; i++) {
                if (S.procs[i].STATE === 'new') {
                    add++;
                } else if (S.procs[i].STATE === 'pending') {
                    del++;
                }
            }
        }
        $find('.js_procm_proc_pname').text(row.PNAME === undefined || row.PNAME === null ? '' : String(row.PNAME));
        $find('.js_procm_proc_st')
            .attr('class', 'procm-proc-st procm-st' + s + ' js_procm_proc_st')
            .attr('title', tx.stTips[s])
            .html((s === 0 ? '' : '<i class="procm-proc-dot"></i>') + PUB_TEXT[s]);
        $find('.js_procm_proc_os').text(EPTYPE_TEXT[String(toInt(row.EPTYPE))] || '--');
        $find('.js_procm_proc_num').text(toInt(row.PROCNUM));
        var chg = S.cond ? S.cond.chg : '';
        $find('.js_procm_proc_delta[data-chg="new"]').text('+' + add).toggle(add > 0).toggleClass('procm-proc-delta-on', chg === 'new');
        $find('.js_procm_proc_delta[data-chg="pending"]').text('-' + del).toggle(del > 0).toggleClass('procm-proc-delta-on', chg === 'pending');
        // 应用范围：格式和名单列表的「应用范围」列一致（list.js，照策略中心策略列表）：
        //   组<蓝【 N 】> 终端<蓝【 M 】>，终端数为 0 时不显示「终端」项；没有应用范围显示 --。
        //   这里的「终端」是这些组里的终端数 EPNUM（名单只挂组），悬停提示写明「组内共 M 台终端」；
        //   101 后端现在还不返回终端数，EPNUM 固定是 0（bwlistAdapter，PL-03 Q3），0 是「不知道」，提示里就不写终端数。
        //   蓝色类 .procm-scope 在 css/processManageList.css 第一节，本页也在 .procm-bwlist 里，直接复用。
        var gc = toInt(row.GROUPNUM);
        var ec = toInt(row.EPNUM);
        var $scope = $find('.js_procm_proc_scope');
        if (gc > 0) {
            var scopeHtml = '组<span class="procm-scope">【 ' + gc + ' 】</span>';
            if (ec > 0) {
                scopeHtml += '终端<span class="procm-scope">【 ' + ec + ' 】</span>';
            }
            $scope.html(scopeHtml).attr('title', '已应用到 ' + gc + ' 个组' + (ec > 0 ? '，组内共 ' + ec + ' 台终端' : ''));
        } else {
            // 没有应用范围：悬停提示也要换掉，不然会留着上一次「已应用到…」的提示（信息条每次刷新都会重画）
            $scope.html('<span class="procm-gray">--</span>').attr('title', '还没设置应用范围（终端上没有这条名单）');
        }
        $find('.js_procm_proc_ctime').text(row.CREATETIME ? String(row.CREATETIME) : '--');
    }

    // =====================================================================
    // 表格（PL-04 §5.3）
    // =====================================================================

    /** 列：进程名称 / 文件哈希 / 进程路径 / 添加时间 / 操作（formatter 的 value 已被表格组件转义过，一律从 row 取原值自己 esc 一次，同 list.js） */
    function columns() {
        var tx = S.tx;
        return [{
            field: 'PROCNAME',
            title: '进程名称',
            formatter: function (value, row) {
                var html = '<div class="procm-proc-name"><span class="procm-proc-nametext" title="' + esc(row.PROCNAME) + '">' +
                    (row.PROCNAME ? esc(row.PROCNAME) : '--') + '</span>';
                if (row.STATE === 'new') {
                    html += '<span class="procm-proc-tag procm-proc-tag-new" title="' + esc(tx.newTip) + '">新增</span>';
                } else if (row.STATE === 'pending') {
                    html += '<span class="procm-proc-tag procm-proc-tag-del" title="' + esc(tx.pendingTip) + '">移除</span>';
                }
                return html + '</div>';
            }
        }, {
            // 文件哈希：前面灰色小标签标出算法，悬停看「算法：哈希」
            field: 'FILEHASH',
            title: '文件哈希',
            formatter: function (value, row) {
                return '<div class="procm-proc-hash" title="' + esc(row.ALGOTEXT + '：' + row.FILEHASH) + '">' +
                    '<span class="procm-proc-algo">' + esc(row.ALGOTEXT) + '</span>' +
                    '<span class="procm-proc-mono">' + esc(row.FILEHASH) + '</span></div>';
            }
        }, {
            field: 'PROCPATH',
            title: '进程路径',
            formatter: function (value, row) {
                return '<div title="' + esc(row.PROCPATH) + '">' + esc(row.PROCPATH) + '</div>';
            }
        }, {
            field: 'CREATETIME',
            title: '添加时间',
            formatter: function (value, row) {
                return row.CREATETIME ? '<div>' + esc(row.CREATETIME) + '</div>' : '<div class="procm-gray">--</div>';
            }
        }, {
            // 操作：新增 / 普通进程「移除」，待移除进程「恢复」（都不弹确认，照 demo）
            field: 'PROCM_PROC_OP',
            title: '操作',
            switchable: false,
            formatter: function (value, row) {
                var id = esc(row.ID);
                return row.STATE === 'pending'
                    ? '<a href="javascript:void(0);" class="procm-proc-op js_procm_proc_restore" data-id="' + id + '">恢复</a>'
                    : '<a href="javascript:void(0);" class="procm-proc-op procm-proc-op-del js_procm_proc_remove" data-id="' + id + '">移除</a>';
            }
        }];
    }

    /** 建表格：本地数据、前端分页（数据由 drawTable 用 load 填进去） */
    function initTable() {
        $find('#procmProcTable').bootstrapTable({
            data: [],
            columns: columns(),
            cache: false,
            search: false,
            showRefresh: false,              // 刷新在信息条右侧（同时刷新信息条）
            showColumns: true,               // 右侧：列设置
            showCustomSearch: true,          // 右侧：高级搜索（展开 / 收起 #procmProcSearchBox）
            customSearchBox: '#procmProcSearchBox',
            customSearchBoxOpen: false,      // 默认折叠（照 demo）
            toolbar: '#procmProcToolbar',    // 左侧：添加进程
            toolbarAlign: 'left',
            pagination: true,
            sidePagination: 'client',        // 前端分页（后端不分页，PL-04 F-1 ①）
            pageSize: PAGE_SIZE,
            pageList: [PAGE_SIZE],
            clickToSelect: false,
            height: $find('.procm-proc-main').height(),
            showHeader: true,
            rowStyle: function (row) {
                // 待移除的行：浅红底、名称删除线、文字变灰（照 demo）
                return row.STATE === 'pending' ? { classes: 'procm-proc-row-del' } : {};
            },
            formatNoMatches: function () {
                if (S.loadFailed) {
                    return '进程没有取到，点右侧「刷新」重试';
                }
                return (S.procs && S.procs.length) ? '没有符合条件的进程' : '名单里还没有进程，点「添加进程」添加';
            }
        });
    }

    /**
     * 按当前条件重画表格和「已筛选出 X 条，共 Y 条」
     * @param toFirst true = 回到第 1 页（换了条件）；否则保持当前页，超出总页数时退到最后一页
     */
    function drawTable(toFirst) {
        var $t = $find('#procmProcTable');
        if (!$t.length) {
            return;
        }
        var res = bwlistAdapter.toProcList(S.procs || [], S.cond, S.eptype);
        var opt = $t.bootstrapTable('getOptions');
        opt.pageNumber = toFirst ? 1 : clampPage(opt.pageNumber, res.total, PAGE_SIZE);
        $t.bootstrapTable('load', res.rows);
        var $box = $find('.js_procm_proc_filtered');
        if (hasCond(S.cond)) {
            $find('.js_procm_proc_x').text(res.total);
            $find('.js_procm_proc_y').text(res.all);
            $box.show();
        } else {
            $box.hide();
        }
    }

    function resize() {
        var $t = $find('#procmProcTable');
        if ($t.length) {
            $t.bootstrapTable('changeHeight', $find('.procm-proc-main').height());
        }
    }

    // =====================================================================
    // 取数（PL-04 §3.2）
    // =====================================================================

    /**
     * 同时发进程行和名单列表两个请求，两个都回来再一起重画
     * @param toFirst 重画表格时是否回到第 1 页
     * @param onDone  可省：两个请求都回来后调（不管成败；离开本视图后不调）。移除 / 恢复用它解开「处理中」
     */
    function fetch(toFirst, onDone) {
        if (!S.$pane) {
            return;
        }
        var token = S.token;
        var seq = ++S.seq;
        var left = 2;            // 还有几个请求没回来
        var procData = null;     // 进程行请求成功时的 data
        var listData = null;     // 名单列表请求成功时的 data
        var $t = $find('#procmProcTable');
        $t.bootstrapTable('showLoading');
        function isCurrent() {
            return token === S.token && seq === S.seq;
        }
        function done() {
            left--;
            if (left > 0) {
                return;
            }
            if (token === S.token && typeof onDone === 'function') {
                onDone();
            }
            if (!isCurrent()) {
                return;   // 已离开本视图，或之后又取过一次：这次的结果作废
            }
            $t.bootstrapTable('hideLoading');
            var row = null;
            if (listData) {
                var rows = $.isArray(listData.rows) ? listData.rows : [];
                for (var i = 0; i < rows.length; i++) {
                    if (toInt(rows[i] && rows[i].PID) === S.pid) {
                        row = bwlistAdapter.toRow(rows[i]);
                        break;
                    }
                }
                if (!row) {
                    // 名单列表里已经没有这条（被别人删了）：回到列表。
                    // 进程行请求成功时才另弹一句；它失败（如 code 3「名单不存在。」）时 core.js 已经弹过，不弹第二次
                    if (procData) {
                        RsCore.msg.warn('名单不存在或已被删除');
                    }
                    if (typeof S.onBack === 'function') {
                        S.onBack();
                    }
                    return;
                }
                S.row = row;
            }
            if (procData) {
                S.procs = bwlistAdapter.toProcList(procData.rows, {}, S.eptype).allRows;
                S.loadFailed = false;
                S.stale = false;   // 进程行是最新的了
                drawTable(toFirst);
            } else if (!S.procs) {
                // 进程行一次都没取到过（如进入时就断网）：表格空文案改成「没取到，点刷新」，不说成「名单里还没有进程」
                S.loadFailed = true;
                drawTable(toFirst);
            }
            drawInfo();
        }
        RsCore.ajax(URL_PROCS, { pid: S.pid, policytype: S.cfg.type }, function (data) {
            procData = data || { rows: [] };
        }, done);
        RsCore.ajax(URL_LIST, bwlistAdapter.toQuery(S.cfg.type, {}), function (data) {
            listData = data || { rows: [] };
        }, done);
    }

    // =====================================================================
    // 高级查询（写法照名单列表页 list.js：点选项立刻筛；指定日期、关键字点「筛选」才生效）
    // =====================================================================

    /** 把点选项的选中状态和 S.cond 对齐 */
    function syncChips() {
        $find('.js_procm_proc_chips').each(function () {
            var key = $(this).attr('data-key');
            var val = S.cond[key] || '';
            if (key === 'time' && (S.cond.from || S.cond.to)) {
                $(this).children('a').removeClass('active');   // 用了指定日期：时间范围的点选项都不选
                return;
            }
            $(this).children('a').removeClass('active').filter(function () {
                return ($(this).attr('val') || '') === val;
            }).addClass('active');
        });
    }

    /** 点了某个点选项：这一组只选中它，立刻筛；时间范围的点选项同时清掉指定日期 */
    function pickChip($a) {
        var key = $a.closest('.js_procm_proc_chips').attr('data-key');
        if (key !== 'time' && key !== 'chg') {
            return;
        }
        S.cond[key] = $a.attr('val') || '';
        if (key === 'time') {
            $find('.js_procm_proc_from, .js_procm_proc_to').val('');
            S.cond.from = '';
            S.cond.to = '';
            $find('.js_procm_proc_dateerr').hide();
        }
        syncChips();
        drawInfo();       // +N / -M 的按下状态跟着变
        drawTable(true);
    }

    /** 点信息条的 +N / -M：变化状态选「新增」/「待移除」，再点一次取消 */
    function pickDelta(chg) {
        S.cond.chg = S.cond.chg === chg ? '' : chg;
        syncChips();
        drawInfo();
        drawTable(true);
    }

    /** 点「筛选」：指定日期、字段、关键字生效；开始日期晚于结束日期时红字提示、不筛 */
    function applyInput() {
        var from = trim($find('.js_procm_proc_from').val());
        var to = trim($find('.js_procm_proc_to').val());
        var $err = $find('.js_procm_proc_dateerr');
        if (from && to && from > to) {
            $err.text('开始日期不能晚于结束日期').show();
            return;
        }
        $err.hide();
        S.cond.from = from;
        S.cond.to = to;
        S.cond.field = $find('.js_procm_proc_field').val() === 'hash' ? 'hash' : 'path';
        S.cond.kw = trim($find('.js_procm_proc_kw').val());
        if (from || to) {
            S.cond.time = '';   // 填了指定日期：以它为准，时间范围的点选项取消（照 demo）
        }
        syncChips();
        drawTable(true);
    }

    /** 点「重置」：全部条件回到默认 */
    function resetCond() {
        S.cond = $.extend({}, EMPTY_COND);
        $find('.js_procm_proc_from, .js_procm_proc_to, .js_procm_proc_kw').val('');
        $find('.js_procm_proc_field').val('path').selectric('refresh');
        $find('.js_procm_proc_kw').attr('placeholder', KW_PLACEHOLDER.path);
        $find('.js_procm_proc_dateerr').hide();
        syncChips();
        drawInfo();
        drawTable(true);
    }

    /**
     * 指定日期：用现有 datetimepicker（写法同 list.js：只选日期，开始不晚于结束、都不晚于今天）
     * 「今天」取北京日期（UTC+8，用 getUTC* 读），每次打开选择器时现算（PL-04 F-10）
     */
    function initDatePicker() {
        function bjToday() {
            var bj = new Date(new Date().getTime() + 8 * 3600 * 1000);
            return [bj.getUTCFullYear(), bj.getUTCMonth() + 1, bj.getUTCDate()].join('/');
        }
        var $from = $find('.js_procm_proc_from');
        var $to = $find('.js_procm_proc_to');
        $from.datetimepicker({
            format: 'Y-m-d',
            timepicker: false,
            closeOnDateSelect: true,
            onShow: function () {
                this.setOptions({ maxDate: $to.val() ? $to.val().replace(/[-]/g, '/') : bjToday() });
            }
        });
        $to.datetimepicker({
            format: 'Y-m-d',
            timepicker: false,
            closeOnDateSelect: true,
            onShow: function () {
                this.setOptions({ maxDate: bjToday(), minDate: $from.val() ? $from.val().replace(/[-]/g, '/') : false });
            }
        });
    }

    // =====================================================================
    // 添加（PL-04 §5.4）
    // =====================================================================

    /** 打开添加弹窗：每次都是空表单 */
    function openAdd() {
        var $m = $find('#procmProcAddModal');
        if (!$m.length) {
            return;
        }
        S.addCtx = { busy: false };
        $m.find('.js_procm_proc_addpath, .js_procm_proc_addhash').val('');
        updateAddAuto();
        $m.find('.js_procm_proc_adderr').hide().text('');
        $m.find('.js_procm_proc_addok').prop('disabled', false);
        $m.modal('show');
    }

    /** 边输边识别：进程名（路径最后一段）、哈希算法（按长度） */
    function updateAddAuto() {
        var $m = $find('#procmProcAddModal');
        var path = $m.find('.js_procm_proc_addpath').val();
        var hash = $m.find('.js_procm_proc_addhash').val();
        var name = nameOf(path, S.eptype);
        $m.find('.js_procm_proc_addname').text(name || '填写进程路径后自动识别').toggleClass('procm-proc-auto-on', !!name);
        var a = algoOf(hash);
        $m.find('.js_procm_proc_addalgo').text(algoText(hash))
            .toggleClass('procm-proc-auto-on', a >= 0)
            .toggleClass('procm-proc-auto-bad', a < 0 && trim(hash) !== '');
    }

    /**
     * 点「添加」：检查（checkAdd）→ 调添加接口
     *   成功：关弹窗、提示、重取；失败：core.js 已弹原因，弹窗留着可改。请求回来之前按钮置灰（防连点）
     */
    function submitAdd() {
        var ctx = S.addCtx;
        var $m = $find('#procmProcAddModal');
        if (!ctx || ctx.busy || !$m.length) {
            return;
        }
        var r = checkAdd($m.find('.js_procm_proc_addpath').val(), $m.find('.js_procm_proc_addhash').val(), S.eptype, S.procs);
        var $err = $m.find('.js_procm_proc_adderr');
        if (r.err) {
            $err.text(r.err).show();
            return;
        }
        $err.hide().text('');
        var token = S.token;
        var listName = S.tx.name;   // 提交这一刻的名单叫法（请求回来时可能已切到别的名单页）
        var $ok = $m.find('.js_procm_proc_addok');
        ctx.busy = true;
        $ok.prop('disabled', true);
        RsCore.ajax(URL_ADD, { pid: S.pid, policytype: S.cfg.type, propath: r.path, filehash: r.hash, algo: r.algo }, function () {
            // 接口已经做成了：提示照弹
            RsCore.msg.success('已添加进程「' + r.name + '」，回' + listName + '列表点「发布」后终端生效');
            if (token !== S.token) {
                return;   // 已离开本视图
            }
            if (S.addCtx === ctx) {
                $m.modal('hide');
            }
            fetch(false);
        }, function () {
            // complete：成功、失败、网络层失败都会到这里；还是这一次的弹窗就把按钮恢复
            ctx.busy = false;
            if (token === S.token && S.addCtx === ctx) {
                $ok.prop('disabled', false);
            }
        });
    }

    // =====================================================================
    // 移除、恢复（PL-04 §5.5）
    // =====================================================================

    /** 按 ID 在最近一次的进程行里找这一行 */
    function procById(id) {
        var n = toInt(id);
        var list = S.procs || [];
        for (var i = 0; i < list.length; i++) {
            if (list[i].ID === n) {
                return list[i];
            }
        }
        return null;
    }

    /**
     * 移除 / 恢复（都不弹确认，照 demo）：同一时刻只处理一个，处理中再点不响应
     *   成功后重取，不弹成功提示（demo 没有）；失败 core.js 弹原因（ACL 没补时是全局钩子弹的一句，PL-04 F-2）
     *   「处理中」一直到重取回来才解开：否则重取回来之前再点别的行，「至少保留 1 个」会按旧数据算，可能把进程删光
     * @param kind 'remove' / 'restore'
     */
    function doRowOp(kind, id) {
        if (S.busy || !S.$pane) {
            return;
        }
        var row = procById(id);
        if (!row) {
            return;
        }
        var url;
        var param;
        if (kind === 'remove') {
            if (row.STATE === 'pending') {
                return;   // 待移除的行没有「移除」
            }
            if (S.stale) {
                // 上一次移除 / 恢复成功后进程行还没重新取到（重取失败，或被「刷新」顶掉还没回来）：
                // 按旧数据算「至少保留 1 个」可能放行把进程删光，先拦住（内审第 1 轮低 1）
                RsCore.msg.warn('进程列表还没刷新，请点右侧「刷新」后再移除');
                return;
            }
            var msg = removeBlockMsg(S.procs, S.tx.keepOne);
            if (msg) {
                RsCore.msg.warn(msg);
                return;
            }
            url = URL_DEL;
            param = { pid: S.pid, policytype: S.cfg.type, ids: String(row.ID) };   // 逗号分隔字符串的写法（一个 ID 就是一个数字，PL-04 F-13）
        } else {
            if (row.STATE !== 'pending') {
                return;   // 只有待移除的行能恢复
            }
            url = URL_RESTORE;
            param = { id: row.ID, policytype: S.cfg.type };
        }
        var token = S.token;
        var ok = false;   // 接口成功了没有
        S.busy = true;
        RsCore.ajax(url, param, function () {
            ok = true;
            if (token === S.token) {
                S.stale = true;   // 进程行重新取到之前，页面上的是旧数据（见 S.stale）
                fetch(false, function () {
                    S.busy = false;   // 重取回来（不管成败）才解开
                });
            }
        }, function () {
            // complete：失败、被 ACL 拒绝、网络层失败时在这里解开「处理中」；成功时等重取回来再解开（见上）
            if (!ok && token === S.token) {
                S.busy = false;
            }
        });
    }

    // =====================================================================
    // 事件（都挂在本视图容器上，命名空间 .procmProc）
    // =====================================================================
    function initEvent() {
        var $p = S.$pane;
        $p.find('select').selectric({ inheritOriginalWidth: true });
        initDatePicker();

        $p.on('click' + NS, '.js_procm_proc_back', function () {
            if (typeof S.onBack === 'function') {
                S.onBack();
            }
            return false;
        });
        $p.on('click' + NS, '.js_procm_proc_overview', function () {
            if (typeof S.onOverview === 'function') {
                S.onOverview();
            }
            return false;
        });
        $p.on('click' + NS, '.js_procm_proc_refresh', function () {
            fetch(false);
            return false;
        });
        $p.on('click' + NS, '.js_procm_proc_delta', function () {
            pickDelta($(this).attr('data-chg'));
            return false;
        });
        $p.on('click' + NS, '.js_procm_proc_chips > a', function () {
            pickChip($(this));
            return false;
        });
        $p.on('click' + NS, '.js_procm_proc_search', function () {
            applyInput();
            return false;
        });
        $p.on('keydown' + NS, '.js_procm_proc_kw', function (e) {
            if (e.keyCode === 13) {   // 回车 = 点「筛选」
                e.preventDefault();
                applyInput();
            }
        });
        $p.on('submit' + NS, '.js_procm_proc_form', function () {
            return false;
        });
        $p.on('click' + NS, '.js_procm_proc_reset', function () {
            resetCond();
            return false;
        });
        // 换字段：只换关键字框的占位文字，点「筛选」才生效
        $p.on('change' + NS, '.js_procm_proc_field', function () {
            $find('.js_procm_proc_kw').attr('placeholder', KW_PLACEHOLDER[$(this).val()] || KW_PLACEHOLDER.path);
        });
        // 表格里的「移除」「恢复」
        $p.on('click' + NS, '.js_procm_proc_remove', function () {
            doRowOp('remove', $(this).attr('data-id'));
            return false;
        });
        $p.on('click' + NS, '.js_procm_proc_restore', function () {
            doRowOp('restore', $(this).attr('data-id'));
            return false;
        });
        // 添加弹窗
        $p.on('click' + NS, '.js_procm_proc_add', function () {
            openAdd();
            return false;
        });
        $p.on('input' + NS + ' keyup' + NS, '.js_procm_proc_addpath, .js_procm_proc_addhash', function () {
            updateAddAuto();
        });
        $p.on('click' + NS, '.js_procm_proc_addok', function () {
            submitAdd();
            return false;
        });
        $p.on('click' + NS, '.js_procm_proc_addcancel', function () {
            $find('#procmProcAddModal').modal('hide');
            return false;
        });
        // 弹窗关掉（成功、取消、叉、Esc）：清这一次的上下文；只认弹窗自己的事件
        $p.on('hidden' + NS, '#procmProcAddModal', function (e) {
            if (e.target === this) {
                S.addCtx = null;
            }
        });
        $(window).on('resize' + NS, function () {
            resize();
        });
    }

    // =====================================================================
    // 对外
    // =====================================================================

    /** 打开进程视图（见文件头第一节）；返回 true = 打开了 */
    function open(pane, opts) {
        release();   // 上一次的先收干净
        var $p = $(pane);
        if (!$p.length || !opts || !opts.cfg || !opts.row) {
            return false;
        }
        S.$pane = $p;
        S.token = {};
        S.cfg = opts.cfg;
        S.row = opts.row;
        S.pid = toInt(opts.row.PID);
        S.eptype = toInt(opts.row.EPTYPE) === 1 ? 1 : 2;
        S.tx = texts(opts.cfg, S.eptype);
        S.procs = null;
        S.loadFailed = false;
        S.stale = false;
        S.cond = $.extend({}, EMPTY_COND);
        S.busy = false;
        S.addCtx = null;
        S.onBack = opts.onBack;
        S.onOverview = opts.onOverview;
        $p.html(mustache.render(tpl, S.tx));   // 模板里只有本文件拼的文案（mustache {{}} 会转义）
        // 「手动添加进程」弹窗按住标题能拖动（10-25，照策略中心；写法和原因见 list.js init 里同一处说明）。
        // 只绑本视图容器里的标题：名单页那 5 个弹窗由 list.js 绑过，再绑一次会重复
        RsCore.alertBoxDrag($p.find('.alert_drag'));
        drawInfo();                              // 先用列表这一行画信息条，取数回来再重画（PL-04 §5.1）
        initTable();
        initEvent();
        fetch(true);
        return true;
    }

    /**
     * 离开进程视图（返回列表、离开名单页）时收尾：可以重复调，没打开过也能调
     *   作废取数序号和标记（没回来的请求结果丢掉）；关添加弹窗（遮罩在 body 上）；销毁日期选择器（弹层挂在 body 上）、
     *   下拉美化、表格（含列宽拖拽）；解绑本视图的全部事件（含 window 上的）；清空容器
     */
    function release() {
        var $p = S.$pane;
        S.token = null;
        S.seq++;
        S.addCtx = null;
        S.busy = false;
        $(window).off('resize' + NS);
        if ($p) {
            var $m = $p.find('#procmProcAddModal');
            var m = $m.data('modal');   // bootstrap 2 弹窗对象：没打开过就没有
            if (m && m.isShown) {
                $m.modal('hide');
            }
            try {
                $p.find('.js_procm_proc_from, .js_procm_proc_to').datetimepicker('destroy');
            } catch (e1) {
                // 日期控件没建起来时忽略
            }
            try {
                $p.find('select').selectric('destroy');
            } catch (e2) {
                // 下拉美化没建起来时忽略
            }
            var $t = $p.find('#procmProcTable');
            try {
                $t.colResizable({ disable: true });   // 关掉列宽拖拽（照 list.js destroy）
            } catch (e3) {
                // 列宽拖拽没开时忽略
            }
            try {
                $t.bootstrapTable('destroy');
            } catch (e4) {
                // 表格没建起来时忽略
            }
            $p.off(NS).empty();
        }
        S.$pane = null;
        S.row = null;
        S.procs = null;
        S.loadFailed = false;
        S.stale = false;
        S.onBack = null;
        S.onOverview = null;
    }

    return {
        open: open,
        release: release,
        // 纯函数，给 node 单测（页面不用）
        _test: {
            texts: texts,
            nameOf: nameOf,
            algoOf: algoOf,
            algoText: algoText,
            normPath: normPath,
            findDup: findDup,
            checkAdd: checkAdd,
            removeBlockMsg: removeBlockMsg,
            clampPage: clampPage,
            hasCond: hasCond
        }
    };
});
