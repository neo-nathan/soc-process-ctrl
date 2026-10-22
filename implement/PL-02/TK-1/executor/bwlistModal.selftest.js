/*
 * PL-02 TK-1 Executor 单元级自测（不进 SOC 源码、不进本仓库）
 * 用法：node bwlistModal.selftest.js
 * 被测：SOC 工作副本 public/esm/view/processManage/bwlistModal.js（AMD 模块，用最小 define 替身加载）；
 *       另对 list.html（新弹窗的结构）、list.js（配置、调用处、完成判据 grep）做静态检查。
 * 页面依赖（jQuery、bootstrap 2 弹窗、RsCore）用下面的最小替身：只实现 bwlistModal.js 用到的那几个方法，
 *   弹窗 show / hide 的行为照 bootstrap 2.3.2（hide 时去掉 body 上的遮罩、在弹窗元素上触发 hidden，冒泡到页面容器）。
 * 这里只验「代码按我写的意图跑」；计划级验收（PL-02 §七 S-1～S-7）由独立 Tester 在 101 上做。
 */
'use strict';
var fs = require('fs');
var vm = require('vm');
var path = require('path');

var SRC = '/Users/nick/Workspace/ESMCenterST/public/esm/view/processManage';
var results = [];
function ok(name, cond, detail) {
    results.push({ ok: !!cond, name: name, detail: detail === undefined ? '' : detail });
}

// ---------------------------------------------------------------------
// 最小 jQuery / bootstrap 替身
// ---------------------------------------------------------------------
function El(cls) {
    this.cls = cls;
    this._text = '';
    this._val = '';
    this.attrs = {};
    this.props = {};
}
var world;   // 每个用例前重建
function resetWorld(withModal) {
    var modalEl = new El('modal');
    modalEl.modalObj = null;      // bootstrap 的 data('modal')：没打开过就没有
    var kids = {};
    ['.js_procm_lm_title', '.js_procm_lm_name_label', '.js_procm_lm_name', '.js_procm_lm_systype',
        '.js_procm_lm_desc', '.js_procm_lm_cancel', '.js_procm_lm_ok'].forEach(function (s) {
        kids[s] = new El(s);
    });
    world = {
        modalEl: modalEl,
        kids: kids,
        hasModal: withModal !== false,
        handlers: [],             // 页面容器上的委托事件 {type, ns, sel, fn}
        backdrops: 0,             // body 上的遮罩数
        hideCalls: 0,
        showCalls: 0,
        ajax: [],                 // RsCore.ajax 调用
        msgs: []                  // RsCore.msg.* 调用
    };
}
function W(list) {   // jQuery 对象替身
    this.list = list;
    this.length = list.length;
}
W.prototype.find = function (sel) {
    var out = [];
    this.list.forEach(function (el) {
        if (el === 'VIEW') {
            if (sel === '#procmListModal' && world.hasModal) { out.push(world.modalEl); }
        } else if (el === world.modalEl) {
            if (world.kids[sel]) { out.push(world.kids[sel]); }
        }
    });
    return new W(out);
};
W.prototype.text = function (v) {
    if (v === undefined) { return this.list.length ? this.list[0]._text : ''; }
    this.list.forEach(function (el) { el._text = String(v); });
    return this;
};
W.prototype.val = function (v) {
    if (v === undefined) { return this.list.length ? this.list[0]._val : undefined; }
    this.list.forEach(function (el) { el._val = String(v); });
    return this;
};
W.prototype.attr = function (k, v) {
    if (v === undefined) { return this.list.length ? this.list[0].attrs[k] : undefined; }
    this.list.forEach(function (el) { el.attrs[k] = String(v); });
    return this;
};
W.prototype.prop = function (k, v) {
    if (v === undefined) { return this.list.length ? this.list[0].props[k] : undefined; }
    this.list.forEach(function (el) { el.props[k] = v; });
    return this;
};
W.prototype.data = function (k) {
    if (k === 'modal' && this.list[0] === world.modalEl) { return world.modalEl.modalObj || undefined; }
    return undefined;
};
W.prototype.modal = function (cmd) {
    this.list.forEach(function (el) {
        if (el !== world.modalEl) { return; }
        if (!el.modalObj) { el.modalObj = { isShown: false }; }
        if (cmd === 'show') {
            world.showCalls++;
            if (el.modalObj.isShown) { return; }
            el.modalObj.isShown = true;
            world.backdrops++;
        } else if (cmd === 'hide') {
            world.hideCalls++;
            if (!el.modalObj.isShown) { return; }   // bootstrap 2：没开着时 hide 什么都不做，也不触发 hidden
            el.modalObj.isShown = false;
            world.backdrops--;
            dispatch('hidden', '#procmListModal', el, el);
        }
    });
    return this;
};
function parseEvt(s) {
    var i = s.indexOf('.');
    return i < 0 ? { type: s, ns: '' } : { type: s.slice(0, i), ns: s.slice(i + 1) };
}
W.prototype.on = function (evt, sel, fn) {
    var p = parseEvt(evt);
    world.handlers.push({ type: p.type, ns: p.ns, sel: sel, fn: fn });
    return this;
};
W.prototype.off = function (evt) {
    if (evt === undefined) { world.handlers = []; return this; }
    var p = parseEvt(evt);
    world.handlers = world.handlers.filter(function (h) {
        var nsHit = !p.ns || h.ns === p.ns;
        var typeHit = !p.type || h.type === p.type;
        return !(nsHit && typeHit);
    });
    return this;
};
// 在页面容器上分发一次委托事件：sel 必须和绑定时的选择器字符串相同；this = 匹配到的元素，e.target = 事件源
function dispatch(type, sel, thisEl, targetEl) {
    var hs = world.handlers.filter(function (h) { return h.type === type && h.sel === sel; });
    hs.forEach(function (h) { h.fn.call(thisEl, { target: targetEl }); });
    return hs.length;
}
function click(cls) {
    var el = world.kids[cls];
    if (el.props.disabled) { return 0; }   // 浏览器里禁用的按钮点了不触发 click
    return dispatch('click', '#procmListModal ' + cls, el, el);
}
function $(x) {
    if (x === undefined) { return new W([]); }
    return x;
}
$.trim = function (s) { return String(s === null || s === undefined ? '' : s).replace(/^\s+|\s+$/g, ''); };

