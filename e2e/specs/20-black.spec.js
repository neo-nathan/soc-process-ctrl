/**
 * 黑名单链路：E-8 ～ E-10。每条一个 test，用 -g 单独跑，前后靠本轮 state.json 衔接。
 * E-8 是设计里标的疑似断点（黑名单报文 policytype 发 3、终端只认 2，黑名单库不下载），不符合预期时把终端日志原样存证。
 * 判定按设计 P9 ①：Redis 名单项白、黑都是 policytype=2，黑白看 <userlibs><type>。
 * E-10（拦截）本轮不跑：用户确认没有不依赖心跳的本机兜底办法，且 E-1b 已证实没有用户白名单时
 * 终端会把所有进程判成「不在白名单」，开拦截有把 13.18 锁死的风险，只记 BLOCKED。
 */
'use strict';
const { test, expect } = require('@playwright/test');
const env = require('../lib/env');
const term = require('../lib/terminal');
const ev = require('../lib/evidence');
const P = require('../lib/page');
const ops = require('../lib/ops');
const { until, LIMIT } = require('../lib/wait');
const { open, recorder } = require('../lib/run');
const ssh = require('../lib/ssh');
const {
  groupLinks, ptfileMatches, colleague, programs, auditRows, epstate18, findPolicy, groupProcPolicy,
  listRowText, ensurePublishedList, applyAndCheck,
} = require('../lib/cases');

test('E-8 黑名单下发', async () => {
  const R = recorder('E-8');
  const G = P.load().groupId;
  if (!G) throw new Error('没有测试组，先跑 E-1');
  // 14.15 后端的名单下发代码在测试期间被同事改过（黑名单 policytype 3 → 2），先记下这次运行时的指纹
  const fpOut = ssh.run(env.center.host, env.secret.centerSsh(),
    'cd /opt/BDFZ/ESM/data/web/esmCenter && md5sum models/BaseDA/Procmanager.php controllers/Procmanager.php && ls -l --time-style=+%F_%T models/BaseDA/Procmanager.php', 60000).out;
  ev.save('E-8', 'center-code-fingerprint.txt', fpOut);
  R.seg('14.15 后端名单代码指纹（只记录）', 'RECORD', fpOut.replace(/\s+/g, ' ').slice(0, 200));
  const s = await open();
  try {
    R.seg('应用前测试组关联（只记录）', 'RECORD', groupLinks(G).map((x) => x[1] + '(' + x[2] + ',type' + x[3] + ')').join('；'));
    // pl05-black 从没在学习模式下运行过，进程管理页搜不到，只能在名单进程视图手工录入路径 + MD5
    const r = await ensurePublishedList(R, s, 'E-8', 'black', env.names.black, 'pl05-black', 'manual');
    if (!r.pol) return;
    // 应用到测试组：库里测试组的名单关联只剩黑名单（白名单被换下，黑白互斥）；
    // Redis 名单项 policytype 仍是 2、<type> 变 2、dpath 变 ruc/libs/b/u（设计 P9 ①）；终端下载 b/u 的库
    await applyAndCheck(R, s, 'E-8', 'black', env.names.black, G, '');
    const tb = await listRowText(s.page, 'black', env.names.black);
    const tw = await listRowText(s.page, 'white', env.names.white);
    await s.page.screenshot({ path: ev.dir('E-8') + '/list-page-white.png' });
    R.seg('名单页应用范围：黑名单组【 1 】、白名单 ---', /组【\s*1\s*】/.test(tb) && /---/.test(tw) ? 'PASS' : 'FAIL', '黑：' + tb.slice(0, 120) + ' ｜ 白：' + tw.slice(0, 120));
    colleague(R, 'E-8');
    R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  } finally {
    await s.close('E-8');
  }
  expect(R.finish(), 'E-8 结论').not.toBe('FAIL');
});

