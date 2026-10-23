// 发布切真接口 releaseWBList 后，bwlistMock.js 单测：只拦应用到组 2 个地址，发布（新旧地址）都原样放行
// 用法：node mock.test.js [bwlistMock.js 路径]
var assert = require('assert');
var load = require('./amd');
var FILE = process.argv[2] || '/Users/nick/Workspace/ESMCenterST/public/esm/view/processManage/bwlistMock.js';

// 假的 RsCore：记录放行的请求和弹出的提示（warn 照 core.js 用 this.run，裸调会报错）
var passed = [], warns = [];
var RsCore = {
    ajaxList: [],
    msg: {
        run: function (type, title, content) { warns.push([title, content, type]); },
        warn: function (title, content) { this.run('error', title, content); }
    },
    ajax: function (url, param) { passed.push({ url: url, param: param }); return 'orig'; }
};
var origAjax = RsCore.ajax;
var M = load(FILE, { RsCore: RsCore }).mod;

var tests = [];
function t(name, fn) { tests.push({ name: name, fn: fn }); }
// 发一个请求（走 mock），等回调后返回 {ok, code, msg, data, completed}
function call(url, param) {
    return new Promise(function (resolve) {
        var out = { completed: 0 };
        RsCore.ajax(url, param, function (data, code, msg) { out.ok = true; out.code = code; out.msg = msg; out.data = data; },
            function () { out.completed++; setTimeout(function () { resolve(out); }, 0); },
            function (data, code, msg) { out.ok = false; out.code = code; out.msg = msg; });
    });
}
function row(pid, pub) { return { PID: pid, PNAME: 'n' + pid, PUBSTATUS: pub }; }

t('导出不变；URLS 只剩应用到组 2 个；MSG 只剩 APPLY', function () {
    assert.deepStrictEqual(Object.keys(M).sort(), ['MSG', 'URLS', 'install', 'isEnabled', 'isInstalled', 'remember', 'reset', 'setEnabled', 'uninstall']);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(M.URLS)), ['Procmanager/getWBListUsedGroupId', 'Procmanager/setWBListGroups']);
    assert.deepStrictEqual(Object.keys(M.MSG), ['APPLY']);
});
t('install：包一层，重复 install 不叠', function () {
    assert.strictEqual(M.install(), true);
    var w = RsCore.ajax;
    assert.notStrictEqual(w, origAjax);
    assert.strictEqual(M.install(), true);
    assert.strictEqual(RsCore.ajax, w);
});
t('发布 releaseWBList 原样放行（参数对象、回调都是同一个）；旧地址 publishWBList 也不再拦', function () {
    passed = [];
    var p = { pid: 60, policytype: 2 };
    var cb = function () {};
    assert.strictEqual(RsCore.ajax('Procmanager/releaseWBList', p, cb), 'orig');
    assert.strictEqual(passed.length, 1);
    assert.strictEqual(passed[0].url, 'Procmanager/releaseWBList');
    assert.strictEqual(passed[0].param, p);
    assert.strictEqual(RsCore.ajax('/procmanager/PUBLISHWBLIST', p), 'orig');
    assert.strictEqual(passed.length, 2);
});
t('列表、创建、删除照旧放行', function () {
    passed = [];
    RsCore.ajax('Procmanager/getWBList', { policytype: 2 });
    RsCore.ajax('Procmanager/createWBList', { a: 1 });
    RsCore.ajax('Procmanager/delWBList', { pid: 1, policytype: 2 });
    assert.strictEqual(passed.length, 3);
});
t('应用到组 2 个地址仍被拦，大小写和开头 / 不影响', async function () {
    passed = [];
    await call('Procmanager/getWBListUsedGroupId', { pid: 1 });
    await call('/procmanager/SETWBLISTGROUPS', { pid: 1, policytype: 2 });
    assert.strictEqual(passed.length, 0);
});
t('应用到组：参数错 2、没 remember 3、只有已发布能做，成功不记组；取已选组一律空', async function () {
    M.reset();
    assert.strictEqual((await call('Procmanager/setWBListGroups', { pid: 0, policytype: 2 })).code, 2);
    assert.strictEqual((await call('Procmanager/getWBListUsedGroupId', {})).code, 2);
    assert.strictEqual((await call('Procmanager/setWBListGroups', { pid: 3, policytype: 3 })).code, 3);
    M.remember(3, [row(1, 0), row(2, 1), row(3, 2), row(4, 3)]);
    assert.ok(/先添加进程/.test((await call('Procmanager/setWBListGroups', { pid: 1, policytype: 3 })).msg));
    assert.ok(/先发布/.test((await call('Procmanager/setWBListGroups', { pid: 2, policytype: 3 })).msg));
    assert.ok(/有变更/.test((await call('Procmanager/setWBListGroups', { pid: 4, policytype: 3 })).msg));
    assert.strictEqual((await call('Procmanager/setWBListGroups', { pid: 3, policytype: 2 })).code, 3);   // 类型不符
    var ok = await call('Procmanager/setWBListGroups', { pid: '3', policytype: '3', aObjId: ['10'] });
    assert.strictEqual(ok.ok, true); assert.strictEqual(ok.msg, M.MSG.APPLY); assert.strictEqual(ok.completed, 1);
    var used = await call('Procmanager/getWBListUsedGroupId', { pid: 3, productid: 'x', eptype: 2 });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(used.data)), { aUsedGroupId: [], aLockGroupId: [] });
});
t('报错时弹「错误」，hideMsg 时不弹', async function () {
    M.reset(); warns = [];
    await call('Procmanager/setWBListGroups', { pid: 1, policytype: 2 });
    assert.strictEqual(warns.length, 1); assert.strictEqual(warns[0][0], '错误');
    await call('Procmanager/setWBListGroups', { pid: 1, policytype: 2, hideMsg: true });
    assert.strictEqual(warns.length, 1);
});
t('uninstall 还原；关开关后 install 不包', function () {
    assert.strictEqual(M.uninstall(), true);
    assert.strictEqual(RsCore.ajax, origAjax);
    M.setEnabled(false);
    assert.strictEqual(M.install(), false);
    assert.strictEqual(RsCore.ajax, origAjax);
    M.setEnabled(true);
});

(async function () {
    for (var i = 0; i < tests.length; i++) {
        await tests[i].fn();
        console.log('PASS', tests[i].name);
    }
    console.log('ALL PASS (' + tests.length + ')');
})().catch(function (e) { console.error('FAIL', e); process.exit(1); });