var RsCore = {
    ajax: function (url, param, callback, complete, error) {
        world.ajax.push({ url: url, param: param, callback: callback, complete: complete, error: error });
    },
    msg: {
        warn: function (a, b) { world.msgs.push(['warn', a, b]); },
        success: function (a) { world.msgs.push(['success', a]); },
        notice: function (a) { world.msgs.push(['notice', a]); }
    }
};
// 照 core.js：code=0 → callback(data, code, msg) → complete；失败 → error（+ core 自己弹「错误」，这里记成 core-warn）→ complete
function resolve(i, kind, data, msg) {
    var a = world.ajax[i];
    if (kind === 'ok') {
        a.callback && a.callback(data, 0, msg);
    } else if (kind === 'fail') {
        a.error && a.error('', 10, msg);
        world.msgs.push(['core-warn', '错误', msg]);
    } // 'net'：网络层失败，core 只调 complete
    a.complete && a.complete({ status: kind === 'net' ? 500 : 200 });
}

// 加载 AMD 模块
function loadModule() {
    var code = fs.readFileSync(process.env.MOD || path.join(SRC, 'bwlistModal.js'), 'utf8');
    var mod;
    var ctx = {
        define: function (fn) { mod = fn(function () { throw new Error('不应 require 别的模块'); }); },
        $: $, RsCore: RsCore, console: console
    };
    vm.runInNewContext(code, ctx, { filename: 'bwlistModal.js' });
    return mod;
}

