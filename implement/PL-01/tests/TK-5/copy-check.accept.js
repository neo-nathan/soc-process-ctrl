// PL-01 TK-5 Tester：把 101 页面上实测抄下来的文案（OBSERVED）和基线原文（EXPECT）逐条比对。
// 期望值只来自基线原文（PL-01 §五、§4.3、§4.5，01 §7.2、§7.5、§7.6、§8.8），每条注明出处。
// 实测值来自 2026-10-22 13:4x～14:0x CST 在 Chrome 标签 88508831 上从菜单进入名单页、点按钮后只读 DOM 抄录（见 browser-cases.md）。
// 用法：node copy-check.accept.js          → 正常比对
//       node copy-check.accept.js --mutate → 故意把每条实测改坏一个字，确认断言会红（自检第 4 句）
'use strict';

var MUTATE = process.argv.indexOf('--mutate') >= 0;

// ---------------- 期望（基线原文拼出来） ----------------
// 发布确认：PL-01 §五「确定发布「X」吗？发布后进程数为 K。」；没应用的多一句「发布后才能应用到组」；已应用的多一句「组内终端下次心跳（默认 5 分钟内）生效」
function expPublish(name, k, applied) {
  return ['确定发布「' + name + '」吗？发布后进程数为 ' + k + '。',
          applied ? '组内终端下次心跳（默认 5 分钟内）生效' : '发布后才能应用到组'];
}
// 删除确认：PL-01 §五「确定删除「X」吗？删除后不能恢复。」；已应用的多一句「该名单已应用到 N 个组、M 台终端。删除后，这些终端下次拉取策略时会清掉本地名单（在线终端默认 5 分钟内，离线终端上线后）」（01 §7.6 同句）
function expDelete(name, n, m) {
  var a = ['确定删除「' + name + '」吗？删除后不能恢复。'];
  if (n) a.push('该名单已应用到 ' + n + ' 个组、' + m + ' 台终端。删除后，这些终端下次拉取策略时会清掉本地名单（在线终端默认 5 分钟内，离线终端上线后）');
  return a;
}
// 成功提示：PL-01 §4.3 / 01 §8.8 第 12 条；§4.5
var EXP_PUB_OK_APPLIED = '已发布，组内终端下次心跳（默认 5 分钟内）生效';
var EXP_PUB_OK_UNAPPLIED = '已发布，应用到组后下发';
var EXP_GROUP_OK = '应用成功，组内终端下次心跳（默认 5 分钟内）生效';
// 应用到组提示：PL-01 §五 / 01 §7.5「没有名单的组，组内终端不按名单判断；新建子组会自动带上父组的名单」
var EXP_GROUP_TIP = '没有名单的组，组内终端不按名单判断；新建子组会自动带上父组的名单';

// 灰色按钮原因：PL-01 §五 表（「灰：xxx」）。按「包含原因关键词」比（读法见 blocked_questions Q-A）
var GRAY_RULES = {
  '--':   { pub: '空名单不能发布', grp: '先添加进程并发布' },
  '待发布': { pub: null,          grp: '先发布' },
  '已发布': { pub: '没有变更',     grp: null },
  '有变更': { pub: null,          grp: '先发布' },  // 发布后进程数 > 0 时可点
  '有变更0': { pub: '至少保留 1 个进程', grp: '先发布' } // 发布后进程数 = 0：PL-01 §五「否则灰：至少保留 1 个进程」
};

// 反向哨兵：01 §8.8 第 2、12 条要消除的 demo 旧说法；TASK_SPEC 连带的 01 §6.5 口径
var BANNED = ['下发清除策略', '已发布并下发到', '立即', '终端上就是当前的', '终端已是最新'];

