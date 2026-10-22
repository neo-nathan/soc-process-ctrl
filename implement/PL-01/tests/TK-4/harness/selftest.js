/*
 * PL-01 TK-4 Executor 单元级自测（只在本地自测页面 index.html 里跑，不进 SOC 源码、不进本仓库）
 * 用法：浏览器打开 http://127.0.0.1:8781/index.html（或 ?layout=101 用 101 现在的 layout.html），
 *       控制台执行 await window.__selftest()，返回 {pass, fail, items}
 * 被测：SOC 工作副本里的 processManage.js（公共布局，本次改）、processManage/list.js（本次改）、bwlistMock.js（TK-2，不改）；
 *       老调用方用 101 只读副本里的真 processMana.js、log.js（本次不改）。
 * 这里只验「代码按我写的意图跑」（单元级）；计划级验收 S-6、S-7、S-10 前半由独立 Tester 在 101 上做。
 */
window.__selftest = async function () {
    var items = [];
    function ok(name, cond, detail) { items.push({ ok: !!cond, name: name, detail: detail === undefined ? '' : detail }); }
    function w(n) { return new Promise(function (r) { setTimeout(r, n || 400); }); }
    function calls(url) { return window.__ajaxLog.filter(function (x) { return x.url === url; }); }
    function msgsSince(n) { return window.__msgLog.slice(n); }
    function keys(o) { return Object.keys(o).sort().join(','); }
    var $M = function () { return $('#addNewListModal'); };
    function modalState() {
        return {
            visible: $M().is(':visible'),
            title: $('#addNewListTitle').text(),
            type: $('#addNewListModal .add-newl-type').text(),
            name: $('#addNewLName').val(),
            desc: $('#addNewLDesc').val()
        };
    }
    function setModal(title, type, name, desc) {
        $('#addNewListTitle').text(title);
        $('#addNewListModal .add-newl-type').text(type);
        $('#addNewLName').val(name);
        $('#addNewLDesc').val(desc);
    }
    function confirmBtn() { $('#addNewListBtn')[0].click(); }
    function listRows() { return $('.procm-bwlist #tbClient > tbody > tr[data-index]'); }
    async function openEdit(index) {
        listRows().eq(index).find('td').eq(4)[0].click();   // 点行展开
        await w(50);
        $('.procm-bwlist tr.procm-append-tr li[data-op=edit]')[0].click();
        await w(50);
    }
    var srvReq = [];   // bootstrapTable url 方式发的 $.ajax（老页面的表格刷新）
    $(document).off('ajaxSend.selftest').on('ajaxSend.selftest', function (e, x, o) { srvReq.push(o.url); });
    function srvCount(path) { return srvReq.filter(function (u) { return u.indexOf(path) === 0; }).length; }

    try {
    window.__leaveAll();
    window.__resetBackend();
    window.__ajaxLog.length = 0;
    window.__msgLog.length = 0;
    window.__errors.length = 0;
    window.__backend.delay = 20;

    // =====================================================================
    // A. 老调用方：进程管理页（101 真 processMana.js）「选中加白 → 新建名单」
    // =====================================================================
    await window.__goChild('processMana'); await w(800);
    ok('A0 布局有公共弹窗、listModal 接口已导出', $M().length === 1 && window.__layoutMod && window.__layoutMod.listModal && typeof window.__layoutMod.listModal.open === 'function');
    $('#tbClient').bootstrapTable('check', 0);
    $('#addWhite')[0].click(); await w(300);
    ok('A1 加入名单弹窗打开、确认按钮 data 带进程', $('#addBWListModal').is(':visible') && JSON.parse($('#addNewListBtn').attr('data')).proclist.length === 1);
    $('#addNewList')[0].click(); await w(150);
    var sA = modalState();
    ok('A2 新建名单弹窗：标题、系统类型由老页面设置', sA.visible && sA.title === '新建白名单' && sA.type === 'Linux/信创', JSON.stringify(sA));
    var nCreate = calls('Procmanager/createWBList').length, nMsg = window.__msgLog.length;
    $('#addNewLName').val('   '); confirmBtn(); await w(150);
    ok('A3 名称为空（全空格）：提示且不发请求', calls('Procmanager/createWBList').length === nCreate && msgsSince(nMsg).some(function (m) { return m.kind === 'warn' && m.title === '请输入名单名称！'; }));
    var nProc = srvCount('/Procmanager/procManager');
    nMsg = window.__msgLog.length;
    $('#addNewLName').val('PL01测试-进程管理'); $('#addNewLDesc').val('老办法'); confirmBtn(); await w(500);
    var cA = calls('Procmanager/createWBList').slice(-1)[0];
    ok('A4 createWBList 参数：data 属性里的 policytype/systype/proclist/procsource + 名称、描述', cA && cA.param.policytype === 2 && cA.param.systype === 2 && cA.param.proclist.length === 1 && cA.param.procsource && cA.param.pname === 'PL01测试-进程管理' && cA.param.description === '老办法', cA && JSON.stringify(cA.param));
    ok('A5 成功：两层弹窗、遮罩都关掉', !$M().is(':visible') && !$('#addBWListModal').is(':visible') && !$('.second-modal').is(':visible') && $('.modal-backdrop').length === 0);
    ok('A6 成功：进程管理表格刷新（procManager 又请求一次）', srvCount('/Procmanager/procManager') === nProc + 1, srvCount('/Procmanager/procManager') + ' vs ' + nProc);
    ok('A7 成功提示一次、没有脚本错误（原来的 view 未定义）', msgsSince(nMsg).filter(function (m) { return m.kind === 'success'; }).length === 1 && window.__errors.length === 0, JSON.stringify(window.__errors));
    // 选中加黑 → 新建黑名单
    $('#tbClient').bootstrapTable('check', 1);
    $('#addBlack')[0].click(); await w(300);
    $('#addNewList')[0].click(); await w(150);
    ok('A8 加黑：标题「新建黑名单」', $('#addNewListTitle').text() === '新建黑名单');
    $('#addNewLName').val('PL01测试-黑'); confirmBtn(); await w(500);
    var cA2 = calls('Procmanager/createWBList').slice(-1)[0];
    ok('A9 加黑：policytype=3、带进程；弹窗关闭', cA2.param.policytype === 3 && cA2.param.proclist.length >= 1 && !$M().is(':visible') && $('.modal-backdrop').length === 0, JSON.stringify(cA2.param));

    // =====================================================================
    // B. 老调用方：日志页（101 真 log.js）「加白 → 新建名单」
    // =====================================================================
    await window.__goChild('log', 'g=1'); await w(900);
    $('#tbClient').bootstrapTable('check', 0);
    $('#addWhite')[0].click(); await w(300);
    $('#addNewList')[0].click(); await w(150);
    ok('B1 日志页：新建名单弹窗打开、标题「新建白名单」', $M().is(':visible') && $('#addNewListTitle').text() === '新建白名单');
    var nLog = srvCount('/Procmanager/getProcLogList');
    $('#addNewLName').val('PL01测试-日志'); confirmBtn(); await w(500);
    var cB = calls('Procmanager/createWBList').slice(-1)[0];
    ok('B2 日志页：createWBList 带日志里的进程', cB.param.pname === 'PL01测试-日志' && cB.param.proclist && cB.param.proclist[0].procpath === '/usr/bin/nc', JSON.stringify(cB.param));
    ok('B3 日志页：弹窗关闭、日志表格刷新、没有脚本错误', !$M().is(':visible') && !$('#addBWListModal').is(':visible') && $('.modal-backdrop').length === 0 && srvCount('/Procmanager/getProcLogList') === nLog + 1 && window.__errors.length === 0, srvCount('/Procmanager/getProcLogList') + ' vs ' + nLog + ' ' + JSON.stringify(window.__errors));

    // =====================================================================
    // C. 名单页创建（白）：不读 data 属性残留、只建名单、成功刷新本页表格、弹窗还原
    // =====================================================================
    var residue = $('#addNewListBtn').attr('data');
    ok('C0 前提：确认按钮 data 属性里还留着上一次「加入名单」的进程', residue && JSON.parse(residue).proclist.length >= 1);
    setModal('LEGACY-T', 'LEGACY-TYPE', 'LEGACY-NAME', 'LEGACY-DESC');   // 名单页打开前弹窗的样子（用来验还原）
    await window.__goChild('list', 'tab=white'); await w(700);
    var nRowsW = listRows().length;
    $('.js_procm_create')[0].click(); await w(100);
    var sC = modalState();
    ok('C1 创建：弹窗打开，标题「创建白名单」，系统类型 Linux/信创，名称、描述是空的', sC.visible && sC.title === '创建白名单' && sC.type === 'Linux/信创' && sC.name === '' && sC.desc === '', JSON.stringify(sC));
    ok('C1b 有遮罩（弹窗打开期间页面点不到）', $('.modal-backdrop').length === 1);
    nCreate = calls('Procmanager/createWBList').length; nMsg = window.__msgLog.length;
    confirmBtn(); await w(100);
    ok('C2 名称为空：提示「请输入名单名称！」、不发请求、弹窗不关', calls('Procmanager/createWBList').length === nCreate && msgsSince(nMsg).some(function (m) { return m.title === '请输入名单名称！'; }) && $M().is(':visible'));
    var nList = calls('Procmanager/getWBList').length;
    nMsg = window.__msgLog.length;
    $('#addNewLName').val(' PL01测试-新白 '); $('#addNewLDesc').val(' 描述1 '); confirmBtn(); await w(600);
    var cC = calls('Procmanager/createWBList').slice(-1)[0];
    ok('C3 createWBList 只传 pname、description、policytype、systype（不带 data 属性里的进程，F-8 ②）', cC && keys(cC.param) === 'description,pname,policytype,systype' && cC.param.pname === 'PL01测试-新白' && cC.param.description === '描述1' && cC.param.policytype === 2 && cC.param.systype === 2, cC && JSON.stringify(cC.param));
    ok('C4 成功：提示一次「创建成功。」、没有多余提示', msgsSince(nMsg).length === 1 && msgsSince(nMsg)[0].kind === 'success' && msgsSince(nMsg)[0].title === '创建成功。', JSON.stringify(msgsSince(nMsg)));
    ok('C5 成功：弹窗关闭、遮罩去掉', !$M().is(':visible') && $('.modal-backdrop').length === 0);
    ok('C6 成功：本页表格刷新（getWBList 又请求）、新名单出现', calls('Procmanager/getWBList').length > nList && listRows().length === nRowsW + 1 && listRows().text().indexOf('PL01测试-新白') > -1, listRows().length + ' vs ' + nRowsW);
    var sC2 = modalState();
    ok('C7 弹窗内容还原成名单页打开前的样子', sC2.title === 'LEGACY-T' && sC2.type === 'LEGACY-TYPE' && sC2.name === 'LEGACY-NAME' && sC2.desc === 'LEGACY-DESC', JSON.stringify(sC2));
    ok('C8 确认按钮 data 属性没被名单页改动', $('#addNewListBtn').attr('data') === residue);
    ok('C9 没有脚本错误', window.__errors.length === 0, JSON.stringify(window.__errors));

    // =====================================================================
    // D. 名单页创建（黑）
    // =====================================================================
    await window.__goChild('list', 'tab=black'); await w(700);
    var nRowsB = listRows().length;
    $('.js_procm_create')[0].click(); await w(100);
    ok('D1 黑名单页创建：标题「创建黑名单」、系统类型 Linux/信创', $('#addNewListTitle').text() === '创建黑名单' && $('#addNewListModal .add-newl-type').text() === 'Linux/信创');
    $('#addNewLName').val('PL01测试-新黑'); confirmBtn(); await w(600);
    var cD = calls('Procmanager/createWBList').slice(-1)[0];
    ok('D2 createWBList：policytype=3、systype=2、只 4 个参数', keys(cD.param) === 'description,pname,policytype,systype' && cD.param.policytype === 3 && cD.param.systype === 2 && cD.param.description === '', JSON.stringify(cD.param));
    ok('D3 黑名单表格刷新、新名单出现', listRows().length === nRowsB + 1 && listRows().text().indexOf('PL01测试-新黑') > -1);

    // =====================================================================
    // E. 名单页编辑
    // =====================================================================
    await window.__goChild('list', 'tab=white'); await w(700);
    setModal('PRE-T', 'PRE-TYPE', 'PRE-N', 'PRE-D');
    await openEdit(0);
    var sE = modalState();
    ok('E1 编辑：标题「编辑白名单」，带出原名称、原描述，系统类型显示 Linux/信创', sE.visible && sE.title === '编辑白名单' && sE.type === 'Linux/信创' && sE.name === 'Web 服务白名单' && sE.desc === '对外 Web 服务器', JSON.stringify(sE));
    ok('E1b 系统类型只是文字，没有可改的控件', $('#addNewListModal .add-newl-type').is('span') && $('#addNewListModal select, #addNewListModal input[type=radio]').length === 0);
    nList = calls('Procmanager/getWBList').length; nMsg = window.__msgLog.length;
    $('#addNewLName').val('Web 服务白名单-改'); $('#addNewLDesc').val('新描述'); confirmBtn(); await w(600);
    var cE = calls('Procmanager/editWBList').slice(-1)[0];
    ok('E2 editWBList 只传 pid、pname、description', cE && keys(cE.param) === 'description,pid,pname' && cE.param.pid === '101' && cE.param.pname === 'Web 服务白名单-改' && cE.param.description === '新描述', cE && JSON.stringify(cE.param));
    ok('E3 编辑成功：提示「修改成功。」、弹窗关闭、表格刷新显示新名称', msgsSince(nMsg).length === 1 && msgsSince(nMsg)[0].title === '修改成功。' && !$M().is(':visible') && calls('Procmanager/getWBList').length > nList && listRows().eq(0).text().indexOf('Web 服务白名单-改') > -1, JSON.stringify(msgsSince(nMsg)));
    var sE2 = modalState();
    ok('E4 编辑后弹窗还原', sE2.title === 'PRE-T' && sE2.type === 'PRE-TYPE' && sE2.name === 'PRE-N' && sE2.desc === 'PRE-D', JSON.stringify(sE2));
    // 名称带 HTML 的名单：原样填进输入框，不执行（先清标记：101 老页面的「加入名单」弹窗自己会执行它，见 A 段，与本次改动无关）
    window.__xss = 0;
    await openEdit(1); await w(100);
    ok('E5 名称带 <img onerror>：输入框里是原文、没有执行、描述原文', $('#addNewLName').val() === '<img src=x onerror="window.__xss=1">名单' && !window.__xss && $('#addNewLDesc').val() === '<b>粗</b>"引号"', $('#addNewLName').val());
    $('#addNewListModal .modal-footer .btn-cancel')[0].click(); await w(100);
    ok('E6 点「关闭」：弹窗关闭、还原、不发请求', !$M().is(':visible') && $('#addNewListTitle').text() === 'PRE-T' && $('#addNewLName').val() === 'PRE-N' && calls('Procmanager/editWBList').length === 1);
    await openEdit(2);
    ok('E7 描述为 null：描述框是空的', $('#addNewLDesc').val() === '' && $('#addNewLName').val() === 'test666');
    $('#addNewListModal .modal-header .close')[0].click(); await w(100);
    ok('E8 点右上角叉：弹窗关闭并还原', !$M().is(':visible') && $('#addNewListTitle').text() === 'PRE-T');
    await openEdit(3);
    ok('E9 Windows 名单：系统类型显示 Windows', $('#addNewListModal .add-newl-type').text() === 'Windows' && $('#addNewListTitle').text() === '编辑白名单');
    // 编辑时清空名称
    nMsg = window.__msgLog.length;
    var nEdit = calls('Procmanager/editWBList').length;
    $('#addNewLName').val(''); confirmBtn(); await w(100);
    ok('E10 编辑时名称清空：提示、不发请求、弹窗不关', calls('Procmanager/editWBList').length === nEdit && msgsSince(nMsg).some(function (m) { return m.title === '请输入名单名称！'; }) && $M().is(':visible'));
    // 编辑失败：core.js 弹一次，页面不再弹；弹窗不关；不刷新
    window.__backend.failEdit = 4;
    nMsg = window.__msgLog.length; nList = calls('Procmanager/getWBList').length;
    $('#addNewLName').val('改名失败'); confirmBtn(); await w(400);
    ok('E11 编辑失败：只有 core 的一次「错误」提示，弹窗不关、不刷新表格', msgsSince(nMsg).length === 1 && msgsSince(nMsg)[0].title === '错误' && $M().is(':visible') && calls('Procmanager/getWBList').length === nList, JSON.stringify(msgsSince(nMsg)));
    // 失败后改好再点确定：走的还是编辑（上下文还在）
    $('#addNewLName').val('win 名单2'); confirmBtn(); await w(600);
    var cE2 = calls('Procmanager/editWBList').slice(-1)[0];
    ok('E12 失败后再点确定：仍是编辑同一条（pid=104），成功后关闭并还原', cE2.param.pid === '104' && cE2.param.pname === 'win 名单2' && !$M().is(':visible') && $('#addNewListTitle').text() === 'PRE-T', JSON.stringify(cE2.param));

    // =====================================================================
    // F. 创建失败、Esc 关闭、请求途中关闭、里面元素冒泡的 hidden
    // =====================================================================
    window.__backend.failCreate = 5;
    $('.js_procm_create')[0].click(); await w(100);
    nMsg = window.__msgLog.length; nList = calls('Procmanager/getWBList').length;
    $('#addNewLName').val('PL01测试-失败'); confirmBtn(); await w(400);
    ok('F1 创建失败：只有 core 的一次提示、弹窗不关、标题仍是「创建白名单」、不刷新', msgsSince(nMsg).length === 1 && $M().is(':visible') && $('#addNewListTitle').text() === '创建白名单' && calls('Procmanager/getWBList').length === nList, JSON.stringify(msgsSince(nMsg)));
    $M().trigger($.Event('keyup', { which: 27 })); await w(100);
    ok('F2 按 Esc：弹窗关闭并还原', !$M().is(':visible') && $('#addNewListTitle').text() === 'PRE-T' && $('#addNewLName').val() === 'PRE-N');
    // 弹窗里面的元素触发 hidden（冒泡上来）：不能把名单页的上下文当成「弹窗关了」清掉
    $('.js_procm_create')[0].click(); await w(100);
    $('#addNewLName').trigger('hidden');
    nCreate = calls('Procmanager/createWBList').length;
    $('#addNewLName').val('PL01测试-冒泡'); confirmBtn(); await w(600);
    var cF = calls('Procmanager/createWBList').slice(-1)[0];
    ok('F3 里面元素冒泡的 hidden 不影响：仍按名单页创建提交', calls('Procmanager/createWBList').length === nCreate + 1 && keys(cF.param) === 'description,pname,policytype,systype', JSON.stringify(cF.param));
    // 请求途中用户点了关闭：结果回来后不再动弹窗，但照样刷新表格
    window.__backend.delay = 300;
    $('.js_procm_create')[0].click(); await w(100);
    setModal('创建白名单', 'Linux/信创', 'PL01测试-途中关', '');
    nList = calls('Procmanager/getWBList').length;
    confirmBtn(); await w(50);
    $('#addNewListModal .modal-footer .btn-cancel')[0].click(); await w(50);
    ok('F4 途中点关闭：立即还原', !$M().is(':visible') && $('#addNewLName').val() === 'PRE-N');
    await w(1200);
    ok('F5 结果回来：弹窗仍关着、内容仍是还原后的、表格照样刷新', !$M().is(':visible') && $('#addNewLName').val() === 'PRE-N' && $('#addNewListTitle').text() === 'PRE-T' && calls('Procmanager/getWBList').length > nList && listRows().text().indexOf('PL01测试-途中关') > -1);
    // 请求途中离开名单页：结果回来后不刷新已经离开的页面，也不报错
    $('.js_procm_create')[0].click(); await w(100);
    $('#addNewLName').val('PL01测试-途中离开');
    confirmBtn(); await w(30);
    nList = calls('Procmanager/getWBList').length;
    await window.__goChild('processMana'); await w(100);
    ok('F6 途中离开：弹窗被名单页 destroy 关掉并还原', !$M().is(':visible') && $('.modal-backdrop').length === 0 && $('#addNewListTitle').text() === 'PRE-T' && $('#addNewLName').val() === 'PRE-N');
    await w(1000);
    ok('F7 结果回来后不再请求名单列表、没有脚本错误', calls('Procmanager/getWBList').length === nList && window.__errors.length === 0, JSON.stringify(window.__errors));
    window.__backend.delay = 20;

    // =====================================================================
    // G. 名单页用过之后，老页面再用同一个弹窗：表现和名单页没用过一样，仍按老办法带进程创建
    // =====================================================================
    await w(400);
    $('#tbClient').bootstrapTable('check', 0);
    $('#addWhite')[0].click(); await w(300);
    $('#addNewList')[0].click(); await w(150);
    var sG = modalState();
    ok('G1 老页面打开：名称、描述是名单页用之前的值（名单页的值没留下来）', sG.visible && sG.name === 'PRE-N' && sG.desc === 'PRE-D' && sG.title === '新建白名单' && sG.type === 'Linux/信创', JSON.stringify(sG));
    nProc = srvCount('/Procmanager/procManager');
    $('#addNewLName').val('PL01测试-之后老办法'); confirmBtn(); await w(500);
    var cG = calls('Procmanager/createWBList').slice(-1)[0];
    ok('G2 仍走老办法：带 data 属性里的进程、弹窗关闭、表格刷新', cG.param.proclist && cG.param.proclist.length === 1 && !$M().is(':visible') && !$('#addBWListModal').is(':visible') && srvCount('/Procmanager/procManager') === nProc + 1, JSON.stringify(cG.param));

    // =====================================================================
    // H. 名单页表格请求：网络 / HTTP 层失败也让表格收到失败；接口报错一样；成功不误报
    // =====================================================================
    await window.__goChild('list', 'tab=white'); await w(700);
    var errs = [], succ = 0;
    $('.procm-bwlist #tbClient').on('load-error.bs.table', function (e, status) { errs.push(status); }).on('load-success.bs.table', function () { succ++; });
    window.__backend.netFailNext = 1;
    nMsg = window.__msgLog.length;
    $('.procm-bwlist #tbClient').bootstrapTable('refresh'); await w(400);
    ok('H1 网络层失败（core 只调 complete）：表格收到一次 load-error（status 0）、正在加载已收起', errs.length === 1 && errs[0] === 0 && !$('.procm-bwlist .fixed-table-loading').is(':visible'), JSON.stringify(errs));
    ok('H2 网络层失败：只有 core 的一次提示，页面不另弹', msgsSince(nMsg).length === 1, JSON.stringify(msgsSince(nMsg)));
    window.__backend.failNext = 5;
    nMsg = window.__msgLog.length;
    $('.procm-bwlist #tbClient').bootstrapTable('refresh'); await w(400);
    ok('H3 接口报错：load-error 只触发一次（status 5）、只一次提示', errs.length === 2 && errs[1] === 5 && msgsSince(nMsg).length === 1, JSON.stringify(errs));
    var s0 = succ;
    $('.procm-bwlist #tbClient').bootstrapTable('refresh'); await w(400);
    ok('H4 成功：触发 load-success、不触发 load-error', succ === s0 + 1 && errs.length === 2 && listRows().length > 0);

    // =====================================================================
    // I. 名单页 destroy：关掉列宽拖拽（照 log.js / overview.js）
    // =====================================================================
    var tbl = $('.procm-bwlist #tbClient')[0];
    var hadResizer = tbl.classList.contains('JColResizer');
    var spy = [], orig = $.fn.colResizable;
    $.fn.colResizable = function (opt) { spy.push({ els: this.toArray(), disable: !!(opt && opt.disable) }); return orig.apply(this, arguments); };
    // 只调名单页的 destroy、先不渲染下一页（下一页的表格也叫 #tbClient，它初始化时会顺手拆掉同名的旧记录，看不出名单页自己有没有拆）
    window.__child.destroy(); window.__child = null;
    $.fn.colResizable = orig;
    ok('I1 离开名单页：对名单表格调了 colResizable({disable:true})', spy.some(function (c) { return c.disable && c.els.indexOf(tbl) > -1; }), JSON.stringify(spy.map(function (c) { return c.disable; })));
    ok('I2 名单页 destroy 后、下一页渲染前：名单表格上的列宽拖拽已拆掉（离开前有）', hadResizer && !tbl.classList.contains('JColResizer'));
    await window.__goChild('processMana'); await w(300);

    // =====================================================================
    // J. 公共布局重新渲染（离开进程管控再回来）后：名单页创建照常、老页面照常
    // =====================================================================
    window.__leaveAll(); await w(100);
    await window.__goChild('list', 'tab=white'); await w(700);
    $('.js_procm_create')[0].click(); await w(100);
    ok('J1 布局重新渲染后：创建弹窗照常打开', $M().is(':visible') && $('#addNewListTitle').text() === '创建白名单');
    $('#addNewLName').val('PL01测试-重渲染'); confirmBtn(); await w(600);
    var cJ = calls('Procmanager/createWBList').slice(-1)[0];
    ok('J2 布局重新渲染后：按名单页创建提交、弹窗关闭并还原成布局刚渲染时的样子', keys(cJ.param) === 'description,pname,policytype,systype' && !$M().is(':visible') && $('#addNewListTitle').text() === '新建名单' && $('#addNewLName').val() === '', $('#addNewListTitle').text());
    // 名单页打开弹窗后整个离开进程管控（子页面先 destroy，再 destroy 布局）：不报错、不留遮罩
    $('.js_procm_create')[0].click(); await w(100);
    window.__leaveAll(); await w(100);
    ok('J3 弹窗开着时离开进程管控：没有遮罩残留、没有脚本错误', $('.modal-backdrop').length === 0 && window.__errors.length === 0, JSON.stringify(window.__errors));
    await window.__goChild('processMana'); await w(800);
    $('#tbClient').bootstrapTable('check', 0);
    $('#addWhite')[0].click(); await w(300);
    $('#addNewList')[0].click(); await w(150);
    $('#addNewLName').val('PL01测试-回来老办法'); confirmBtn(); await w(500);
    var cJ2 = calls('Procmanager/createWBList').slice(-1)[0];
    ok('J4 回来后老页面：仍按老办法带进程创建并关闭弹窗', cJ2.param.proclist && !$M().is(':visible') && $('.modal-backdrop').length === 0, JSON.stringify(cJ2.param));

    } catch (e) {
        ok('EXC 自测中途抛错（后面的用例没跑）：' + e, false);
    }
    ok('Z 全程没有未捕获的脚本错误', window.__errors.length === 0, JSON.stringify(window.__errors));
    window.__leaveAll();
    var fail = items.filter(function (i) { return !i.ok; });
    return { pass: items.length - fail.length, fail: fail.length, failed: fail, total: items.length };
};