var VIEW = new W(['VIEW']);
function nsCount() {
    return world.handlers.filter(function (h) { return h.ns === 'procmListModal'; }).length;
}
var WHITE = {
    mode: 'create', title: '创建白名单', policytype: 2, systype: 2, pid: '', pname: '', description: '',
    name: '白名单', namePlaceholder: '示例：办公区终端白名单', descPlaceholder: '选填，说明这条白名单用在哪里、放行什么'
};
function k(s) { return world.kids[s]; }
function shown() { return !!(world.modalEl.modalObj && world.modalEl.modalObj.isShown); }

// ---------------------------------------------------------------------
// 用例
// ---------------------------------------------------------------------
(function () {
    var m;
    // U1 没 bind 就 open → false
    resetWorld(); m = loadModule();
    ok('U1 导出 bind/open/release 三个函数', typeof m.bind === 'function' && typeof m.open === 'function' && typeof m.release === 'function' && Object.keys(m).length === 3, Object.keys(m).join(','));
    ok('U1 没 bind 时 open 返回 false', m.open(WHITE) === false);

    // U2 页面上没有弹窗 → false
    resetWorld(false); m = loadModule(); m.bind(VIEW);
    ok('U2 页面上没有 #procmListModal 时 open 返回 false', m.open(WHITE) === false && world.showCalls === 0);

    // U3 参数不对 → false
    resetWorld(); m = loadModule(); m.bind(VIEW);
    ok('U3 opts 为空返回 false', m.open(null) === false);
    ok('U3 mode 不对返回 false', m.open({ mode: 'xx' }) === false);
    ok('U3 编辑没有 pid 返回 false', m.open({ mode: 'edit', pid: '' }) === false && world.showCalls === 0);

    // U4 bind 绑了 3 个、重复 bind 不重复
    resetWorld(); m = loadModule(); m.bind(VIEW);
    ok('U4 bind 绑 3 个 .procmListModal 委托事件', nsCount() === 3, nsCount());
    m.bind(VIEW); m.bind(VIEW);
    ok('U4 重复 bind 仍是 3 个', nsCount() === 3, nsCount());
    // 不碰别的命名空间
    world.handlers.push({ type: 'click', ns: 'procmList', sel: '.x', fn: function () {} });
    m.bind(VIEW);
    ok('U4 bind 不去掉 list.js 的 .procmList 事件', world.handlers.filter(function (h) { return h.ns === 'procmList'; }).length === 1);

    // U5 创建：打开填值
    resetWorld(); m = loadModule(); m.bind(VIEW);
    k('.js_procm_lm_name')._val = '上次留下的';
    k('.js_procm_lm_desc')._val = '上次描述';
    k('.js_procm_lm_ok').props.disabled = true;
    var saved = [];
    var opts = Object.assign({}, WHITE, { onSaved: function (mode, data) { saved.push([mode, data]); } });
    ok('U5 open 创建返回 true', m.open(opts) === true);
    ok('U5 弹窗显示、遮罩 1 个', shown() && world.backdrops === 1);
    ok('U5 标题「创建白名单」', k('.js_procm_lm_title')._text === '创建白名单');
    ok('U5 标签「白名单名称：」', k('.js_procm_lm_name_label')._text === '白名单名称：');
    ok('U5 系统类型 Linux/信创', k('.js_procm_lm_systype')._text === 'Linux/信创');
    ok('U5 创建是空表单（不留上次的值）', k('.js_procm_lm_name')._val === '' && k('.js_procm_lm_desc')._val === '');
    ok('U5 占位按参数填', k('.js_procm_lm_name').attrs.placeholder === '示例：办公区终端白名单' && k('.js_procm_lm_desc').attrs.placeholder === '选填，说明这条白名单用在哪里、放行什么');
    ok('U5 按钮「创建」且可点', k('.js_procm_lm_ok')._text === '创建' && k('.js_procm_lm_ok').props.disabled === false);

    // U6 名称为空 / 全空格：提示、不发请求、不关
    click('.js_procm_lm_ok');
    k('.js_procm_lm_name')._val = '   ';
    click('.js_procm_lm_ok');
    ok('U6 名称为空提示「请输入名单名称！」两次、不发请求、弹窗还开着',
        world.msgs.length === 2 && world.msgs[0][0] === 'warn' && world.msgs[0][1] === '请输入名单名称！' && world.ajax.length === 0 && shown(),
        JSON.stringify(world.msgs));

    // U7 提交创建：去首尾空格、参数恰好 4 个、置灰防连点
    world.msgs = [];
    k('.js_procm_lm_name')._val = '  PL02测试-a  ';
    k('.js_procm_lm_desc')._val = '  说明  ';
    click('.js_procm_lm_ok');
    ok('U7 调 createWBList 一次', world.ajax.length === 1 && world.ajax[0].url === 'Procmanager/createWBList');
    ok('U7 参数 = pname/description/policytype/systype（去首尾空格，不带进程）',
        JSON.stringify(world.ajax[0].param) === JSON.stringify({ pname: 'PL02测试-a', description: '说明', policytype: 2, systype: 2 }),
        JSON.stringify(world.ajax[0].param));
    ok('U7 请求中按钮置灰', k('.js_procm_lm_ok').props.disabled === true);
    k('.js_procm_lm_ok').props.disabled = false;   // 即使按钮被别的东西恢复了，busy 也挡住第二次
    click('.js_procm_lm_ok');
    ok('U7 连点只发 1 次（busy 挡住）', world.ajax.length === 1, world.ajax.length);
    k('.js_procm_lm_ok').props.disabled = true;

    // U8 成功：提示 → 关弹窗 → onSaved
    resolve(0, 'ok', { PID: 9 }, '创建成功。');
    ok('U8 弹接口给的提示', world.msgs.length === 1 && world.msgs[0][0] === 'success' && world.msgs[0][1] === '创建成功。');
    ok('U8 弹窗关、遮罩 0', !shown() && world.backdrops === 0);
    ok('U8 onSaved(\'create\', data) 调一次', saved.length === 1 && saved[0][0] === 'create' && saved[0][1].PID === 9);
    // 关掉后上下文已清：再点按钮（假设能点）不发请求
    k('.js_procm_lm_ok').props.disabled = false;
    k('.js_procm_lm_name')._val = 'x';
    click('.js_procm_lm_ok');
    ok('U8 关掉后上下文已清，点按钮不发请求', world.ajax.length === 1);

    // U9 编辑：带出原值（val 填，不当 HTML）、系统类型按这一行、按钮「保存」
    resetWorld(); m = loadModule(); m.bind(VIEW);
    var BLACK_EDIT = {
        mode: 'edit', title: '编辑黑名单', policytype: 3, systype: '1', pid: '201', pname: '<b>x</b>&"', description: '原描述',
        name: '黑名单', namePlaceholder: '示例：挖矿程序黑名单', descPlaceholder: '选填，说明这条黑名单用在哪里、拦截什么',
        onSaved: function (mode) { saved.push([mode]); }
    };
    saved = [];
    ok('U9 open 编辑返回 true', m.open(BLACK_EDIT) === true);
    ok('U9 标题「编辑黑名单」、标签「黑名单名称：」、按钮「保存」',
        k('.js_procm_lm_title')._text === '编辑黑名单' && k('.js_procm_lm_name_label')._text === '黑名单名称：' && k('.js_procm_lm_ok')._text === '保存');
    ok('U9 原名称、原描述原样带出', k('.js_procm_lm_name')._val === '<b>x</b>&"' && k('.js_procm_lm_desc')._val === '原描述');
    ok('U9 系统类型显示这条名单自己的（1 → Windows）', k('.js_procm_lm_systype')._text === 'Windows');
    ok('U9 黑名单占位', k('.js_procm_lm_name').attrs.placeholder === '示例：挖矿程序黑名单' && k('.js_procm_lm_desc').attrs.placeholder === '选填，说明这条黑名单用在哪里、拦截什么');
    k('.js_procm_lm_name')._val = ' 新名字 ';
    k('.js_procm_lm_desc')._val = '';
    click('.js_procm_lm_ok');
    ok('U9 调 editWBList，参数只有 pid/pname/description', world.ajax.length === 1 && world.ajax[0].url === 'Procmanager/editWBList' &&
        JSON.stringify(world.ajax[0].param) === JSON.stringify({ pid: '201', pname: '新名字', description: '' }), JSON.stringify(world.ajax[0].param));

    // U10 失败：本模块不弹、弹窗留着、按钮恢复、可再点
    resolve(0, 'fail', '', '名单名称已存在。');
    ok('U10 失败时只有 core 那一次提示', world.msgs.length === 1 && world.msgs[0][0] === 'core-warn', JSON.stringify(world.msgs));
    ok('U10 弹窗留着、按钮恢复', shown() && k('.js_procm_lm_ok').props.disabled === false);
    ok('U10 失败不调 onSaved', saved.length === 0);
    click('.js_procm_lm_ok');
    ok('U10 改了可以再点（发第 2 次）', world.ajax.length === 2);
    resolve(1, 'net');
    ok('U10 网络层失败：按钮恢复、弹窗留着、本模块不弹', k('.js_procm_lm_ok').props.disabled === false && shown() && world.msgs.length === 1);

    // U11 系统类型认不出 → --；编辑后再开创建是空表单
    m.open(Object.assign({}, BLACK_EDIT, { systype: '9' }));
    ok('U11 认不出的系统类型显示 --', k('.js_procm_lm_systype')._text === '--');
    m.open(Object.assign({}, WHITE));
    ok('U11 编辑后再开创建：空表单、按钮「创建」', k('.js_procm_lm_name')._val === '' && k('.js_procm_lm_desc')._val === '' && k('.js_procm_lm_ok')._text === '创建');

    // U12 取消 / 叉 / Esc 都关、清上下文；子元素冒上来的 hidden 不清
    resetWorld(); m = loadModule(); m.bind(VIEW);
    m.open(WHITE);
    dispatch('hidden', '#procmListModal', world.modalEl, { child: true });   // 子元素的 hidden 冒泡上来
    k('.js_procm_lm_name')._val = 'a';
    click('.js_procm_lm_ok');
    ok('U12 子元素的 hidden 不清上下文（还能提交）', world.ajax.length === 1);
    resolve(0, 'net');
    var n = click('.js_procm_lm_cancel');
    ok('U12 「取消」由本模块绑、点了关弹窗、遮罩 0', n === 1 && !shown() && world.backdrops === 0);
    click('.js_procm_lm_ok');
    ok('U12 取消后上下文已清（点按钮不发请求）', world.ajax.length === 1);
    m.open(WHITE);
    new W([world.modalEl]).modal('hide');   // 叉（data-dismiss）/ Esc：bootstrap 自己调 hide
    k('.js_procm_lm_name')._val = 'a';
    click('.js_procm_lm_ok');
    ok('U12 叉 / Esc 关掉后上下文已清', world.ajax.length === 1 && world.backdrops === 0);

    // U13 请求中取消、再打开：旧请求回来不关新弹窗、不动新按钮，提示和 onSaved 照常
    resetWorld(); m = loadModule(); m.bind(VIEW);
    saved = [];
    m.open(Object.assign({}, WHITE, { onSaved: function (mode) { saved.push(mode); } }));
    k('.js_procm_lm_name')._val = 'old';
    click('.js_procm_lm_ok');
    click('.js_procm_lm_cancel');
    m.open(Object.assign({}, WHITE, { onSaved: function (mode) { saved.push('new-' + mode); } }));
    ok('U13 再打开时按钮恢复可点', k('.js_procm_lm_ok').props.disabled === false && shown());
    var hideBefore = world.hideCalls;
    resolve(0, 'ok', {}, '创建成功。');
    ok('U13 旧请求成功：提示照弹', world.msgs.length === 1 && world.msgs[0][1] === '创建成功。');
    ok('U13 旧请求成功：不关新弹窗', shown() && world.hideCalls === hideBefore);
    ok('U13 旧请求成功：调的是旧那次的 onSaved', saved.length === 1 && saved[0] === 'create');
    k('.js_procm_lm_ok').props.disabled = 'MARK';
    world.ajax[0].complete({});   // 再来一次 complete 也不碰新按钮
    ok('U13 旧请求的 complete 不动新弹窗的按钮', k('.js_procm_lm_ok').props.disabled === 'MARK');
    k('.js_procm_lm_ok').props.disabled = false;
    k('.js_procm_lm_name')._val = 'new';
    click('.js_procm_lm_ok');
    ok('U13 新的一次可以正常提交', world.ajax.length === 2);

    // U14 release：开着就关、去遮罩、解绑、之后回来的请求不动页面
    resetWorld(); m = loadModule(); m.bind(VIEW);
    saved = [];
    m.open(Object.assign({}, WHITE, { onSaved: function (mode) { saved.push(mode); } }));
    k('.js_procm_lm_name')._val = 'r';
    click('.js_procm_lm_ok');
    m.release();
    ok('U14 release 关弹窗、遮罩 0', !shown() && world.backdrops === 0);
    ok('U14 release 解绑本模块事件', nsCount() === 0);
    hideBefore = world.hideCalls;
    k('.js_procm_lm_ok').props.disabled = 'MARK';
    resolve(0, 'ok', {}, '创建成功。');
    ok('U14 release 后请求成功：提示照弹、不再 hide、不动按钮', world.msgs.length === 1 && world.hideCalls === hideBefore && k('.js_procm_lm_ok').props.disabled === 'MARK');
    ok('U14 release 后 onSaved 照调（由 list.js 的 token 判断不刷新）', saved.length === 1);
    ok('U14 release 后 open 返回 false', m.open(WHITE) === false);
    // 没打开过就 release：不报错、不 hide
    resetWorld(); m = loadModule(); m.bind(VIEW);
    var threw = false;
    try { m.release(); m.release(); } catch (e) { threw = String(e); }
    ok('U14 没打开过 / 连续 release 不报错、不调 hide', threw === false && world.hideCalls === 0, threw);
    // release 后重新 bind（回到名单页）：重新可用
    m.bind(VIEW);
    ok('U14 回到页面重新 bind 后可以打开', m.open(WHITE) === true && nsCount() === 3);
})();

