/**
 * 进程管控 · 白名单 / 黑名单列表页的「已应用组」弹窗（10-23 新增；设计文档 01 §8.5「应用范围」列）
 *
 * 一、做什么
 *   名单列表「应用范围」列里点「组【 N 】」，弹出这个窗口，列出这条名单应用到了哪些组、每组有多少终端、已下发 / 未下发多少台。
 *   外观照策略中心策略列表点「组【 N 】」弹出的「已应用组」窗口（strategy/seeGroup/seeGroup.html + seeGroup.js）。
 *
 * 二、为什么不直接调策略中心的 seeGroup.js（10-23 评估）
 *   ① 它的接口地址写死成 Policycenter/showUsedGroup（级联时换成 adminSubPolicy/getUsedGroup），换不成名单的 Procmanager/showUsedGroup；
 *   ② 它从每行第一列的 data-row 属性取策略编号，名单列表没有这个属性；
 *   ③ 它的「已下发 / 未下发」能点开下发详情，调的是 Policycenter/getEpIssuedStatus，那个接口不认进程管控的产品号，数会对不上；
 *   ④ 它被策略中心和 9 个产品策略页共用，是同事的文件，不去改它；而且它把弹窗放进公共布局的 #seeGroupBox、id 是 #seeGroup，
 *      别的页面打开过之后 #seeGroup 一直留在页面上，名单页再用同一个 id 会撞。
 *   所以：弹窗外壳照抄进 list.html（id 换成 procmSeeGroup 开头，外面套 .strategy_content.policy-form，直接吃策略中心同一套样式），
 *   列的样子照抄 strategy/colums.js 的 groupList，请求和交互由本文件自己做。
 *
 * 三、接口 Procmanager/showUsedGroup（101 后端，10-23 核实代码）
 *   入参：pid 名单 PID（必传）、policytype 2 白 / 3 黑（可省，传了后端会校验）、groupName 组名模糊查询、
 *         offset / limit 分页、sort 排序字段、order ASC / DESC。系统类型后端从库里取，不用传。
 *   出参：data = { rows: [{OBJID, GROUPNAME 组全路径, EPNUM 终端数, UPDATETIME 应用时间, yixiafa 已下发, weixiafa 未下发, ...}], total }
 *   失败：r.code 非 0（参数错误、名单不存在等），弹后端给的原因、表格显示空。
 *
 * 四、和策略中心的不同
 *   ① 「已下发 / 未下发」只显示数字（绿 / 红），不能点：后端没有名单自己的下发详情接口，借策略中心的数对不上（10-23 用户定）；
 *   ② 点「查询」从第 1 页开始查（策略中心在第 3 页点查询会停在第 3 页）；
 *   ③ 「已下发」表头悬停有说明：发布名单后该组的已下发记录会先清零，等终端下次心跳重新拉取后才回升，免得看成没下发成功。
 *
 * 五、对外 3 个函数（写法照同目录 bwlistModal.js）
 *   bind($view)  名单页 init 渲染完 list.html 后调：在页面容器上用事件委托绑「查询」按钮、输入框回车、弹窗关闭，
 *                命名空间 .procmSeeGroup；先 off 再绑，重复调用不会重复绑定。
 *   open(opts)   点「组【 N 】」时调。opts = { pid 名单 PID, pname 名单名称, policytype 2 / 3 }；
 *                弹窗不在页面上或 pid 不对时返回 false，成功打开返回 true。
 *   release()    名单页 destroy 里调：弹窗开着就关掉（去掉 body 上的遮罩），销毁表格，清掉上下文。
 *
 * 写法：RequireJS AMD 模块，只用 ES5（不用 let / const / 箭头函数 / 模板字符串 / class）。
 * 表格组件 bootstrap-table 由 list.js 先加载（require('table')），这里不再 require，免得同一个插件按两个路径加载两遍。
 */
