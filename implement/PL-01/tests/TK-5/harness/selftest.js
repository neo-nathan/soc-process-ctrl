/*
 * PL-01 TK-5 Executor 单元级自测（只在本地自测页面 index.html 里跑，不进 SOC 源码、不进本仓库）
 * 用法：python3 serve.py 8795 后，浏览器打开 http://127.0.0.1:8795/index.html（?lmut=N 换成变异版 list.js），
 *       控制台执行 await window.__selftest()，返回 {pass, fail, items}
 * 被测：SOC 工作副本里的 processManage/list.js、list.html、css/processManageList.css（本次改）；
 *       bwlistMock.js（TK-2，不改）、processManage.js（TK-4，不改）、101 只读副本的 strategy/tree.js（不改）。
 * 期望值一律取自基线原文（PL-01 §五「发布」「删除」「应用到组」与规则表、设计 01 §6.5 / §8.8 第 2、12 条、
 *   bwlistMock 的 MSG 与 101 delWBListAction 的返回文字），不取自被测代码。
 * 这里只验「代码按我写的意图跑」（单元级）；计划级验收 S-5、S-8、S-9、S-10 后半由独立 Tester 在 101 上做。
 */
window.__selftest = async function () {
    var items = [];
    function ok(name, cond, detail) { items.push({ ok: !!cond, name: name, detail: detail === undefined ? '' : String(detail) }); }
    function w(n) { return new Promise(function (r) { setTimeout(r, n === undefined ? 300 : n); }); }
    function req(name) { return new Promise(function (r) { require([name], r); }); }
    var mock = await req('processManage/bwlistMock');

    // ---------- 期望值（基线原文） ----------
    var T_HEART = '组内终端下次心跳（默认 5 分钟内）生效';                 // PL-01 §五「发布」已应用多的一句
    var T_PUB_UN = '发布后才能应用到组';                                 // PL-01 §五「发布」没应用多的一句
    var T_HINT = '没有名单的组，组内终端不按名单判断；新建子组会自动带上父组的名单';   // PL-01 §五「应用到组」、设计 7.5
    function T_PUB1(x, k) { return '确定发布「' + x + '」吗？发布后进程数为 ' + k + '。'; }
    function T_DEL1(x) { return '确定删除「' + x + '」吗？删除后不能恢复。'; }
    function T_DEL2(n, m) { return '该名单已应用到 ' + n + ' 个组、' + m + ' 台终端。删除后，这些终端下次拉取策略时会清掉本地名单（在线终端默认 5 分钟内，离线终端上线后）'; }
    var M_PUB_AP = '已发布，组内终端下次心跳（默认 5 分钟内）生效';      // bwlistMock MSG.PUBLISH_APPLIED（PL-01 §4.3）
    var M_PUB_UN = '已发布，应用到组后下发';                             // MSG.PUBLISH_UNAPPLIED
    var M_APPLY = '应用成功，组内终端下次心跳（默认 5 分钟内）生效';      // MSG.APPLY（§4.5）
    var M_DEL = '删除成功。';                                           // 101 delWBListAction $this->ok('', '删除成功。')

    // ---------- 工具 ----------
    var spyLog = [];
    var mockAjax = null;
    function spyOn() {   // 在 mock 包装外面再套一层只记录的壳（离开页面前一定要 spyOff，否则 mock 还原不了）
        mockAjax = RsCore.ajax;
        RsCore.ajax = function (url, p) {
            spyLog.push({ url: url, param: (p && typeof p === 'object') ? JSON.parse(JSON.stringify(p)) : p, raw: p });
            return mockAjax.apply(this, arguments);
        };
    }
    function spyOff() { if (mockAjax) { RsCore.ajax = mockAjax; mockAjax = null; } }
    function calls(url) { return spyLog.filter(function (x) { return x.url === url; }); }
    function fakeCalls(url) { return window.__ajaxLog.filter(function (x) { return x.url === url; }); }
    function msgsSince(n) { return window.__msgLog.slice(n); }
    async function go(tab, mode) {
        spyOff();
        mock.setMode(mode);
        mock.reset();
        await window.__goChild('list', 'tab=' + tab);
        await w(600);
        spyOn();
    }
    async function leave() { spyOff(); window.__leaveChild(); await w(50); }
    function rows() { return $('.procm-bwlist #tbClient > tbody > tr[data-index]'); }
    function rowByName(name) {
        return rows().filter(function () { return $(this).find('.js_procm_name').text() === name; }).first();
    }
    async function expand(name) {
        var $tr = rowByName(name);
        if (!$tr.length) { return null; }
        if (!$tr.hasClass('procm-row-open')) { $tr.find('td').eq(3)[0].click(); await w(30); }
        return $tr.next('tr.procm-append-tr');
    }
    async function btn(name, op) { var $r = await expand(name); return $r ? $r.find('li[data-op=' + op + ']') : $(); }
    function visible(sel) { return $(sel).is(':visible'); }
    function lines(sel) { return $(sel).find('.js_procm_confirm_text > div').map(function () { return $(this).text(); }).get(); }
    function backdrops() { return $('.modal-backdrop').length; }
    function zt() { return $.fn.zTree ? $.fn.zTree.getZTreeObj('procmGroupTree') : null; }
    function nodeById(id) { var z = zt(); return z ? z.getNodeByParam('id', id) : null; }
    function focusinModal() {
        var ev = $._data(document, 'events') || {};
        return (ev.focusin || []).filter(function (h) { return h.namespace === 'modal'; }).length;
    }

    try {
        window.__leaveAll();
        window.__resetBackend();
        window.__ajaxLog.length = 0;
        window.__msgLog.length = 0;
        window.__errors.length = 0;
        window.__xss = undefined;

        // =================================================================
        // G. 按钮置灰规则（PL-01 §五 规则表 = 设计 7.2）：fake 模式用 demo 的 10 种情形
        // =================================================================
        await go('white', 'fake');
        var G = [
            // [名称, 发布灰?, 发布悬停要含, 应用到组灰?, 应用到组悬停要含]
            ['Web 服务白名单', true, '没有变更', false, ''],                 // 已发布、已应用
            ['数据库服务白名单', false, T_HEART, true, '先发布'],             // 有变更 9 -1、已应用
            ['邮件服务白名单', true, '没有变更', false, ''],                 // 已发布、未应用
            ['人事系统白名单', false, '应用到组后下发', true, '先发布'],      // 有变更 5 +2、未应用
            ['打印服务白名单', false, '应用到组后下发', true, '先发布'],      // 待发布 0 +7
            ['财务系统白名单', true, '至少保留 1 个进程', true, '先发布'],    // 有变更 6 -6：发布后为 0
            ['门户网站白名单', true, '空名单不能发布', true, '先添加进程并发布']   // --
        ];
        for (var gi = 0; gi < G.length; gi++) {
            var g = G[gi];
            var $pub = await btn(g[0], 'publish');
            var $grp = await btn(g[0], 'group');
            ok('G' + gi + 'a ' + g[0] + '：发布' + (g[1] ? '灰' : '可点'), $pub.length === 1 && $pub.hasClass('procm-op-off') === g[1] && ($pub.attr('aria-disabled') === 'true') === g[1], $pub.attr('class'));
            ok('G' + gi + 'b ' + g[0] + '：发布悬停含「' + g[2] + '」', ($pub.attr('title') || '').indexOf(g[2]) > -1, $pub.attr('title'));
            ok('G' + gi + 'c ' + g[0] + '：应用到组' + (g[3] ? '灰' : '可点'), $grp.length === 1 && $grp.hasClass('procm-op-off') === g[3], $grp.attr('class'));
            if (g[4]) { ok('G' + gi + 'd ' + g[0] + '：应用到组悬停含「' + g[4] + '」', ($grp.attr('title') || '').indexOf(g[4]) > -1, $grp.attr('title')); }
            var $r = await expand(g[0]);
            ok('G' + gi + 'e ' + g[0] + '：编辑、进程、删除都能点', $r.find('li[data-op=edit],li[data-op=proc],li[data-op=del]').filter('.procm-op-off').length === 0 && $r.find('li').length === 5);
            ok('G' + gi + 'f ' + g[0] + '：发布悬停不说「已发布并下发到」「立即」（8.8 第 12 条）', !/已发布并下发到|立即/.test($pub.attr('title') || ''), $pub.attr('title'));
            var dt = $r.find('li[data-op=del]').attr('title') || '';
            ok('G' + gi + 'g ' + g[0] + '：删除悬停不说「清除策略」（8.8 第 2 条）', dt.indexOf('清除策略') < 0 && dt.indexOf('删除名单') === 0, dt);
        }
        var $webDel = (await expand('Web 服务白名单')).find('li[data-op=del]');
        ok('G7 已应用名单的删除悬停：下次拉取策略时清掉本地名单（7.6）', ($webDel.attr('title') || '').indexOf('下次拉取策略时会清掉本地名单') > -1, $webDel.attr('title'));
        // 灰色按钮的样子：禁止光标、灰字；删除仍是红色
        var $off = await btn('门户网站白名单', 'publish');
        ok('G8 灰色按钮：禁止光标、灰字（照 demo .obtn.off）', $off.css('cursor') === 'not-allowed' && $off.css('color') === 'rgb(176, 184, 196)', $off.css('cursor') + ' ' + $off.css('color'));
        var $red = await btn('门户网站白名单', 'del');
        ok('G9 删除按钮保持红色（TK-3 改裁 B2）', $red.css('color') === 'rgb(237, 84, 82)', $red.css('color'));
        // 点灰色按钮：不开弹窗、不发请求
        var nCall = spyLog.length;
        $off[0].click(); await w(80);
        (await btn('门户网站白名单', 'group'))[0].click(); await w(80);
        ok('G10 点灰色的发布、应用到组：不开弹窗、不发请求', !visible('#procmPublishModal') && !visible('#procmSetGroup') && spyLog.length === nCall && backdrops() === 0);

        // =================================================================
        // S. 已发布、已应用行的状态说明按设计 6.5 心跳口径（TK-3 内审第 2 轮 S2）
        // =================================================================
        var $st = rowByName('Web 服务白名单').find('.procm-st');
        $st.trigger('mouseenter'); await w(30);
        var tipText = $('.procm-bwlist .js_procm_tiprow').text();
        ok('S1 已发布已应用：说明含「在线终端下次心跳（默认 5 分钟内）生效，离线终端上线后生效」', tipText.indexOf('在线终端下次心跳（默认 5 分钟内）生效，离线终端上线后生效') > -1, tipText);
        ok('S2 已发布已应用：不再说「终端上就是当前…」「终端已是最新」', tipText.indexOf('终端上就是当前') < 0 && tipText.indexOf('终端已是最新') < 0, tipText);
        $st.trigger('mouseleave');

        // =================================================================
        // P. 发布（PL-01 §五「发布」、§4.3）
        // =================================================================
        (await btn('人事系统白名单', 'publish'))[0].click(); await w(60);
        var L = lines('#procmPublishModal');
        ok('P1 未应用：弹窗打开，标题「发布白名单」', visible('#procmPublishModal') && $('#procmPublishModal .modal-header h3').text() === '发布白名单' && backdrops() === 1, $('#procmPublishModal .modal-header h3').text());
        ok('P2 未应用：文案 = 原文第一句 + 「发布后才能应用到组」', L.length === 2 && L[0] === T_PUB1('人事系统白名单', 7) && L[1] === T_PUB_UN, JSON.stringify(L));
        nCall = calls('Procmanager/publishWBList').length;
        $('#procmPublishModal .js_procm_modal_cancel')[0].click(); await w(60);
        ok('P3 取消：弹窗关、遮罩去掉、不发请求', !visible('#procmPublishModal') && backdrops() === 0 && calls('Procmanager/publishWBList').length === nCall);
        (await btn('数据库服务白名单', 'publish'))[0].click(); await w(60);
        L = lines('#procmPublishModal');
        ok('P4 已应用：文案 = 原文第一句 + 「组内终端下次心跳（默认 5 分钟内）生效」', L.length === 2 && L[0] === T_PUB1('数据库服务白名单', 8) && L[1] === T_HEART, JSON.stringify(L));
        var nMsg = window.__msgLog.length;
        var nList = calls('Procmanager/getWBList').length;
        $('#procmPublishModal .js_procm_publish_ok')[0].click();
        $('#procmPublishModal .js_procm_publish_ok')[0].click();   // 连点
        await w(250);
        var pc = calls('Procmanager/publishWBList');
        ok('P5 连点两次只发一次 publishWBList，参数 pid、policytype=2', pc.length === nCall + 1 && pc[pc.length - 1].param.pid === '90000002' && pc[pc.length - 1].param.policytype === 2 && Object.keys(pc[pc.length - 1].param).sort().join() === 'pid,policytype', JSON.stringify(pc[pc.length - 1] && pc[pc.length - 1].param));
        var sm = msgsSince(nMsg);
        ok('P6 成功：只弹一次接口给的提示（已应用的那句）', sm.length === 1 && sm[0].kind === 'success' && sm[0].title === M_PUB_AP, JSON.stringify(sm));
        ok('P7 成功：弹窗关、遮罩去掉、表格刷新', !visible('#procmPublishModal') && backdrops() === 0 && calls('Procmanager/getWBList').length > nList);
        var $db = rowByName('数据库服务白名单');
        ok('P8 发布后：状态已发布、进程数合并成 8（没有 +N / -M）', $db.find('.procm-st').text().indexOf('已发布') > -1 && $.trim($db.find('.procm-num').text()) === '8', $db.find('.procm-num').text());
        var $dbPub = await btn('数据库服务白名单', 'publish');
        ok('P9 发布后：发布变灰（没有变更）、应用到组能点', $dbPub.hasClass('procm-op-off') && !(await btn('数据库服务白名单', 'group')).hasClass('procm-op-off'));
        // 未应用的发布：提示换成「已发布，应用到组后下发」
        (await btn('人事系统白名单', 'publish'))[0].click(); await w(60);
        nMsg = window.__msgLog.length;
        $('#procmPublishModal .js_procm_publish_ok')[0].click(); await w(250);
        sm = msgsSince(nMsg);
        ok('P10 未应用名单发布成功：提示「已发布，应用到组后下发」', sm.length === 1 && sm[0].title === M_PUB_UN, JSON.stringify(sm));
        // 失败：打开确认框后，状态被别处改成已发布（mock 拒绝）→ core 那层弹一次「错误」，页面不再弹；弹窗留着、按钮恢复
        (await btn('打印服务白名单', 'publish'))[0].click(); await w(60);
        await new Promise(function (r) { RsCore.ajax('Procmanager/publishWBList', { pid: '90000007', policytype: 2 }, function () { r(); }); });
        nMsg = window.__msgLog.length;
        $('#procmPublishModal .js_procm_publish_ok')[0].click(); await w(250);
        sm = msgsSince(nMsg);
        ok('P11 失败：只有 mock（= core.js）弹的一次「错误」，页面不再弹（F-12）', sm.length === 1 && sm[0].kind === 'warn' && sm[0].title === '错误', JSON.stringify(sm));
        ok('P12 失败：弹窗留着、「发布」按钮恢复可点', visible('#procmPublishModal') && !$('#procmPublishModal .js_procm_publish_ok').prop('disabled'));
        $('#procmPublishModal .modal-header .close')[0].click(); await w(60);
        ok('P13 右上角叉：弹窗关、遮罩去掉', !visible('#procmPublishModal') && backdrops() === 0);

        // =================================================================
        // D1. 删除确认文案（fake 模式：PID 库里没有，删除会被假后端回「名单不存在」，正好验失败）
        // =================================================================
        (await btn('门户网站白名单', 'del'))[0].click(); await w(60);
        L = lines('#procmDelModal');
        ok('D1 未应用：标题「删除白名单」、只有第一句', visible('#procmDelModal') && $('#procmDelModal .modal-header h3').text() === '删除白名单' && L.length === 1 && L[0] === T_DEL1('门户网站白名单'), JSON.stringify(L));
        ok('D2 「删除」按钮红色（照 demo 删除弹窗）', $('#procmDelModal .js_procm_del_ok').css('background-color') === 'rgb(229, 57, 53)', $('#procmDelModal .js_procm_del_ok').css('background-color'));
        $('#procmDelModal .js_procm_modal_cancel')[0].click(); await w(60);
        (await btn('Web 服务白名单', 'del'))[0].click(); await w(60);
        L = lines('#procmDelModal');
        ok('D3 已应用：第一句 + 原文提醒句（1 个组、24 台终端）', L.length === 2 && L[0] === T_DEL1('Web 服务白名单') && L[1] === T_DEL2(1, 24), JSON.stringify(L));
        ok('D4 已应用提醒句是红字', $('#procmDelModal .procm-confirm-warn').css('color') === 'rgb(229, 57, 53)', $('#procmDelModal .procm-confirm-warn').css('color'));
        nMsg = window.__msgLog.length;
        $('#procmDelModal .js_procm_del_ok')[0].click(); await w(150);
        var dc = fakeCalls('Procmanager/delWBList');
        sm = msgsSince(nMsg);
        ok('D5 删除走真接口 delWBList（mock 不拦），参数 pid、policytype=2', dc.length === 1 && dc[0].param.pid === '90000001' && dc[0].param.policytype === 2 && Object.keys(dc[0].param).sort().join() === 'pid,policytype', JSON.stringify(dc));
        ok('D6 失败（名单不存在）：只弹一次「错误」、弹窗留着、按钮恢复', sm.length === 1 && sm[0].title === '错误' && visible('#procmDelModal') && !$('#procmDelModal .js_procm_del_ok').prop('disabled'), JSON.stringify(sm));
        // 按 Esc 关
        var esc = $.Event('keyup'); esc.which = 27; $('#procmDelModal').trigger(esc); await w(60);
        ok('D7 按 Esc：弹窗关、遮罩去掉', !visible('#procmDelModal') && backdrops() === 0);
        await leave();

        // =================================================================
        // A. 应用到组（real 模式：假后端的名单 + mock 按 PID 算的字段；PID 2、7 已发布，8 待发布，9 有变更，3 --）
        // =================================================================
        await go('white', 'real');
        ok('A0 real 模式：5 条名单', rows().length === 5, rows().length);
        var nTree = fakeCalls('Group/getGroupTree').length;
        (await btn('PL01测试-已发布A', 'group'))[0].click(); await w(300);
        ok('A1 打开：标题「已应用组（名称）」、提示文字是名单的说法', visible('#procmSetGroup') && $('#procmSetGroup .js_procm_group_title').text() === '已应用组（PL01测试-已发布A）' && $('#procmSetGroup .info-tips').text().indexOf(T_HINT) > -1, $('#procmSetGroup .info-tips').text());
        ok('A2 分组树画好：5 个组、已选 0、Group/getGroupTree 调了一次', zt() && zt().transformToArray(zt().getNodes()).length === 5 && $('#procmGroupTreeCount').text() === '0' && fakeCalls('Group/getGroupTree').length === nTree + 1);
        var ug = calls('Procmanager/getWBListUsedGroupId');
        ok('A3 取已选组：树组件发 getWBListUsedGroupId，pid=2、eptype=2', ug.length === 1 && ug[0].param.pid === '2' && ug[0].param.eptype === 2, JSON.stringify(ug));
        ok('A4 不显示「继承」勾选框（showInheritBtn:false）', $('#procmSetGroup .ncheckbox-inherit').length === 0);
        ok('A5 开了继承的子组不能单独勾、其他组能勾（树组件规则）', nodeById('4').chkDisabled === true && !nodeById('3').chkDisabled && !nodeById('1').chkDisabled);
        nMsg = window.__msgLog.length;
        $('#procmSetGroup .js_procm_group_ok')[0].click(); await w(150);
        ok('A6 原来没有组、现在也没勾：直接关，不发 setWBListGroups、不弹提示', !visible('#procmSetGroup') && backdrops() === 0 && calls('Procmanager/setWBListGroups').length === 0 && msgsSince(nMsg).length === 0);
        ok('A7 关掉后：分组树从 zTree 登记表里去掉、树区清空', zt() === null && $('#procmGroupTree').children().length === 0);
        (await btn('PL01测试-已发布A', 'group'))[0].click(); await w(300);
        zt().checkNode(nodeById('3'), true, false, true); await w(30);   // 勾「服务器」，开继承的子组跟着勾上
        ok('A8 勾「服务器」：继承子组跟着勾、已选 2', nodeById('4').checked === true && $('#procmGroupTreeCount').text() === '2', $('#procmGroupTreeCount').text());
        nMsg = window.__msgLog.length;
        nList = calls('Procmanager/getWBList').length;
        $('#procmSetGroup .js_procm_group_ok')[0].click();
        $('#procmSetGroup .js_procm_group_ok')[0].click();   // 连点
        await w(300);
        var sg = calls('Procmanager/setWBListGroups');
        ok('A9 提交一次 setWBListGroups：pid=2、policytype=2、aObjId = 组号数组 [3,4]', sg.length === 1 && sg[0].param.pid === '2' && sg[0].param.policytype === 2 && JSON.stringify(sg[0].param.aObjId) === '["3","4"]' && Object.keys(sg[0].param).sort().join() === 'aObjId,pid,policytype', JSON.stringify(sg));
        sm = msgsSince(nMsg);
        ok('A10 成功：只弹一次接口给的提示、弹窗关、遮罩去掉、表格刷新', sm.length === 1 && sm[0].title === M_APPLY && !visible('#procmSetGroup') && backdrops() === 0 && calls('Procmanager/getWBList').length > nList, JSON.stringify(sm));
        ok('A11 列表应用范围显示「2 个组 40 台终端」', rowByName('PL01测试-已发布A').find('td').eq(5).text().replace(/\s+/g, ' ').indexOf('2 个组 40 台终端') > -1, rowByName('PL01测试-已发布A').find('td').eq(5).text());
        (await btn('PL01测试-已发布A', 'group'))[0].click(); await w(300);
        ok('A12 再次打开：回显已选的 2 个组', nodeById('3').checked && nodeById('4').checked && !nodeById('2').checked && $('#procmGroupTreeCount').text() === '2');
        zt().checkNode(nodeById('3'), false, false, true); await w(30);
        $('#procmSetGroup .js_procm_group_ok')[0].click(); await w(300);
        sg = calls('Procmanager/setWBListGroups');
        ok('A13 原来有组、现在全取消：照样提交（aObjId 为空数组），列表回到 --', sg.length === 2 && JSON.stringify(sg[1].param.aObjId) === '[]' && rowByName('PL01测试-已发布A').find('td').eq(5).text().indexOf('--') > -1, JSON.stringify(sg[1] && sg[1].param));
        // 待发布、有变更、-- 的应用到组都是灰的
        ok('A14 待发布、有变更、-- 的应用到组都是灰的', (await btn('PL01测试-待发布C', 'group')).hasClass('procm-op-off') && (await btn('PL01测试-有变更D', 'group')).hasClass('procm-op-off') && (await btn('PL01测试-空E', 'group')).hasClass('procm-op-off'));
        // 名称带 HTML 的名单：标题按文字显示，不执行
        (await btn('<img src=x onerror="window.__xss=1">已发布B&"', 'group'))[0].click(); await w(300);
        ok('A15 名称带 HTML：标题照原样显示文字、不生成元素', $('#procmSetGroup .js_procm_group_title').text() === '已应用组（<img src=x onerror="window.__xss=1">已发布B&"）' && $('#procmSetGroup .js_procm_group_title img').length === 0);
        $('#procmSetGroup .js_procm_modal_cancel')[0].click(); await w(60);

        // =================================================================
        // D2. 删除（real 模式，真接口 delWBList 由假后端回）
        // =================================================================
        // 先把 PID 2 应用到「默认分组」，再删：提醒句是 1 个组、20 台终端
        (await btn('PL01测试-已发布A', 'group'))[0].click(); await w(300);
        zt().checkNode(nodeById('2'), true, false, true); await w(30);
        $('#procmSetGroup .js_procm_group_ok')[0].click(); await w(300);
        (await btn('PL01测试-已发布A', 'del'))[0].click(); await w(60);
        L = lines('#procmDelModal');
        ok('D8 已应用 1 个组：提醒句（1 个组、20 台终端）', L.length === 2 && L[1] === T_DEL2(1, 20), JSON.stringify(L));
        window.__backend.netFailDel = true;
        nMsg = window.__msgLog.length;
        $('#procmDelModal .js_procm_del_ok')[0].click(); await w(150);
        sm = msgsSince(nMsg);
        ok('D9 网络层失败（core.js 只调 complete）：只有 core 那一次提示、弹窗留着、按钮恢复', sm.length === 1 && sm[0].title === '系统异常 , 请稍后再试！' && visible('#procmDelModal') && !$('#procmDelModal .js_procm_del_ok').prop('disabled'), JSON.stringify(sm));
        nMsg = window.__msgLog.length;
        $('#procmDelModal .js_procm_del_ok')[0].click(); await w(300);
        sm = msgsSince(nMsg);
        ok('D10 成功：提示「删除成功。」一次、弹窗关、遮罩去掉、这一行从列表消失', sm.length === 1 && sm[0].title === M_DEL && !visible('#procmDelModal') && backdrops() === 0 && rowByName('PL01测试-已发布A').length === 0 && rows().length === 4, JSON.stringify(sm) + ' rows=' + rows().length);
        // 名称带 HTML 的名单：删除确认文案按文字显示
        (await btn('<img src=x onerror="window.__xss=1">已发布B&"', 'del'))[0].click(); await w(60);
        L = lines('#procmDelModal');
        ok('D11 名称带 HTML：删除文案照原样显示文字、不生成元素、没执行', L[0] === T_DEL1('<img src=x onerror="window.__xss=1">已发布B&"') && $('#procmDelModal .js_procm_confirm_text img').length === 0 && window.__xss === undefined, JSON.stringify(L));
        $('#procmDelModal .js_procm_modal_cancel')[0].click(); await w(60);
        // 待发布的发布：确认后成功，状态变已发布
        (await btn('PL01测试-待发布C', 'publish'))[0].click(); await w(60);
        L = lines('#procmPublishModal');
        ok('P14 real 待发布（0 +7）：文案「发布后进程数为 7」+ 没应用那句', L[0] === T_PUB1('PL01测试-待发布C', 7) && L[1] === T_PUB_UN, JSON.stringify(L));
        $('#procmPublishModal .js_procm_publish_ok')[0].click(); await w(300);
        ok('P15 发布后状态已发布、进程数 7', rowByName('PL01测试-待发布C').find('.procm-st').text().indexOf('已发布') > -1 && $.trim(rowByName('PL01测试-待发布C').find('.procm-num').text()) === '7');

        // =================================================================
        // R. 弹窗与离开页面的收尾（S-10 后半：离开后不在全局留下东西）
        // =================================================================
        // R1 树还在加载时取消：取消那次 Group/getGroupTree，之后不再画树、不再取已选组
        window.__backend.delays['Group/getGroupTree'] = [300];
        var nUg = calls('Procmanager/getWBListUsedGroupId').length;
        (await btn('<img src=x onerror="window.__xss=1">已发布B&"', 'group'))[0].click(); await w(20);
        $('#procmSetGroup .js_procm_modal_cancel')[0].click(); await w(500);
        var lastTree = fakeCalls('Group/getGroupTree').slice(-1)[0];
        ok('R1 加载中取消：那次 Group/getGroupTree 被取消、没再取已选组、树区空、登记表里没有', lastTree.aborted === true && calls('Procmanager/getWBListUsedGroupId').length === nUg && zt() === null && $('#procmGroupTree').children().length === 0);
        // R2 过期的加载回来盖掉当前的树（拿不到请求句柄、取消不了时）：要重画当前名单的树
        //    先把 PID 7 应用到「默认分组」；然后 PID 7 打开（树请求慢）→ 取消 → PID 8（P15 已发布、没有组）打开（树请求快）
        (await btn('<img src=x onerror="window.__xss=1">已发布B&"', 'group'))[0].click(); await w(300);
        zt().checkNode(nodeById('2'), true, false, true); await w(30);
        $('#procmSetGroup .js_procm_group_ok')[0].click(); await w(300);
        window.__backend.noList = true;                       // 不登记 ajaxList → 页面拿不到句柄、取消不了
        window.__backend.delays['Group/getGroupTree'] = [400, 30];
        (await btn('<img src=x onerror="window.__xss=1">已发布B&"', 'group'))[0].click(); await w(20);   // 慢的那次（这条有 1 个组）
        $('#procmSetGroup .js_procm_modal_cancel')[0].click(); await w(20);
        (await btn('PL01测试-待发布C', 'group'))[0].click();   // 快的那次（P15 发布过，已发布、没有组）
        await w(800);
        ok('R2 过期的加载回来后：树是当前名单的（5 个组、一个没勾、已选 0）', visible('#procmSetGroup') && zt() && zt().transformToArray(zt().getNodes()).length === 5 && !nodeById('2').checked && $('#procmGroupTreeCount').text() === '0', zt() ? JSON.stringify(zt().getCheckedNodes(true).map(function (n) { return n.id; })) : 'no tree');
        nCall = calls('Procmanager/setWBListGroups').length;
        $('#procmSetGroup .js_procm_group_ok')[0].click(); await w(150);
        ok('R3 之后点「应用」：按当前名单判断（原来没有、也没勾 → 直接关不提交）', !visible('#procmSetGroup') && calls('Procmanager/setWBListGroups').length === nCall);
        window.__backend.noList = false;
        // R4 弹窗开着离开页面：遮罩去掉、bootstrap 的焦点事件解开、树从登记表去掉、弹窗随页面清掉、RsCore.ajax 还原
        (await btn('<img src=x onerror="window.__xss=1">已发布B&"', 'group'))[0].click(); await w(300);
        ok('R4 前提：弹窗开着、树已画好、有遮罩', visible('#procmSetGroup') && zt() !== null && backdrops() === 1 && focusinModal() === 1);
        await leave();
        ok('R5 离开后：没有遮罩、没有 focusin.modal、没有 procmGroupTree、弹窗元素没了、RsCore.ajax 还原', backdrops() === 0 && focusinModal() === 0 && zt() === null && $('#procmSetGroup,#procmPublishModal,#procmDelModal').length === 0 && RsCore.ajax === window.__originalAjax);
        // R6 确认弹窗开着离开页面
        await go('white', 'real');
        (await btn('PL01测试-有变更D', 'publish'))[0].click(); await w(60);
        ok('R6 前提：发布确认开着', visible('#procmPublishModal') && backdrops() === 1);
        await leave();
        ok('R7 离开后：没有遮罩、没有 focusin.modal', backdrops() === 0 && focusinModal() === 0);
        // R8 树还在加载时离开页面：之后不报错、不再发取已选组（mock 已卸，要是发了就会打到假后端的「没有这个接口」）
        await go('white', 'real');
        window.__backend.delays['Group/getGroupTree'] = [300];
        (await btn('<img src=x onerror="window.__xss=1">已发布B&"', 'group'))[0].click(); await w(20);
        nMsg = window.__msgLog.length;
        await leave(); await w(500);
        ok('R8 加载中离开：不再取已选组、不弹提示、登记表里没有树', fakeCalls('Procmanager/getWBListUsedGroupId').length === 0 && msgsSince(nMsg).length === 0 && zt() === null && backdrops() === 0);
        // R9 回到名单页再用：应用到组照常
        await go('white', 'real');
        (await btn('<img src=x onerror="window.__xss=1">已发布B&"', 'group'))[0].click(); await w(300);
        ok('R9 回来再开：树照常画好', visible('#procmSetGroup') && zt() && zt().transformToArray(zt().getNodes()).length === 5);
        $('#procmSetGroup .js_procm_modal_cancel')[0].click(); await w(60);
        await leave();

        // =================================================================
        // B. 黑名单页：标题、policytype=3
        // =================================================================
        await go('black', 'real');
        (await btn('PL01测试-黑待发布', 'publish'))[0].click(); await w(60);
        ok('B1 黑名单页发布确认：标题「发布黑名单」', $('#procmPublishModal .modal-header h3').text() === '发布黑名单' && lines('#procmPublishModal')[0] === T_PUB1('PL01测试-黑待发布', 2));
        $('#procmPublishModal .js_procm_publish_ok')[0].click(); await w(300);
        pc = calls('Procmanager/publishWBList');
        ok('B2 黑名单页发布：policytype=3', pc.length && pc[pc.length - 1].param.policytype === 3 && pc[pc.length - 1].param.pid === '5');
        (await btn('PL01测试-黑已发布', 'group'))[0].click(); await w(300);
        zt().checkNode(nodeById('5'), true, false, true); await w(30);
        $('#procmSetGroup .js_procm_group_ok')[0].click(); await w(300);
        sg = calls('Procmanager/setWBListGroups');
        ok('B3 黑名单页应用到组：policytype=3、aObjId=["5"]', sg.length && sg[sg.length - 1].param.policytype === 3 && JSON.stringify(sg[sg.length - 1].param.aObjId) === '["5"]', JSON.stringify(sg[sg.length - 1]));
        (await btn('PL01测试-黑已发布', 'del'))[0].click(); await w(60);
        ok('B4 黑名单页删除确认：标题「删除黑名单」、提醒句 1 个组 20 台终端', $('#procmDelModal .modal-header h3').text() === '删除黑名单' && lines('#procmDelModal')[1] === T_DEL2(1, 20), JSON.stringify(lines('#procmDelModal')));
        $('#procmDelModal .js_procm_modal_cancel')[0].click(); await w(60);
        await leave();

        // =================================================================
        // E. 全程
        // =================================================================
        ok('E1 全程没有未捕获的脚本错误', window.__errors.length === 0, JSON.stringify(window.__errors));
        ok('E2 策略中心的树 id 从没被名单页用过（groupTree、groupTreePolicy 都没登记）', $.fn.zTree.getZTreeObj('groupTree') === null && $.fn.zTree.getZTreeObj('groupTreePolicy') === null);
        ok('E3 名单页的分组树没有残留在 zTree 登记表里', $.fn.zTree.getZTreeObj('procmGroupTree') === null && !$.fn.zTree._z.data.getSetting('procmGroupTree'));
    } catch (e) {
        spyOff();
        ok('EXCEPTION ' + (e && e.message), false, e && e.stack);
    }
    var fail = items.filter(function (x) { return !x.ok; });
    return { pass: items.length - fail.length, fail: fail.length, items: items, failed: fail };
};
