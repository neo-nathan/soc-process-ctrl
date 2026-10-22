/*
 * PL-01 TK-3 验收：把 101 浏览器实测读数（ev-01～ev-03 原样抄来）和「按基线原文算出来的期望」逐条比对。
 * 期望值只来自基线：
 *   - 真名单 = 101 MySQL 只读结果（s2-real-lists.result.txt；PL-01 §七 S-2「真名单都在」）
 *   - 筛选语义 = demo/白名单列表.html:996-1017（PL-01 §五「照 demo 四行点选」）
 *   - 底部统计 = PL-01 §五「名单总数 = 当前结果条数；进程总数 = 各行 PROCNUM + ADDNUM − DELNUM 之和」
 *   - 已筛选出 X 个，共 Y 个 = demo :1017 filtering = rows.length !== allTotal（主 Agent 10:24 裁决 1）
 *   - 时间范围（R1，10-21 21:5x 用户拍板后的基线）= PL-01 §4.2 ctime 行：「本周（本周一 ~ 今天）/ 本月（本月 1 日 ~ 今天）/
 *     上月（上月 1 日 ~ 上月最后一天）」；PL-01 §五「照 demo 四行点选（时间范围、…）」；demo「时间范围：」全部 / 本周 / 本月 / 上月
 *   - 用例里旧的「近 7 天 / 近 30 天」读数是旧版本页面上的，口径作废，改成 PENDING（待浏览器复跑），不计通过
 * 不读、不调实现代码。用法：node tk3.accept.js（可加 --mutate 检查断言能变红）
 */
'use strict';
var fs = require('fs');
var path = require('path');
var MUTATE = process.argv.indexOf('--mutate') >= 0;
var MUTATE_WEEK_SUNDAY = MUTATE;   // --mutate 时同时把「一周从周一开始」改成从周日开始

