// PL-04 单测：bwlistAdapter.js 新加的 toProcRow / toProcList，bwlistProc.js 导出的纯函数（_test）
// 用法：node pl04.unit.test.js [SOC 源码 processManage 目录]
var assert = require('assert');
var path = require('path');
var load = require('./amd');
var DIR = process.argv[2] || '/Users/nick/Workspace/ESMCenterST/public/esm/view/processManage';
var A = load(path.join(DIR, 'bwlistAdapter.js')).mod;
var P = load(path.join(DIR, 'bwlistProc.js')).mod._test;
var n = 0;
function t(name, fn) { fn(); n++; console.log('PASS', name); }
function eq(a, b) { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b); }
function ids(res) { return res.rows.map(function (r) { return r.ID; }); }

// 美东晚上 = 北京第二天早上：2026-10-22 20:00 EDT = 2026-10-23 08:00 北京（周五）
var NOW_X = Date.parse('2026-10-22T20:00:00-04:00');
// 北京 2026-11-01 00:30（周日）= UTC 10-31 16:30
var NOW_Y = Date.parse('2026-11-01T00:30:00+08:00');

// ---------- toProcRow ----------
t('toProcRow 字段转换（Linux）', function () {
    var r = A.toProcRow({ ID: '17', PROCPATH: '/opt/BDFZ/ESM/bin/redis-server', FILEHASH: 'ABCDEF0123456789ABCDEF0123456789', ALGO: '0', STATUS: '1', CREATETIME: '2026-10-23 10:20:50', X: 1 }, 2);
    eq(r, { ID: 17, PROCPATH: '/opt/BDFZ/ESM/bin/redis-server', FILEHASH: 'abcdef0123456789abcdef0123456789', ALGO: 0, STATUS: 1, CREATETIME: '2026-10-23 10:20:50', X: 1, PROCNAME: 'redis-server', ALGOTEXT: 'MD5', STATE: 'new' });
});
t('ALGO 0 / 8 / 1 → MD5 / SHA256 / 未知算法；STATUS 0 / 2 / 9', function () {
    assert.strictEqual(A.toProcRow({ ALGO: 8 }, 2).ALGOTEXT, 'SHA256');
    assert.strictEqual(A.toProcRow({ ALGO: 1, FILEHASH: '11111' }, 2).ALGOTEXT, '未知算法');
    assert.strictEqual(A.toProcRow({ STATUS: 0 }, 2).STATE, 'normal');
    assert.strictEqual(A.toProcRow({ STATUS: '2' }, 2).STATE, 'pending');
    assert.strictEqual(A.toProcRow({ STATUS: 9 }, 2).STATE, 'normal');
});
t('缺字段不报错', function () {
    eq(A.toProcRow(null, 2), { ID: 0, STATUS: 0, PROCPATH: '', PROCNAME: '', FILEHASH: '', ALGO: 0, ALGOTEXT: 'MD5', STATE: 'normal', CREATETIME: '' });
});
t('进程名：Linux 只按 / 切，Windows 按 \\ 和 / 切', function () {
    assert.strictEqual(A.toProcRow({ PROCPATH: '/opt/a\\b' }, 2).PROCNAME, 'a\\b');
    assert.strictEqual(A.toProcRow({ PROCPATH: 'C:\\Windows\\System32\\svchost.exe' }, 1).PROCNAME, 'svchost.exe');
    assert.strictEqual(A.toProcRow({ PROCPATH: 'C:/Tools/x.exe' }, 1).PROCNAME, 'x.exe');
    assert.strictEqual(A.toProcRow({ PROCPATH: '/opt/BDFZ/ESM/a.txt' }, 2).PROCNAME, 'a.txt');
});

