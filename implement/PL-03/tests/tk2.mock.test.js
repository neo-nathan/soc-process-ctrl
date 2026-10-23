// PL-03 TK-2：bwlistMock.js 单测（§3.3：只拦 3 个地址、remember 后发布 / 应用到组各分支、成功不改列表）
// 用法：node tk2.mock.test.js [bwlistMock.js 路径]
var assert = require('assert');
var load = require('./amd');
var FILE = process.argv[2] || '/Users/nick/Workspace/ESMCenterST/public/esm/view/processManage/bwlistMock.js';

// 假的 RsCore：记录放行的请求和弹出的提示
var passed = [], warns = [];
var RsCore = {
    ajaxList: [],
    // 照 core.js：warn 里用 this.run 弹框，裸调（this 丢了）会报错——用来抓 PL-03 实测发现的 this 丢失问题
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
// 发一个请求，等回调后返回 {ok, code, msg, data, completed}
function call(url, param) {
    return new Promise(function (resolve) {
        var out = { completed: 0 };
        RsCore.ajax(url, param, function (data, code, msg) { out.ok = true; out.code = code; out.msg = msg; out.data = data; },
            function () { out.completed++; setTimeout(function () { resolve(out); }, 0); },
            function (data, code, msg) { out.ok = false; out.code = code; out.msg = msg; });
    });
}
function row(pid, pub, base, add, del, gn) {
    return { PID: pid, PNAME: 'n' + pid, PUBSTATUS: pub, PROCNUM: base, ADDNUM: add, DELNUM: del, GROUPNUM: gn || 0, EPNUM: 0 };
}

t('导出：只剩约定的几个，删掉的都没了', function () {
    var keys = Object.keys(M).sort();
    assert.deepStrictEqual(keys, ['MSG', 'URLS', 'install', 'isEnabled', 'isInstalled', 'remember', 'reset', 'setEnabled', 'uninstall']);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(M.URLS)), ['Procmanager/publishWBList', 'Procmanager/getWBListUsedGroupId', 'Procmanager/setWBListGroups']);
});
t('install：包一层，重复 install 不叠', function () {
    assert.strictEqual(M.install(), true);
    var w = RsCore.ajax;
    assert.notStrictEqual(w, origAjax);
    assert.strictEqual(M.install(), true);
    assert.strictEqual(RsCore.ajax, w);
    assert.strictEqual(M.isInstalled(), true);
});
t('getWBList 原样放行（参数对象同一个）', function () {
    passed = [];
    var p = { policytype: 2, timeRange: 0 };
    var cb = function () {};
    var r = RsCore.ajax('Procmanager/getWBList', p, cb);
    assert.strictEqual(r, 'orig');
    assert.strictEqual(passed.length, 1);
    assert.strictEqual(passed[0].param, p);
    RsCore.ajax('/procmanager/GETWBLIST', p);
    assert.strictEqual(passed.length, 2);
    RsCore.ajax('Procmanager/createWBList', { a: 1 });
    assert.strictEqual(passed.length, 3);
});
t('3 个地址被拦（不放行），大小写和开头 / 不影响', async function () {
    passed = [];
    await call('/procmanager/PUBLISHWBLIST', { pid: 1, policytype: 2 });
    await call('Procmanager/getWBListUsedGroupId', { pid: 1 });
    await call('Procmanager/setWBListGroups', { pid: 1, policytype: 2 });
    assert.strictEqual(passed.length, 0);
});
t('没 remember 过：发布 / 应用到组 → 名单不存在 code 3', async function () {
    M.reset();
    var a = await call('Procmanager/publishWBList', { pid: 60, policytype: 2 });
    assert.strictEqual(a.ok, false); assert.strictEqual(a.code, 3); assert.strictEqual(a.msg, '名单不存在。');
    var b = await call('Procmanager/setWBListGroups', { pid: 60, policytype: 2 });
    assert.strictEqual(b.code, 3);
    assert.strictEqual(a.completed, 1);
});
t('参数错：code 2', async function () {
    assert.strictEqual((await call('Procmanager/publishWBList', { pid: 'x', policytype: 2 })).code, 2);
    assert.strictEqual((await call('Procmanager/publishWBList', { pid: 1, policytype: 5 })).code, 2);
    assert.strictEqual((await call('Procmanager/setWBListGroups', { pid: 0, policytype: 2 })).code, 2);
    assert.strictEqual((await call('Procmanager/getWBListUsedGroupId', {})).code, 2);
    assert.strictEqual((await call('Procmanager/publishWBList', 'pid=1&policytype=2')).code, 2);
});
t('类型不符：白名单的 PID 用黑名单类型发 → 名单不存在', async function () {
    M.reset();
    M.remember(2, [row(60, 1, 0, 1, 0)]);
    assert.strictEqual((await call('Procmanager/publishWBList', { pid: 60, policytype: 3 })).code, 3);
    assert.strictEqual((await call('Procmanager/publishWBList', { pid: 60, policytype: 2 })).ok, true);
});
t('发布：4 种状态 + 发布后 0 + 有组 / 没组文案', async function () {
    M.reset();
    M.remember(2, [row(1, 0, 0, 0, 0), row(2, 1, 0, 3, 0), row(3, 2, 5, 0, 0), row(4, 3, 5, 1, 2, 2), row(5, 1, 0, 0, 0), row(6, 3, 0, 0, 0), row(7, 9, 1, 1, 0)]);
    var r1 = await call('Procmanager/publishWBList', { pid: 1, policytype: 2 });
    assert.strictEqual(r1.code, 4); assert.ok(/空名单/.test(r1.msg));
    var r2 = await call('Procmanager/publishWBList', { pid: 2, policytype: 2 });
    assert.strictEqual(r2.ok, true); assert.strictEqual(r2.msg, M.MSG.PUBLISH_UNAPPLIED); assert.strictEqual(r2.data, '');
    var r3 = await call('Procmanager/publishWBList', { pid: 3, policytype: 2 });
    assert.strictEqual(r3.code, 4); assert.ok(/没有变更/.test(r3.msg));
    var r4 = await call('Procmanager/publishWBList', { pid: '4', policytype: '2' });
    assert.strictEqual(r4.ok, true); assert.strictEqual(r4.msg, M.MSG.PUBLISH_APPLIED);
    var r5 = await call('Procmanager/publishWBList', { pid: 5, policytype: 2 });   // 待发布 +0（PID 40 这类）
    assert.strictEqual(r5.code, 4); assert.ok(/发布后进程数为 0/.test(r5.msg));
    var r6 = await call('Procmanager/publishWBList', { pid: 6, policytype: 2 });   // 有变更 +0（PID 39 这类）
    assert.strictEqual(r6.code, 4); assert.ok(/发布后进程数为 0/.test(r6.msg));
    var r7 = await call('Procmanager/publishWBList', { pid: 7, policytype: 2 });
    assert.strictEqual(r7.code, 4); assert.ok(/当前状态不能发布/.test(r7.msg));
});
t('发布成功后不改记下的行：再发一次结果一样，行对象没被改', async function () {
    M.reset();
    var r = row(2, 1, 0, 3, 0);
    M.remember(2, [r]);
    await call('Procmanager/publishWBList', { pid: 2, policytype: 2 });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), row(2, 1, 0, 3, 0));
    var again = await call('Procmanager/publishWBList', { pid: 2, policytype: 2 });
    assert.strictEqual(again.ok, true);
});
t('应用到组：只有已发布能做，成功不记组；取已选组一律空', async function () {
    M.reset();
    M.remember(3, [row(1, 0, 0, 0, 0), row(2, 1, 0, 1, 0), row(3, 2, 5, 0, 0), row(4, 3, 5, 1, 0)]);
    assert.ok(/先添加进程/.test((await call('Procmanager/setWBListGroups', { pid: 1, policytype: 3 })).msg));
    assert.ok(/先发布/.test((await call('Procmanager/setWBListGroups', { pid: 2, policytype: 3 })).msg));
    assert.ok(/有变更/.test((await call('Procmanager/setWBListGroups', { pid: 4, policytype: 3 })).msg));
    var ok = await call('Procmanager/setWBListGroups', { pid: 3, policytype: 3, aObjId: ['10', '11'] });
    assert.strictEqual(ok.ok, true); assert.strictEqual(ok.msg, M.MSG.APPLY);
    var used = await call('Procmanager/getWBListUsedGroupId', { pid: 3, productid: 'x', eptype: 2 });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(used.data)), { aUsedGroupId: [], aLockGroupId: [] });
});
t('remember 替换上一次；非数组 = 清空这一类；非法 type 不记', async function () {
    M.reset();
    M.remember(2, [row(1, 1, 0, 1, 0)]);
    M.remember(2, [row(2, 1, 0, 1, 0)]);
    assert.strictEqual((await call('Procmanager/publishWBList', { pid: 1, policytype: 2 })).code, 3);
    assert.strictEqual((await call('Procmanager/publishWBList', { pid: 2, policytype: 2 })).ok, true);
    M.remember(5, [row(9, 1, 0, 1, 0)]);
    assert.strictEqual((await call('Procmanager/publishWBList', { pid: 9, policytype: 2 })).code, 3);
    M.remember(2, null);
    assert.strictEqual((await call('Procmanager/publishWBList', { pid: 2, policytype: 2 })).code, 3);
});
t('报错时弹「错误」提示（非 hideMsg），hideMsg 时不弹', async function () {
    M.reset(); warns = [];
    await call('Procmanager/publishWBList', { pid: 1, policytype: 2 });
    assert.strictEqual(warns.length, 1); assert.strictEqual(warns[0][0], '错误');
    await call('Procmanager/publishWBList', { pid: 1, policytype: 2, hideMsg: true });
    assert.strictEqual(warns.length, 1);
});
t('弹提示时 complete 照常调用（提示报错不会打断 complete）', async function () {
    M.reset(); warns = [];
    var r = await call('Procmanager/publishWBList', { pid: 1, policytype: 2 });
    assert.strictEqual(r.completed, 1); assert.strictEqual(warns.length, 1);
    assert.strictEqual(warns[0][2], 'error'); assert.strictEqual(warns[0][1], '名单不存在。');
});
t('uninstall 还原原函数；关掉开关后 install 不包', function () {
    assert.strictEqual(M.uninstall(), true);
    assert.strictEqual(RsCore.ajax, origAjax);
    assert.strictEqual(M.uninstall(), false);
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