// ---------------- 实测（从页面抄录） ----------------
var OBS = {
  publish: [
    { name: 'PL01测试-白-T5a', k: 5, applied: false, got: ['确定发布「PL01测试-白-T5a」吗？发布后进程数为 5。', '发布后才能应用到组'], title: '发布白名单' },
    { name: 'hello', k: 6, applied: false, got: ['确定发布「hello」吗？发布后进程数为 6。', '发布后才能应用到组'], title: '发布白名单' },      // 7 −1 → 6（01 §5.4 base+N−M）
    { name: 'PL01测试-白-T5b', k: 8, applied: false, got: ['确定发布「PL01测试-白-T5b」吗？发布后进程数为 8。', '发布后才能应用到组'], title: '发布白名单' }, // 6 +2 → 8
    { name: 'testhei', k: 3, applied: false, got: ['确定发布「testhei」吗？发布后进程数为 3。', '发布后才能应用到组'], title: '发布黑名单' },
    // ---- 以下 fake 模式（10-22 14:2x CST）----
    { name: '数据库服务白名单', k: 8, applied: true, got: ['确定发布「数据库服务白名单」吗？发布后进程数为 8。', '组内终端下次心跳（默认 5 分钟内）生效'], title: '发布白名单' },   // 9 −1 → 8，已应用 1 组
    { name: '人事系统白名单', k: 7, applied: false, got: ['确定发布「人事系统白名单」吗？发布后进程数为 7。', '发布后才能应用到组'], title: '发布白名单' },               // 反例：5 +2 → 7，未应用
    { name: '挖矿程序黑名单', k: 35, applied: true, got: ['确定发布「挖矿程序黑名单」吗？发布后进程数为 35。', '组内终端下次心跳（默认 5 分钟内）生效'], title: '发布黑名单' }  // 36 −1 → 35，已应用 6 组
  ],
  del: [
    { name: 'PL01测试-白-T5a', n: 2, m: 40, got: ['确定删除「PL01测试-白-T5a」吗？删除后不能恢复。', '该名单已应用到 2 个组、40 台终端。删除后，这些终端下次拉取策略时会清掉本地名单（在线终端默认 5 分钟内，离线终端上线后）'] },
    { name: 'PL01测试-白-T5b', n: 0, m: 0, got: ['确定删除「PL01测试-白-T5b」吗？删除后不能恢复。'] },
    { name: 'PL01测试-黑-T5c', n: 1, m: 20, got: ['确定删除「PL01测试-黑-T5c」吗？删除后不能恢复。', '该名单已应用到 1 个组、20 台终端。删除后，这些终端下次拉取策略时会清掉本地名单（在线终端默认 5 分钟内，离线终端上线后）'] },
    { name: '测试环境白名单', n: 0, m: 0, got: ['确定删除「测试环境白名单」吗？删除后不能恢复。'] }   // fake 行
  ],
  pubOkUnapplied: '已发布，应用到组后下发',
  pubOkApplied: ['已发布，组内终端下次心跳（默认 5 分钟内）生效', '已发布，组内终端下次心跳（默认 5 分钟内）生效'], // fake：数据库服务白名单、挖矿程序黑名单
  groupOk: ['应用成功，组内终端下次心跳（默认 5 分钟内）生效', '应用成功，组内终端下次心跳（默认 5 分钟内）生效'],
  groupTip: '应用组：(没有名单的组，组内终端不按名单判断；新建子组会自动带上父组的名单)',
  // 展开行按钮：[状态, 发布可点?, 发布 title, 应用到组可点?, 应用到组 title, 删除 title, 删除颜色, 按钮文字序列]
  buttons: [
    ['--',   false, '空名单不能发布，请先添加进程', false, '还没有进程，先添加进程并发布', '删除名单', 'rgb(237, 84, 82)', '编辑,进程,应用到组,发布,删除'],
    ['已发布', false, '没有变更，不需要发布', true, '选要用在哪些分组，选完自动下发', '删除名单', 'rgb(237, 84, 82)', '编辑,进程,应用到组,发布,删除'],
    ['待发布', true, '标记为已发布，应用到组后下发', false, '先发布，只有已发布的名单才能设置应用范围', '删除名单', 'rgb(237, 84, 82)', '编辑,进程,应用到组,发布,删除'],
    ['有变更', true, '标记为已发布，应用到组后下发', false, '有变更还没发布，先发布再改应用范围', '删除名单', 'rgb(237, 84, 82)', '编辑,进程,应用到组,发布,删除'],
    ['已发布', false, '没有变更，不需要发布', true, '修改应用的分组，改完自动下发', '删除名单：已应用到 2 个组 40 台终端，这些终端下次拉取策略时会清掉本地名单', 'rgb(237, 84, 82)', '编辑,进程,应用到组,发布,删除'],
    ['待发布', true, '标记为已发布，应用到组后下发', false, '先发布，只有已发布的名单才能设置应用范围', '删除名单', 'rgb(237, 84, 82)', '编辑,进程,应用到组,发布,删除'], // 黑名单 testhei
    // ---- fake 模式 ----
    ['有变更0', false, '发布后进程数为 0，至少保留 1 个进程；要清掉这条名单请直接删除它', false, '有变更还没发布，先发布再改应用范围', '删除名单：已应用到 3 个组 45 台终端，这些终端下次拉取策略时会清掉本地名单', 'rgb(237, 84, 82)', '编辑,进程,应用到组,发布,删除'], // 财务系统白名单 6 −6
    ['有变更0', false, '发布后进程数为 0，至少保留 1 个进程；要清掉这条名单请直接删除它', false, '有变更还没发布，先发布再改应用范围', '删除名单：已应用到 2 个组 30 台终端，这些终端下次拉取策略时会清掉本地名单', 'rgb(237, 84, 82)', '编辑,进程,应用到组,发布,删除'], // 即时通讯黑名单 9 −9
    ['有变更', true, '发布并自动下发到已应用的 1 个组 12 台终端，组内终端下次心跳（默认 5 分钟内）生效', false, '有变更还没发布，先发布再改应用范围', '删除名单：已应用到 1 个组 12 台终端，这些终端下次拉取策略时会清掉本地名单', 'rgb(237, 84, 82)', '编辑,进程,应用到组,发布,删除'] // 反例：数据库服务白名单 9 −1（发布后 8 > 0，发布可点）
  ],
  statusTips: [
    '内容已定稿（8 个进程），还没设置应用范围，终端上没有它。下一步：点「应用到组」，选完自动下发。',
    '内容已定稿（5 个进程），已应用到 2 个组 40 台终端：在线终端下次心跳（默认 5 分钟内）生效，离线终端上线后生效。不需要操作。改应用范围会自动下发，组内终端下次心跳生效。'
  ]
};