var pass = 0, fail = 0, results = [];
function check(name, cond, detail) {
  if (cond) { pass++; results.push('PASS ' + name); }
  else { fail++; results.push('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

// ---------- 1. 期望：101 库里的真名单（只读 SQL 结果原文解析）----------
var sqlTxt = fs.readFileSync(path.join(__dirname, 's2-real-lists.result.txt'), 'utf8');
var db = sqlTxt.split('\n').filter(function (l) { return /^\|\s+\d+ \|/.test(l); }).map(function (l) {
  var c = l.split('|').slice(1, -1).map(function (s) { return s.trim(); });
  return { pid: +c[0], name: c[1], eptype: +c[2], ptype: +c[3], user: c[4], ctime: c[5], desc: c[6] };
});
check('DB 共查到 9 条名单（8 白 1 黑，PL-01 F-6）', db.length === 9, 'got ' + db.length);

// ---------- 2. 实测：页面读数（ev-01 / ev-03 原样）----------
// 列：序号 名称 系统类型 进程数 应用范围 发布状态 创建人 创建时间 描述
var whiteObserved = [
  '1 hello Linux/信创 7-1 -- 有变更 optAdmin 2026-10-19 09:30:04 hello',
  '2 test1 Linux/信创 0+6 -- 待发布 optAdmin 2026-10-19 09:33:23 111',
  '3 test2 Linux/信创 0 -- -- optAdmin 2026-10-19 09:33:32 111',
  '4 test3 Linux/信创 8 -- 已发布 optAdmin 2026-10-19 09:36:38 33333',
  '5 test666 Linux/信创 0 -- -- optAdmin 2026-10-19 10:54:12 --',
  '6 test666 Linux/信创 4-1 -- 有变更 optAdmin 2026-10-19 11:01:25 --',
  '7 test7 Linux/信创 0+3 -- 待发布 optAdmin 2026-10-19 11:01:50 --',
  '8 test8 Linux/信创 0 -- -- optAdmin 2026-10-19 11:20:34 --'
];
var blackObserved = ['1 testhei Linux/信创 0+3 -- 待发布 optAdmin 2026-10-19 09:54:09 --'];
if (MUTATE) whiteObserved[3] = whiteObserved[3].replace('test3', 'test3x');   // 变异：改坏一个名字

function parse(line) {
  var t = line.split(' ');
  // t: seq name os proc scope status user date time desc
  var m = /^(\d+)(?:\+(\d+))?(?:-(\d+))?$/.exec(t[3]);
  return { seq: +t[0], name: t[1], os: t[2], base: +m[1], add: +(m[2] || 0), del: +(m[3] || 0),
           scope: t[4], status: t[5], user: t[6], ctime: t[7] + ' ' + t[8], desc: t[9] };
}
var W = whiteObserved.map(parse), B = blackObserved.map(parse);

// ---------- 3. S-2：真名单都在、字段一致、按创建时间升序（PL-01 §4.2「按创建时间升序」）----------
function cmpList(label, rows, dbRows) {
  check(label + ' 条数 = 库里条数', rows.length === dbRows.length, rows.length + ' vs ' + dbRows.length);
  var sorted = dbRows.slice().sort(function (a, b) { return a.ctime < b.ctime ? -1 : a.ctime > b.ctime ? 1 : a.pid - b.pid; });
  sorted.forEach(function (d, i) {
    var r = rows[i] || {};
    check(label + ' 第' + (i + 1) + '行 = PID ' + d.pid + '（名称/创建人/创建时间/描述/系统类型）',
      r.name === d.name && r.user === d.user && r.ctime === d.ctime &&
      r.desc === (d.desc === '' ? '--' : d.desc) &&            // demo :865 没填描述显示 --
      r.os === (d.eptype === 2 ? 'Linux/信创' : 'Windows') &&  // PL-01 §4.2 systype 2 = Linux
      r.seq === i + 1,
      JSON.stringify(r) + ' vs ' + JSON.stringify(d));
  });
}
cmpList('白名单', W, db.filter(function (d) { return d.ptype === 2; }));
cmpList('黑名单', B, db.filter(function (d) { return d.ptype === 3; }));

// 发布状态与进程数自洽（01 §7.1 + 需求 :61-66）：-- ⇔ base+add=0；待发布 ⇒ base=0 且 add>0；已发布 ⇒ 无增减；有变更 ⇒ base>0 且有增减
W.concat(B).forEach(function (r) {
  var ok = r.status === '--' ? (r.base + r.add === 0)
         : r.status === '待发布' ? (r.base === 0 && r.add > 0)
         : r.status === '已发布' ? (r.base > 0 && r.add === 0 && r.del === 0)
         : r.status === '有变更' ? (r.base > 0 && (r.add > 0 || r.del > 0)) : false;
  check('状态与进程数自洽 ' + r.name + '#' + r.seq, ok, JSON.stringify(r));
});
var statuses = {}; W.concat(B).forEach(function (r) { statuses[r.status] = 1; });
check('S-2 发布状态 4 种都出现（--/待发布/已发布/有变更）', ['--', '待发布', '已发布', '有变更'].every(function (s) { return statuses[s]; }), Object.keys(statuses).join(','));

// 实测颜色（ev-01）：期望来自 demo :879 stColor 与 PL-01 §五（-- 灰 / 待发布 蓝 / 已发布 绿 / 有变更 橙）
var colorObserved = { '有变更': 'rgb(239, 108, 0)', '待发布': 'rgb(30, 136, 229)', '已发布': 'rgb(46, 125, 50)', '--': 'rgb(176, 184, 196)' };
var hex = { '--': '#b0b8c4', '待发布': '#1e88e5', '已发布': '#2e7d32', '有变更': '#ef6c00' };
function rgb(h) { return 'rgb(' + [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }).join(', ') + ')'; }
Object.keys(hex).forEach(function (k) { check('状态颜色 ' + k + ' = demo ' + hex[k], colorObserved[k] === rgb(hex[k]), colorObserved[k]); });

// ---------- 4. 底部统计（PL-01 §五）----------
function footer(rows) { return { n: rows.length, p: rows.reduce(function (s, r) { return s + r.base + r.add - r.del; }, 0) }; }
var fw = footer(W), fb = footer(B);
check('白名单页脚 = 8 个 / 26 个（实测「白名单总数：8 个 | 进程总数：26 个」）', fw.n === 8 && fw.p === 26, JSON.stringify(fw));
check('黑名单页脚 = 1 个 / 3 个（实测「黑名单总数：1 个 | 进程总数：3 个」）', fb.n === 1 && fb.p === 3, JSON.stringify(fb));

// ---------- 5. S-3 筛选：按 demo :996-1017 语义对全集 W 算期望，再和实测（ev-02）比 ----------
// 「今天」：基线没写按浏览器日期还是 101 服务器日期。本机是 10-21（周三），101 已是 10-22（周四）。
// 两个候选都算一遍期望，必须一致才判；不一致就说明这条用例要先定口径（见 checkTodayIndependent）
var TODAY_CANDIDATES = ['2026-10-21', '2026-10-22'];
var TODAY = TODAY_CANDIDATES[1];
// 时间范围起止（YYYY-MM-DD 字符串，UTC 计算）：按 PL-01 §4.2 原句，周一算一周的第一天
function rangeOf(key, today) {
  var t = new Date(today + 'T00:00:00Z'), y = t.getUTCFullYear(), m = t.getUTCMonth();
  var s = function (d) { return d.toISOString().slice(0, 10); };
  var dow = (t.getUTCDay() + 6) % 7;            // 周一 = 0 … 周日 = 6
  if (MUTATE_WEEK_SUNDAY) dow = t.getUTCDay();  // 变异：一周从周日开始（应被 RANGE 自检抓到）
  if (key === 'week') return [s(new Date(Date.UTC(y, m, t.getUTCDate() - dow))), today];
  if (key === 'month') return [s(new Date(Date.UTC(y, m, 1))), today];
  if (key === 'lastmonth') return [s(new Date(Date.UTC(y, m - 1, 1))), s(new Date(Date.UTC(y, m, 0)))];
  return null;
}
function demoFilter(rows, c, today) {
  today = today || TODAY;
  return rows.filter(function (r) {
    var day = r.ctime.slice(0, 10), kind = r.status, applied = r.scope !== '--';
    if (c.delta === 'up' && !(r.add > 0)) return false;
    if (c.delta === 'down' && !(r.del > 0)) return false;
    if (c.delta === 'same' && (r.add > 0 || r.del > 0)) return false;
    if (c.pub && kind !== c.pub) return false;
    if (c.scope === 'yes' && !applied) return false;
    if (c.scope === 'no' && applied) return false;
    var rg = c.time ? rangeOf(c.time, today) : null;   // 时间范围：本周 / 本月 / 上月（含首尾两天）
    if (rg && (day < rg[0] || day > rg[1])) return false;
    if (c.from && day < c.from) return false;
    if (c.to && day > c.to) return false;
    if (c.kw && r.name.toLowerCase().indexOf(c.kw.toLowerCase()) < 0) return false;
    return true;
  });
}
// RANGE 自检：下面每个期望都是按 PL-01 §4.2 原句手算的日期，不来自任何实现
[
  ['week', '2026-10-21', ['2026-10-19', '2026-10-21']],      // 10-21 周三 → 本周一 10-19
  ['week', '2026-10-22', ['2026-10-19', '2026-10-22']],      // 10-22 周四
  ['week', '2026-10-25', ['2026-10-19', '2026-10-25']],      // 周日仍属本周（周一开始）
  ['week', '2026-10-26', ['2026-10-26', '2026-10-26']],      // 周一当天 = 本周第一天
  ['month', '2026-10-22', ['2026-10-01', '2026-10-22']],
  ['lastmonth', '2026-10-22', ['2026-09-01', '2026-09-30']],
  ['lastmonth', '2026-03-15', ['2026-02-01', '2026-02-28']], // 跨 2 月
  ['lastmonth', '2026-01-10', ['2025-12-01', '2025-12-31']]  // 跨年
].forEach(function (t) {
  var got = rangeOf(t[0], t[1]);
  check('RANGE 自检 ' + t[0] + ' @' + t[1] + ' = ' + t[2].join('~'), JSON.stringify(got) === JSON.stringify(t[2]), JSON.stringify(got));
});
// 两个「今天」候选算出的三档期望必须一致，否则这条用例要先定口径
['week', 'month', 'lastmonth'].forEach(function (k) {
  var a = demoFilter(W, { time: k }, TODAY_CANDIDATES[0]).length, b = demoFilter(W, { time: k }, TODAY_CANDIDATES[1]).length;
  check('「今天」取 10-21 或 10-22 时 ' + k + ' 期望一致（' + a + ' / ' + b + '）', a === b);
});

function filtText(n, all) { return n !== all ? '已筛选出 ' + n + ' 个，共 ' + all + ' 个' : '(none)'; }
// 实测：rows 只记名称序列 + 状态位置，filt 原文，页脚
var Q = [
  { id: 'Q1 空白名单', c: { pub: '--' }, obs: ['test2', 'test666', 'test8'], filt: '已筛选出 3 个，共 8 个', foot: [3, 0] },
  { id: 'Q2 待发布', c: { pub: '待发布' }, obs: ['test1', 'test7'], filt: '已筛选出 2 个，共 8 个', foot: [2, 9] },
  { id: 'Q3 已发布', c: { pub: '已发布' }, obs: ['test3'], filt: '已筛选出 1 个，共 8 个', foot: [1, 8] },
  { id: 'Q4 有变更', c: { pub: '有变更' }, obs: ['hello', 'test666'], filt: '已筛选出 2 个，共 8 个', foot: [2, 9] },
  { id: 'Q5 已应用', c: { scope: 'yes' }, obs: [], filt: '已筛选出 0 个，共 8 个', foot: [0, 0] },
  { id: 'Q6 未应用', c: { scope: 'no' }, obs: ['hello', 'test1', 'test2', 'test3', 'test666', 'test666', 'test7', 'test8'], filt: '(none)', foot: [8, 26] },
  { id: 'Q7 有新增', c: { delta: 'up' }, obs: ['test1', 'test7'], filt: '已筛选出 2 个，共 8 个', foot: [2, 9] },
  { id: 'Q8 有移除', c: { delta: 'down' }, obs: ['hello', 'test666'], filt: '已筛选出 2 个，共 8 个', foot: [2, 9] },
  { id: 'Q9 无变更', c: { delta: 'same' }, obs: ['test2', 'test3', 'test666', 'test8'], filt: '已筛选出 4 个，共 8 个', foot: [4, 8] },
  { id: 'Q10 无变更+空白名单', c: { delta: 'same', pub: '--' }, obs: ['test2', 'test666', 'test8'], filt: '已筛选出 3 个，共 8 个', foot: [3, 0] },
  { id: 'Q11 无变更+已发布', c: { delta: 'same', pub: '已发布' }, obs: ['test3'], filt: '已筛选出 1 个，共 8 个', foot: [1, 8] },
  // R1 新口径：Q12a/b/c、Q17、Q17b、Q19～Q21 的 obs 是 ev-07（10-21 22:0x EDT，新代码）的读数；expect / expectN 是按基线手算的期望，脚本先核对它和 demoFilter 一致
  { id: 'Q12a 时间范围=本周', c: { time: 'week' }, obsN: 8, expectN: 8, filt: '(none)', foot: [8, 26] },
  { id: 'Q12b 时间范围=本月', c: { time: 'month' }, obsN: 8, expectN: 8, filt: '(none)', foot: [8, 26] },
  { id: 'Q12c 时间范围=上月', c: { time: 'lastmonth' }, obs: [], expectN: 0, filt: '已筛选出 0 个，共 8 个', foot: [0, 0] },
  { id: 'Q14 指定 10-19~10-19', c: { from: '2026-10-19', to: '2026-10-19' }, obsN: 8, filt: '(none)', foot: [8, 26] },
  { id: 'Q16 指定 10-20~10-21', c: { from: '2026-10-20', to: '2026-10-21' }, obs: [], filt: '已筛选出 0 个，共 8 个', foot: [0, 0] },
  { id: 'Q17 点「本周」清掉指定日期', c: { time: 'week' }, obsN: 8, expectN: 8, filt: '(none)', foot: [8, 26] },
  { id: 'Q17b 点「上月」清掉指定日期（10-19~10-19 → 上月）', c: { time: 'lastmonth' }, obs: [], expectN: 0, filt: '已筛选出 0 个，共 8 个', foot: [0, 0] },
  { id: 'Q19 关键字 TEST6（不分大小写）+本周', c: { time: 'week', kw: 'TEST6' }, obs: ['test666', 'test666'], expect: ['test666', 'test666'], filt: '已筛选出 2 个，共 8 个', foot: [2, 3] },
  // Q20：框里是 hello（未点筛选），点有变更 → 照 demo 只用上次生效的 TEST6（主 Agent 10:24 裁决 4）
  { id: 'Q20 有变更+已生效关键字 TEST6（框内 hello 不生效）+本周', c: { time: 'week', kw: 'TEST6', pub: '有变更' }, obs: ['test666'], expect: ['test666'], filt: '已筛选出 1 个，共 8 个', foot: [1, 3] },
  { id: 'Q21 再加系统类型 Linux/信创', c: { time: 'week', kw: 'TEST6', pub: '有变更' }, obs: ['test666'], expect: ['test666'], filt: '已筛选出 1 个，共 8 个', foot: [1, 3] },
  { id: 'Q22 重置', c: {}, obsN: 8, filt: '(none)', foot: [8, 26] }
];
if (MUTATE) Q[1].obs = ['test1'];   // 变异：少一行
var pending = [];
Q.forEach(function (q) {
  var exp = demoFilter(W, q.c), ef = footer(exp);
  var names = exp.map(function (r) { return r.name; });
  if (q.expect || q.expectN !== undefined) {   // 手算期望（R1）也要和按基线算的结果一致
    var hand = q.expect ? JSON.stringify(q.expect) === JSON.stringify(names) : q.expectN === names.length;
    check('S-3 ' + q.id + ' 手算期望 = 按基线算的结果（' + names.length + ' 行）', hand, 'exp ' + JSON.stringify(names));
  }
  if (q.obs === null) {   // 待浏览器复跑：先核对「手算期望」和 demoFilter 一致，再记 PENDING
    var handOk = q.expect ? JSON.stringify(q.expect) === JSON.stringify(names) : q.expectN === names.length;
    check('S-3 ' + q.id + ' 手算期望 = 按基线算的结果（' + names.length + ' 行）', handOk && q.filt === filtText(exp.length, W.length) && q.foot[0] === ef.n && q.foot[1] === ef.p,
      'exp ' + JSON.stringify(names) + ' ' + filtText(exp.length, W.length) + ' ' + JSON.stringify(ef));
    pending.push(q.id);
    return;
  }
  var obsOk = q.obs ? JSON.stringify(q.obs) === JSON.stringify(names) : q.obsN === names.length;
  check('S-3 ' + q.id + ' 结果集', obsOk, 'exp ' + JSON.stringify(names) + ' obs ' + JSON.stringify(q.obs || q.obsN));
  check('S-3 ' + q.id + ' 已筛选出 X/Y', q.filt === filtText(exp.length, W.length), 'exp ' + filtText(exp.length, W.length) + ' obs ' + q.filt);
  check('S-3 ' + q.id + ' 页脚', q.foot[0] === ef.n && q.foot[1] === ef.p, 'exp ' + JSON.stringify(ef) + ' obs ' + q.foot);
});
// 黑名单页抽测（ev-03）
[{ id: 'B 已应用', c: { scope: 'yes' }, n: 0, filt: '已筛选出 0 个，共 1 个' },
 { id: 'B 空黑名单', c: { pub: '--' }, n: 0, filt: '已筛选出 0 个，共 1 个' },
 { id: 'B 待发布', c: { pub: '待发布' }, n: 1, filt: '(none)' }].forEach(function (q) {
  var exp = demoFilter(B, q.c);
  check('S-3 黑名单 ' + q.id, exp.length === q.n && q.filt === filtText(exp.length, B.length), exp.length + ' ' + q.filt);
});
// 时间三档在当前数据下无区分度：如实标出
var allSameDay = W.every(function (r) { return r.ctime.slice(0, 10) === '2026-10-19'; });
check('提示：全部名单都在 2026-10-19（周一）→ 本周、本月只能验「全中」（本周只验到「本周一当天算在内」）；上月期望 0 行，有区分度（记 summary）', allSameDay);

// ---------- 6. S-11 反向哨兵（ev-03 指纹表）----------
var ORIG = { len: 6983, sha: '8c18fa211d7a484d' };   // 改动前实测 step4
var s11 = [
  { at: 'overview#1', len: 6983, sha: '8c18fa211d7a484d', keys: 0 },
  { at: 'white#2', len: 1019, sha: 'e7b8740b59cf569b', keys: 1 },
  { at: 'overview#2', len: 6983, sha: '8c18fa211d7a484d', keys: 0 },
  { at: 'black#2', len: 1019, sha: 'e7b8740b59cf569b', keys: 1 },
  { at: 'overview#3', len: 6983, sha: '8c18fa211d7a484d', keys: 0 }
];
if (MUTATE) s11[2].len = 1019;   // 变异：离开后没还原
s11.forEach(function (s) {
  if (/^overview/.test(s.at)) check('S-11 哨兵 ' + s.at + ' RsCore.ajax = 改动前原函数（依据 改动前实测 step4）', s.len === ORIG.len && s.sha === ORIG.sha && s.keys === 0, JSON.stringify(s));
  else check('S-11 ' + s.at + ' 名单页上被包且只有一种包装指纹', s.len !== ORIG.len && s.sha === 'e7b8740b59cf569b', JSON.stringify(s));
});
var consoleMsgs = 0;   // read_console_messages 全程无消息
check('S-11 / 判据 控制台无报错', consoleMsgs === 0);

results.forEach(function (l) { console.log(l); });
console.log('\nPENDING（旧读数作废、待浏览器复跑，不计入通过）: ' + pending.length + ' 条 → ' + pending.join(' / '));
console.log('\nTOTAL ' + (pass + fail) + '  PASS ' + pass + '  FAIL ' + fail);
process.exit(fail ? 1 : 0);