// ---------------------------------------------------------------------
// 静态检查：list.html 新弹窗、list.js 配置与调用、完成判据 grep
// ---------------------------------------------------------------------
(function () {
    var html = fs.readFileSync(path.join(SRC, 'list.html'), 'utf8');
    var js = fs.readFileSync(path.join(SRC, 'list.js'), 'utf8');
    var mjs = fs.readFileSync(path.join(SRC, 'bwlistModal.js'), 'utf8');
    var start = html.indexOf('<div id="procmListModal"');
    var block = start >= 0 ? html.slice(start) : '';
    block = block.slice(0, block.lastIndexOf('</div>'));   // 去掉最后一个 </div>（.procm-bwlist 的结尾）
    ok('H1 list.html 有 #procmListModal，且在 .procm-bwlist 里、在 #procmSetGroup 之后', start > html.indexOf('id="procmSetGroup"') && start > 0 && /<\/div>\s*$/.test(html));
    ok('H1 只有 1 个 #procmListModal', (html.match(/id="procmListModal"/g) || []).length === 1);
    ok('H2 外壳：modal hide、tabindex、data-backdrop="static"、宽 500，无行内 z-index',
        /<div id="procmListModal" class="modal hide" tabindex="-1" data-backdrop="static" style="width:500px;">/.test(block) && !/z-index/.test(block));
    ok('H3 没有 secondm-hide / alert_drag / addNewList', !/secondm-hide|alert_drag|addNewList/.test(block));
    ok('H4 3 个按钮都是 type="button"', (block.match(/<button /g) || []).length === 3 && (block.match(/<button type="button"/g) || []).length === 3);
    ok('H4 叉带 data-dismiss，「取消」不带', /<button type="button" class="close" data-dismiss="modal"><\/button>/.test(block) && /<button type="button" class="btn btn-cancel js_procm_lm_cancel">取消<\/button>/.test(block));
    ok('H5 名称 maxlength 100、描述 maxlength 200', /js_procm_lm_name" type="text" maxlength="100"/.test(block) && /js_procm_lm_desc"[^>]*maxlength="200"/.test(block));
    ok('H5 两个输入框保留 oninput="RsCore.validateXss(this)"', (block.match(/oninput="RsCore\.validateXss\(this\)"/g) || []).length === 2);
    ok('H6 标签「描述：」、没有「备注」', /描述：<\/label>/.test(block) && !/备/.test(block));
    ok('H6 两个必填红星（名称、系统类型）', (block.match(/<span class="import-icon">\*<\/span>/g) || []).length === 2);
    ok('H6 系统类型是文字、没有下拉框', /js_procm_lm_systype/.test(block) && !/<select/.test(block));
    ok('H7 bwlistModal.js 用到的 7 个类在弹窗里都有', ['js_procm_lm_title', 'js_procm_lm_name_label', 'js_procm_lm_name', 'js_procm_lm_systype',
        'js_procm_lm_desc', 'js_procm_lm_cancel', 'js_procm_lm_ok'].every(function (c) { return new RegExp('class="[^"]*\\b' + c + '\\b').test(block); }));
    ok('H8 弹窗块里没有 mustache 标记', !/\{\{/.test(block));

    ok('J1 list.js 占位：白名单两条照计划原文', js.indexOf("namePlaceholder: '示例：办公区终端白名单'") > 0 && js.indexOf("descPlaceholder: '选填，说明这条白名单用在哪里、放行什么'") > 0);
    ok('J1 list.js 占位：黑名单两条照计划原文', js.indexOf("namePlaceholder: '示例：挖矿程序黑名单'") > 0 && js.indexOf("descPlaceholder: '选填，说明这条黑名单用在哪里、拦截什么'") > 0);
    ok('J2 list.js require processManage/bwlistModal', js.indexOf("require('processManage/bwlistModal')") > 0);
    ok('J2 init 里 bind、destroy 里 release、openListModal 调 open', /bwlistModal\.bind\(view\)/.test(js) && /bwlistModal\.release\(\)/.test(js) && /bwlistModal\.open\(\{/.test(js));
    ok('J3 open 传 name / namePlaceholder / descPlaceholder', /name: cfg\.name,/.test(js) && /namePlaceholder: cfg\.namePlaceholder/.test(js) && /descPlaceholder: cfg\.descPlaceholder/.test(js));
    ok('J4 完成判据 grep：layoutPage|addNewList|require(\'processManage\') 在 list.js、bwlistModal.js 里 0 处',
        !/layoutPage|addNewList|require\('processManage'\)/.test(js) && !/layoutPage|addNewList|require\('processManage'\)/.test(mjs));
    ok('J5 bwlistModal.js 不写死白 / 黑文案', !/白名单|黑名单/.test(mjs.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
    ok('J6 bwlistModal.js 只用 ES5（代码里没有 let/const/=>/模板字符串/class）',
        !/\blet\b|\bconst\b|=>|`|^\s*class\b/m.test(mjs.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
})();

var pass = results.filter(function (r) { return r.ok; }).length;
results.forEach(function (r) {
    console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok || !r.detail ? '' : '  → ' + r.detail));
});
console.log('\n' + pass + '/' + results.length + (pass === results.length ? ' 全绿' : ' 有红'));
process.exit(pass === results.length ? 0 : 1);
