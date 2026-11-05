/**
 * 白名单链路：E-1 ～ E-7（含 E-1b、E-5b）。每条一个 test，用 -g 单独跑，前后靠本轮 state.json 衔接。
 * 每条都按「页面动作 → 中心库 / Redis → 终端收到 → 终端执行 → 入库 → 页面显示」分段记结论；
 * 结尾都检查同事数据没变（lib/baseline.js）。
 */
'use strict';
const { test, expect } = require('@playwright/test');
const env = require('../lib/env');
const center = require('../lib/center');
const term = require('../lib/terminal');
const ev = require('../lib/evidence');
const P = require('../lib/page');
const ops = require('../lib/ops');
const base = require('../lib/baseline');
const { until, LIMIT } = require('../lib/wait');
const { open, recorder } = require('../lib/run');
const {
  findGroup, groupLinks, ep18, ptfileMatches, colleague, programs, auditRows, epstate18, uptimerOf, findPolicy, groupProcPolicy, execRows, listProcs, listLibs, parseUserlibs, groupListItem, zipsMatch, pwZip, listRowText, ensurePublishedList, applyAndCheck, rowsOf18,
} = require('../lib/cases');

test('E-1 建测试组、改不继承、移入 13.18', async () => {
  const R = recorder('E-1');
  const s = await open();
  try {
    let g = findGroup();
    await test.step('页面：根管理组下新增子组', async () => {
      if (g) { R.seg('新增子组', 'RECORD', '测试组已存在（重跑），组号 ' + g.id); return; }
      const r = await ops.createSubGroup(s.page, env.names.group);
      ev.save('E-1', 'create-group.json', r);
      const w = await until('GROUPINFO 出现测试组', () => findGroup(), (x) => !!x, { timeoutMs: LIMIT.pageToCenter, intervalMs: 2000 });
      g = w.value;
      R.seg('新增子组', ops.ok(r) && g ? 'PASS' : 'FAIL', g ? '组号 ' + g.id + '，父组 ' + g.parent + '，ISINHERIT=' + g.inherit : JSON.stringify(r.json));
    });
    if (!g) return;
    P.setGroup(g.id); // 之后护栏只放行这个组号

    const linksBefore = groupLinks(g.id);
    ev.save('E-1', 'links-after-create.json', linksBefore);
    await test.step('中心：新组照抄父组的进程管控关联', async () => {
      const pids = linksBefore.map((x) => x[1]);
      R.seg('照抄父组关联（PID 3、22）', pids.indexOf('3') >= 0 && pids.indexOf('22') >= 0 ? 'PASS' : 'FAIL', '关联 PID：' + pids.join(','));
    });

    await test.step('页面：组信息页取消「继承父组」并保存', async () => {
      if (g.inherit === '0') { R.seg('改不继承', 'RECORD', '已是不继承（重跑）'); return; }
      const r = await ops.setInherit(s.page, g.id, false);
      ev.save('E-1', 'set-inherit.json', r);
      const w = await until('ISINHERIT 变 0', () => findGroup(), (x) => x && x.inherit === '0', { timeoutMs: LIMIT.pageToCenter, intervalMs: 2000 });
      R.seg('改不继承', ops.ok(r) && w.ok ? 'PASS' : 'FAIL', 'ISINHERIT=' + (w.value || w.last || {}).inherit + '；请求参数 inherit=' + (r.params.inherit || []).join(','));
      const after = groupLinks(g.id);
      ev.save('E-1', 'links-after-noinherit.json', after);
      R.seg('改不继承不动已有关联', JSON.stringify(after) === JSON.stringify(linksBefore) ? 'PASS' : 'FAIL', '前 ' + linksBefore.length + ' 条，后 ' + after.length + ' 条');
    });

    const items = center.procmItems(g.id);
    ev.save('E-1', 'pgl-new-group.json', items);
    R.seg('Redis pgl_<新组> 有进程管控项', items && items.length ? 'PASS' : 'FAIL', (items || []).map((i) => 'type' + i.policytype + ' ver' + i.policyver).join(','));

    const mark = term.logMark('t18');
    const before = ep18();
    ev.save('E-1', 'ep18-before-move.json', before);
    await test.step('页面：把 13.18 移进测试组', async () => {
      if (before.group === g.id) { R.seg('移终端', 'RECORD', '13.18 已在测试组（重跑）'); return; }
      const r = await ops.moveTerminal(s.page, env.t18.host, before.group, env.names.group);
      ev.save('E-1', 'move.json', r);
      const w = await until('EPINFO.GROUPID 变成测试组', () => ep18(), (x) => x.group === g.id, { timeoutMs: LIMIT.pageToCenter, intervalMs: 2000 });
      ev.save('E-1', 'ep18-after-move.json', w.value || w.last);
      R.seg('移终端', ops.ok(r) && w.ok ? 'PASS' : 'FAIL', 'GROUPID=' + (w.value || w.last || {}).group);
      R.seg('PSTAMP 变化（只记录）', 'RECORD', before.pstamp + ' → ' + (w.value || w.last || {}).pstamp);
    });
    R.seg('Redis 终端缓存（只记录）', 'RECORD', JSON.stringify(center.epCache(env.t18.sguid)));

    await test.step('终端：ptfile 里的进程管控策略和测试组一致', async () => {
      const w = await until('13.18 ptfile 与 pgl_<测试组> 一致', () => ptfileMatches(g.id), (x) => x.ok, { timeoutMs: LIMIT.centerToTerminal, intervalMs: 15000 });
      ev.save('E-1', 'ptfile-vs-pgl.json', w.value || w.last);
      R.seg('ptfile 与测试组一致', w.ok ? 'PASS' : 'TIMEOUT', w.ok ? '用时 ' + Math.round(w.ms / 1000) + ' 秒（新组照抄父组，内容可能和移动前相同）' : JSON.stringify(w.last).slice(0, 300));
      const log = term.logSince('t18', mark, /OnMscPolicyChange|QueryPolicy|policy/i);
      ev.save('E-1', 'rss-log-policy.txt', log.lines.join('\n'));
      R.seg('终端日志里的策略变化（只记录）', 'RECORD', log.lines.length + ' 行');
    });

    await test.step('页面：概览里 13.18 在测试组', async () => {
      const p = P.waitApi(s.page, 'Procmanager/getClientsOverview');
      await P.openHash(s.page, '#processManage/overview?g=' + g.id);
      const r = await p;
      ev.save('E-1', 'overview.json', r.json);
      const rows = (r.json && r.json.data && r.json.data.rows) || [];
      R.seg('概览显示 13.18 在测试组', rows.find((x) => x.IP === env.t18.host) ? 'PASS' : 'FAIL', '测试组概览共 ' + rows.length + ' 行');
    });

    colleague(R, 'E-1');
    R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  } finally {
    await s.close('E-1');
  }
  expect(R.finish(), 'E-1 结论').not.toBe('FAIL');
});

