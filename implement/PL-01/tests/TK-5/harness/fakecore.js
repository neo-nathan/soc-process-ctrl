/*
 * PL-01 TK-5 本地自测用的假 RsCore（只在自测页面用，不进 SOC 源码、不进本仓库）
 * RsCore.ajax 的回调规则照 101 js/core.js:1148-1276：
 *   code=0 → callback(data, code, msg)；code=1 → error + 弹「系统异常」；其他非 0 → error + 弹「错误」（hideMsg 时不弹）；
 *   网络 / HTTP 层失败 → 不调 callback、不调 error，只弹提示；被 abort → 什么都不弹；最后都调 complete(req)。
 *   每次请求都登记到 RsCore.ajaxList 并返回带 abort() 的句柄（照 core.js:1267-1268 core.ajaxList.push($ajax); return $ajax）。
 * 假后端：
 *   Procmanager/getWBList（type 2/3，全部名单；mock real 模式会用包装前的 ajax 调它）
 *   Procmanager/delWBList（照 101 controllers/Procmanager.php delWBListAction 的校验和返回文字）
 *   Group/getGroupTree（分组树：根管理组 / 默认分组 / 服务器 / 服务器下一个开继承、一个不开继承的子组）
 * 名单 PID 按 bwlistMock real 模式按 PID 算出的发布状态挑的（见 ../pickpid.js）：
 *   2、7 已发布；8 待发布；9 有变更（20 +1 -2）；3 --；黑名单 13 已发布、5 待发布
 */
