/**
 * 进程管控 · 白名单 / 黑名单列表页（PL-01 TK-3；设计文档 01 §8.5、§8.8）
 *
 * 一、白、黑两页共用这一份代码
 *   左侧菜单「白名单」「黑名单」都指向路由 processManage/list，参数 tab=white / tab=black（PL-01 F-2）。
 *   本文件按 tab 取 TAB_CFG 里的配置：白 → 接口参数 type=2，黑 → type=3；页面上随白 / 黑变化的文案都从配置里取。
 *
 * 二、数据从哪来
 *   表格用 bootstrapTable 的 ajax 选项自己发请求，请求走 RsCore.ajax（PL-01 §4.1）：
 *     - 名单列表 Procmanager/getWBList 走真接口（PL-03）：页面条件 op.cond 发请求前由 bwlistAdapter.toQuery 转成后端参数，
 *       返回的行由 bwlistAdapter.toList 转成页面字段、排序、再做后端做不了的两项筛选（关键字、无变更）；
 *       后端参数名、字段名再变，只改 bwlistAdapter.js，本文件不动（PL-03 R-1）；
 *     - 发布 Procmanager/releaseWBList 走真接口（10-23 切换，不再经 mock）；
 *     - 应用到组也走真接口（10-23 切换）：取已选组 Policycenter/getUsedGroupId、提交 Procmanager/usedGroup；
 *     - 「应用范围」列点「组【 N 】」弹出的已应用组（10-23）：Procmanager/showUsedGroup，请求和弹窗逻辑都在同目录 bwlistUsedGroup.js；
 *     - bwlistMock 的开关已关（bwlistMock.js 里 ENABLED=false）：install() 什么都不做，remember 只记行、没人用；
 *       这两处调用暂时留着，等确认真接口稳定后连同 bwlistMock.js 一起删。
 *   RsCore.ajax 只在 code=0 时调成功回调，而表格要 success / error / complete 三个回调，所以 tableAjax 做适配：
 *     成功 → 把结果包回 {r, data} 交给 success；失败 → 调 error；两种情况都调 complete（否则表格一直转圈）。
 *     「失败」包括两类：接口返回非 0 的 code（core.js 会调 error 回调）；网络 / HTTP 层失败、登录过期、返回格式不对
 *     （core.js 只调 complete、不调 error）——后一类由 tableAjax 在 complete 里补调一次 error（PL-01 TK-4）。
 *   每次列表返回都先过 bwlistAdapter.toList（逐行 toRow），页面只读转换之后的字段（PL-01 R-3）。
 *   接口失败时 core.js 已经弹过「错误」+ 原因，页面的 error 回调里不再弹第二次（PL-01 F-12）。
 *
 * 三、本文件负责的页面行为（PL-01 §五）
 *   面包屑、工具栏（系统类型筛选已隐藏、固定传 Linux/信创；创建按钮；右侧高级搜索 / 刷新 / 列设置用 bootstrapTable 自带的）、
 *   高级查询（4 行点选点了立刻查；指定日期、名称关键字点「筛选」才查；「重置」）、
 *   9 列（10-23 去掉「创建人」）、折叠（点行在下面插一行按钮，同时只展开一行，再点收起，照 strategy/openLine.js 的交互；整行鼠标是手型）、
 *   展开行的 5 个按钮（编辑 / 进程 / 应用到组 / 发布 / 删除）、空结果文案、发布状态的悬停说明（10-23 去掉了底部统计）。
 *
 * 四、按钮的处理函数（op.actions）
 *   op.actions 里每个按钮一个处理函数。展开行按钮的签名 function (row, $btn)：row 是这一行（toRow 之后的数据），
 *   $btn 是被点的按钮；工具栏「创建…」是 create()，不带参数。
 *     create（工具栏「创建…」）、edit（编辑）→ PL-02 TK-1：用本页自带的弹窗 #procmListModal（在 list.html 里），
 *       打开、名称必填检查、调 createWBList / editWBList、防连点、关闭、离开页面时收尾由同目录 bwlistModal.js 负责，
 *       本文件只给标题、模式、参数和白 / 黑两份文案，保存成功后刷新本页表格（见 openListModal）。
 *       （PL-01 TK-4 时借用的是公共布局里的「新建名单」弹窗，同事部署公共文件时会被盖掉，PL-02 改成名单页自带，
 *       本文件不再依赖公共布局模块。）
 *     group（应用到组）、publish（发布）、del（删除）及按钮置灰规则 → PL-01 TK-5 已实现，见下面第五节；
 *     proc（进程）→ PL-04：在名单页里换成进程视图（同目录 bwlistProc.js，不新开路由，PL-04 Q1）：
 *       收起展开行、收起说明框，隐藏面包屑 / 主体，显示空容器 .js_procm_procpane，调 bwlistProc.open；
 *       点「返回」（或面包屑「白名单」）→ bwlistProc.release → 隐藏进程视图 → 只显示面包屑 / 主体（说明框不跟着显示）
 *       → 表格量一次高度 → 刷新列表（条件、页码不变）；离开名单页时 destroy 里先 bwlistProc.release（见 openProc / closeProc）。
 *   展开行按钮的 HTML：<li class="procm-op procm-op-<名字> js_procm_op" data-op="<名字>" data-index="<行号>" data-pid="<PID>">，
 *   灰色（不能点）的按钮多一个 procm-op-off；按钮的悬停说明写在 title 里（见 opStates）。
 *   点击由页面容器上的事件委托统一分发（见 initEvent）；灰色按钮点了不做事。刷新表格调 op.reload()，取某一行调 op.getRow(行号)。
 *
 * 五、发布、删除、应用到组（PL-01 TK-5：§五 规则表与「发布」「删除」「应用到组」、§4.3～4.6；设计 01 §7.2、§7.5、§7.6、§8.8 第 2、12 条）
 *   按钮置灰：照 §五 规则表（= 设计 7.2），按这一行的发布状态算，见 opStates；编辑、删除任何状态都能点。
 *   发布：确认弹窗 #procmPublishModal（外壳照策略中心 #delStrategy，PL-01 F-13）→ Procmanager/releaseWBList（pid、policytype；
 *         真接口，10-23 起）→ 成功弹提示、关弹窗、刷新表格。
 *         提示不用后端的「发布成功。」，由前端按返回的 OBJCOUNT 拼（见 publishOkMsg）：> 0 = 已推给应用了的组 / 终端，
 *         弹「已发布，组内终端下次心跳（默认 5 分钟内）生效」；= 0 弹「已发布，应用到组后下发」（设计 8.8 第 12 条）。
 *         后端拒绝（没有进程 code 5、没有改动 code 6、打包或写库失败 code 7 等）时 core.js 弹「错误」+ 后端原因。
 *   删除：确认弹窗 #procmDelModal（同上）→ Procmanager/delWBList（pid、policytype；真接口，PL-01 F-4）→ 同上。
 *   应用到组：只有「已发布」能点；弹窗 #procmSetGroup（外壳照策略中心 #setGroup，PL-01 F-11），分组树用公共组件
 *         strategy/tree.js 的 createTree 画（取已选组 Policycenter/getUsedGroupId，真接口，要带非空的 productid）；
 *         点「应用」→ Procmanager/usedGroup（pid、policytype、aObjId = 勾选的全部组的 JSON 字符串，真接口）；
 *         原来没有组、现在也没勾时直接关、不发请求（照策略中心）。
 *   三处都不做二次认证（PL-01 Q1）；接口失败时 core.js 已经弹过「错误」+ 原因，这里不再弹（PL-01 F-12），弹窗留着可以再点或取消。
 *   离开页面（destroy）：先关掉开着的弹窗（遮罩是加在 body 上的，要靠关弹窗去掉），取消还没回来的分组树请求，
 *         再把分组树从 zTree 的登记表里去掉（只去掉名单页自己这棵 #procmGroupTree），不在页面外留下东西。策略中心的文件一个不改。
 *
 * 写法：RequireJS AMD 模块，只用 ES5（不用 let / const / 箭头函数 / 模板字符串 / class）。
 */