test('E-1b 没有用户名单时终端判不判断（只记录）', async () => {
  const R = recorder('E-1b');
  const G = P.load().groupId;
  if (!G) throw new Error('没有测试组，先跑 E-1');
  const prog = programs();
  ev.save('E-1b', 'programs.json', prog);
  const items = center.procmItems(G);
  ev.save('E-1b', 'pgl-group.json', items);
  R.seg('测试组当前策略（只记录）', 'RECORD', items.map((i) => 'type' + i.policytype + (i.policytype === '1' ? ' auditmode=' + center.tag(i.xml, 'auditmode') : '')).join('，'));
  R.seg('pwdata 文件（只记录）', 'RECORD', term.listFiles('t18', 'pwdata').map((f) => f.file).join(' '));

  const mark = term.logMark('t18');
  const t0 = term.now('t18');
  const runs = ['pl05-probe', 'pl05-normal'].map((n) => Object.assign({ name: n }, term.runProgram(n, 2)));
  ev.save('E-1b', 'runs.json', runs);
  R.seg('两个程序能正常运行', runs.every((r) => r.code === 0) ? 'PASS' : 'FAIL', runs.map((r) => r.name + ' rc=' + r.code).join('，'));

  const up = uptimerOf(G);
  const probePath = prog['pl05-probe'].path;
  const normalPath = prog['pl05-normal'].path;
  // 等两个都出日志，或等满 uptimer + 3 分钟（没日志也是一种结果）
  const w = await until('审计日志入库', () => ({ p: auditRows(probePath, t0), n: auditRows(normalPath, t0) }),
    (x) => x.p.length > 0 && x.n.length > 0, { timeoutMs: LIMIT.upload(up), intervalMs: 15000, log: false });
  const v = w.value || w.last || { p: [], n: [] };
  ev.save('E-1b', 'audit-rows.json', v);
  const desc = (rows) => rows.length ? rows.length + ' 条，ACTIONREASON=' + rows.map((r) => r[4]).join('/') + '，PROCACTION=' + rows.map((r) => r[5]).join('/') : '无';
  R.seg('pl05-probe 审计日志（只记录）', 'RECORD', desc(v.p));
  R.seg('pl05-normal 审计日志（只记录）', 'RECORD', desc(v.n) + '；等待 ' + Math.round(w.ms / 1000) + ' 秒（上限 uptimer ' + up + ' + 180）');
  const log = term.logSince('t18', mark, /pl05/);
  ev.save('E-1b', 'rss-log-pl05.txt', log.lines.join('\n'));
  R.seg('rss.def.log 里 pl05 相关行（只记录）', 'RECORD', log.lines.length + ' 行');
  const st = epstate18();
  ev.save('E-1b', 'epstate.json', st);
  R.seg('EPSTATE（只记录）', 'RECORD', st.map((r) => r[0] + '=' + r[1]).join('，'));
  // 背景：本机 SSH 登录产生的 sshd-session 也会被记审计日志（说明无名单时终端按「不在白名单」判）
  const ssh = center.sql("SELECT COUNT(*), MIN(ACTIONREASON), MAX(ACTIONREASON) FROM RPW_PROCESSAUDITINFO WHERE SGUID='" + env.t18.sguid + "' AND PROCPATH='/usr/libexec/sshd-session' AND LOGEDATE>=" + t0)[0];
  R.seg('同期 sshd-session 审计日志（只记录）', 'RECORD', ssh.join(' / '));
  colleague(R, 'E-1b');
  expect(R.finish(), 'E-1b 结论').not.toBe('FAIL');
});