// ---------- toProcList：排序、计数 ----------
var RAW = [
    { ID: 5, PROCPATH: '/usr/bin/e', FILEHASH: 'EE', ALGO: 0, STATUS: 0, CREATETIME: '2026-10-01 09:00:00' },
    { ID: 4, PROCPATH: '/usr/bin/d', FILEHASH: 'DD', ALGO: 0, STATUS: 2, CREATETIME: '2026-09-15 09:00:00' },
    { ID: 3, PROCPATH: '/usr/bin/C', FILEHASH: 'CC', ALGO: 8, STATUS: 1, CREATETIME: '2026-10-23 10:00:00' },
    { ID: 2, PROCPATH: '/usr/bin/b', FILEHASH: 'BB', ALGO: 0, STATUS: 1, CREATETIME: '2026-10-19 00:00:00' },
    { ID: 1, PROCPATH: '/usr/bin/a', FILEHASH: 'AB', ALGO: 0, STATUS: 1, CREATETIME: '2026-10-19 00:00:00' },
    { ID: 6, PROCPATH: '/opt/x/f', FILEHASH: 'FF', ALGO: 0, STATUS: 0, CREATETIME: '2026-09-30 23:59:59' }
];
t('排序：新增 → 待移除 → 其余，同组按时间升序再按 ID', function () {
    var res = A.toProcList(RAW, {}, 2, NOW_X);
    eq(ids(res), [1, 2, 3, 4, 6, 5]);
    eq([res.total, res.all, res.addN, res.delN], [6, 6, 3, 1]);
    assert.strictEqual(res.allRows.length, 6);
});
t('rawRows 不是数组按空', function () {
    eq(A.toProcList(null, {}, 2), { rows: [], total: 0, all: 0, addN: 0, delN: 0, allRows: [] });
});

// ---------- 筛选 ----------
t('变化状态 new / pending / normal', function () {
    eq(ids(A.toProcList(RAW, { chg: 'new' }, 2, NOW_X)), [1, 2, 3]);
    eq(ids(A.toProcList(RAW, { chg: 'pending' }, 2, NOW_X)), [4]);
    eq(ids(A.toProcList(RAW, { chg: 'normal' }, 2, NOW_X)), [6, 5]);
});
t('时间范围按北京日期（美东晚上 = 北京周五 10-23）', function () {
    eq(ids(A.toProcList(RAW, { time: 'week' }, 2, NOW_X)), [1, 2, 3]);      // 10-19（周一）~ 10-23
    eq(ids(A.toProcList(RAW, { time: 'month' }, 2, NOW_X)), [1, 2, 3, 5]);  // 10-01 ~ 10-23
    eq(ids(A.toProcList(RAW, { time: 'lastmonth' }, 2, NOW_X)), [4, 6]);    // 09-01 ~ 09-30
    eq(ids(A.toProcList(RAW, { time: 'xyz' }, 2, NOW_X)), [1, 2, 3, 4, 6, 5]);
});
t('时间范围：北京 11-01（周日）零点半', function () {
    eq(ids(A.toProcList(RAW, { time: 'week' }, 2, NOW_Y)), []);             // 10-26 ~ 11-01
    eq(ids(A.toProcList(RAW, { time: 'lastmonth' }, 2, NOW_Y)), [1, 2, 3, 5]); // 10-01 ~ 10-31
    eq(ids(A.toProcList([{ ID: 9, CREATETIME: '2026-10-26 00:00:00' }], { time: 'week' }, 2, NOW_Y)), [9]);
});
t('指定日期含首尾，只填起 / 止，且覆盖 time', function () {
    eq(ids(A.toProcList(RAW, { from: '2026-09-30', to: '2026-10-01' }, 2, NOW_X)), [6, 5]);
    eq(ids(A.toProcList(RAW, { from: '2026-10-19' }, 2, NOW_X)), [1, 2, 3]);
    eq(ids(A.toProcList(RAW, { to: '2026-09-15' }, 2, NOW_X)), [4]);
    eq(ids(A.toProcList(RAW, { time: 'week', to: '2026-09-15' }, 2, NOW_X)), [4]);
});
t('关键字：不分大小写、去首尾空格；字段 path / hash', function () {
    eq(ids(A.toProcList(RAW, { kw: '  USR/BIN/c ' }, 2, NOW_X)), [3]);
    eq(ids(A.toProcList(RAW, { field: 'hash', kw: 'b' }, 2, NOW_X)), [1, 2]);   // AB、BB（转小写后）
    eq(ids(A.toProcList(RAW, { field: 'path', kw: 'b' }, 2, NOW_X)), [1, 2, 3, 4, 5]); // 都含 /usr/bin/；/opt/x/f 不含
    eq(ids(A.toProcList(RAW, { field: 'hash', kw: '/usr' }, 2, NOW_X)), []);
});
t('组合是「并且」，计数按筛选前', function () {
    var res = A.toProcList(RAW, { chg: 'new', time: 'week', field: 'hash', kw: 'cc' }, 2, NOW_X);
    eq(ids(res), [3]);
    eq([res.total, res.all, res.addN, res.delN], [1, 6, 3, 1]);
});
t('原有 toQuery 不受影响（信息条用空条件）', function () {
    eq(A.toQuery(2, {}), { policytype: 2, timeRange: 0 });
});