(function () {
    var log = window.__ajaxLog = [];       // 每次 RsCore.ajax 调用（包装前的那一层）
    var msgs = window.__msgLog = [];       // 每次弹提示
    window.__errors = [];                  // 页面上没被捕获的脚本错误
    window.addEventListener('error', function (e) {
        window.__errors.push(String(e.message || e));
    });
    window.__backend = {
        delay: 15,
        delays: {},          // 按地址给的延迟队列：{ 'Group/getGroupTree': [400, 30] }，用一个取一个，取完回到 delay
        noList: false,       // true：不登记到 RsCore.ajaxList（模拟拿不到请求句柄，用来测「过期回调」那条路）
        failDel: 0,          // >0：下一次 delWBList 返回这个 code
        netFailDel: false,   // true：下一次 delWBList 按网络层失败处理
        failTree: 0,         // >0：下一次 Group/getGroupTree 返回这个 code
        rows: null,
        groups: null
    };
    window.__resetBackend = function () {
        var b = window.__backend;
        b.delays = {};
        b.noList = false;
        b.failDel = 0;
        b.netFailDel = false;
        b.failTree = 0;
        b.rows = {
            '2': [
                { PID: '2', PGUID: 'g2', PNAME: 'PL01测试-已发布A', EPTYPE: '2', POLICYTYPE: '2', CREATEUSER: 'optAdmin', CREATETIME: '2026-10-01 10:00:00', DESCRIPTION: 'a', SYSTYPE: 'Linux' },
                { PID: '7', PGUID: 'g7', PNAME: '<img src=x onerror="window.__xss=1">已发布B&"', EPTYPE: '2', POLICYTYPE: '2', CREATEUSER: 'optAdmin', CREATETIME: '2026-10-02 10:00:00', DESCRIPTION: 'b', SYSTYPE: 'Linux' },
                { PID: '8', PGUID: 'g8', PNAME: 'PL01测试-待发布C', EPTYPE: '2', POLICYTYPE: '2', CREATEUSER: 'optAdmin', CREATETIME: '2026-10-03 10:00:00', DESCRIPTION: 'c', SYSTYPE: 'Linux' },
                { PID: '9', PGUID: 'g9', PNAME: 'PL01测试-有变更D', EPTYPE: '2', POLICYTYPE: '2', CREATEUSER: 'optAdmin', CREATETIME: '2026-10-04 10:00:00', DESCRIPTION: 'd', SYSTYPE: 'Linux' },
                { PID: '3', PGUID: 'g3', PNAME: 'PL01测试-空E', EPTYPE: '2', POLICYTYPE: '2', CREATEUSER: 'optAdmin', CREATETIME: '2026-10-05 10:00:00', DESCRIPTION: 'e', SYSTYPE: 'Linux' }
            ],
            '3': [
                { PID: '13', PGUID: 'g13', PNAME: 'PL01测试-黑已发布', EPTYPE: '2', POLICYTYPE: '3', CREATEUSER: 'optAdmin', CREATETIME: '2026-10-01 11:00:00', DESCRIPTION: 'x', SYSTYPE: 'Linux' },
                { PID: '5', PGUID: 'g5', PNAME: 'PL01测试-黑待发布', EPTYPE: '2', POLICYTYPE: '3', CREATEUSER: 'optAdmin', CREATETIME: '2026-10-02 11:00:00', DESCRIPTION: 'y', SYSTYPE: 'Linux' }
            ]
        };
        // 分组树（Group/getGroupTree 的返回形状：id、pId、name、EID、ISINHERIT；tree.js 用 OrganGroupNodeValidator 按 pId、EID 校验）
        b.groups = [
            { id: '1', pId: '0', name: '根管理组', EID: 'E1', ISINHERIT: '0', authp: '1' },
            { id: '2', pId: '1', name: '默认分组', EID: 'E1', ISINHERIT: '0', authp: '1' },
            { id: '3', pId: '1', name: '服务器', EID: 'E1', ISINHERIT: '0', authp: '1' },
            { id: '4', pId: '3', name: '服务器-继承子组', EID: 'E1', ISINHERIT: '1', authp: '1' },
            { id: '5', pId: '3', name: '服务器-独立子组', EID: 'E1', ISINHERIT: '0', authp: '1' }
        ];
    };
    window.__resetBackend();

    function ok(data, msg) {
        return { r: { code: 0, action: 0, msg: msg || '' }, data: data };
    }
    function notice(code, msg) {
        return { r: { code: code, action: 0, msg: msg }, data: '' };
    }
    function backend(url, p) {
        var b = window.__backend;
        if (url === 'Procmanager/getWBList') {
            var t = String(p.type);
            if (t !== '2' && t !== '3') {
                return notice(1, '参数错误。');
            }
            var rows = JSON.parse(JSON.stringify(b.rows[t]));
            return ok({ rows: rows, total: rows.length });
        }
        if (url === 'Procmanager/delWBList') {
            // 照 101 delWBListAction：pid 必须是正整数（code 2）、policytype 2/3（code 3）、名单不存在（code 4）、成功「删除成功。」
            if (!p.pid || !/^\d+$/.test(String(p.pid)) || parseInt(p.pid, 10) <= 0) { return notice(2, '参数错误。'); }
            if (['2', '3'].indexOf(String(p.policytype)) < 0) { return notice(3, '参数错误。'); }
            if (b.netFailDel) { b.netFailDel = false; return 'NETFAIL'; }
            if (b.failDel) { var fd = b.failDel; b.failDel = 0; return notice(fd, '删除失败。'); }
            var list = b.rows['2'].concat(b.rows['3']);
            var hit = null;
            for (var i = 0; i < list.length; i++) {
                if (String(list[i].PID) === String(p.pid)) { hit = list[i]; }
            }
            if (!hit) { return notice(4, '名单不存在。'); }
            var lt = String(hit.POLICYTYPE);
            b.rows[lt] = b.rows[lt].filter(function (r) { return r !== hit; });
            return ok('', '删除成功。');
        }
        if (url === 'Group/getGroupTree') {
            if (b.failTree) { var ft = b.failTree; b.failTree = 0; return notice(ft, '取分组失败'); }
            return JSON.parse(JSON.stringify(ok(b.groups)));
        }
        return notice(9, '假后端没有这个接口：' + url);
    }
    function showMsg(kind, title, content) {
        msgs.push({ kind: kind, title: title, content: content });
        var box = document.getElementById('fakeMsg');
        if (box) {
            box.textContent = '[' + kind + '] ' + (title || '') + ' ' + (content || '');
        }
    }
    function mk(kind) {
        // 记录原样的前两个参数：title = 第一个参数（只传一个时就是提示文字），content = 第二个
        return function (title, content) {
            showMsg(kind, title, content);
        };
    }
    window.GlobaluserInfo = { RSTOCKEN: 'x', level: 8, name: 'optAdmin', product: {}, id: 'U1', eid: 'E1' };
    window.isBM = '0';
    window.RsCore = {
        ajaxPath: '/',
        ajaxList: [],
        cache: { group: { eid: 'E1', list: {} } },
        config: { pageinfo: { processManage: { nav: [{ value: 'overview', name: '概览' }, { value: 'log', name: '日志' }, { value: 'policy', name: '策略' }] } } },
        load: {
            show: function () { window.__loadShow = (window.__loadShow || 0) + 1; },
            hide: function () { window.__loadHide = (window.__loadHide || 0) + 1; }
        },
        msg: { warn: mk('warn'), notice: mk('notice'), success: mk('success'), error: mk('error') },
        validateXss: function (input) {
            input.value = input.value.replace(/[<>&"]/g, '');
        },
        validateUserName: function () {},
        alertBoxDrag: function () {},
        reqTableError: function () {},
        ajaxClean: function () {
            var l = window.RsCore.ajaxList;
            for (var i = 0; i < l.length; i++) { l[i].abort(); }
            window.RsCore.ajaxList = [];
        },
        assist: {
            params2str: function (obj) {
                var arr = [];
                for (var key in obj) {
                    arr.push(key + '=' + encodeURIComponent(obj[key] === undefined ? '' : obj[key]));
                }
                return arr.join('&');
            },
            str2json: function (str) {
                var o = {};
                if (!str) {
                    return o;
                }
                var arr = str.split('&');
                for (var i = 0; i < arr.length; i++) {
                    var eq = arr[i].indexOf('=');
                    var k = eq < 0 ? arr[i] : arr[i].substring(0, eq);
                    o[k] = eq < 0 ? '' : decodeURIComponent(arr[i].substring(eq + 1));
                }
                return o;
            },
            getUrlSearchQuerys: function () {
                var h = window.location.hash;
                var i = h.indexOf('?');
                return i < 0 ? {} : window.RsCore.assist.str2json(h.substring(i + 1));
            }
        },
        ajax: function (url, param, callback, complete, error) {
            if (arguments.length === 2 && typeof param === 'function') {
                callback = param;
                param = '';
            }
            var p = param || {};
            var b = window.__backend;
            var entry = { url: url, param: JSON.parse(JSON.stringify(p)), aborted: false, done: false };
            log.push(entry);
            var q = b.delays[url];
            var delay = (q && q.length) ? q.shift() : b.delay;
            var handle = {
                abort: function () {
                    if (entry.done) { return; }   // 已经回来了：取消不起作用（照 jQuery）
                    entry.aborted = true;
                    entry.done = true;
                    clearTimeout(timer);
                    // 照 core.js：error 分支看到 statusText = abort 就直接 return（不弹提示），complete 照调
                    if (complete) { complete({ status: 0, statusText: 'abort' }); }
                }
            };
            var timer = setTimeout(function () {
                if (entry.done) { return; }
                entry.done = true;
                var json = backend(url, p);
                if (json === 'NETFAIL') {
                    showMsg('warn', '系统异常 , 请稍后再试！');
                    if (complete) { complete({ status: 0, statusText: 'error' }); }
                    return;
                }
                var r = json.r;
                if (r.code === 0) {
                    if (callback) { callback(typeof json.data !== 'undefined' ? json.data : json, r.code, r.msg); }
                } else if (r.code === 1) {
                    if (error) { error(json.data, r.code, r.msg); }
                    showMsg('warn', '系统异常,请联系管理员！', r.msg);
                } else {
                    if (error) { error(json.data, r.code, r.msg); }
                    if (!p.hideMsg) {
                        showMsg('warn', '错误', r.msg);
                    }
                }
                if (complete) { complete({ status: 200 }); }
            }, delay);
            if (!b.noList) {
                window.RsCore.ajaxList.push(handle);
            }
            return handle;
        }
    };
    window.__originalAjax = window.RsCore.ajax;
})();