test('E-2 进程策略下发（学习）', async () => {
  const R = recorder('E-2');
  const G = P.load().groupId;
  if (!G) throw new Error('没有测试组，先跑 E-1');
  const name = env.names.policy;
  const s = await open();
  try {
    const linksBefore = groupLinks(G);
    const mark = term.logMark('t18');
    let pol = findPolicy(name);
    await test.step('页面：策略中心新建学习策略，应用范围只勾测试组', async () => {
      if (pol) { P.addPid(pol.pid, name); R.seg('新建策略', 'RECORD', '已存在（重跑），PID ' + pol.pid); return; }
      const r = await ops.createPolicy(s.page, name, env.names.group, { auditmode: '1', uptimer: 60, cloneName: '进程管理_默认策略' },
        async () => {
          const w = await until('POLICY 出现测试策略', () => findPolicy(name), (x) => !!x, { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
          if (w.ok) P.addPid(w.value.pid, name); // 登记给护栏，之后应用范围才放行
        });
      ev.save('E-2', 'create-policy.json', r);
      pol = findPolicy(name);
      R.seg('新建策略', ops.ok(r.add) && pol ? 'PASS' : 'FAIL', pol ? 'PID ' + pol.pid + '；接口返回 data=' + JSON.stringify(r.add.json.data) : JSON.stringify(r.add && r.add.json));
      if (r.range) {
        const ids = (r.range.params['aObjId.groupid'] || r.range.params.aObjId || []).join(',');
        R.seg('应用范围提交只含测试组', ops.ok(r.range) && ids === G ? 'PASS' : 'FAIL', '提交组号 ' + ids + '；树上勾选 ' + r.checked.join(','));
      } else R.seg('应用范围提交只含测试组', 'FAIL', '没走到应用范围');
    });
    if (!pol) return;

    await test.step('中心：库和 Redis', async () => {
      const w = await until('测试组进程策略关联换成新 PID', () => groupLinks(G), (x) => x.some((r) => r[1] === pol.pid) && !x.some((r) => r[1] === '3'),
        { timeoutMs: LIMIT.pageToCenter, intervalMs: 2000 });
      const links = w.value || w.last;
      ev.save('E-2', 'links.json', { before: linksBefore, after: links });
      R.seg('测试组进程策略关联换成新 PID', w.ok ? 'PASS' : 'FAIL', '前 ' + linksBefore.map((r) => r[1]).join(',') + ' → 后 ' + links.map((r) => r[1]).join(','));
      const gp = groupProcPolicy(G);
      ev.save('E-2', 'pgl-proc-policy.json', gp);
      R.seg('pgl_<测试组> 进程策略 auditmode=1、uptimer=60', gp && gp.auditmode === '1' && gp.uptimer === '60' ? 'PASS' : 'FAIL',
        gp ? 'enable=' + gp.enable + ' auditmode=' + gp.auditmode + ' uptimer=' + gp.uptimer + ' notify=' + gp.notify + ' ver=' + gp.ver : '没有进程策略项');
      R.seg('终端版本号（只记录）', 'RECORD', JSON.stringify(center.epCache(env.t18.sguid)) + '；EPINFO.PSTAMP=' + ep18().pstamp);
    });

    await test.step('终端：收到新策略', async () => {
      const t0 = Date.now();
      const w = await until('13.18 ptfile 与测试组一致', () => ptfileMatches(G), (x) => x.ok, { timeoutMs: LIMIT.centerToTerminal, intervalMs: 15000 });
      ev.save('E-2', 'ptfile-vs-pgl.json', w.value || w.last);
      R.seg('ptfile 内容 = 中心下发内容', w.ok ? 'PASS' : 'TIMEOUT', w.ok ? '用时 ' + Math.round((Date.now() - t0) / 1000) + ' 秒' : JSON.stringify(w.last).slice(0, 300));
      const log = term.logSince('t18', mark, /OnMscPolicyChange|QueryPolicy|PolicyChange/);
      ev.save('E-2', 'rss-log-policy.txt', log.lines.join('\n'));
      R.seg('终端日志有策略变化', log.lines.some((l) => /OnMscPolicyChange/.test(l)) ? 'PASS' : 'FAIL', log.lines.length + ' 行');
    });

    await test.step('页面：策略页显示新策略；EPSTATE', async () => {
      await P.openHash(s.page, '#processManage/policy?g=' + G);
      await s.page.waitForTimeout(3000);
      const shown = (await s.page.locator('.policyNameSpan').first().innerText().catch(() => '')).trim();
      await s.page.screenshot({ path: ev.dir('E-2') + '/policy-page.png' });
      R.seg('策略页显示新策略', shown === name ? 'PASS' : 'FAIL', '显示「' + shown + '」');
      await new Promise((r) => setTimeout(r, 30000)); // 给终端一点时间上报状态
      const st = epstate18();
      ev.save('E-2', 'epstate.json', st);
      R.seg('EPSTATE procaudit（只记录，设计 5.7 期望学习=1）', 'RECORD', st.map((r) => r[0] + '=' + r[1] + '@' + r[2]).join('，'));
    });

    colleague(R, 'E-2');
    R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  } finally {
    await s.close('E-2');
  }
  expect(R.finish(), 'E-2 结论').not.toBe('FAIL');
});

test('E-3 学习数据上报（有就更新）', async () => {
  const R = recorder('E-3');
  const G = P.load().groupId;
  const gp = groupProcPolicy(G);
  if (!gp || gp.auditmode !== '1') throw new Error('测试组策略不是学习模式，先跑 E-2');
  const prog = programs()['pl05-learn'];
  const up = parseInt(gp.uptimer, 10) || 60;
  const s = await open();
  try {
    const mark = term.logMark('t18');
    const before = execRows(prog.path);
    R.seg('运行前采集记录（只记录）', 'RECORD', before.length + ' 行');
    const r1 = term.runProgram('pl05-learn', 2);
    // 重跑时这一行已经在了（有就更新，不会再多一行），只能看有没有；首次入库的结论见第一次的证据
    const rerun = before.length > 0;
    const w1 = await until('第一次运行后入库', () => execRows(prog.path), (x) => x.length > (rerun ? 0 : before.length), { timeoutMs: LIMIT.upload(up), intervalMs: 10000 });
    ev.save('E-3', rerun ? 'exec-after-rerun1.json' : 'exec-after-run1.json', w1.value || w1.last);
    R.seg('第一次运行后入库', rerun ? 'RECORD' : (w1.ok ? 'PASS' : 'TIMEOUT'), (rerun ? '重跑：运行前已有 ' + before.length + ' 行，首次入库见 run1-console.txt；' : '') + 'rc=' + r1.code + '；用时 ' + Math.round(w1.ms / 1000) + ' 秒');
    const row = (w1.value || w1.last || [])[0];
    if (row) {
      const h = row[4].toLowerCase();
      R.seg('哈希和 13.18 上算的一致', h === prog.md5 || h === prog.sha256 ? 'PASS' : 'FAIL', 'FILEHASH=' + row[4] + ' ALGO=' + row[5]);
    }
    // 间隔超过 uptimer 再跑一次，看是更新还是新增一行
    await new Promise((r) => setTimeout(r, (up + 10) * 1000));
    const r2 = term.runProgram('pl05-learn', 2);
    await new Promise((r) => setTimeout(r, (up + 60) * 1000)); // 给第二次上报留足时间
    const after = execRows(prog.path);
    ev.save('E-3', 'exec-after-run2.json', after);
    R.seg('两次运行只有一行（有就更新）', after.length === 1 ? 'PASS' : 'FAIL', 'rc=' + r2.code + '；共 ' + after.length + ' 行；TIME ' + after.map((x) => x[1]).join(' / '));
    const log = term.logSince('t18', mark, /pl05-learn/);
    ev.save('E-3', 'rss-log-learn.txt', log.lines.join('\n'));
    R.seg('终端日志有 procw pl05-learn', log.lines.some((l) => /procw, path0=\/tmp\/pl05\/pl05-learn/.test(l)) ? 'PASS' : 'FAIL', log.lines.length + ' 行');
    const sr = await ops.searchProc(s.page, prog.path);
    ev.save('E-3', 'search.json', sr.rows);
    await s.page.screenshot({ path: ev.dir('E-3') + '/search.png' });
    R.seg('进程管理页搜得到', sr.rows.some((t) => t.indexOf('pl05-learn') >= 0) ? 'PASS' : 'FAIL', sr.rows.length + ' 行');
    colleague(R, 'E-3');
    R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  } finally {
    await s.close('E-3');
  }
  expect(R.finish(), 'E-3 结论').not.toBe('FAIL');
});

test('E-4 建白名单并发布', async () => {
  const R = recorder('E-4');
  if (!P.load().groupId) throw new Error('没有测试组，先跑 E-1');
  const s = await open();
  try {
    const r = await ensurePublishedList(R, s, 'E-4', 'white', env.names.white, 'pl05-learn');
    if (r.pol) {
      const txt = await listRowText(s.page, 'white', env.names.white);
      await s.page.screenshot({ path: ev.dir('E-4') + '/list-page.png' });
      R.seg('名单页显示已发布', txt.indexOf('已发布') >= 0 ? 'PASS' : 'FAIL', txt.slice(0, 200));
    }
    colleague(R, 'E-4');
    R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  } finally {
    await s.close('E-4');
  }
  expect(R.finish(), 'E-4 结论').not.toBe('FAIL');
});

test('E-5 白名单下发', async () => {
  const R = recorder('E-5');
  const G = P.load().groupId;
  const pol = findPolicy(env.names.white);
  if (!G || !pol || pol.status !== '4') throw new Error('白名单没发布，先跑 E-4');
  P.addPid(pol.pid, env.names.white);
  const s = await open();
  try {
    R.seg('应用前测试组关联（只记录）', 'RECORD', groupLinks(G).map((x) => x[1] + '(' + x[2] + ')').join('；'));
    await applyAndCheck(R, s, 'E-5', 'white', env.names.white, G, '');
    const txt = await listRowText(s.page, 'white', env.names.white);
    await s.page.screenshot({ path: ev.dir('E-5') + '/list-page.png' });
    R.seg('名单页应用范围显示组【 1 】', /组【\s*1\s*】/.test(txt) ? 'PASS' : 'FAIL', txt.slice(0, 200));
    colleague(R, 'E-5');
    R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  } finally {
    await s.close('E-5');
  }
  expect(R.finish(), 'E-5 结论').not.toBe('FAIL');
});

test('E-5b 白名单换白名单', async () => {
  const R = recorder('E-5b');
  const G = P.load().groupId;
  const w1 = findPolicy(env.names.white);
  if (!G || !w1 || w1.status !== '4') throw new Error('白名单没发布，先跑 E-4、E-5');
  P.addPid(w1.pid, env.names.white);
  const s = await open();
  try {
    const r = await ensurePublishedList(R, s, 'E-5b', 'white', env.names.white2, 'pl05-learn');
    if (!r.pol) return;
    await applyAndCheck(R, s, 'E-5b', 'white', env.names.white2, G, '换成白2：');
    const t1 = await listRowText(s.page, 'white', env.names.white);
    const t2 = await listRowText(s.page, 'white', env.names.white2);
    R.seg('换成白2：两个名单的应用范围', /---/.test(t1) && /组【\s*1\s*】/.test(t2) ? 'PASS' : 'FAIL', '白：' + t1.slice(0, 120) + ' ｜ 白2：' + t2.slice(0, 120));
    await applyAndCheck(R, s, 'E-5b', 'white', env.names.white, G, '换回白：');
    const u1 = await listRowText(s.page, 'white', env.names.white);
    const u2 = await listRowText(s.page, 'white', env.names.white2);
    await s.page.screenshot({ path: ev.dir('E-5b') + '/list-page.png' });
    R.seg('换回白：两个名单的应用范围', /组【\s*1\s*】/.test(u1) && /---/.test(u2) ? 'PASS' : 'FAIL', '白：' + u1.slice(0, 120) + ' ｜ 白2：' + u2.slice(0, 120));
    colleague(R, 'E-5b');
    R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  } finally {
    await s.close('E-5b');
  }
  expect(R.finish(), 'E-5b 结论').not.toBe('FAIL');
});

test('E-6 审计·白名单', async () => {
  const R = recorder('E-6');
  const G = P.load().groupId;
  const pol = findPolicy(env.names.policy);
  const wl = findPolicy(env.names.white);
  if (!G || !pol || !wl) throw new Error('缺测试组 / 测试策略 / 白名单，先跑 E-1～E-5');
  P.addPid(pol.pid, env.names.policy);
  const prog = programs();
  const learn = prog['pl05-learn'].path;
  const unknown = prog['pl05-unknown'].path;
  const s = await open();
  try {
    const links = groupLinks(G);
    R.seg('测试组当前关联（只记录）', 'RECORD', links.map((x) => x[1] + '(' + x[2] + ')').join('；'));
    if (!links.some((x) => x[1] === wl.pid)) R.seg('前提：测试组用的是 PL05测试-白', 'FAIL', '测试组上没有白名单关联');
    const mark = term.logMark('t18');
    await test.step('页面：策略页改审计模式并应用', async () => {
      const gp0 = groupProcPolicy(G);
      if (gp0 && gp0.auditmode === '2') { R.seg('改审计', 'RECORD', '已是审计（重跑）'); return; }
      const r = await ops.setAuditMode(s.page, G, '2');
      ev.save('E-6', 'edit-policy.json', r);
      R.seg('改审计（editPolicy 提交的是测试策略）', ops.ok(r) && (r.params.pid || [])[0] === pol.pid ? 'PASS' : 'FAIL', 'pid=' + (r.params.pid || []).join(',') + '；接口 ' + JSON.stringify(r.json).slice(0, 120));
    });
    const w = await until('pgl 进程策略 auditmode=2', () => groupProcPolicy(G), (x) => x && x.auditmode === '2', { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
    const gp = w.value || w.last;
    ev.save('E-6', 'pgl-proc-policy.json', gp);
    R.seg('pgl_<测试组> 进程策略 auditmode=2', w.ok ? 'PASS' : 'FAIL', gp ? 'auditmode=' + gp.auditmode + ' uptimer=' + gp.uptimer + ' notify=' + gp.notify + ' ver=' + gp.ver : '没有进程策略项');
    const t0 = Date.now();
    const tw = await until('13.18 ptfile 与测试组一致', () => ptfileMatches(G), (x) => x.ok, { timeoutMs: LIMIT.centerToTerminal, intervalMs: 15000 });
    ev.save('E-6', 'ptfile-vs-pgl.json', tw.value || tw.last);
    R.seg('终端收到审计策略', tw.ok ? 'PASS' : 'TIMEOUT', tw.ok ? '用时 ' + Math.round((Date.now() - t0) / 1000) + ' 秒' : JSON.stringify(tw.last).slice(0, 300));
    ev.save('E-6', 'rss-log-policy.txt', term.logSince('t18', mark, /OnMscPolicyChange|QueryPolicy/).lines.join('\n'));

    // 终端执行：白名单里的 pl05-learn 不该出日志，不在名单的 pl05-unknown 该出「不在白名单」
    const ts = term.now('t18');
    const runs = ['pl05-learn', 'pl05-unknown'].map((n) => Object.assign({ name: n }, term.runProgram(n, 2)));
    ev.save('E-6', 'runs.json', runs);
    R.seg('两个程序都能运行（审计不拦）', runs.every((r) => r.code === 0) ? 'PASS' : 'FAIL', runs.map((r) => r.name + ' rc=' + r.code).join('，'));
    const up = parseInt(gp && gp.uptimer, 10) || 60;
    const aw = await until('pl05-unknown 审计日志入库', () => auditRows(unknown, ts), (x) => x.length > 0, { timeoutMs: LIMIT.upload(up), intervalMs: 10000 });
    await new Promise((r) => setTimeout(r, 60000)); // unknown 到了以后再等 1 分钟，给 learn 万一有的日志留时间
    const u = auditRows(unknown, ts);
    const l = auditRows(learn, ts);
    ev.save('E-6', 'audit-rows.json', { since: ts, unknown: u, learn: l });
    R.seg('pl05-unknown 有日志：PROCACTION=0、ACTIONREASON=2', u.length && u.every((x) => x[5] === '0' && x[4] === '2') ? 'PASS' : (aw.ok ? 'FAIL' : 'TIMEOUT'),
      u.length + ' 条，ACTIONREASON=' + u.map((x) => x[4]).join('/') + '，PROCACTION=' + u.map((x) => x[5]).join('/') + '；入库用时 ' + Math.round(aw.ms / 1000) + ' 秒');
    if (u[0]) R.seg('日志哈希 = 13.18 上算的', String(u[0][6]).toLowerCase() === prog['pl05-unknown'].md5 ? 'PASS' : 'FAIL', u[0][6] + ' ALGO=' + u[0][7]);
    R.seg('pl05-learn（在白名单）没有日志', l.length === 0 ? 'PASS' : 'FAIL', l.length + ' 条');

    await test.step('页面：日志页按路径筛', async () => {
      const su = await ops.searchLog(s.page, G, 'procpath', unknown);
      ev.save('E-6', 'log-page-unknown.json', su);
      await s.page.screenshot({ path: ev.dir('E-6') + '/log-page-unknown.png' });
      // 只数路径完全相同的行（searchLog 已核对请求里带了筛选条件）
      const su18 = rowsOf18(su.rows).filter((x) => x.PROCPATH === unknown);
      R.seg('日志页筛得到 pl05-unknown（13.18）', su18.length ? 'PASS' : 'FAIL', '共 ' + su.rows.length + ' 行，13.18 且路径相同的 ' + su18.length + ' 行');
      const sl = await ops.searchLog(s.page, G, 'procpath', learn);
      ev.save('E-6', 'log-page-learn.json', sl);
      const allLearn = auditRows(learn, 0).length; // 库里 13.18 这个路径的全部审计日志（本轮之前也算）
      const sl18 = rowsOf18(sl.rows).filter((x) => x.PROCPATH === learn).length;
      R.seg('日志页筛不到 pl05-learn（13.18）', sl18 === 0 ? 'PASS' : (sl18 === allLearn && l.length === 0 ? 'RECORD' : 'FAIL'),
        '页面 13.18 且路径相同的 ' + sl18 + ' 行；库里全部 ' + allLearn + ' 条、本轮 ' + l.length + ' 条');
    });
    await new Promise((r) => setTimeout(r, 20000));
    const st = epstate18();
    ev.save('E-6', 'epstate.json', st);
    R.seg('EPSTATE procaudit（只记录，设计 5.7 期望审计+白名单=2）', 'RECORD', st.map((r) => r[0] + '=' + r[1] + '@' + r[2]).join('，'));
    colleague(R, 'E-6');
    R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  } finally {
    await s.close('E-6');
  }
  expect(R.finish(), 'E-6 结论').not.toBe('FAIL');
});

test('E-7 修正误报（日志页加白再发布）', async () => {
  const R = recorder('E-7');
  const G = P.load().groupId;
  const wl = findPolicy(env.names.white);
  const gp = groupProcPolicy(G);
  if (!G || !wl || !gp || gp.auditmode !== '2') throw new Error('测试组不是审计 + 白名单，先跑 E-6');
  P.addPid(wl.pid, env.names.white);
  const prog = programs();
  const unknown = prog['pl05-unknown'].path;
  const s = await open();
  try {
    const libs0 = listLibs(wl.pid);
    await test.step('页面：日志页把 pl05-unknown 加到 PL05测试-白', async () => {
      if (listProcs('white', wl.pid).some((x) => x[0] === unknown)) { R.seg('日志页加白', 'RECORD', '名单里已有（重跑）'); return; }
      const r = await ops.addFromLog(s.page, G, unknown, env.t18.host, 'white', env.names.white);
      ev.save('E-7', 'add-from-log.json', r);
      const w = await until('名单进程表出现 pl05-unknown', () => listProcs('white', wl.pid), (x) => x.some((y) => y[0] === unknown), { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
      const row = (w.value || w.last || []).find((y) => y[0] === unknown);
      R.seg('日志页加白', ops.ok(r) && row ? 'PASS' : 'FAIL', row ? 'STATUS=' + row[3] + ' 哈希=' + row[1] : JSON.stringify(r.json).slice(0, 200));
      if (row) R.seg('加白的哈希 = 13.18 上算的', String(row[1]).toLowerCase() === prog['pl05-unknown'].md5 ? 'PASS' : 'FAIL', row[1]);
    });
    const mark = term.logMark('t18');
    await test.step('页面：名单页发布', async () => {
      const r = await ops.publishList(s.page, 'white', env.names.white);
      ev.save('E-7', 'publish.json', r);
      const w = await until('STATUS 回到 4 且版本变化', () => listLibs(wl.pid), (x) => x && libs0 && x.version !== libs0.version, { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
      R.seg('发布后名单 version 变化', ops.ok(r) && w.ok && findPolicy(env.names.white).status === '4' ? 'PASS' : 'FAIL',
        (libs0 && libs0.version) + ' → ' + ((w.value || w.last || {}).version) + '；STATUS=' + findPolicy(env.names.white).status);
    });
    const libs1 = listLibs(wl.pid);
    ev.save('E-7', 'policyjson-userlibs.json', { before: libs0, after: libs1 });
    const z = zipsMatch('w/u', wl.pguid, libs1);
    ev.save('E-7', 'zips.json', z);
    R.seg('新 zip 6 个，md5 = POLICYJSON', z.ok ? 'PASS' : 'FAIL', z.have.length + ' 个');
    const a1 = (libs1.lib || []).find((x) => x.arch === 'aarch64');
    const a0 = libs0 && (libs0.lib || []).find((x) => x.arch === 'aarch64');
    R.seg('aarch64 zip 换了（md5 变化）', a1 && a0 && a1.md5 !== a0.md5 ? 'PASS' : 'FAIL', (a0 && a0.md5) + ' → ' + (a1 && a1.md5));
    const gi = groupListItem(G);
    ev.save('E-7', 'pgl-list-item.json', gi);
    R.seg('pgl 名单项 version 跟着变', gi && gi.userlibs && gi.userlibs.version === libs1.version ? 'PASS' : 'FAIL', gi && gi.userlibs ? 'version=' + gi.userlibs.version : '没有名单项');
    const t0 = Date.now();
    const tw = await until('13.18 下载新版本 zip', () => pwZip(wl.pguid), (x) => x && a1 && x.md5 === String(a1.md5).toUpperCase(), { timeoutMs: LIMIT.centerToTerminal + LIMIT.libDownload, intervalMs: 15000 });
    ev.save('E-7', 'pwdata.json', term.listFiles('t18', 'pwdata'));
    ev.save('E-7', 'rss-log.txt', term.logSince('t18', mark, /OnMscPolicyChange|QueryPolicy|userlibs|\.zip|download/i).lines.join('\n'));
    R.seg('终端下载新版本 zip', tw.ok ? 'PASS' : 'TIMEOUT', tw.ok ? '用时 ' + Math.round((Date.now() - t0) / 1000) + ' 秒' : JSON.stringify(tw.last));

    // 再运行 pl05-unknown：已在白名单，uptimer + 3 分钟内不该再出新日志（没日志要等满整段才能下结论）
    const ts = term.now('t18');
    const run = term.runProgram('pl05-unknown', 2);
    const up = parseInt(gp.uptimer, 10) || 60;
    await new Promise((r) => setTimeout(r, LIMIT.upload(up)));
    const after = auditRows(unknown, ts);
    ev.save('E-7', 'audit-rows-after.json', { since: ts, rows: after });
    R.seg('加白后 pl05-unknown 不再出日志', after.length === 0 ? 'PASS' : 'FAIL', 'rc=' + run.code + '；等待 ' + (up + 180) + ' 秒，新日志 ' + after.length + ' 条');
    colleague(R, 'E-7');
    R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  } finally {
    await s.close('E-7');
  }
  expect(R.finish(), 'E-7 结论').not.toBe('FAIL');
});