// ---------- bwlistProc 纯函数 ----------
var ALL = A.toProcList([
    { ID: 1, PROCPATH: '/usr/bin/python3', FILEHASH: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', ALGO: 0, STATUS: 0 },
    { ID: 2, PROCPATH: '/usr/bin/gone', FILEHASH: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', ALGO: 0, STATUS: 2 }
], {}, 2).allRows;
var H32 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
var H64 = new Array(65).join('c');
t('checkAdd 每一步的提示（Linux）', function () {
    assert.strictEqual(P.checkAdd('  ', H32, 2, []).err, '请填写进程路径');
    assert.strictEqual(P.checkAdd('/' + new Array(501).join('a'), H32, 2, []).err, '进程路径不能超过 500 个字符');
    assert.strictEqual(P.checkAdd('/' + new Array(500).join('a'), H32, 2, []).err, '');   // 正好 500 个字
    assert.strictEqual(P.checkAdd('usr/bin/x', H32, 2, []).err, 'Linux/信创 名单请填写完整的进程路径，示例：/usr/bin/python3');
    assert.strictEqual(P.checkAdd('/usr/bin/', H32, 2, []).err, 'Linux/信创 名单请填写完整的进程路径，示例：/usr/bin/python3');
    assert.strictEqual(P.checkAdd('/usr/bin/x', ' ', 2, []).err, '请填写文件哈希');
    assert.strictEqual(P.checkAdd('/usr/bin/x', H32.slice(1), 2, []).err, '文件哈希应为 32 位（MD5）或 64 位（SHA256）十六进制字符');
    assert.strictEqual(P.checkAdd('/usr/bin/x', H32 + 'a', 2, []).err, '文件哈希应为 32 位（MD5）或 64 位（SHA256）十六进制字符');
    assert.strictEqual(P.checkAdd('/usr/bin/x', 'g' + H32.slice(1), 2, []).err, '文件哈希应为 32 位（MD5）或 64 位（SHA256）十六进制字符');
});
t('checkAdd 通过：路径去空格、哈希转小写、算法按长度', function () {
    eq(P.checkAdd(' /usr/bin/python3 ', ' ' + H32.toUpperCase() + ' ', 2, []), { err: '', path: '/usr/bin/python3', hash: H32, algo: 0, name: 'python3' });
    assert.strictEqual(P.checkAdd('/usr/bin/x', H64, 2, []).algo, 8);
});
t('查重：同路径同哈希（大小写都算）、撞到待移除的、只差大小写的 Linux 路径放行', function () {
    assert.strictEqual(P.checkAdd('/usr/bin/python3', H32, 2, ALL).err, '名单里已有路径和哈希都相同的「python3」，不用重复添加');
    assert.strictEqual(P.checkAdd('/usr/bin/python3', H32.toUpperCase(), 2, ALL).err, '名单里已有路径和哈希都相同的「python3」，不用重复添加');
    assert.strictEqual(P.checkAdd('/usr/bin/gone', 'B'.repeat(32), 2, ALL).err, '名单里已有路径和哈希都相同的「gone」，它已被标记移除，点它的「恢复」即可');
    assert.strictEqual(P.checkAdd('/usr/bin/Python3', H32, 2, ALL).err, '');
    assert.strictEqual(P.checkAdd('/usr/bin/python3', 'd'.repeat(32), 2, ALL).err, '');   // 同路径换哈希
    assert.strictEqual(P.checkAdd('/usr/bin/py', H32, 2, ALL).err, '');                  // 同哈希换路径
    assert.strictEqual(P.checkAdd('/usr/bin/python3', null, 2, null).err, '请填写文件哈希');  // 进程行还没取到也不报错
});
t('Windows 分支：盘符路径、查重不分大小写、/ 与 \\ 当同一个', function () {
    var w = A.toProcList([{ ID: 1, PROCPATH: 'C:\\Windows\\System32\\svchost.exe', FILEHASH: H32, ALGO: 0, STATUS: 1 }], {}, 1).allRows;
    assert.strictEqual(P.checkAdd('/usr/bin/x', H32, 1, []).err, 'Windows 名单请填写完整的进程路径，示例：C:\\Windows\\System32\\svchost.exe');
    assert.strictEqual(P.checkAdd('c:/windows/system32/SVCHOST.EXE', H32, 1, w).err, '名单里已有路径和哈希都相同的「svchost.exe」，不用重复添加');
    assert.strictEqual(P.checkAdd('D:\\x.exe', H32, 1, w).err, '');
    assert.strictEqual(P.nameOf('C:/a/b.exe', 1), 'b.exe');
});
t('至少保留 1 个', function () {
    var MSG = 'M';
    function rows(st) { return st.map(function (s, i) { return { ID: i + 1, STATUS: s }; }); }
    assert.strictEqual(P.removeBlockMsg(rows([0]), MSG), 'M');          // 发布过、只剩 1 个
    assert.strictEqual(P.removeBlockMsg(rows([0, 2]), MSG), 'M');       // 1 个正常 + 1 个待移除
    assert.strictEqual(P.removeBlockMsg(rows([2, 1]), MSG), 'M');       // 发布过（有 2），只剩 1 个新增
    assert.strictEqual(P.removeBlockMsg(rows([0, 0]), MSG), '');        // 还剩 2 个
    assert.strictEqual(P.removeBlockMsg(rows([0, 2, 1]), MSG), '');     // S-7 ⑤：pl04a 正常、pl04b 待移除、pl04c 新增，移 pl04c 后还剩 1 个
    assert.strictEqual(P.removeBlockMsg(rows([1]), MSG), '');           // 没发布过，可以删光
    assert.strictEqual(P.removeBlockMsg(rows([1, 1]), MSG), '');
    assert.strictEqual(P.removeBlockMsg(null, MSG), '');
});
t('分页退页', function () {
    assert.strictEqual(P.clampPage(2, 21, 15), 2);
    assert.strictEqual(P.clampPage(2, 15, 15), 1);
    assert.strictEqual(P.clampPage(3, 0, 15), 1);
    assert.strictEqual(P.clampPage(0, 30, 15), 1);
});
t('黑白名单文案', function () {
    var b = P.texts({ type: 3, name: '黑名单' }, 2);
    assert.strictEqual(b.verb, '拦截');
    assert.strictEqual(b.newTip, '上次发布之后新加入的进程，回黑名单列表点「发布」后，终端才会拦截');
    assert.strictEqual(b.keepOne, '黑名单至少要保留 1 个进程，不能把进程全部移除；要清掉这条黑名单请直接删除它');
    assert.strictEqual(b.pendingTip, '已标记移除，回黑名单列表点「发布」后才会从终端上移除');
    var w = P.texts({ type: 2, name: '白名单' }, 2);
    assert.strictEqual(w.verb, '放行');
    assert.strictEqual(w.keepOne, '白名单至少要保留 1 个进程，不能把进程全部移除；要清掉这条白名单请直接删除它');
    assert.strictEqual(w.stTips.length, 4);
});
t('算法提示、hasCond', function () {
    assert.strictEqual(P.algoText(''), '填写文件哈希后自动识别');
    assert.strictEqual(P.algoText(H64), 'SHA256');
    assert.strictEqual(P.algoText('xyz'), '识别不出（应为 32 位或 64 位十六进制）');
    assert.strictEqual(P.hasCond({ time: '', from: '', to: '', chg: '', field: 'hash', kw: '  ' }), false);
    assert.strictEqual(P.hasCond({ chg: 'new' }), true);
});
// ---------- 内审第 1 轮建议补的 ----------
t('Windows：超过 500 字、只有盘符', function () {
    assert.strictEqual(P.checkAdd('C:\\' + 'a'.repeat(498), H32, 1, []).err, '进程路径不能超过 500 个字符');
    assert.strictEqual(P.checkAdd('C:\\', H32, 1, []).err, 'Windows 名单请填写完整的进程路径，示例：C:\\Windows\\System32\\svchost.exe');
});
t('至少保留 1 个：要移除的那行本身是新增', function () {
    // 已发布 1 个普通（0）已被标记移除（2）+ 1 个新增（1）：移除新增后有效进程 0 → 拦
    assert.strictEqual(P.removeBlockMsg([{ STATUS: 2 }, { STATUS: 1 }], 'M'), 'M');
    // 1 个普通 + 1 个新增：移除新增后还剩 1 个 → 放
    assert.strictEqual(P.removeBlockMsg([{ STATUS: 0 }, { STATUS: 1 }], 'M'), '');
});
t('toProcList 不传 now 也能算（取当前时刻）', function () {
    var today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    eq(A.toProcList([{ ID: 1, CREATETIME: today + ' 00:00:01' }], { time: 'week' }, 2).total, 1);
    eq(A.toProcList([{ ID: 1, CREATETIME: today + ' 00:00:01' }], { time: 'month' }, 2).total, 1);
});
console.log('ALL PASS (' + n + ')');
