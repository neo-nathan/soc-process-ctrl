// PL-03 TK-1：bwlistAdapter.js 单测（§3.1 参数、§3.2 字段、排序、前端筛选）
// 用法：node tk1.adapter.test.js [bwlistAdapter.js 路径]
var assert = require('assert');
var path = require('path');
var load = require('./amd');
var FILE = process.argv[2] || '/Users/nick/Workspace/ESMCenterST/public/esm/view/processManage/bwlistAdapter.js';
var A = load(FILE).mod;
var n = 0;
function t(name, fn) { fn(); n++; console.log('PASS', name); }
function eq(a, b) { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b); }
var E = { systype: '', ctime: '', cfrom: '', cto: '', pubstatus: '', scope: '', delta: '', kw: '' };
function c(o) { return Object.assign({}, E, o); }

// ---------- §3.1 toQuery ----------
t('空条件 = policytype + timeRange=0，别的都不传', function () {
    eq(A.toQuery(2, E), { policytype: 2, timeRange: 0 });
    eq(A.toQuery(3, {}), { policytype: 3, timeRange: 0 });
    eq(A.toQuery(2, null), { policytype: 2, timeRange: 0 });
});
t('不带旧名 type 和任何页面参数名', function () {
    var q = A.toQuery(2, c({ systype: '2', ctime: 'week', pubstatus: '1', scope: '1', delta: 'add', kw: 'x' }));
    ['type', 'systype', 'ctime', 'cfrom', 'cto', 'pubstatus', 'scope', 'delta', 'kw'].forEach(function (k) {
        assert.ok(!(k in q), '不该有 ' + k);
    });
});
t('systype → eptype', function () {
    eq(A.toQuery(2, c({ systype: '2' })), { policytype: 2, eptype: 2, timeRange: 0 });
    eq(A.toQuery(2, c({ systype: 1 })), { policytype: 2, eptype: 1, timeRange: 0 });
    eq(A.toQuery(2, c({ systype: '5' })), { policytype: 2, timeRange: 0 });
});
t('ctime → timeRange 1/2/3，未知值按 0', function () {
    assert.strictEqual(A.toQuery(2, c({ ctime: 'week' })).timeRange, 1);
    assert.strictEqual(A.toQuery(2, c({ ctime: 'month' })).timeRange, 2);
    assert.strictEqual(A.toQuery(2, c({ ctime: 'lastmonth' })).timeRange, 3);
    assert.strictEqual(A.toQuery(2, c({ ctime: 'xyz' })).timeRange, 0);
    assert.strictEqual(A.toQuery(2, c({ ctime: 'toString' })).timeRange, 0);
});
t('指定日期：timeRange=0 + begintime/endtime，忽略 ctime', function () {
    eq(A.toQuery(2, c({ cfrom: '2026-10-01' })), { policytype: 2, timeRange: 0, begintime: '2026-10-01' });
    eq(A.toQuery(2, c({ cto: '2026-10-22' })), { policytype: 2, timeRange: 0, endtime: '2026-10-22' });
    eq(A.toQuery(2, c({ ctime: 'week', cfrom: '2026-10-22', cto: '2026-10-22' })), { policytype: 2, timeRange: 0, begintime: '2026-10-22', endtime: '2026-10-22' });
    eq(A.toQuery(2, c({ cfrom: ' 2026-10-01 ' })), { policytype: 2, timeRange: 0, begintime: '2026-10-01' });
});
t('pubstatus 0/1/2/3 → status 1/2/4/3；0 不算空；越界不传', function () {
    assert.strictEqual(A.toQuery(2, c({ pubstatus: '0' })).status, 1);
    assert.strictEqual(A.toQuery(2, c({ pubstatus: 0 })).status, 1);
    assert.strictEqual(A.toQuery(2, c({ pubstatus: '1' })).status, 2);
    assert.strictEqual(A.toQuery(2, c({ pubstatus: '2' })).status, 4);
    assert.strictEqual(A.toQuery(2, c({ pubstatus: '3' })).status, 3);
    assert.ok(!('status' in A.toQuery(2, c({ pubstatus: '9' }))));
    assert.ok(!('status' in A.toQuery(2, c({ pubstatus: '' }))));
});
t('scope 1/0 → objrange 1/0；0 不算空', function () {
    assert.strictEqual(A.toQuery(2, c({ scope: '1' })).objrange, 1);
    assert.strictEqual(A.toQuery(2, c({ scope: '0' })).objrange, 0);
    assert.strictEqual(A.toQuery(2, c({ scope: 0 })).objrange, 0);
    assert.ok(!('objrange' in A.toQuery(2, c({ scope: '' }))));
});
t('delta add/del → procstatus 1/2；none、kw 不传', function () {
    assert.strictEqual(A.toQuery(2, c({ delta: 'add' })).procstatus, 1);
    assert.strictEqual(A.toQuery(2, c({ delta: 'del' })).procstatus, 2);
    eq(A.toQuery(2, c({ delta: 'none', kw: 'abc' })), { policytype: 2, timeRange: 0 });
});
t('null / undefined 当空', function () {
    eq(A.toQuery(2, { systype: null, pubstatus: undefined, scope: null }), { policytype: 2, timeRange: 0 });
});