// 改坏：首个汉字、以及所有「先」「名」「留」都换成「错」（保证关键词包含类断言也会红）
function mut(s) { return MUTATE ? s.replace(/[一-龥]/, '错').replace(/[先名留]/g, '错') : s; }

function mutB(b) { return MUTATE ? !b : b; }                    // 改坏：可点 / 灰 反过来
function mutSeq(q) { return MUTATE ? q + ',应用到终端' : q; }   // 改坏：多出「应用到终端」
function mutColor(c) { return MUTATE ? 'rgb(65, 70, 86)' : c; } // 改坏：删除按钮变成普通深灰色

var pass = 0, fail = 0, logs = [];
function check(id, ok, detail) { if (ok) pass++; else fail++; logs.push((ok ? 'GREEN ' : 'RED   ') + id + (ok ? '' : '  ← ' + detail)); }

// S-8 发布确认文案（PL-01 §五「发布」）
OBS.publish.forEach(function (o, i) {
  var exp = expPublish(o.name, o.k, o.applied);
  var got = o.got.map(mut);
  check('S8-PUB-' + i + ' ' + o.name, JSON.stringify(got) === JSON.stringify(exp), JSON.stringify(got) + ' ≠ ' + JSON.stringify(exp));
  check('S8-PUB-TITLE-' + i, /^发布(白|黑)名单$/.test(mut(o.title)) && (/黑名单$/.test(o.name) || o.name === 'testhei' ? mut(o.title) === '发布黑名单' : mut(o.title) === '发布白名单'), o.title);
});
// S-9 删除确认文案（PL-01 §五「删除」；01 §7.6）
OBS.del.forEach(function (o, i) {
  var exp = expDelete(o.name, o.n, o.m);
  var got = o.got.map(mut);
  check('S9-DEL-' + i + ' ' + o.name, JSON.stringify(got) === JSON.stringify(exp), JSON.stringify(got) + ' ≠ ' + JSON.stringify(exp));
});
// S-8 成功提示（§4.3 / 8.8 第 12 条；§4.5）
check('S8-PUB-OK-UNAPPLIED', mut(OBS.pubOkUnapplied) === EXP_PUB_OK_UNAPPLIED, OBS.pubOkUnapplied);
OBS.pubOkApplied.forEach(function (g, i) { check('S8-PUB-OK-APPLIED-' + i, mut(g) === EXP_PUB_OK_APPLIED, g); });
OBS.groupOk.forEach(function (g, i) { check('S8-GROUP-OK-' + i, mut(g) === EXP_GROUP_OK, g); });
check('S8-GROUP-TIP', mut(OBS.groupTip).indexOf(EXP_GROUP_TIP) >= 0, OBS.groupTip);
// S-5 按钮规则（PL-01 §五 表；01 §7.2）+ 不放「应用到终端」+ 删除红色（需求「删除一律可点（红色）」）
OBS.buttons.forEach(function (b, i) {
  var st = b[0], r = GRAY_RULES[st];
  var pubEnabled = mutB(b[1]), grpEnabled = mutB(b[3]);
  check('S5-' + i + '-' + st + '-发布可点性', pubEnabled === (r.pub === null), '发布 ' + (pubEnabled ? '可' : '灰'));
  check('S5-' + i + '-' + st + '-应用到组可点性', grpEnabled === (r.grp === null), '应用到组 ' + (grpEnabled ? '可' : '灰'));
  if (r.pub) check('S5-' + i + '-' + st + '-发布灰原因', mut(b[2]).indexOf(r.pub) >= 0, b[2] + ' 不含 ' + r.pub);
  if (r.grp) check('S5-' + i + '-' + st + '-应用到组灰原因', mut(b[4]).indexOf(r.grp) >= 0, b[4] + ' 不含 ' + r.grp);
  check('S5-' + i + '-无应用到终端', mutSeq(b[7]).indexOf('应用到终端') < 0, b[7]);
  check('S5-' + i + '-删除红色', /^rgb\((2[0-5]\d|1[5-9]\d), ([0-9]{1,2}|1[0-1]\d), ([0-9]{1,2}|1[0-1]\d)\)$/.test(mutColor(b[6])), b[6]);
});
// 反向哨兵：页面上所有抄录到的悬停 / 弹窗文字都不得出现被 8.8 第 2、12 条及 6.5 口径淘汰的说法
var all = [];
OBS.buttons.forEach(function (b) { all.push(b[2], b[4], b[5]); });
OBS.statusTips.forEach(function (t) { all.push(t); });
OBS.del.forEach(function (o) { all = all.concat(o.got); });
OBS.publish.forEach(function (o) { all = all.concat(o.got); });
all.push(OBS.pubOkUnapplied); all = all.concat(OBS.groupOk).concat(OBS.pubOkApplied);
BANNED.forEach(function (w) {
  var hit = all.filter(function (s) { return (MUTATE ? s + w : s).indexOf(w) >= 0; });
  check('SENTINEL-禁用说法「' + w + '」=0', hit.length === 0, '命中 ' + hit.length + ' 处：' + hit.slice(0, 2).join(' / '));
});

console.log(logs.join('\n'));
console.log('\n执行 ' + (pass + fail) + ' 条：绿 ' + pass + '，红 ' + fail + (MUTATE ? '（--mutate 模式，期望全红）' : ''));
process.exit(MUTATE ? (pass === 0 ? 0 : 1) : (fail === 0 ? 0 : 1));