test('E-9 审计·黑名单', async () => {
  const R = recorder('E-9');
  const G = P.load().groupId;
  const pol = findPolicy(env.names.policy);
  const bl = findPolicy(env.names.black);
  if (!G || !pol || !bl) throw new Error('缺测试组 / 测试策略 / 黑名单，先跑 E-1、E-2、E-8');
  P.addPid(pol.pid, env.names.policy);
  const prog = programs();
  const black = prog['pl05-black'].path;
  const normal = prog['pl05-normal'].path;
  const s = await open();
  try {
    const links = groupLinks(G);
    R.seg('测试组当前关联（只记录）', 'RECORD', links.map((x) => x[1] + '(' + x[2] + ')').join('；'));
    if (!links.some((x) => x[1] === bl.pid)) R.seg('前提：测试组用的是 PL05测试-黑', 'FAIL', '测试组上没有黑名单关联');
    // 策略应已是审计（E-6 改的）；不是就在策略页改成审计（14.15 没开安全认证，不弹二次认证）
    await test.step('页面：确认策略是审计', async () => {
      const gp0 = groupProcPolicy(G);
      if (gp0 && gp0.auditmode === '2') { R.seg('策略是审计', 'PASS', '已是审计（E-6 改的）'); return; }
      const r = await ops.setAuditMode(s.page, G, '2');
      ev.save('E-9', 'edit-policy.json', r);
      R.seg('改审计（editPolicy 提交的是测试策略）', ops.ok(r) && (r.params.pid || [])[0] === pol.pid ? 'PASS' : 'FAIL', 'pid=' + (r.params.pid || []).join(','));
    });
    const gp = groupProcPolicy(G);
    ev.save('E-9', 'pgl-proc-policy.json', gp);
    R.seg('pgl_<测试组> 进程策略 auditmode=2', gp && gp.auditmode === '2' ? 'PASS' : 'FAIL', gp ? 'auditmode=' + gp.auditmode + ' uptimer=' + gp.uptimer : '没有进程策略项');
    const tw = await until('13.18 ptfile 与测试组一致', () => ptfileMatches(G), (x) => x.ok, { timeoutMs: LIMIT.centerToTerminal, intervalMs: 15000 });
    ev.save('E-9', 'ptfile-vs-pgl.json', tw.value || tw.last);
    R.seg('终端策略和测试组一致（审计 + 黑名单）', tw.ok ? 'PASS' : 'TIMEOUT', tw.ok ? '' : JSON.stringify(tw.last).slice(0, 300));

    // 终端执行：黑名单里的 pl05-black 预期出「在黑名单」日志，pl05-normal 预期没有日志
    const ts = term.now('t18');
    const mark = term.logMark('t18');
    const runs = ['pl05-black', 'pl05-normal'].map((n) => Object.assign({ name: n }, term.runProgram(n, 2)));
    ev.save('E-9', 'runs.json', runs);
    R.seg('两个程序都能运行（审计不拦）', runs.every((x) => x.code === 0) ? 'PASS' : 'FAIL', runs.map((x) => x.name + ' rc=' + x.code).join('，'));
    const up = parseInt(gp && gp.uptimer, 10) || 60;
    const aw = await until('pl05-black 审计日志入库', () => auditRows(black, ts), (x) => x.length > 0, { timeoutMs: LIMIT.upload(up), intervalMs: 10000 });
    await new Promise((r) => setTimeout(r, 60000)); // black 到了再等 1 分钟，给 normal 万一有的日志留时间
    const b = auditRows(black, ts);
    const n = auditRows(normal, ts);
    ev.save('E-9', 'audit-rows.json', { since: ts, black: b, normal: n });
    ev.save('E-9', 'rss-log-pl05.txt', term.logSince('t18', mark, /pl05/).lines.join('\n'));
    R.seg('pl05-black 有日志：PROCACTION=0、ACTIONREASON=1（在黑名单）', b.length && b.every((x) => x[5] === '0' && x[4] === '1') ? 'PASS' : (aw.ok ? 'FAIL' : 'TIMEOUT'),
      b.length + ' 条，ACTIONREASON=' + b.map((x) => x[4]).join('/') + '，PROCACTION=' + b.map((x) => x[5]).join('/') + '；入库用时 ' + Math.round(aw.ms / 1000) + ' 秒');
    if (b[0]) R.seg('日志哈希 = 13.18 上算的', String(b[0][6]).toLowerCase() === prog['pl05-black'].md5 ? 'PASS' : 'FAIL', b[0][6] + ' ALGO=' + b[0][7]);
    // 预期没有；E-1b 曾看到「只有黑名单时其他进程也按不在白名单记」，这里如实判
    R.seg('pl05-normal 没有日志', n.length === 0 ? 'PASS' : 'FAIL', n.length + ' 条' + (n.length ? '，ACTIONREASON=' + n.map((x) => x[4]).join('/') + '（只有黑名单时其他进程仍被记「不在白名单」，同 E-1b）' : ''));
    await new Promise((r) => setTimeout(r, 20000));
    const st = epstate18();
    ev.save('E-9', 'epstate.json', st);
    R.seg('EPSTATE procaudit（只记录，设计 5.7 期望审计+黑名单=3）', 'RECORD', st.map((r) => r[0] + '=' + r[1] + '@' + r[2]).join('，'));
    colleague(R, 'E-9');
    R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  } finally {
    await s.close('E-9');
  }
  expect(R.finish(), 'E-9 结论').not.toBe('FAIL');
});

test('E-10 拦截·黑名单（本轮 BLOCKED）', async () => {
  const R = recorder('E-10');
  R.seg('拦截·黑名单', 'BLOCKED', '前提不满足：用户确认没有不依赖心跳的本机兜底办法（TK-0 ⑥）；E-1b 证实没有用户白名单时终端把所有进程判成「不在白名单」，'
    + '开拦截可能连 SSH 都被拦、只能等心跳恢复（R-2）。恢复条件：有控制台或本机关拦截的办法后再跑。');
  expect(R.finish(), 'E-10 结论').not.toBe('FAIL');
});