define(function (require) {
    var tpl = require('text!processManage/list.html');
    var mustache = require('mustache');
    var bwlistMock = require('processManage/bwlistMock');
    /** 名单列表真接口的参数 / 字段转换（PL-03 Q4） */
    var bwlistAdapter = require('processManage/bwlistAdapter');
    // 名单页自带的创建 / 编辑弹窗（PL-02 TK-1）：bind / open / release 三个函数，弹窗 HTML 是 list.html 里的 #procmListModal
    var bwlistModal = require('processManage/bwlistModal');
    // 名单进程视图（PL-04）：open / release 两个函数，模板是同目录 bwlistProc.html，画在 list.html 的空容器 .js_procm_procpane 里
    var bwlistProc = require('processManage/bwlistProc');
    // 「已应用组」弹窗（10-23）：bind / open / release 三个函数，弹窗 HTML 是 list.html 里的 #procmSeeGroup，接口 Procmanager/showUsedGroup
    var bwlistUsedGroup = require('processManage/bwlistUsedGroup');
    // 公共分组树组件（策略中心、计划任务等都在用）：「应用到组」弹窗只调它公开的 createTree、getCheckedIds，不改它（设计 01 §7.5、PL-01 F-11）
    var tree = require('strategy/tree');
    require('colResizable');
    require('table');
    require('css!table');
    require('util_b');
    require('datetimepicker');
    require('css!datetimepicker');
    require('selectric');
    require('css!selectric');
    // 名单页自己的样式。计划写的 css!../css/processManageList 实测会被 RequireJS 的 css 别名截走（404，PL-01 R-5 先行实测），
    // 所以照现有代码的绝对路径写法（如 css!/public/dep/table/bootstrap-table.css）；require-css 插件本身就是在页面里动态插 <link>
    require('css!/public/esm/css/processManageList.css');

    var getUrlSearchQuerys = RsCore.assist.getUrlSearchQuerys;
    var str2json = RsCore.assist.str2json;

    // =====================================================================
    // 常量与配置
    // =====================================================================

    /** 名单列表接口：真接口（PL-03），参数和返回字段经 bwlistAdapter 转换 */
    var URL_LIST = 'Procmanager/getWBList';

    /**
     * 发布、应用到组、删除用的接口（PL-01 §4.3～4.6）：
     *   全部是真接口（应用到组 10-23 由 mock 的 getWBListUsedGroupId / setWBListGroups 切过来）
     */
    var URL_PUBLISH = 'Procmanager/releaseWBList';            // 发布：pid、policytype（真接口，10-23 由 mock 的 publishWBList 切过来）
    // 应用到组弹窗取已选组：分组树组件自己发（pid、productid、eptype）。
    //   后端没有名单专用的取已选组接口，复用策略中心的：它按 pid 读 POLICYOBJECT（名单的组也存在这张表），
    //   返回 {aUsedGroupId:[{OBJID, ISLOCK}], aLockGroupId:[]}，正好是分组树要的格式；productid 为空会报「参数错误」
    var URL_USED_GROUP = 'Policycenter/getUsedGroupId';
    // 应用到组提交：pid、policytype、aObjId（勾选的全部组）。只有已发布的名单能改；后端算差集、写库、给增减的组下发
    var URL_SET_GROUPS = 'Procmanager/usedGroup';
    var URL_DEL = 'Procmanager/delWBList';                    // 删除：pid、policytype

    /**
     * 「应用到组」弹窗里分组树的 id、「已经选中 N 组织」那个数字的选择器（交给 tree.createTree 的 createId、selectedSpanId）。
     * 用名单页自己的名字，不和策略中心的 groupTree / groupTreePolicy 重名：zTree 按这个 id 登记树，名单页只销毁自己这一棵。
     */
    var TREE_ID = 'procmGroupTree';
    var TREE_COUNT_SEL = '#procmGroupTreeCount';

    /**
     * 名单行在库里的产品号（POLICY.PRODUCTID），取已选组接口必须带、不能为空。
     *   getWBList 不返回 PRODUCTID（设计 12.1 P24 ⑥），所以行里没有时用这个值。
     *   现在 101 后端和库里名单用的是进程管控（PROCM）的产品号；设计 K3 要的是名单专用产品号，还没对齐（P24），
     *   以后后端改了产品号或列表返回了 PRODUCTID，这里跟着改或去掉。
     */
    var WBLIST_PRODUCTID = '2DA19BD4-5E8D-4397-B233-D9F95CD29DB3';

    /** 设计 01 §6.5、§8.8 第 12 条的生效口径：中心不推送，终端下次心跳才拉取（不说「立即」） */
    var TXT_HEARTBEAT = '组内终端下次心跳（默认 5 分钟内）生效';

    /** 应用到组成功的提示（原来是 bwlistMock 的 MSG.APPLY；不用后端的「更新应用范围成功！」，口径照设计 8.8 第 12 条） */
    var TXT_APPLY_OK = '应用成功，' + TXT_HEARTBEAT;

    /** 发布成功的两种提示（设计 8.8 第 12 条；原来写在 bwlistMock 的 MSG 里，发布切真接口后挪到这里） */
    var TXT_PUBLISH_APPLIED = '已发布，' + TXT_HEARTBEAT;   // 名单已应用到组 / 终端
    var TXT_PUBLISH_UNAPPLIED = '已发布，应用到组后下发';    // 名单还没有应用范围

    /**
     * 白 / 黑两页的配置：type = 接口参数（2 白名单、3 黑名单），name = 页面上用的名单叫法；
     * namePlaceholder、descPlaceholder = 创建 / 编辑弹窗里名称、描述输入框的占位文字（照 demo，PL-02 §五「占位」、F-8），
     *   白、黑各写各的（黑名单是「拦截什么」，不是把白名单的「放行什么」换个字），经 bwlistModal.open 传给弹窗
     */
    var TAB_CFG = {
        white: {
            tab: 'white',
            type: 2,
            name: '白名单',
            namePlaceholder: '示例：办公区终端白名单',
            descPlaceholder: '选填，说明这条白名单用在哪里、放行什么'
        },
        black: {
            tab: 'black',
            type: 3,
            name: '黑名单',
            namePlaceholder: '示例：挖矿程序黑名单',
            descPlaceholder: '选填，说明这条黑名单用在哪里、拦截什么'
        }
    };

    /** 系统类型：EPTYPE 1 = Windows、2 = Linux/信创 */
    var EPTYPE_TEXT = { '1': 'Windows', '2': 'Linux/信创' };

    /** 名单页创建名单时的系统类型：一期只有 Linux/信创（PL-01 §五「系统类型固定显示 Linux/信创」），接口参数 systype = 2 */
    var SYSTYPE_CREATE = 2;

    /** 发布状态 PUBSTATUS 0～3 的显示文字（设计 7.1；颜色在样式 procm-st0～3 里：灰 / 蓝 / 绿 / 橙） */
    var PUB_TEXT = ['--', '待发布', '已发布', '有变更'];

    /**
     * 查询条件的初始值（页面内部的条件名，照 PL-01 §4.2；发请求前由 bwlistAdapter.toQuery 转成后端参数；type 另外按页面配置给）
     *   systype 固定 '2'（Linux/信创）：10-23 起工具栏的系统类型下拉隐藏，但接口照样传 eptype=2；
     *     它是「默认值」不是「用户设的条件」——hasCond 拿各项和这里的初始值比，所以它不会让页面误显示「已筛选出 X 个，共 Y 个」；
     *     取总数 Y 时也用这份初始值，同样带 eptype=2，X 和 Y 口径一致。
     *   其余各项空 = 不限。
     */
    var EMPTY_COND = { systype: '2', ctime: '', cfrom: '', cto: '', pubstatus: '', scope: '', delta: '', kw: '' };

    /** 行首箭头、名称上的悬停文字（照 demo） */
    var TXT_OPEN = '展开操作';
    var TXT_CLOSE = '收起';

    /** 展开行的 5 个按钮，顺序照 PL-01 §五（不放「应用到终端」，设计 8.8 第 3 条） */
    var OP_BUTTONS = [
        ['edit', '编辑'],
        ['proc', '进程'],
        ['group', '应用到组'],
        ['publish', '发布'],
        ['del', '删除']
    ];

    /**
     * 按 tab 取本页配置（tab 不是 black 一律按白名单，和旧骨架默认白名单一致）
     * 页面上随白 / 黑变化的文案都在这里拼好，模板和代码只从这里取
     */
    function getCfg(tab) {
        var base = tab === 'black' ? TAB_CFG.black : TAB_CFG.white;
        var name = base.name;
        return {
            tab: base.tab,
            type: base.type,
            name: name,                                            // 面包屑、底部「白名单总数」
            title: '进程管控-' + name,                              // 浏览器标签页标题
            createText: '创建' + name,                              // 工具栏按钮
            emptyName: '空' + name,                                 // 高级查询「发布状态」里 -- 那一项（照 demo：空白名单 / 空黑名单）
            emptyText: '没有符合条件的' + name + '，可以调整条件或点"重置"',  // 空结果（PL-01 §五）
            namePlaceholder: base.namePlaceholder,                  // 创建 / 编辑弹窗：名称占位（PL-02 §五）
            descPlaceholder: base.descPlaceholder                   // 创建 / 编辑弹窗：描述占位（PL-02 §五）
        };
    }

    /** 转义后输出到页面（名单名称、描述等用户数据，防 XSS）；null / undefined 当空字符串 */
    function esc(v) {
        if (v === null || v === undefined) {
            return '';
        }
        return util_b.escapeHTML(String(v));
    }

    /** 转成整数，转不了按 0（toRow 已经转过，这里再兜一次底） */
    function toInt(v) {
        var n = parseInt(v, 10);
        return isNaN(n) ? 0 : n;
    }

    /**
     * 发布成功时弹的提示（后端 releaseWBList 只回「发布成功。」，这里换成设计要的两种说法）
     *   data：后端返回的 data，其中 OBJCOUNT = 这次把新库推给了多少个应用对象（组数 + 终端数，没有应用范围时为 0）；
     *   row：发布的这一行，后端没给 OBJCOUNT（字段缺失）时，退回用列表里这一行的已应用组数 GROUPNUM 判断。
     */
    function publishOkMsg(data, row) {
        var n = (data && typeof data === 'object' && data.OBJCOUNT !== undefined && data.OBJCOUNT !== null)
            ? toInt(data.OBJCOUNT)
            : toInt(row && row.GROUPNUM);
        return n > 0 ? TXT_PUBLISH_APPLIED : TXT_PUBLISH_UNAPPLIED;
    }

    /** 发布状态归到 0～3；不认识的值按 0（--）显示 */
    function pubStatus(v) {
        var s = toInt(v);
        return (s >= 0 && s <= 3) ? s : 0;
    }

    /** null / undefined 当空字符串，其余转成字符串（往 .text() 里填用户数据时用，.text() 本身不会当 HTML 解析） */
    function str(v) {
        return (v === null || v === undefined) ? '' : String(v);
    }

    /**
     * 一行名单的几个数：按钮置灰、确认弹窗文案、悬停说明都从这里取（字段都是 bwlistAdapter.toRow 之后的，PL-01 R-3）
     *   s       发布状态 0 --、1 待发布、2 已发布、3 有变更（设计 7.1）
     *   base    已发布版本的进程数 PROCNUM；add 还没发布的新增 ADDNUM（+N）；del 还没发布的待移除 DELNUM（-M）
     *   total   发布后的进程数 = base + N − M（设计 5.4）
     *   gc / hc 应用范围：组数 GROUPNUM、这些组里的终端数 EPNUM；applied = 组数 > 0（名单只挂组，设计 K13）
     *   chg     还没发布的增减，如「新增 2 个、移除 1 个」
     */
    function rowFacts(row) {
        var base = toInt(row.PROCNUM);
        var add = toInt(row.ADDNUM);
        var del = toInt(row.DELNUM);
        var gc = toInt(row.GROUPNUM);
        var parts = [];
        if (add > 0) {
            parts.push('新增 ' + add + ' 个');
        }
        if (del > 0) {
            parts.push('移除 ' + del + ' 个');
        }
        return {
            s: pubStatus(row.PUBSTATUS),
            base: base,
            add: add,
            del: del,
            total: base + add - del,
            gc: gc,
            hc: toInt(row.EPNUM),
            applied: gc > 0,
            chg: parts.join('、')
        };
    }

    /**
     * 展开行 5 个按钮能不能点（off = true 是灰色）和悬停说明（tip，写进按钮的 title；空 = 不加悬停说明）
     * 置灰规则照 PL-01 §五 规则表（= 设计 7.2；需求「最终控制规则」同表）：
     *   发布状态   发布                                         应用到组               编辑、删除
     *   --         灰：空名单不能发布                            灰：先添加进程并发布     可
     *   待发布     可                                           灰：先发布              可
     *   已发布     灰：没有变更                                  可                     可
     *   有变更     可（发布后进程数 > 0；否则灰：至少保留 1 个进程）  灰：先发布              可
     * 悬停文字：灰色按钮写原因，每句都含上表里的原话，后面照 demo 补一句怎么办；
     *   能点的按钮照 demo（demo 的 procTip、groupTip、pubTip、delTip；编辑在 demo 里没有悬停说明，这里也不加），
     *   其中发布、删除两句 demo 和设计 8.8 冲突，按 8.8 改写：
     *     发布（8.8 第 12 条）：demo「发布并下发到 N 台终端」暗示立即下发 → 已应用时说「组内终端下次心跳（默认 5 分钟内）生效」，
     *       没应用时说「应用到组后下发」；
     *     删除（8.8 第 2 条、7.6）：demo「向 N 台终端下发清除策略」→ 没有单独的清除指令，终端下次拉取策略时清掉本地名单。
     */
    function opStates(row) {
        var f = rowFacts(row);
        var states = {
            // 编辑：任何状态都能点（§五 表最后一列）
            edit: { off: false, tip: '' },
            // 进程：悬停照 demo procTip；点了进名单进程视图（PL-04）
            proc: {
                off: false,
                tip: f.s === 0 ? '还没有进程，去添加' : (f.chg ? '有 ' + f.chg + ' 还没发布' : '查看 / 维护名单里的进程')
            },
            // 删除：任何状态都能点（需求「删除一律可点（红色）。」）
            del: {
                off: false,
                tip: f.applied
                    ? '删除名单：已应用到 ' + f.gc + ' 个组 ' + f.hc + ' 台终端，这些终端下次拉取策略时会清掉本地名单'
                    : '删除名单'
            }
        };
        // 应用到组：只有「已发布」能点
        if (f.s === 2) {
            states.group = { off: false, tip: f.applied ? '修改应用的分组，改完自动下发' : '选要用在哪些分组，选完自动下发' };
        } else if (f.s === 0) {
            states.group = { off: true, tip: '还没有进程，先添加进程并发布' };
        } else if (f.s === 1) {
            states.group = { off: true, tip: '先发布，只有已发布的名单才能设置应用范围' };
        } else {
            states.group = { off: true, tip: '有变更还没发布，先发布再改应用范围' };
        }
        // 发布：待发布能点；有变更且发布后进程数 > 0 能点；其余灰
        if (f.s === 1 || (f.s === 3 && f.total > 0)) {
            states.publish = {
                off: false,
                tip: f.applied
                    ? '发布并自动下发到已应用的 ' + f.gc + ' 个组 ' + f.hc + ' 台终端，' + TXT_HEARTBEAT
                    : '标记为已发布，应用到组后下发'
            };
        } else if (f.s === 0) {
            states.publish = { off: true, tip: '空名单不能发布，请先添加进程' };
        } else if (f.s === 2) {
            states.publish = { off: true, tip: '没有变更，不需要发布' };
        } else {
            states.publish = { off: true, tip: '发布后进程数为 0，至少保留 1 个进程；要清掉这条名单请直接删除它' };
        }
        return states;
    }

    /**
     * 发布确认弹窗的文案（PL-01 §五「发布」原文）：
     *   「确定发布「X」吗？发布后进程数为 K。」；已应用到组的多一句「组内终端下次心跳（默认 5 分钟内）生效」，
     *   没应用的多一句「发布后才能应用到组」。X = 名单名称（转义一次），K = 发布后的进程数。
     */
    function publishConfirmHtml(row) {
        var f = rowFacts(row);
        return '<div>确定发布「' + esc(row.PNAME) + '」吗？发布后进程数为 ' + f.total + '。</div>' +
            '<div class="procm-confirm-line">' + (f.applied ? TXT_HEARTBEAT : '发布后才能应用到组') + '</div>';
    }

    /**
     * 删除确认弹窗的文案（PL-01 §五「删除」原文；设计 7.6、8.8 第 2 条）：
     *   「确定删除「X」吗？删除后不能恢复。」；已应用到组的多一句
     *   「该名单已应用到 N 个组、M 台终端。删除后，这些终端下次拉取策略时会清掉本地名单（在线终端默认 5 分钟内，离线终端上线后）」
     *   （红字，照 demo 删除弹窗的提醒句）。N = 组数，M = 终端数。
     */
    function delConfirmHtml(row) {
        var f = rowFacts(row);
        var html = '<div>确定删除「' + esc(row.PNAME) + '」吗？删除后不能恢复。</div>';
        if (f.applied) {
            html += '<div class="procm-confirm-line procm-confirm-warn">该名单已应用到 ' + f.gc + ' 个组、' + f.hc +
                ' 台终端。删除后，这些终端下次拉取策略时会清掉本地名单（在线终端默认 5 分钟内，离线终端上线后）</div>';
        }
        return html;
    }

    /**
     * 把名单页这棵分组树从 zTree 的登记表里去掉，并清空它画出来的节点。
     * ⚠️ $.fn.zTree.destroy 不传 id（或传空串）会把页面上所有 zTree 都销毁，这里固定传名单页自己的 TREE_ID；
     *    这个 id 还没登记过时 zTree 自己什么都不做。
     */
    function destroyTree() {
        if ($.fn.zTree && typeof $.fn.zTree.destroy === 'function') {
            $.fn.zTree.destroy(TREE_ID);
        }
    }

    // =====================================================================
    // 页面逻辑
    // =====================================================================
    var op = {
        view: null,        // 页面容器（.c-page-content）
        cfg: null,         // 当前页配置（getCfg 的结果）
        cond: null,        // 当前生效的查询条件（点选项点了立刻改；关键字、指定日期点「筛选」才改）
        token: null,       // 本次打开页面的标记：离开页面或白黑切换时换掉，旧请求回来就丢掉，不碰新页面
        reqSeq: 0,         // 列表请求序号：只认最近一次请求的返回（连续点筛选时，旧请求晚回来也不会盖掉新结果）
        layoutBak: null,   // 进页面前公共布局容器的 style，离开时还原
        confirmCtx: null,  // 发布 / 删除确认弹窗这一次打开的上下文 {kind, row, busy}；弹窗关掉时清空（PL-01 TK-5）
        groupCtx: null,    // 应用到组弹窗这一次打开的上下文 {row, loaded, busy, initChecked, xhr}；弹窗关掉时清空（PL-01 TK-5）

        init: function (container, paramStr) {
            var view = $(container);
            op.view = view;
            op.token = {};
            op.reqSeq = 0;
            /** 根据 tab 参数决定白名单还是黑名单 */
            var tab = 'white';
            if (paramStr) {
                var p = str2json(paramStr);
                tab = p.tab || 'white';
            }
            op.cfg = getCfg(tab);
            op.cond = $.extend({}, EMPTY_COND);
            document.title = op.cfg.title;

            var params = getUrlSearchQuerys();
            util_b.blackShow(params['g']);
            /** 非概览页：隐藏 nav 子 tab 和组树，内容区占满（沿用旧骨架；离开页面时还原，见 restoreLayout） */
            op.hideLayout();

            /** mock 开关已关（10-23 应用到组切真接口后），这里 install() 什么都不做、返回 false；等删 bwlistMock.js 时一起去掉 */
            bwlistMock.install();

            view.html(mustache.render(tpl, op.cfg));
            /** 创建 / 编辑弹窗：list.html 渲染完就绑（事件委托挂在页面容器上，命名空间 .procmListModal，PL-02 §四） */
            bwlistModal.bind(view);
            /** 已应用组弹窗：同样渲染完就绑（命名空间 .procmSeeGroup） */
            bwlistUsedGroup.bind(view);
            /** 弹窗拖拽（10-25，照策略中心 index.js 的「RsCore.alertBoxDrag(".alert_drag")」）：
             *   本页 5 个弹窗的标题 h3 带 alert_drag，按住标题能拖动整个弹窗（公共函数在 js/core.js alertBoxDrag）。
             *   只绑本页渲染出来的标题（view 里找），不碰公共布局里别的弹窗，免得重复绑；每次进页面模板重画，旧元素连同绑定一起没了。
             *   类加在 h3 上、不加在整个标题栏：这个函数会让绑定的元素吞掉点击（return false），
             *   加在标题栏上会把标题栏里靠 data-dismiss 关闭的 × 弄失效（策略中心是另外给 × 绑了关闭事件）。 */
            RsCore.alertBoxDrag(view.find('.alert_drag'));
            op.initTable(view);
            op.initEvent(view);
        },

        // ---------------------------------------------------------------
        // 公共布局：隐藏顶部页签和左侧组树（PL-01 §五「页面布局」），离开页面时原样还原
        // ---------------------------------------------------------------

        /** 记下 4 个公共容器原来的 style，再隐藏页签、组树，内容区占满 */
        hideLayout: function () {
            if (!op.layoutBak) {   // 已经记过（还没还原）就不再记，免得把「已隐藏」当成原样
                var bak = [];
                $('.c-page-nav,.c-page-silder,.c-page-container,.c-page-wrap').each(function () {
                    bak.push({ el: this, style: this.getAttribute('style') });
                });
                op.layoutBak = bak;
            }
            $('.c-page-nav,.c-page-silder').hide();
            $('.c-page-container').css('margin-left', 0);
            $('.c-page-wrap').css('top', 0);
        },

        /** 把 4 个公共容器的 style 还原成进页面前的样子（不在公共容器上留下名单页的改动） */
        restoreLayout: function () {
            var bak = op.layoutBak || [];
            for (var i = 0; i < bak.length; i++) {
                if (bak[i].style === null) {
                    bak[i].el.removeAttribute('style');
                } else {
                    bak[i].el.setAttribute('style', bak[i].style);
                }
            }
            op.layoutBak = null;
        },

        // ---------------------------------------------------------------
        // 表格
        // ---------------------------------------------------------------

        initTable: function (view) {
            var token = op.token;
            var cfg = op.cfg;
            view.find('#tbClient').bootstrapTable({
                // 自己接管请求：走 RsCore.ajax（登录令牌、报错提示都由 core.js 统一处理），见 tableAjax
                ajax: function (request) {
                    op.tableAjax(request, token);
                },
                method: 'post',
                // 表单格式：这样表格交给 ajax 的 request.data 是对象（json 格式会被表格序列化成字符串），后端按表单字段读参数
                contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
                queryParams: function () {
                    return op.buildParams();
                },
                responseHandler: function (res) {
                    return op.toTableData(res);
                },
                columns: op.getColumns(),
                cache: false,
                search: false,
                showRefresh: true,              // 右侧：刷新
                showColumns: true,              // 右侧：列设置
                showCustomSearch: true,         // 右侧：高级搜索（展开 / 收起下面的 #customSearchBox）
                customSearchBox: '#customSearchBox',
                customSearchBoxOpen: false,     // 默认折叠（照 demo）
                toolbar: '#custom-toolbar',     // 左侧：系统类型筛选 + 创建按钮
                toolbarAlign: 'left',
                pagination: false,              // 不分页（PL-01 §1.1、§4.2）
                sidePagination: 'server',       // 返回 {rows, total}；排序和关键字 /「无变更」筛选在 bwlistAdapter.toList，其余条件后端筛（PL-03）
                clickToSelect: false,
                height: view.find('.procm-main').height(),
                showHeader: true,
                formatNoMatches: function () {  // 空结果文案（PL-01 §五）
                    return cfg.emptyText;
                },
                onLoadSuccess: function (data) {
                    if (token === op.token) {
                        op.afterLoad(data);
                    }
                },
                onLoadError: function () {
                    // 不弹提示：失败原因 core.js 已经弹过（PL-01 F-12），这里再弹就是第二次
                }
            });
        },

        /**
         * 表格的 ajax 适配（PL-01 §4.1）：表格给的 request 带 success / error / complete，
         * RsCore.ajax(url, param, callback, complete, error) 只在 code=0 时调 callback。
         *   成功：把结果包回 {r, data} 交给 request.success（表格再走 responseHandler → 渲染）；
         *   失败：调 request.error（表格触发 onLoadError）。core.js 对「接口返回非 0 的 code」会调 error 回调；
         *         对网络 / HTTP 层失败（断网、超时、500 等）、登录过期、返回格式不对，只调 complete、不调 error，
         *         所以 complete 里发现 success、error 都没被调过，就补调一次 request.error（PL-01 TK-4）；
         *   最后都调 request.complete（表格收起「正在加载」）。
         *   失败提示 core.js 已经弹过，这里不再弹（PL-01 F-12）。
         * 过期的请求（离开了页面，或之后又发了新请求）回来时什么都不做，交给最新那次请求收尾。
         */
        tableAjax: function (request, token) {
            var seq = ++op.reqSeq;
            var param = request.data;
            if (!$.isPlainObject(param)) {
                param = op.buildParams();   // 兜底：表格没把 queryParams 的结果原样给成对象时（比如序列化成了字符串），按当前条件重新转一次
            }
            // 记下发请求这一刻的条件：前端还要按它的关键字、「无变更」筛（见 toTableData）。
            // 不在回来时读 op.cond：那时用户可能已经又点了别的条件（新请求会让这次作废，但多一层保险）
            var cond = $.extend({}, op.cond || EMPTY_COND);
            var answered = false;   // 这次请求 RsCore.ajax 有没有调过成功回调或 error 回调
            function isCurrent() {
                return token === op.token && seq === op.reqSeq;
            }
            RsCore.ajax(URL_LIST, param, function (data, code, msg) {
                answered = true;
                if (!isCurrent()) {
                    return;
                }
                request.success({ r: { code: code, action: 0, msg: msg }, data: data, cond: cond });
            }, function (req) {
                if (!isCurrent()) {
                    return;
                }
                if (!answered) {
                    // core.js 只调了 complete（网络 / HTTP 层失败等）：补调一次 error，让表格也走「加载失败」
                    request.error({ status: (req && req.status) ? req.status : 0 });
                }
                request.complete();
            }, function (data, code) {
                answered = true;
                if (!isCurrent()) {
                    return;
                }
                request.error({ status: code });
            });
        },

        /** 当前查询条件 → 后端 getWBList 参数（PL-03 §3.1，转换规则全在 bwlistAdapter.toQuery；空 = 不限，不传） */
        buildParams: function () {
            return bwlistAdapter.toQuery(op.cfg.type, op.cond || EMPTY_COND);
        },

        /** 有没有设任何查询条件（type 不算条件；和初始值 EMPTY_COND 不一样才算，所以固定的 systype=2 不算） */
        hasCond: function () {
            var c = op.cond || EMPTY_COND;
            for (var k in EMPTY_COND) {
                if (EMPTY_COND.hasOwnProperty(k) && c[k] !== EMPTY_COND[k]) {
                    return true;
                }
            }
            return false;
        },

        /**
         * 接口返回 → 表格数据（PL-03 §3.2）：bwlistAdapter.toList 逐行转换、排序、按关键字 /「无变更」筛（PL-01 R-3），
         * 页面只读转换后的字段；条件取 tableAjax 发请求时记下的 res.cond（没有就用当前条件）。
         * 转换后的行仍交给 bwlistMock.remember（mock 已关，记了也没人用；删 bwlistMock.js 时一起去掉）。
         */
        toTableData: function (res) {
            var data = res && res.data;
            var raw = (data && $.isArray(data.rows)) ? data.rows : [];
            var result = bwlistAdapter.toList(raw, (res && res.cond) || op.cond || EMPTY_COND);
            bwlistMock.remember(op.cfg.type, result.rows);
            return result;
        },

        /** 列表加载成功后：收起说明框、更新「已筛选出 X 个，共 Y 个」（10-23 去掉了底部统计） */
        afterLoad: function (data) {
            var rows = (data && $.isArray(data.rows)) ? data.rows : [];
            op.hideTip();
            op.updateFiltered(rows.length);
        },

        /**
         * 「已筛选出 X 个，共 Y 个」（PL-01 §七 S-3；照 demo：筛选结果条数 ≠ 名单总数时才显示）
         *   X = 这次列表的条数；Y = 另发一次只带初始条件的 getWBList（toQuery(type, EMPTY_COND) = policytype + eptype=2 + timeRange=0，
         *   后端 timeRange 缺省是本周，必须显式传 0 才是全部，PL-03 F-7），取它的 total（不带条件时就是名单总数）。
         *   没设任何条件时 X 就是总数，不用再发请求，直接不显示。
         */
        updateFiltered: function (x) {
            var view = op.view;
            var $box = view.find('.js_procm_filtered');
            $box.hide();
            if (!op.hasCond()) {
                return;
            }
            var token = op.token;
            var seq = op.reqSeq;
            RsCore.ajax(URL_LIST, bwlistAdapter.toQuery(op.cfg.type, EMPTY_COND), function (data) {
                if (token !== op.token || seq !== op.reqSeq) {
                    return;   // 已离开页面，或之后又查过一次：这次的总数作废
                }
                var y = (data && data.total !== undefined && data.total !== null && !isNaN(parseInt(data.total, 10)))
                    ? parseInt(data.total, 10)
                    : ((data && $.isArray(data.rows)) ? data.rows.length : 0);
                if (x !== y) {
                    view.find('.js_procm_x').text(x);
                    view.find('.js_procm_y').text(y);
                    $box.show();
                }
            });
            // 取总数失败：core.js 已弹提示（F-12），这句保持不显示即可，不另做处理
        },

        /** 重新查询（点选项、筛选、重置、系统类型都走这里）；表格重新渲染后展开的行自然收起 */
        reload: function () {
            if (!op.view) {
                return;
            }
            op.hideTip();
            op.view.find('#tbClient').bootstrapTable('refresh');
        },

        /**
         * 面包屑「进程管控」：回到进程管控概览（照 demo）
         * 写法照左侧子菜单的点击（js/index.js「进程管控左菜单：父项展开收起、子项精确跳转」）：
         *   先取消未完成的请求，地址带上 g = GlobaluserInfo.gValue（没有就用 1，根管理组）；
         *   概览页拿不到 g 就是空白页（设计 01 §3.3）。
         *   左侧菜单的高亮不用这里管：路由切完后 index.js 的 PageLoad.nav 会按新地址把「概览」标成选中。
         */
        goOverview: function () {
            if (RsCore.ajaxClean) {
                RsCore.ajaxClean();
            }
            var gu = window.GlobaluserInfo;
            var g = (gu && gu.gValue) ? gu.gValue : 1;
            window.location.hash = '#processManage/overview?' + RsCore.assist.params2str({ g: g });
        },

        /** 窗口大小变化：表格高度跟着主体区域变 */
        resizeTable: function () {
            if (!op.view) {
                return;
            }
            op.view.find('#tbClient').bootstrapTable('changeHeight', op.view.find('.procm-main').height());
        },

        /** 按行号取这一行的数据（toRow 之后的）；取不到返回 null */
        getRow: function (index) {
            if (!op.view) {
                return null;
            }
            var data = op.view.find('#tbClient').bootstrapTable('getData');
            var i = parseInt(index, 10);
            if (!$.isArray(data) || isNaN(i) || i < 0 || i >= data.length) {
                return null;
            }
            return data[i];
        },

        // ---------------------------------------------------------------
        // 列（PL-01 §五：展开箭头 / 序号 / 名称 / 系统类型 / 进程数 / 应用范围 / 发布状态 / 创建时间 / 描述；
        //   「创建人」列 10-23 删掉：只有主账号能建名单，这一列没有区分度。后端返回的 CREATEUSER 字段照旧在 row 里，只是不显示）
        // ⚠️ formatter 的第一个参数 value 已经被表格组件转义过一次（bootstrap-table.js calculateObjectValue 里
        //    「添加防XSS注入处理 2025.4.8」：字符串参数先 escapeHTML 再交给 formatter），再 esc 一次就会显示成 &lt; 这种字。
        //    所以这里一律从 row 里取原始值、自己 esc 一次。
        // ---------------------------------------------------------------
        getColumns: function () {
            return [{
                // 展开箭头：样式照策略中心（open_tr 朝右 = 收起，close_tr 朝下 = 展开），点它和点行一样
                // procm-col-arrow：这一列不留左右内边距、箭头居中，并且不显示这一列右边的列宽拖拽手柄
                //   （101 实测手柄压在箭头右半边上，点箭头中心展不开；样式见 processManageList.css「折叠箭头列」）
                field: 'PROCM_ARROW',
                title: '',
                width: 36,
                'class': 'procm-col-arrow',
                switchable: false,
                formatter: function () {
                    return '<div class="open_tr js_procm_arrow" title="' + TXT_OPEN + '"></div>';
                }
            }, {
                field: 'PROCM_SEQ',
                title: '序号',
                formatter: function (value, row, index) {
                    return '<div>' + (index + 1) + '</div>';
                }
            }, {
                // 名称：蓝色链接样式，点它和点行一样展开 / 收起（照 demo）
                field: 'PNAME',
                title: '名称',
                formatter: function (value, row) {
                    if (row.PNAME === undefined || row.PNAME === null || row.PNAME === '') {
                        return '<div class="procm-gray">--</div>';
                    }
                    return '<a href="javascript:;" class="procm-name js_procm_name" title="' + TXT_OPEN + '">' + esc(row.PNAME) + '</a>';
                }
            }, {
                // 系统类型：EPTYPE 1 Windows、2 Linux/信创
                field: 'EPTYPE',
                title: '系统类型',
                formatter: function (value, row) {
                    var text = EPTYPE_TEXT[String(row.EPTYPE)];
                    return text ? '<div>' + text + '</div>' : '<div class="procm-gray">--</div>';
                }
            }, {
                // 进程数：已发布版本的数量（base）+ 还没发布的新增（+N 绿）/ 待移除（-M 红）；本期 +N / -M 不做链接（PL-01 §五）
                field: 'PROCNUM',
                title: '进程数',
                formatter: function (value, row) {
                    var add = toInt(row.ADDNUM);
                    var del = toInt(row.DELNUM);
                    var html = '<div class="procm-num"><span>' + toInt(row.PROCNUM) + '</span>';
                    if (add > 0) {
                        html += '<span class="procm-add" title="有 ' + add + ' 个新增进程还没发布">+' + add + '</span>';
                    }
                    if (del > 0) {
                        html += '<span class="procm-del" title="有 ' + del + ' 个移除的进程还没发布">-' + del + '</span>';
                    }
                    return html + '</div>';
                }
            }, {
                // 应用范围：格式照策略中心策略列表的「应用范围」列（view/strategy/colums.js 应用范围列）：
                //   组<蓝【 N 】> 终端<蓝【 M 】>，数为 0 的那一项不显示；
                //   没有应用到组时显示 --（名单只挂组，组数 = 0 就是没有；-- 沿用本页其他列的空值写法）。
                // 注意口径不同：策略中心的「终端」是直接挂的终端；名单只挂组，这里的「终端」是这些组里的终端数 EPNUM，
                //   所以悬停提示写明「组内共 M 台终端」，免得看成另外单挂了终端。
                // 101 后端 getWBList 现在还不返回终端数，bwlistAdapter 把 EPNUM 固定成 0（PL-03 Q3）：
                //   0 是「不知道」不是「没有」，所以 M = 0 时提示里也不写终端数，只写「已应用到 N 个组」。
                field: 'GROUPNUM',
                title: '应用范围',
                formatter: function (value, row) {
                    var gc = toInt(row.GROUPNUM);
                    var ec = toInt(row.EPNUM);
                    if (gc <= 0) {
                        return '<div class="procm-gray" title="还没设置应用范围（终端上没有这条名单）">--</div>';
                    }
                    var tip = '已应用到 ' + gc + ' 个组' + (ec > 0 ? '，组内共 ' + ec + ' 台终端' : '');
                    var html = '<div title="' + tip + '">';
                    // 「组【 N 】」能点：弹出「已应用组」窗口（照策略中心，10-23；点击在 initEvent 里，见 js_procm_seegroup）
                    html += '组<span class="procm-scope procm-scope-link js_procm_seegroup" title="' + tip + '，点击查看已应用组">【 ' + gc + ' 】</span>';
                    if (ec > 0) {
                        html += '终端<span class="procm-scope">【 ' + ec + ' 】</span>';
                    }
                    return html + '</div>';
                }
            }, {
                // 发布状态：圆点 + 文字（-- 灰且不带圆点、待发布 蓝、已发布 绿、有变更 橙，照 demo）；表头和单元格悬停有说明
                field: 'PUBSTATUS',
                title: '发布状态<span class="procm-info js_procm_tip" data-tip="head"></span>',
                formatter: function (value, row) {
                    var s = pubStatus(row.PUBSTATUS);
                    return '<div class="procm-pub"><span class="procm-st procm-st' + s + ' js_procm_tip" data-tip="row">' +
                        (s === 0 ? '' : '<i class="procm-dot"></i>') + PUB_TEXT[s] + '</span></div>';
                }
            }, {
                field: 'CREATETIME',
                title: '创建时间',
                formatter: function (value, row) {
                    var v = row.CREATETIME;
                    return v ? '<div>' + esc(v) + '</div>' : '<div class="procm-gray">--</div>';
                }
            }, {
                // 描述：超长省略，悬停看全文；没填显示灰色 --（照 demo）
                field: 'DESCRIPTION',
                title: '描述',
                formatter: function (value, row) {
                    var v = row.DESCRIPTION;
                    if (v === undefined || v === null || v === '') {
                        return '<div class="procm-gray">--</div>';
                    }
                    return '<div class="procm-desc" title="' + esc(v) + '">' + esc(v) + '</div>';
                }
            }];
        },

        // ---------------------------------------------------------------
        // 折叠：点行在下面插一行按钮，同时只展开一行，再点收起（照 strategy/openLine.js 的交互）
        // ---------------------------------------------------------------

        /** 点了某一行：它已展开就收起；否则先收起别的行，再展开它 */
        toggleRow: function ($tr) {
            var wasOpen = $tr.hasClass('procm-row-open');
            op.collapseAll($tr.parent());
            if (wasOpen) {
                return;
            }
            var index = $tr.attr('data-index');
            var row = op.getRow(index);
            if (!row) {
                return;
            }
            $tr.addClass('procm-row-open');
            $tr.find('.js_procm_arrow').removeClass('open_tr').addClass('close_tr').attr('title', TXT_CLOSE);
            $tr.find('.js_procm_name').attr('title', TXT_CLOSE);
            $tr.after(op.buildOpRow(index, row, $tr.children('td').length));
        },

        /** 收起所有展开的行（删掉插入的按钮行、箭头复原） */
        collapseAll: function ($tbody) {
            $tbody.children('tr.procm-append-tr').remove();
            var $open = $tbody.children('tr.procm-row-open').removeClass('procm-row-open');
            $open.find('.js_procm_arrow').removeClass('close_tr').addClass('open_tr').attr('title', TXT_OPEN);
            $open.find('.js_procm_name').attr('title', TXT_OPEN);
        },

        /**
         * 拼展开行：一个跨满所有列的单元格，里面 5 个按钮（样式照策略中心展开行）
         * 按这一行的发布状态决定按钮能不能点（不能点的加 procm-op-off，显示成灰色），悬停说明写在 title 里（见 opStates，PL-01 TK-5）
         */
        buildOpRow: function (index, row, colspan) {
            var idx = esc(index);
            var pid = esc(row.PID);
            var states = opStates(row);
            var html = '<tr class="append_tr procm-append-tr"><td colspan="' + colspan + '" class="append_td"><ul>';
            for (var i = 0; i < OP_BUTTONS.length; i++) {
                var name = OP_BUTTONS[i][0];
                var st = states[name] || { off: false, tip: '' };
                html += '<li class="procm-op procm-op-' + name + (st.off ? ' procm-op-off' : '') + ' js_procm_op" data-op="' + name +
                    '" data-index="' + idx + '" data-pid="' + pid + '"' +
                    (st.tip ? ' title="' + esc(st.tip) + '"' : '') +       // 悬停说明（文字是本文件拼的，照样转义一次）
                    (st.off ? ' aria-disabled="true"' : '') +
                    '><span>' + OP_BUTTONS[i][1] + '</span></li>';
            }
            return html + '</ul></td></tr>';
        },

        // ---------------------------------------------------------------
        // 创建 / 编辑：本页自带的弹窗 #procmListModal（PL-02 TK-1：§四、§五；PL-01 §五「创建」「编辑」、§4.6）
        //   弹窗在 list.html 里；打开、名称必填检查（设计 01 §8.5）、调接口、防连点、关闭、离开页面时收尾都由 bwlistModal.js 负责；
        //   这里只告诉它标题、模式、参数和白 / 黑两份文案，保存成功后刷新本页表格。
        //   创建：标题「创建白名单（黑名单）」，系统类型固定显示 Linux/信创，调 createWBList（不带进程，只建名单）；
        //   编辑：标题「编辑白名单（黑名单）」，带出原名称和描述，系统类型只显示不可改，调 editWBList（只改名称和描述）。
        //   不做二次认证（PL-01 Q1）。
        // ---------------------------------------------------------------
        openListModal: function (mode, row) {
            var isEdit = mode === 'edit';
            if (isEdit && !row) {
                return;
            }
            var cfg = op.cfg;
            var token = op.token;
            var opened = bwlistModal.open({
                mode: isEdit ? 'edit' : 'create',
                title: (isEdit ? '编辑' : '创建') + cfg.name,          // 创建白名单 / 编辑黑名单 …
                policytype: cfg.type,                                    // 2 白名单、3 黑名单（创建时用）
                systype: isEdit ? row.EPTYPE : SYSTYPE_CREATE,           // 编辑：显示这条名单自己的系统类型（只显示，不能改）
                pid: isEdit ? row.PID : '',
                pname: isEdit ? row.PNAME : '',                          // 原名称（取 toRow 之后的原值，弹窗用 val 填，不当 HTML）
                description: isEdit ? row.DESCRIPTION : '',              // 原描述
                name: cfg.name,                                          // 「白名单」/「黑名单」：弹窗拼名称标签用
                namePlaceholder: cfg.namePlaceholder,                    // 名称占位（白、黑各一份，见 TAB_CFG）
                descPlaceholder: cfg.descPlaceholder,                    // 描述占位（同上）
                onSaved: function () {
                    // 保存成功：刷新本页表格；已经离开本页（或白黑切换）就不刷
                    if (token === op.token) {
                        op.reload();
                    }
                }
            });
            if (!opened) {
                // list.html 里没有 #procmListModal（页面没渲染完整），或参数不对（如编辑的这一行没有 PID）
                RsCore.msg.warn('弹窗没有加载成功，请刷新页面后重试');
            }
        },

        // ---------------------------------------------------------------
        // 按钮处理（签名 function (row, $btn)；见文件头第四节）
        // ---------------------------------------------------------------
        actions: {
            /** 工具栏「创建白名单（黑名单）」：本页自带的弹窗 #procmListModal（PL-01 §五「创建」；PL-02 TK-1） */
            create: function () {
                op.openListModal('create', null);
            },
            /** 编辑：同一个弹窗，带出原名称和描述，只改名称和描述（PL-01 §五「编辑」、设计 01 §8.5；PL-02 TK-1） */
            edit: function (row) {
                op.openListModal('edit', row);
            },
            /** 进程：在名单页里换成这条名单的进程视图（PL-04 Q1，见 openProc） */
            proc: function (row) {
                op.openProc(row);
            },
            /** 应用到组：只有「已发布」能点，打开分组树弹窗（PL-01 §五「应用到组」，TK-5） */
            group: function (row) {
                op.openGroup(row);
            },
            /** 发布：先弹确认框，确定后调 releaseWBList（PL-01 §五「发布」，TK-5；10-23 切真接口） */
            publish: function (row) {
                op.openConfirm('publish', row);
            },
            /** 删除：先弹确认框，确定后调 delWBList（PL-01 §五「删除」，TK-5） */
            del: function (row) {
                op.openConfirm('del', row);
            }
        },

        // ---------------------------------------------------------------
        // 名单进程视图（PL-04 §4.1、§5.1；逻辑在 bwlistProc.js）
        // ---------------------------------------------------------------

        /** 名单页里的几块列表内容（进程视图打开时隐藏、返回时显示；状态说明框不在里面，它平时就是隐藏的，只在悬停时显示） */
        LIST_PARTS: '.procm-crumb, .procm-main',

        /** 进入进程视图：收起展开行和说明框，隐藏列表，显示进程视图并打开 */
        openProc: function (row) {
            var view = op.view;
            if (!view || !row) {
                return;
            }
            var token = op.token;
            op.collapseAll(view.find('#tbClient > tbody'));
            op.hideTip();
            view.find(op.LIST_PARTS).hide();
            var $pane = view.find('.js_procm_procpane').show();
            var opened = bwlistProc.open($pane, {
                cfg: op.cfg,
                row: row,
                onBack: function () {
                    if (token === op.token) {   // 还是这一次打开的名单页
                        op.closeProc();
                    }
                },
                onOverview: function () {
                    op.goOverview();
                }
            });
            if (!opened) {
                op.closeProc();   // 打不开（模板没渲染出容器等）：回到列表
            }
        },

        /** 回到列表：收掉进程视图，只显示列表那几块，量一次表格高度（隐藏期间窗口可能变过），刷新列表（条件、页码不变） */
        closeProc: function () {
            bwlistProc.release();
            if (!op.view) {
                return;
            }
            op.view.find('.js_procm_procpane').hide();
            op.view.find(op.LIST_PARTS).show();
            op.resizeTable();
            op.reload();
        },

        // ---------------------------------------------------------------
        // 发布、删除的确认弹窗（PL-01 §五「发布」「删除」；外壳照策略中心 #delStrategy，F-13）
        // ---------------------------------------------------------------

        /**
         * 两个确认弹窗的配置：弹窗、确定按钮、文案、接口、成功提示
         *   okMsg(data, msg, row)：成功后弹什么。发布按 OBJCOUNT 拼（publishOkMsg）；删除照弹后端给的 msg。
         */
        CONFIRM: {
            publish: {
                modal: '#procmPublishModal', ok: '.js_procm_publish_ok', html: publishConfirmHtml, url: URL_PUBLISH,
                okMsg: function (data, msg, row) { return publishOkMsg(data, row); }
            },
            del: {
                modal: '#procmDelModal', ok: '.js_procm_del_ok', html: delConfirmHtml, url: URL_DEL,
                okMsg: function (data, msg) { return msg; }
            }
        },

        /**
         * 打开发布 / 删除确认弹窗。kind：'publish' 发布、'del' 删除；row：这一行（toRow 之后的数据）
         * 按钮灰色时本来点不到，这里再按同一套规则兜一次底（发布灰色就不打开）。
         */
        openConfirm: function (kind, row) {
            var cfg = op.CONFIRM[kind];
            if (!cfg || !row || !op.view) {
                return;
            }
            if (opStates(row)[kind].off) {
                return;
            }
            var $m = op.view.find(cfg.modal);
            op.confirmCtx = { kind: kind, row: row, busy: false };   // 这一次打开的上下文：请求回来时用它判断弹窗还是不是这一次的
            $m.find('.js_procm_confirm_text').html(cfg.html(row));   // 名单名称在拼文案时已转义
            $m.find(cfg.ok).prop('disabled', false);
            $m.modal('show');
        },

        /**
         * 点了确认弹窗的「发布」/「删除」：调接口（参数 pid、policytype，PL-01 §4.3、§4.6）
         *   成功：弹提示（删除用接口给的；发布由前端按 OBJCOUNT 拼两种之一，设计 8.8 第 12 条，见 cfg.okMsg）、关弹窗、刷新表格；
         *   失败：core.js 已经弹过「错误」+ 原因，这里不再弹（F-12）；弹窗留着，按钮恢复，可以再点或取消。
         *   请求回来之前按钮置灰，防止连点发两次。
         */
        submitConfirm: function (kind) {
            var ctx = op.confirmCtx;
            var cfg = op.CONFIRM[kind];
            if (!ctx || ctx.kind !== kind || ctx.busy || !cfg || !op.view) {
                return;
            }
            var token = op.token;
            var $m = op.view.find(cfg.modal);
            var $ok = $m.find(cfg.ok);
            ctx.busy = true;
            $ok.prop('disabled', true);
            RsCore.ajax(cfg.url, { pid: ctx.row.PID, policytype: op.cfg.type }, function (data, code, msg) {
                // 接口已经做成了：提示照弹（哪怕已经离开本页）；ctx.row 是打开弹窗时的那一行
                RsCore.msg.success(cfg.okMsg(data, msg, ctx.row));
                if (token !== op.token) {
                    return;   // 已经离开本页（或白黑切换）：弹窗已随页面关掉，不刷新
                }
                if (op.confirmCtx === ctx) {
                    $m.modal('hide');
                }
                op.reload();
            }, function () {
                // complete：成功、失败、网络层失败都会到这里。还是这一次的弹窗就把按钮恢复（成功时弹窗已关，不用管）
                ctx.busy = false;
                if (token === op.token && op.confirmCtx === ctx) {
                    $ok.prop('disabled', false);
                }
            });
        },

        // ---------------------------------------------------------------
        // 应用到组（PL-01 §五「应用到组」、F-11；设计 01 §7.5）
        //   弹窗外壳照策略中心 #setGroup；分组树调公共组件 strategy/tree.js 的 createTree（type 2 = 应用组树）：
        //     它先调 Group/getGroupTree 取全部分组，再用 url 取这条名单已应用的组（返回 aUsedGroupId:[{OBJID, ISLOCK}]、aLockGroupId:[]），
        //     画进 #procmGroupTree、把勾选数写进 #procmGroupTreeCount，最后调 callback({treeData, checkTree: 已应用的组})。
        //   开了继承的子组随父组勾选、不能单独勾，是树组件自己的规则（tree.js:395-404），这里不改。
        // ---------------------------------------------------------------

        /** 打开「应用到组」弹窗（按钮灰色时本来点不到，这里再兜一次底：不是已发布就不打开） */
        /**
         * 「应用范围」列点「组【 N 】」：打开已应用组弹窗（10-23；逻辑在 bwlistUsedGroup.js，接口 Procmanager/showUsedGroup）
         *   组数为 0 时列里显示 --、没有可点的「组【 N 】」，所以这里不用再判断组数。
         *   index：这一行在表格里的行号（tr 上的 data-index）。
         */
        openSeeGroup: function (index) {
            var row = op.getRow(index);
            if (!row) {
                return;
            }
            if (!bwlistUsedGroup.open({ pid: row.PID, pname: row.PNAME, policytype: op.cfg.type })) {
                RsCore.msg.warn('弹窗没有加载成功，请刷新页面后重试');
            }
        },

        openGroup: function (row) {
            if (!row || !op.view || opStates(row).group.off) {
                return;
            }
            op.closeGroup();   // 上一次的（正常点不到：弹窗开着时页面被遮罩挡住）先收掉
            var ctx = { row: row, loaded: false, busy: false, initChecked: [], xhr: null };
            op.groupCtx = ctx;
            var $m = op.view.find('#procmSetGroup');
            $m.find('.js_procm_group_title').text('已应用组（' + str(row.PNAME) + '）');   // 标题照策略中心；用 text 填，名称不会当 HTML
            $m.find(TREE_COUNT_SEL).text('0');
            $m.find('.js_procm_group_ok').prop('disabled', false);
            $m.modal('show');
            op.loadGroupTree(ctx);
        },

        /**
         * 让公共树组件画这条名单的分组树。参数照设计 01 §7.5：
         *   type 2（应用组树）、url = 取已选组的接口、pid、productid、eptype 2、showInheritBtn true（显示「继承」勾选框，
         *   和策略中心一样可点，10-23 用户定）、createId、selectedSpanId、callback；
         *   policyType 不传（传 '0' 会被当成默认策略，已勾的组取消不了）。
         *   productid：树组件会原样带给取已选组的接口 Policycenter/getUsedGroupId，它要求非空（空了报「参数错误」）；
         *   优先用这一行自己的 PRODUCTID，现在 getWBList 不返回它，就用 WBLIST_PRODUCTID（名单在库里实际存的产品号）。
         *   这个产品号还用来查「被其他策略锁定的组」（aLockGroupId：同产品号、其他 PID、ISLOCK=1 的组），那些组在树上不能勾。
         * 树组件没有「取消」的办法：它第一步 Group/getGroupTree 是在 createTree 里同步发出去的，RsCore.ajax 会把请求登记到
         *   RsCore.ajaxList（切页面时 core.js 用它统一取消），这里顺手记下这一个请求，弹窗关掉、离开页面时取消它，
         *   免得关掉之后它回来又去画树、又去请求取已选组。
         */
        loadGroupTree: function (ctx) {
            ctx.loaded = false;
            ctx.initChecked = [];
            op.abortGroupXhr(ctx);
            destroyTree();   // 先去掉上一棵树（含节点），新的画好之前树区是空的，「应用」也点不了（见 submitGroup）
            var list = RsCore.ajaxList;
            var before = $.isArray(list) ? list.length : -1;
            tree.createTree({
                type: 2,
                url: URL_USED_GROUP,
                pid: ctx.row.PID,
                productid: ctx.row.PRODUCTID || WBLIST_PRODUCTID,
                eptype: 2,
                // 显示「继承」勾选框（照策略中心）。点它由树组件调 group/pOpenClose（带上面的 productid、eptype 2）：
                //   ① 继承标记记在组上（GROUPINFO.ISINHERIT），不分产品，改了策略中心、其他产品也跟着变；
                //   ② 开继承时后端先删掉这个组在该产品号下的全部应用关系，再按父组补回一条——名单和进程策略同用
                //      PROCM 产品号，会连带删掉这个组的进程策略或名单关系，且不刷新名单缓存（设计 01 P24 ⑳，等后端修）。
                showInheritBtn: true,
                createId: TREE_ID,
                selectedSpanId: TREE_COUNT_SEL,
                callback: function (res) {
                    op.onGroupTreeLoaded(ctx, res);
                }
            });
            // createTree 只同步发了 Group/getGroupTree 这一个请求时，记下它（多了、少了都不认，不去碰别人的请求）
            if (before >= 0 && list === RsCore.ajaxList && list.length === before + 1) {
                ctx.xhr = list[before];
            }
        },

        /**
         * 分组树画好了（树组件的 callback）。res.checkTree = 这条名单原来已应用的组（取已选组接口返回的 aUsedGroupId）。
         * 不是当前这一次弹窗的（弹窗已关，或又打开了别的名单）：它刚把树画进了同一个 #procmGroupTree，
         *   先把它去掉、计数归 0；当前弹窗的树已经画好过、被它盖掉了的，重新画一遍当前名单的树。
         */
        onGroupTreeLoaded: function (ctx, res) {
            if (ctx !== op.groupCtx) {
                var cur = op.groupCtx;
                destroyTree();
                if (op.view) {
                    op.view.find(TREE_COUNT_SEL).text('0');
                }
                if (cur && cur.loaded) {
                    op.loadGroupTree(cur);
                }
                return;
            }
            ctx.loaded = true;
            ctx.xhr = null;
            ctx.initChecked = (res && $.isArray(res.checkTree)) ? res.checkTree : [];
            // 照策略中心：树区里的列表宽度跟着树的宽度走（树比弹窗宽时可以横向滚动）
            var $m = op.view ? op.view.find('#procmSetGroup') : $();
            $m.find('.set_group_main .c-account-ul').width($m.find('.set_group_main .zTreeDemoBackground').width());
        },

        /**
         * 点了「应用」：取勾选的全部组提交 Procmanager/usedGroup（pid、policytype、aObjId，PL-01 §4.5）
         *   树还没画好（或正在重画）时不做事；原来没有组、现在也一个没勾时直接关弹窗、不发请求（照策略中心 setGroup）；
         *   成功：弹 TXT_APPLY_OK、关弹窗、刷新表格（列表的应用范围随之更新）；失败：core.js 已弹过提示（F-12），弹窗留着
         *   （后端 code 4 = 名单还没发布，例如别人刚加了进程把它变成「有变更」）；
         *   没拿到明确结果（返回不是 JSON、超时等）时关弹窗、刷新列表，因为后端可能已经写了库（见 complete 里的说明）。
         *   不做二次认证（PL-01 Q1；策略中心这里会弹口令框，名单不弹）。
         */
        submitGroup: function () {
            var ctx = op.groupCtx;
            if (!ctx || !ctx.loaded || ctx.busy || !op.view) {
                return;
            }
            var zTree = $.fn.zTree ? $.fn.zTree.getZTreeObj(TREE_ID) : null;
            if (!zTree) {
                return;
            }
            // 设计 7.5：tree.getCheckedIds(nodes, true) 取勾选的全部组，它返回 [{groupid, islock}]；
            // aObjId 只要组号（PL-01 §4.5 / 设计 9.1.5「aObjId[]（勾选的全部组）」），
            // islock 是级联锁定用的，名单不支持级联（设计 7.5：aLockGroupId 固定空），不传
            var checked = tree.getCheckedIds(zTree.getNodes(), true);
            var ids = [];
            for (var i = 0; i < checked.length; i++) {
                ids.push(checked[i].groupid);
            }
            var $m = op.view.find('#procmSetGroup');
            if (!ctx.initChecked.length && !ids.length) {
                $m.modal('hide');
                return;
            }
            var token = op.token;
            var $ok = $m.find('.js_procm_group_ok');
            ctx.busy = true;
            $ok.prop('disabled', true);
            // aObjId 用 JSON 字符串发：jQuery 发请求时会把空数组整个丢掉，后端收不到 aObjId 就当「不改分组」，
            //   一个组都不勾（取消全部组）就失效了；发 "[]" 后端才认作「全部取消」（后端 parseObjIdList 支持 JSON 字符串）
            var answered = false;   // 后端有没有给出明确结果（成功回调或 error 回调被调过）
            RsCore.ajax(URL_SET_GROUPS, { pid: ctx.row.PID, policytype: op.cfg.type, aObjId: JSON.stringify(ids) }, function () {
                answered = true;
                RsCore.msg.success(TXT_APPLY_OK);
                if (token !== op.token) {
                    return;   // 已经离开本页：弹窗已随页面关掉，不刷新
                }
                if (op.groupCtx === ctx) {
                    $m.modal('hide');
                }
                op.reload();
            }, function () {
                // complete：成功、失败、网络层失败都会到这里；还是这一次的弹窗就把「应用」恢复（成功时弹窗已关）
                ctx.busy = false;
                if (token === op.token && op.groupCtx === ctx) {
                    $ok.prop('disabled', false);
                }
                // 没拿到明确结果（返回的不是 JSON、超时、断网等，core.js 已弹过「系统异常」类提示）：
                //   后端可能已经写了库（10-23 实测：usedGroup 写库提交后在更新终端版本号时报错，返回「0:服务异常」），
                //   所以刷新一下列表，让「应用范围」显示库里的真实情况；
                //   弹窗也关掉：它记的「打开时已选的组」（initChecked）可能已经和库里不一样了，留着再提交会按旧的判断
                //   （例：打开时没组 → 提交后库里有了 → 再全部取消，会被当成「原来没组、现在没勾」直接关窗、不发请求）。
                //   重新打开弹窗时会按库里的真实情况重新取已选组
                if (!answered && token === op.token) {
                    if (op.groupCtx === ctx) {
                        $m.modal('hide');
                    }
                    op.reload();
                }
            }, function () {
                answered = true;   // error 回调：后端明确拒绝了（如 code 4 名单还没发布），core.js 已弹原因，库没改，不用刷新
            });
        },

        /** 取消这一次还没回来的 Group/getGroupTree 请求（已经回来的取消了也没影响） */
        abortGroupXhr: function (ctx) {
            var x = ctx && ctx.xhr;
            if (ctx) {
                ctx.xhr = null;
            }
            if (x && typeof x.abort === 'function') {
                try {
                    x.abort();
                } catch (e) {
                    // 取消失败不影响后面：它回来时 onGroupTreeLoaded 会认出不是当前弹窗的
                }
            }
        },

        /** 应用到组弹窗关掉（或离开页面）时：清掉上下文、取消没回来的树请求、把树从 zTree 登记表里去掉 */
        closeGroup: function () {
            var ctx = op.groupCtx;
            op.groupCtx = null;
            op.abortGroupXhr(ctx);
            destroyTree();
            if (op.view) {
                op.view.find(TREE_COUNT_SEL).text('0');
            }
        },

        /**
         * 离开页面时：PL-01 TK-5 的 3 个弹窗开着的都关掉（关掉才会去掉加在 body 上的遮罩、解开 bootstrap 挂在 document 上的焦点事件）
         * 创建 / 编辑弹窗 #procmListModal 不在这里关，由 destroy 里的 bwlistModal.release() 关（PL-02 §四）
         */
        hideModals: function ($c) {
            $c.find('#procmPublishModal, #procmDelModal, #procmSetGroup').each(function () {
                var m = $(this).data('modal');   // bootstrap 2 弹窗对象：没打开过就没有
                if (m && m.isShown) {
                    $(this).modal('hide');
                }
            });
        },

        // ---------------------------------------------------------------
        // 高级查询
        // ---------------------------------------------------------------

        /** 点「筛选」：关键字、指定日期生效；填了指定日期时「时间范围」的点选项都取消（以指定日期为准，照 demo） */
        applyInput: function () {
            var view = op.view;
            var from = view.find('.js_procm_from').val() || '';
            var to = view.find('.js_procm_to').val() || '';
            op.cond.kw = $.trim(view.find('.js_procm_kw').val() || '');
            op.cond.cfrom = from;
            op.cond.cto = to;
            var $timeChips = view.find('.js_procm_chips[data-key="ctime"]').children('a');
            if (from || to) {
                op.cond.ctime = '';
                $timeChips.removeClass('active');
            } else if (!$timeChips.filter('.active').length) {
                $timeChips.filter('[val=""]').addClass('active');   // 没有日期也没有选中项：回到「全部」
            }
            op.reload();
        },

        /** 点了某个点选项：这一组只选中它，条件立刻生效；「时间范围」的点选项（ctime：week / month / lastmonth）同时清掉指定日期（两者只取一个，照 demo） */
        pickChip: function ($a) {
            var $group = $a.closest('.js_procm_chips');
            var key = $group.attr('data-key');
            if (!EMPTY_COND.hasOwnProperty(key)) {
                return;
            }
            $group.children('a').removeClass('active');
            $a.addClass('active');
            op.cond[key] = $a.attr('val') || '';
            if (key === 'ctime') {
                op.view.find('.js_procm_from, .js_procm_to').val('');
                op.cond.cfrom = '';
                op.cond.cto = '';
            }
            op.reload();
        },

        /** 点「重置」：所有条件回到默认（工具栏的系统类型回到固定的 Linux/信创，下拉现在是隐藏的） */
        resetCond: function () {
            var view = op.view;
            op.cond = $.extend({}, EMPTY_COND);
            view.find('.js_procm_chips').each(function () {
                $(this).children('a').removeClass('active').filter('[val=""]').addClass('active');
            });
            view.find('.js_procm_from, .js_procm_to, .js_procm_kw').val('');
            view.find('.js_procm_systype').val(EMPTY_COND.systype).selectric('refresh');
            view.find('.js_procm_field').val('name').selectric('refresh');
            op.reload();
        },

        /**
         * 指定日期：用现有 datetimepicker（写法照 log.js：只选日期，开始不晚于结束、都不晚于今天）
         * 「今天」取中心时间（北京时间，UTC+8）的日期，和后端算本周 / 本月 / 上月用的 SCommon::getDateRanges
         *   （先设了 Asia/Shanghai 时区）同一口径，和浏览器在哪个时区无关（PL-01 整体审 I1）：
         *   浏览器不在东八区时（如美东夏令时 12:00～24:00 已是北京第二天），用本机日期会出现「本周 / 本月」算进了北京当天新建的名单、
         *   「指定日期」却选不到这一天。
         *   算法：当前时刻（毫秒）加 8 小时，再用 getUTC* 读年月日（北京没有夏令时，固定 UTC+8）。
         *   每次打开选择器（onShow）时现算：后端每次查询都按当时的时刻取「今天」，页面一直开着跨过北京零点时，
         *   这里也跟着变成新的一天，两边对得上。
         * 注意：同目录 log.js 的日期选择器用的是本机日期；log.js 不在本计划范围，本次不改它。
         */
        initDatePicker: function (view) {
            /** 北京时间的今天，拼成 datetimepicker 要的 'Y/M/D'；北京时间 = UTC + 8 小时，只用 getUTC* 读 */
            function bjToday() {
                var bj = new Date(new Date().getTime() + 8 * 3600 * 1000);
                return [bj.getUTCFullYear(), bj.getUTCMonth() + 1, bj.getUTCDate()].join('/');
            }
            var $from = view.find('.js_procm_from');
            var $to = view.find('.js_procm_to');
            $from.datetimepicker({
                format: 'Y-m-d',
                timepicker: false,
                closeOnDateSelect: true,
                onShow: function () {
                    this.setOptions({
                        maxDate: $to.val() ? $to.val().replace(/[-]/g, '/') : bjToday()
                    });
                }
            });
            $to.datetimepicker({
                format: 'Y-m-d',
                timepicker: false,
                closeOnDateSelect: true,
                onShow: function () {
                    this.setOptions({
                        maxDate: bjToday(),
                        minDate: $from.val() ? $from.val().replace(/[-]/g, '/') : false
                    });
                }
            });
        },

        // ---------------------------------------------------------------
        // 发布状态的悬停说明（表头一份固定说明、每行一份按数据拼的说明，内容照 demo）
        // 表格表头、表体都在会滚动 / 裁剪的容器里，所以说明框放在页面上、用 fixed 定位，按鼠标所在元素的位置摆
        // ---------------------------------------------------------------

        /** 这一行的说明：为什么是这个状态 + 下一步做什么（照 demo；「应用到终端」本期不做，设计 8.8 第 3 条，提示里也去掉） */
        rowTipHtml: function (row) {
            var name = op.cfg.name;
            var s = pubStatus(row.PUBSTATUS);
            var base = toInt(row.PROCNUM);
            var add = toInt(row.ADDNUM);
            var del = toInt(row.DELNUM);
            var gc = toInt(row.GROUPNUM);
            var hc = toInt(row.EPNUM);
            var applied = gc > 0;                               // 设过应用范围（名单只挂组）
            var parts = [];
            if (add > 0) {
                parts.push('新增 ' + add + ' 个');
            }
            if (del > 0) {
                parts.push('移除 ' + del + ' 个');
            }
            var chg = parts.join('、');                          // 还没发布的增减
            var toZero = s === 3 && (base + add - del) <= 0;    // 有变更、但发布后进程数会变成 0
            var where = gc + ' 个组 ' + hc + ' 台终端';
            var why;
            var next;
            if (s === 0) {
                why = '还没有任何进程，不能发布。';
                next = '下一步：到「进程」页添加进程，然后点「发布」。';
            } else if (s === 1) {
                why = '加了 ' + add + ' 个进程，还没发布过，终端上没有这条' + name + '。';
                next = '下一步：点「发布」把内容定稿，再设置应用范围（自动下发）。';
            } else if (s === 2) {
                // 已应用的两句按设计 01 §6.5 心跳拉取口径写（PL-01 TK-5，TK-3 内审第 2 轮 S2 转入）：
                //   中心不推送，在线终端下次心跳（默认 5 分钟内）才拉到，离线终端上线后才拉到；
                //   demo 原句「终端上就是当前的 K 个进程」「终端已是最新」说成了终端已经拿到，不照抄
                why = applied ? '内容已定稿（' + base + ' 个进程），已应用到 ' + where + '：在线终端下次心跳（默认 5 分钟内）生效，离线终端上线后生效。'
                    : '内容已定稿（' + base + ' 个进程），还没设置应用范围，终端上没有它。';
                next = applied ? '不需要操作。改应用范围会自动下发，组内终端下次心跳生效。' : '下一步：点「应用到组」，选完自动下发。';
            } else {
                why = '发布过（' + base + ' 个进程），之后' + chg + '还没发布' + (applied ? '，终端上跑的还是旧版本。' : '。');
                next = toZero ? '发布后进程数会变成 0，不能发布；要清掉这条名单请直接删除。'
                    : '下一步：点「发布」' + (applied ? '，会自动下发到终端。有变更时不能改应用范围。' : '把变更定稿，再设置应用范围。');
            }
            return '<div class="procm-tip-key procm-tipc' + s + '">' + PUB_TEXT[s] + '</div>' +
                '<div class="procm-tip-line">' + esc(why) + '</div>' +
                '<div class="procm-tip-next">' + esc(next) + '</div>';
        },

        /** 鼠标移到说明图标 / 状态文字上：填内容、摆位置、显示 */
        showTip: function (el) {
            if (!op.view) {
                return;
            }
            var $tip = op.view.find('.js_procm_tipbox');
            var isHead = $(el).attr('data-tip') === 'head';
            if (isHead) {
                $tip.find('.js_procm_tiprow').empty().hide();
                $tip.find('.js_procm_tiphead').show();
                $tip.addClass('procm-tip-wide');
            } else {
                var row = op.getRow($(el).closest('tr').attr('data-index'));
                if (!row) {
                    return;
                }
                $tip.find('.js_procm_tiphead').hide();
                $tip.find('.js_procm_tiprow').html(op.rowTipHtml(row)).show();
                $tip.removeClass('procm-tip-wide');
            }
            // 先放到屏幕外显示出来量尺寸，再摆到元素下方（下方放不下就放上方；左右不出窗口）
            $tip.css({ left: '-9999px', top: '-9999px' }).show();
            var rect = el.getBoundingClientRect();
            var tw = $tip.outerWidth();
            var th = $tip.outerHeight();
            var ww = $(window).width();
            var wh = $(window).height();
            var left = isHead ? (rect.right + 8 - tw) : (rect.left - 8);   // 表头说明右对齐、行说明左对齐（照 demo）
            if (left + tw > ww - 8) {
                left = ww - 8 - tw;
            }
            if (left < 8) {
                left = 8;
            }
            var top = rect.bottom + 8;
            if (top + th > wh - 8) {
                top = rect.top - 8 - th;
            }
            if (top < 8) {
                top = 8;
            }
            $tip.css({ left: left + 'px', top: top + 'px' });
        },

        /** 隐藏说明框 */
        hideTip: function () {
            if (op.view) {
                op.view.find('.js_procm_tipbox').hide();
            }
        },

        // ---------------------------------------------------------------
        // 事件：全部用事件委托挂在页面容器上（命名空间 .procmList），离开页面时随容器一起 off
        // ---------------------------------------------------------------
        initEvent: function (view) {
            // 下拉美化（照现有页面）
            view.find('select').selectric({ inheritOriginalWidth: true });
            op.initDatePicker(view);

            // 折叠：点表体的数据行（含箭头、名称）展开 / 收起；插入的按钮行没有 data-index，不会触发
            view.on('click.procmList', '#tbClient > tbody > tr[data-index]', function () {
                op.toggleRow($(this));
            });
            // 展开行的按钮：按 data-op 分给 op.actions 里对应的处理函数；灰色按钮（procm-op-off）只看悬停说明，点了不做事（PL-01 §五）
            view.on('click.procmList', '.js_procm_op', function (e) {
                e.stopPropagation();
                var $btn = $(this);
                if ($btn.hasClass('procm-op-off')) {
                    return;
                }
                var fn = op.actions[$btn.attr('data-op')];
                var row = op.getRow($btn.attr('data-index'));
                if (row && typeof fn === 'function') {
                    fn(row, $btn);
                }
            });
            // 「应用范围」列的「组【 N 】」：弹出已应用组（10-23）；拦住冒泡，不让这一下同时展开 / 收起这一行
            view.on('click.procmList', '.js_procm_seegroup', function (e) {
                e.stopPropagation();
                op.openSeeGroup($(this).closest('tr[data-index]').attr('data-index'));
            });
            // 工具栏「创建…」
            view.on('click.procmList', '.js_procm_create', function () {
                op.actions.create();
            });
            // 面包屑「进程管控」：回概览（地址带 g，见 goOverview）
            view.on('click.procmList', '.js_procm_crumb_overview', function (e) {
                e.preventDefault();
                op.goOverview();
            });
            // 系统类型筛选：选了立刻查（10-23 起下拉隐藏，用户点不到；留着给二期 Windows 用）
            view.on('change.procmList', '.js_procm_systype', function () {
                op.cond.systype = $(this).val() || '';
                op.reload();
            });

            // 高级查询：点选项立刻查
            view.on('click.procmList', '.js_procm_chips > a', function () {
                op.pickChip($(this));
                return false;
            });
            // 「筛选」：关键字、指定日期生效
            view.on('click.procmList', '.js_procm_search', function () {
                op.applyInput();
            });
            // 关键字框里按回车 = 点「筛选」（照旧骨架）；表单不提交，免得整页刷新
            view.on('keydown.procmList', '.js_procm_kw', function (e) {
                if (e.keyCode === 13) {
                    e.preventDefault();
                    op.applyInput();
                }
            });
            view.on('submit.procmList', '.js_procm_form', function () {
                return false;
            });
            // 「重置」
            view.on('click.procmList', '.js_procm_reset', function () {
                op.resetCond();
            });

            // 发布状态的悬停说明
            view.on('mouseenter.procmList', '.js_procm_tip', function () {
                op.showTip(this);
            });
            view.on('mouseleave.procmList', '.js_procm_tip', function () {
                op.hideTip();
            });
            // 滚动时说明框会和元素错位，先收起
            view.on('mousewheel.procmList DOMMouseScroll.procmList', function () {
                op.hideTip();
            });

            // 3 个弹窗（PL-01 TK-5）：「取消」关弹窗（右上角叉带 data-dismiss，bootstrap 自己关）
            view.on('click.procmList', '.js_procm_modal_cancel', function () {
                $(this).closest('.modal').modal('hide');
                return false;
            });
            // 确认弹窗的「发布」「删除」、应用到组的「应用」
            view.on('click.procmList', '.js_procm_publish_ok', function () {
                op.submitConfirm('publish');
                return false;
            });
            view.on('click.procmList', '.js_procm_del_ok', function () {
                op.submitConfirm('del');
                return false;
            });
            view.on('click.procmList', '.js_procm_group_ok', function () {
                op.submitGroup();
                return false;
            });
            // 弹窗关掉（点确定成功、取消、叉、按 Esc 都会触发 hidden）：清掉这一次的上下文；只认弹窗自己的事件
            view.on('hidden.procmList', '#procmPublishModal, #procmDelModal', function (e) {
                if (e.target === this) {
                    op.confirmCtx = null;
                }
            });
            view.on('hidden.procmList', '#procmSetGroup', function (e) {
                if (e.target === this) {
                    op.closeGroup();
                }
            });

            // 窗口大小变化：表格高度跟着变
            $(window).on('resize.procmList', function () {
                op.resizeTable();
            });
        },

        /** 离开页面：作废未返回的请求、还原 RsCore.ajax、收掉进程视图、关掉创建 / 编辑弹窗和已应用组弹窗、还原公共布局、清掉页面 */
        destroy: function (container) {
            op.token = null;          // 还没返回的请求回来后什么都不做
            // 进程视图开着时离开（点左侧菜单等）：先收掉它（关添加弹窗、销毁日期弹层 / 表格、解绑事件，PL-04 §5.1）；没打开过也能调
            bwlistProc.release();
            bwlistMock.uninstall();   // 还原 RsCore.ajax（PL-01 §4.1、R-2；先做，后面清页面出错也不影响）
            // 创建 / 编辑弹窗还开着（比如按浏览器后退离开）：关掉（去掉 body 上的遮罩）、清上下文，之后回来的请求不再动页面（PL-02 §五「离开页面」）
            bwlistModal.release();
            // 已应用组弹窗开着时离开：关掉（去掉遮罩）、销毁里面的表格、解绑（10-23）
            bwlistUsedGroup.release();
            op.restoreLayout();
            $(window).off('resize.procmList');
            var $c = $(container);
            // 本页自己的 3 个弹窗（PL-01 TK-5）：开着的先关掉（去掉 body 上的遮罩），再清上下文、取消没回来的树请求、销毁分组树
            op.hideModals($c);
            op.confirmCtx = null;
            op.closeGroup();
            try {
                $c.find('.js_procm_from, .js_procm_to').datetimepicker('destroy');   // 日历弹层挂在 body 上，要单独销毁
            } catch (e) {
                // 日期控件没建起来（页面初始化中途出错）时忽略
            }
            // 关掉表格的列宽拖拽（照同目录 log.js、overview.js 的 destroy 写法；不关的话插件里一直记着这张已清掉的表）
            $c.find('#tbClient').colResizable({ 'disable': true });
            $c.off().empty();
            op.view = null;
        }
    };

    return {
        container: '.c-page-content',
        render: function (container, paramStr) {
            op.init(container, paramStr);
        },
        destroy: function () {
            op.destroy(this.container);
        }
    };
});