// ---------- §3.2 toRow ----------
function raw(o) {
    return Object.assign({ PID: 1, PNAME: 'a', STATUS: 1, CREATETIME: '2026-10-01 00:00:00',
        PROCCOUNT: 0, PROCCONFIRMCOUNT: 0, PROCADDCOUNT: 0, PROCREMOVECOUNT: 0, OBJCOUNT: 0, DESCRIPTION: 'd' }, o);
}
t('STATUS 1/2/3/4 → PUBSTATUS 0/1/3/2；越界按 0', function () {
    [[1, 0], [2, 1], [3, 3], [4, 2], [0, 0], [5, 0], ['1', 0], ['2', 1], ['3', 3], ['4', 2], [null, 0], ['abc', 0]].forEach(function (p) {
        assert.strictEqual(A.toRow(raw({ STATUS: p[0] })).PUBSTATUS, p[1], 'STATUS=' + p[0]);
    });
});
t('PROCNUM = 已确认 + 移除；ADDNUM/DELNUM/GROUPNUM；EPNUM=0；字符串数字转整数', function () {
    var r = A.toRow(raw({ PROCCONFIRMCOUNT: '5', PROCADDCOUNT: '2', PROCREMOVECOUNT: '1', OBJCOUNT: '3', PROCCOUNT: 7 }));
    assert.strictEqual(r.PROCNUM, 6); assert.strictEqual(r.ADDNUM, 2); assert.strictEqual(r.DELNUM, 1);
    assert.strictEqual(r.GROUPNUM, 3); assert.strictEqual(r.EPNUM, 0);
    // 自洽：发布后进程数 = PROCCOUNT
    assert.strictEqual(r.PROCNUM + r.ADDNUM - r.DELNUM, 7);
});
t('缺字段按 0，原字段保留，不改入参', function () {
    var src = { PID: '9', PNAME: 'x', EXTRA: 'keep' };
    var r = A.toRow(src);
    assert.strictEqual(r.PROCNUM, 0); assert.strictEqual(r.ADDNUM, 0); assert.strictEqual(r.DELNUM, 0);
    assert.strictEqual(r.PUBSTATUS, 0); assert.strictEqual(r.GROUPNUM, 0); assert.strictEqual(r.EPNUM, 0);
    assert.strictEqual(r.EXTRA, 'keep'); assert.strictEqual(r.PID, '9');
    assert.ok(!('PROCNUM' in src));
    var z = A.toRow(null); assert.strictEqual(z.PUBSTATUS, 0);
});

// ---------- §3.2 / Q2 toList ----------
var rows = [
    raw({ PID: 5, PNAME: 'Web 服务', CREATETIME: '2026-10-22 10:00:00', PROCADDCOUNT: 1, STATUS: 2 }),
    raw({ PID: 3, PNAME: 'web-db', CREATETIME: '2026-10-19 09:00:00', STATUS: 1 }),
    raw({ PID: 4, PNAME: '数据库', CREATETIME: '2026-10-22 10:00:00', STATUS: 1 }),
    raw({ PID: 1, PNAME: 'Mail', CREATETIME: '2026-10-01 00:00:00', PROCREMOVECOUNT: 2, PROCCONFIRMCOUNT: 3, STATUS: 3 })
];
t('只有移除、没有添加：PROCNUM = 已确认 + 移除（Mail 行 3 + 2 = 5）', function () {
    var m = A.toList(rows, E).rows[0];
    assert.strictEqual(m.PID, 1); assert.strictEqual(m.PROCNUM, 5); assert.strictEqual(m.DELNUM, 2); assert.strictEqual(m.ADDNUM, 0);
    assert.strictEqual(m.PUBSTATUS, 3);
});
t('按创建时间升序、同一时间按 PID 升序', function () {
    eq(A.toList(rows, E).rows.map(function (r) { return r.PID; }), [1, 3, 4, 5]);
    assert.strictEqual(A.toList(rows, E).total, 4);
});
t('kw：不分大小写、首尾空格、中文', function () {
    eq(A.toList(rows, c({ kw: 'WEB' })).rows.map(function (r) { return r.PID; }), [3, 5]);
    eq(A.toList(rows, c({ kw: '  web ' })).rows.map(function (r) { return r.PID; }), [3, 5]);
    eq(A.toList(rows, c({ kw: '数据' })).rows.map(function (r) { return r.PID; }), [4]);
    assert.strictEqual(A.toList(rows, c({ kw: 'zzz' })).total, 0);
});
t('delta=none：ADDNUM=0 且 DELNUM=0', function () {
    eq(A.toList(rows, c({ delta: 'none' })).rows.map(function (r) { return r.PID; }), [3, 4]);
    // add/del 交给后端，前端不再筛
    assert.strictEqual(A.toList(rows, c({ delta: 'add' })).total, 4);
});
t('kw + none 组合；total = 筛后条数', function () {
    var r = A.toList(rows, c({ kw: 'web', delta: 'none' }));
    eq(r.rows.map(function (x) { return x.PID; }), [3]); assert.strictEqual(r.total, 1);
});
t('rawRows 不是数组按空；不改入参顺序', function () {
    eq(A.toList(null, E), { rows: [], total: 0 });
    eq(A.toList({}, E), { rows: [], total: 0 });
    assert.strictEqual(rows[0].PID, 5);
});
t('PNAME 缺失时 kw 筛不报错', function () {
    assert.strictEqual(A.toList([{ PID: 1 }], c({ kw: 'a' })).total, 0);
    assert.strictEqual(A.toList([{ PID: 1, PNAME: null }], c({ kw: 'null' })).total, 0);
});
console.log('ALL PASS (' + n + ')');