define(function (require) {
    require('util_b');

    /** 接口：名单的已应用组列表（带已下发 / 未下发数） */
    var URL_USED_GROUP_LIST = 'Procmanager/showUsedGroup';

    /** 弹窗和里面元素的选择器（都在 list.html 里，id 用 procmSeeGroup 开头，不和策略中心的 #seeGroup、#see_group 重名） */
    var SEL_MODAL = '#procmSeeGroup';
    var SEL_TABLE = '#procmSeeGroupTable';
    var SEL_KW = '.js_procm_sg_kw';          // 组名称输入框
    var SEL_SEARCH = '.js_procm_sg_search';  // 「查询」按钮
    var SEL_TITLE = '.js_procm_sg_title';    // 标题

    /** 「已下发」表头的悬停说明（口径见 101 后端 getWBListUsedGroups 注释：发布 / 删除名单会清掉该组的已下发记录） */
    var TIP_DELIVERED = '组内已拉取到这条名单的终端数。发布名单后会先清零，终端下次心跳（默认 5 分钟内）重新拉取后回升';

    /** 名单页容器（bind 时记下）；当前这次打开的上下文 { pid, policytype, kw 当前生效的查询关键字, offset 当前页从第几条开始 } */
    var $view = null;
    var ctx = null;

    /** 转义成 HTML 文本（组名称是用户起的，可能带 < > 等字符） */
    function esc(v) {
        if (v === null || v === undefined) {
            return '';
        }
        return util_b.escapeHTML(String(v));
    }

    /** 转成整数，转不了按 0 */
    function toInt(v) {
        var n = parseInt(v, 10);
        return isNaN(n) ? 0 : n;
    }

    /**
     * 列：照策略中心 strategy/colums.js 的 groupList（序号 / 组名称 / 终端数量 / 应用时间 / 已下发 / 未下发），
     * 只是去掉了「已下发 / 未下发」的点击（见文件头第四节）。
     * 注意：表格组件会先把字符串字段转义一次再交给 formatter（bootstrap-table.js「添加防XSS注入处理」），
     *   所以和 list.js 一样，一律从 row 里取原始值、自己 esc 一次，不用 formatter 的第一个参数，免得显示成 &lt;。
     */
    function getColumns(myCtx) {
        return [{
            width: 50,
            title: '序号',
            field: 'PROCM_SG_SEQ',
            align: 'center',
            formatter: function (value, row, index) {
                // 序号接着分页往下数：第 2 页从 11 开始。照策略中心：发请求时记下 offset（见 queryParams），这里加上它
                return '<div>' + (index + 1 + toInt(myCtx.offset)) + '</div>';
            }
        }, {
            field: 'GROUPNAME',
            title: '组名称',
            width: 180,
            align: 'left',
            formatter: function (value, row) {
                if (row.GROUPNAME === undefined || row.GROUPNAME === null) {
                    return '---';
                }
                var name = esc(row.GROUPNAME);
                return '<div title="' + name + '">' + name + '</div>';
            }
        }, {
            field: 'EPNUM',
            title: '终端数量',
            align: 'center',
            formatter: function (value, row) {
                return (row.EPNUM === undefined || row.EPNUM === null) ? '---' : '<div>' + toInt(row.EPNUM) + '</div>';
            }
        }, {
            field: 'UPDATETIME',
            title: '应用时间',
            align: 'center',
            sortable: true,   // 照策略中心：只有应用时间能点表头排序（后端排序字段白名单里有 UPDATETIME）
            width: 150,
            formatter: function (value, row) {
                if (row.UPDATETIME === undefined || row.UPDATETIME === null) {
                    return '---';
                }
                var t = esc(row.UPDATETIME);
                return '<div title="' + t + '">' + t + '</div>';
            }
        }, {
            field: 'yixiafa',
            title: '<span title="' + TIP_DELIVERED + '">已下发</span>',
            align: 'center',
            formatter: function (value, row) {
                if (row.yixiafa === undefined || row.yixiafa === null) {
                    return '---';
                }
                var n = toInt(row.yixiafa);
                // 大于 0 绿色（照策略中心），但不能点，所以不用策略中心带手型的 .gree，用名单页自己的类
                return '<div' + (n > 0 ? ' class="procm-sg-yes"' : '') + '>' + n + '</div>';
            }
        }, {
            field: 'weixiafa',
            title: '未下发',
            align: 'center',
            formatter: function (value, row) {
                if (row.weixiafa === undefined || row.weixiafa === null) {
                    return '---';
                }
                var n = toInt(row.weixiafa);
                // 大于 0 红色（照策略中心 .red），同样不能点
                return '<div' + (n > 0 ? ' class="procm-sg-no"' : '') + '>' + n + '</div>';
            }
        }];
    }

    /**
     * 建表格。配置照策略中心 strategy/createTable.js（分页、每页 10 条、高 340、空数据文案「当前暂无数据～」），
     * 不直接调 createTable.js：它按另一个路径再加载一遍表格插件，而且只对 code=1 报错（后端「名单不存在」是 code=2）。
     * 请求用表格自带的 ajax（插件会带上登录令牌 RSTOCKEN，并登记到 RsCore.ajaxList，切页面时统一取消）。
     */
    function createTable(myCtx) {
        $view.find(SEL_TABLE).bootstrapTable({
            url: RsCore.ajaxPath + URL_USED_GROUP_LIST,
            method: 'post',
            contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
            queryParams: function (params) {
                // params 是表格给的 offset / limit / sort / order；sort 固定 UPDATETIME（照策略中心），order 随表头点击变
                myCtx.offset = params.offset ? params.offset : 0;   // 记下这一页从第几条开始，算序号用
                return {
                    pid: myCtx.pid,
                    policytype: myCtx.policytype,
                    groupName: myCtx.kw,
                    offset: params.offset ? params.offset : 0,
                    limit: params.limit ? params.limit : 10,
                    sort: 'UPDATETIME',
                    order: params.order ? params.order : 'desc'
                };
            },
            responseHandler: function (res) {
                var empty = { rows: [], total: 0 };
                if (myCtx !== ctx) {
                    return empty;   // 弹窗已关或已换成另一条名单：这次的结果不要了
                }
                if (!res || !res.r) {
                    return empty;
                }
                if (res.r.code !== 0) {
                    // 参数错误、名单不存在等：弹后端给的原因（照策略中心 createTable 的写法）
                    RsCore.msg.error(res.r.msg || '查询已应用组失败');
                    return empty;
                }
                var data = res.data;
                if (!data || !$.isArray(data.rows)) {
                    return empty;
                }
                return { rows: data.rows, total: toInt(data.total) };
            },
            onLoadError: function (status) {
                if (myCtx === ctx) {
                    RsCore.reqTableError(status);   // 登录超时等，照策略中心
                }
            },
            columns: getColumns(myCtx),
            cache: false,
            search: false,
            showRefresh: true,          // 工具栏被策略中心样式「.modal_type_one .fixed-table-toolbar」隐藏，照 createTable 保留配置
            showColumns: true,
            pagination: true,
            pageSize: 10,
            height: 340,
            countCheck: true,
            showHeader: true,
            sidePagination: 'server',
            showCustomSearch: true,
            showPaginationSwitch: false,
            clickToSelect: false,
            // 策略中心 createTable 写的是 true（勾选框美化插件 iCheck，seeGroup.js 自己 require 了它）；
            // 这张表没有勾选框，名单页也没加载 iCheck，开着会在建表时报「iCheck is not a function」、表格建不起来（10-23 101 实测）
            useIcheck: false,
            customSearchBoxOpen: false,
            hideCheckNum: true,
            hideExportIcon: true,
            showPaginL: false,
            hidePageInfo: true,
            formatNoMatches: function () {
                return '当前暂无数据～';
            }
        });
    }

    /** 销毁表格（还没建过时什么都不做） */
    function destroyTable() {
        if (!$view) {
            return;
        }
        var $t = $view.find(SEL_TABLE);
        if ($t.data('bootstrap.table')) {
            $t.bootstrapTable('destroy');
        }
    }

    /** 点「查询」或输入框回车：按输入的组名称从第 1 页重新查 */
    function doSearch() {
        if (!ctx || !$view) {
            return;
        }
        ctx.kw = $.trim($view.find(SEL_MODAL).find(SEL_KW).val() || '');
        $view.find(SEL_TABLE).bootstrapTable('search');   // 插件的 search = 页码回到 1 再请求
    }

    /** 弹窗关掉（叉、Esc）后：清上下文、销毁表格，下次打开重新建 */
    function onHidden() {
        ctx = null;
        destroyTable();
    }

    return {
        bind: function (view) {
            $view = view;
            view.off('.procmSeeGroup');
            view.on('click.procmSeeGroup', SEL_MODAL + ' ' + SEL_SEARCH, function () {
                doSearch();
                return false;
            });
            view.on('keydown.procmSeeGroup', SEL_MODAL + ' ' + SEL_KW, function (e) {
                if (e.keyCode === 13) {
                    e.preventDefault();
                    doSearch();
                }
            });
            // 只认弹窗自己的 hidden（里面的其他组件也可能冒泡同名事件）
            view.on('hidden.procmSeeGroup', SEL_MODAL, function (e) {
                if (e.target === this) {
                    onHidden();
                }
            });
        },

        open: function (opts) {
            var pid = opts ? toInt(opts.pid) : 0;
            if (!$view || pid <= 0) {
                return false;
            }
            var $m = $view.find(SEL_MODAL);
            if (!$m.length) {
                return false;
            }
            destroyTable();
            ctx = { pid: pid, policytype: opts.policytype, kw: '', offset: 0 };
            // 标题照策略中心「已应用组（名称）」；用 text 填，名称不会当 HTML
            var pname = (opts.pname === null || opts.pname === undefined) ? '' : String(opts.pname);
            $m.find(SEL_TITLE).text(pname ? '已应用组（' + pname + '）' : '已应用组');
            $m.find(SEL_KW).val('');
            // 先显示弹窗再建表格：弹窗隐藏时建表，表头列宽量出来是 0
            $m.modal('show');
            createTable(ctx);
            return true;
        },

        release: function () {
            if ($view) {
                var $m = $view.find(SEL_MODAL);
                var m = $m.data('modal');   // bootstrap 2 弹窗对象：没打开过就没有
                if (m && m.isShown) {
                    $m.modal('hide');       // 关掉才会去掉 body 上的遮罩；hidden 里会清上下文、销毁表格
                }
                $view.off('.procmSeeGroup');
            }
            ctx = null;
            destroyTable();
            $view = null;
        }
    };
});
