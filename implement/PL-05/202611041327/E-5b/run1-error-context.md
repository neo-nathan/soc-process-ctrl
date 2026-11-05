# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 10-white.spec.js >> E-5b 白名单换白名单
- Location: specs/10-white.spec.js:532:1

# Error details

```
Error: E-5b 结论

expect(received).not.toBe(expected) // Object.is equality

Expected: not "FAIL"
```

# Test source

```ts
  456 |     (r.resp.params.aObjId || []).forEach((v) => { try { ids = ids.concat(JSON.parse(v)); } catch (e) { ids.push(v); } });
  457 |     R.seg(tag + '应用到组提交只含测试组', ops.ok(r.resp) && ids.map(String).join() === G ? 'PASS' : 'FAIL', '提交组号 ' + ids.join(',') + '；树上勾选 ' + r.checked.join(',') + '；接口 ' + JSON.stringify(r.resp.json).slice(0, 120));
  458 |   });
  459 |   const ptype = type === 'black' ? '3' : '2';
  460 |   const w = await until('测试组名单关联只剩 ' + name, () => groupLinks(G).filter((x) => x[3] === '2' || x[3] === '3'),
  461 |     (x) => x.length === 1 && x[0][1] === pol.pid, { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
  462 |   const links = groupLinks(G);
  463 |   ev.save(caseId, fp + 'links.json', links);
  464 |   R.seg(tag + '测试组上的名单关联只剩它', w.ok ? 'PASS' : 'FAIL', links.map((x) => x[1] + '(' + x[2] + ',type' + x[3] + ')').join('；'));
  465 |   const gi = groupListItem(G);
  466 |   ev.save(caseId, fp + 'pgl-list-item.json', gi);
  467 |   const u = gi && gi.userlibs;
  468 |   const want = { type: type === 'black' ? '2' : '1', dpath: type === 'black' ? 'ruc/libs/b/u' : 'ruc/libs/w/u' };
  469 |   const centerA = center.libFiles(type === 'black' ? 'b/u' : 'w/u', pol.pguid).find((f) => f.file === pol.pguid + '_aarch64.zip');
  470 |   const uA = u && (u.lib || []).find((l) => l.arch === 'aarch64');
  471 |   R.seg(tag + 'pgl 名单项指向它', gi && gi.policytype === ptype && u && u.type === want.type && u.dpath === want.dpath && u.name === pol.pguid &&
  472 |     uA && centerA && String(uA.md5).toUpperCase() === centerA.md5 ? 'PASS' : 'FAIL',
  473 |     gi ? 'policytype=' + gi.policytype + ' type=' + (u && u.type) + ' dpath=' + (u && u.dpath) + ' name=' + (u && u.name) + ' aarch64=' + (uA && uA.md5) + ' 中心文件=' + (centerA && centerA.md5) : '没有名单项');
  474 |   const items = center.procmItems(G) || [];
  475 |   R.seg(tag + 'pgl 里只有一个名单项', items.filter((i) => i.policytype === '2' || i.policytype === '3').length === 1 ? 'PASS' : 'FAIL', items.map((i) => 'type' + i.policytype).join(','));
  476 | 
  477 |   // 终端：收到名单变化、下载对应 zip
  478 |   const t0 = Date.now();
  479 |   const tw = await until('13.18 pwdata 有 ' + name + ' 的 zip 且 md5 一致', () => pwZip(pol.pguid), (x) => x && centerA && x.md5 === centerA.md5,
  480 |     { timeoutMs: LIMIT.centerToTerminal + LIMIT.libDownload, intervalMs: 15000 });
  481 |   ev.save(caseId, fp + 'pwdata.json', term.listFiles('t18', 'pwdata'));
  482 |   R.seg(tag + '终端下载 zip 且 md5 一致', tw.ok ? 'PASS' : 'TIMEOUT', tw.ok ? tw.value.file + '；用时 ' + Math.round((Date.now() - t0) / 1000) + ' 秒' : JSON.stringify(tw.last));
  483 |   const pt = ptfileMatches(G);
  484 |   ev.save(caseId, fp + 'ptfile-vs-pgl.json', pt);
  485 |   R.seg(tag + 'ptfile 与测试组 pgl 一致', pt.ok ? 'PASS' : 'FAIL', 'want ' + pt.want + ' / have ' + pt.have);
  486 |   const log = term.logSince('t18', mark, /OnMscPolicyChange|QueryPolicy|userlibs|\.zip|download/i);
  487 |   ev.save(caseId, fp + 'rss-log.txt', log.lines.join('\n'));
  488 |   R.seg(tag + '终端日志有 type="' + ptype + '" delete="0"', log.lines.some((l) => l.indexOf('type="' + ptype + '"') >= 0 && l.indexOf('delete="0"') >= 0) ? 'PASS' : 'FAIL', log.lines.length + ' 行');
  489 |   return { ok: w.ok && tw.ok };
  490 | }
  491 | 
  492 | test('E-4 建白名单并发布', async () => {
  493 |   const R = recorder('E-4');
  494 |   if (!P.load().groupId) throw new Error('没有测试组，先跑 E-1');
  495 |   const s = await open();
  496 |   try {
  497 |     const r = await ensurePublishedList(R, s, 'E-4', 'white', env.names.white, 'pl05-learn');
  498 |     if (r.pol) {
  499 |       const txt = await listRowText(s.page, 'white', env.names.white);
  500 |       await s.page.screenshot({ path: ev.dir('E-4') + '/list-page.png' });
  501 |       R.seg('名单页显示已发布', txt.indexOf('已发布') >= 0 ? 'PASS' : 'FAIL', txt.slice(0, 200));
  502 |     }
  503 |     colleague(R, 'E-4');
  504 |     R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  505 |   } finally {
  506 |     await s.close('E-4');
  507 |   }
  508 |   expect(R.finish(), 'E-4 结论').not.toBe('FAIL');
  509 | });
  510 | 
  511 | test('E-5 白名单下发', async () => {
  512 |   const R = recorder('E-5');
  513 |   const G = P.load().groupId;
  514 |   const pol = findPolicy(env.names.white);
  515 |   if (!G || !pol || pol.status !== '4') throw new Error('白名单没发布，先跑 E-4');
  516 |   P.addPid(pol.pid, env.names.white);
  517 |   const s = await open();
  518 |   try {
  519 |     R.seg('应用前测试组关联（只记录）', 'RECORD', groupLinks(G).map((x) => x[1] + '(' + x[2] + ')').join('；'));
  520 |     await applyAndCheck(R, s, 'E-5', 'white', env.names.white, G, '');
  521 |     const txt = await listRowText(s.page, 'white', env.names.white);
  522 |     await s.page.screenshot({ path: ev.dir('E-5') + '/list-page.png' });
  523 |     R.seg('名单页应用范围显示组【 1 】', /组【\s*1\s*】/.test(txt) ? 'PASS' : 'FAIL', txt.slice(0, 200));
  524 |     colleague(R, 'E-5');
  525 |     R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  526 |   } finally {
  527 |     await s.close('E-5');
  528 |   }
  529 |   expect(R.finish(), 'E-5 结论').not.toBe('FAIL');
  530 | });
  531 | 
  532 | test('E-5b 白名单换白名单', async () => {
  533 |   const R = recorder('E-5b');
  534 |   const G = P.load().groupId;
  535 |   const w1 = findPolicy(env.names.white);
  536 |   if (!G || !w1 || w1.status !== '4') throw new Error('白名单没发布，先跑 E-4、E-5');
  537 |   P.addPid(w1.pid, env.names.white);
  538 |   const s = await open();
  539 |   try {
  540 |     const r = await ensurePublishedList(R, s, 'E-5b', 'white', env.names.white2, 'pl05-learn');
  541 |     if (!r.pol) return;
  542 |     await applyAndCheck(R, s, 'E-5b', 'white', env.names.white2, G, '换成白2：');
  543 |     const t1 = await listRowText(s.page, 'white', env.names.white);
  544 |     const t2 = await listRowText(s.page, 'white', env.names.white2);
  545 |     R.seg('换成白2：两个名单的应用范围', /---/.test(t1) && /组【\s*1\s*】/.test(t2) ? 'PASS' : 'FAIL', '白：' + t1.slice(0, 120) + ' ｜ 白2：' + t2.slice(0, 120));
  546 |     await applyAndCheck(R, s, 'E-5b', 'white', env.names.white, G, '换回白：');
  547 |     const u1 = await listRowText(s.page, 'white', env.names.white);
  548 |     const u2 = await listRowText(s.page, 'white', env.names.white2);
  549 |     await s.page.screenshot({ path: ev.dir('E-5b') + '/list-page.png' });
  550 |     R.seg('换回白：两个名单的应用范围', /组【\s*1\s*】/.test(u1) && /---/.test(u2) ? 'PASS' : 'FAIL', '白：' + u1.slice(0, 120) + ' ｜ 白2：' + u2.slice(0, 120));
  551 |     colleague(R, 'E-5b');
  552 |     R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  553 |   } finally {
  554 |     await s.close('E-5b');
  555 |   }
> 556 |   expect(R.finish(), 'E-5b 结论').not.toBe('FAIL');
      |                                     ^ Error: E-5b 结论
  557 | });
  558 | 
  559 | /** 日志页返回的行里属于 13.18 的（按整行 JSON 里有没有 13.18 的 IP 判断，不依赖字段名） */
  560 | function rowsOf18(rows) { return rows.filter((r) => JSON.stringify(r).indexOf('"' + env.t18.host + '"') >= 0); }
  561 | 
  562 | test('E-6 审计·白名单', async () => {
  563 |   const R = recorder('E-6');
  564 |   const G = P.load().groupId;
  565 |   const pol = findPolicy(env.names.policy);
  566 |   const wl = findPolicy(env.names.white);
  567 |   if (!G || !pol || !wl) throw new Error('缺测试组 / 测试策略 / 白名单，先跑 E-1～E-5');
  568 |   P.addPid(pol.pid, env.names.policy);
  569 |   const prog = programs();
  570 |   const learn = prog['pl05-learn'].path;
  571 |   const unknown = prog['pl05-unknown'].path;
  572 |   const s = await open();
  573 |   try {
  574 |     const links = groupLinks(G);
  575 |     R.seg('测试组当前关联（只记录）', 'RECORD', links.map((x) => x[1] + '(' + x[2] + ')').join('；'));
  576 |     if (!links.some((x) => x[1] === wl.pid)) R.seg('前提：测试组用的是 PL05测试-白', 'FAIL', '测试组上没有白名单关联');
  577 |     const mark = term.logMark('t18');
  578 |     await test.step('页面：策略页改审计模式并应用', async () => {
  579 |       const gp0 = groupProcPolicy(G);
  580 |       if (gp0 && gp0.auditmode === '2') { R.seg('改审计', 'RECORD', '已是审计（重跑）'); return; }
  581 |       const r = await ops.setAuditMode(s.page, G, '2');
  582 |       ev.save('E-6', 'edit-policy.json', r);
  583 |       R.seg('改审计（editPolicy 提交的是测试策略）', ops.ok(r) && (r.params.pid || [])[0] === pol.pid ? 'PASS' : 'FAIL', 'pid=' + (r.params.pid || []).join(',') + '；接口 ' + JSON.stringify(r.json).slice(0, 120));
  584 |     });
  585 |     const w = await until('pgl 进程策略 auditmode=2', () => groupProcPolicy(G), (x) => x && x.auditmode === '2', { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
  586 |     const gp = w.value || w.last;
  587 |     ev.save('E-6', 'pgl-proc-policy.json', gp);
  588 |     R.seg('pgl_<测试组> 进程策略 auditmode=2', w.ok ? 'PASS' : 'FAIL', gp ? 'auditmode=' + gp.auditmode + ' uptimer=' + gp.uptimer + ' notify=' + gp.notify + ' ver=' + gp.ver : '没有进程策略项');
  589 |     const t0 = Date.now();
  590 |     const tw = await until('13.18 ptfile 与测试组一致', () => ptfileMatches(G), (x) => x.ok, { timeoutMs: LIMIT.centerToTerminal, intervalMs: 15000 });
  591 |     ev.save('E-6', 'ptfile-vs-pgl.json', tw.value || tw.last);
  592 |     R.seg('终端收到审计策略', tw.ok ? 'PASS' : 'TIMEOUT', tw.ok ? '用时 ' + Math.round((Date.now() - t0) / 1000) + ' 秒' : JSON.stringify(tw.last).slice(0, 300));
  593 |     ev.save('E-6', 'rss-log-policy.txt', term.logSince('t18', mark, /OnMscPolicyChange|QueryPolicy/).lines.join('\n'));
  594 | 
  595 |     // 终端执行：白名单里的 pl05-learn 不该出日志，不在名单的 pl05-unknown 该出「不在白名单」
  596 |     const ts = term.now('t18');
  597 |     const runs = ['pl05-learn', 'pl05-unknown'].map((n) => Object.assign({ name: n }, term.runProgram(n, 2)));
  598 |     ev.save('E-6', 'runs.json', runs);
  599 |     R.seg('两个程序都能运行（审计不拦）', runs.every((r) => r.code === 0) ? 'PASS' : 'FAIL', runs.map((r) => r.name + ' rc=' + r.code).join('，'));
  600 |     const up = parseInt(gp && gp.uptimer, 10) || 60;
  601 |     const aw = await until('pl05-unknown 审计日志入库', () => auditRows(unknown, ts), (x) => x.length > 0, { timeoutMs: LIMIT.upload(up), intervalMs: 10000 });
  602 |     await new Promise((r) => setTimeout(r, 60000)); // unknown 到了以后再等 1 分钟，给 learn 万一有的日志留时间
  603 |     const u = auditRows(unknown, ts);
  604 |     const l = auditRows(learn, ts);
  605 |     ev.save('E-6', 'audit-rows.json', { since: ts, unknown: u, learn: l });
  606 |     R.seg('pl05-unknown 有日志：PROCACTION=0、ACTIONREASON=2', u.length && u.every((x) => x[5] === '0' && x[4] === '2') ? 'PASS' : (aw.ok ? 'FAIL' : 'TIMEOUT'),
  607 |       u.length + ' 条，ACTIONREASON=' + u.map((x) => x[4]).join('/') + '，PROCACTION=' + u.map((x) => x[5]).join('/') + '；入库用时 ' + Math.round(aw.ms / 1000) + ' 秒');
  608 |     if (u[0]) R.seg('日志哈希 = 13.18 上算的', String(u[0][6]).toLowerCase() === prog['pl05-unknown'].md5 ? 'PASS' : 'FAIL', u[0][6] + ' ALGO=' + u[0][7]);
  609 |     R.seg('pl05-learn（在白名单）没有日志', l.length === 0 ? 'PASS' : 'FAIL', l.length + ' 条');
  610 | 
  611 |     await test.step('页面：日志页按路径筛', async () => {
  612 |       const su = await ops.searchLog(s.page, G, 'procpath', unknown);
  613 |       ev.save('E-6', 'log-page-unknown.json', su);
  614 |       await s.page.screenshot({ path: ev.dir('E-6') + '/log-page-unknown.png' });
  615 |       R.seg('日志页筛得到 pl05-unknown（13.18）', rowsOf18(su.rows).length ? 'PASS' : 'FAIL', '共 ' + su.rows.length + ' 行，13.18 的 ' + rowsOf18(su.rows).length + ' 行');
  616 |       const sl = await ops.searchLog(s.page, G, 'procpath', learn);
  617 |       ev.save('E-6', 'log-page-learn.json', sl);
  618 |       const allLearn = auditRows(learn, 0).length; // 库里 13.18 这个路径的全部审计日志（本轮之前也算）
  619 |       R.seg('日志页筛不到 pl05-learn（13.18）', rowsOf18(sl.rows).length === 0 ? 'PASS' : (rowsOf18(sl.rows).length === allLearn && l.length === 0 ? 'RECORD' : 'FAIL'),
  620 |         '页面 13.18 的 ' + rowsOf18(sl.rows).length + ' 行；库里全部 ' + allLearn + ' 条、本轮 ' + l.length + ' 条');
  621 |     });
  622 |     await new Promise((r) => setTimeout(r, 20000));
  623 |     const st = epstate18();
  624 |     ev.save('E-6', 'epstate.json', st);
  625 |     R.seg('EPSTATE procaudit（只记录，设计 5.7 期望审计+白名单=2）', 'RECORD', st.map((r) => r[0] + '=' + r[1] + '@' + r[2]).join('，'));
  626 |     colleague(R, 'E-6');
  627 |     R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  628 |   } finally {
  629 |     await s.close('E-6');
  630 |   }
  631 |   expect(R.finish(), 'E-6 结论').not.toBe('FAIL');
  632 | });
  633 | 
  634 | test('E-7 修正误报（日志页加白再发布）', async () => {
  635 |   const R = recorder('E-7');
  636 |   const G = P.load().groupId;
  637 |   const wl = findPolicy(env.names.white);
  638 |   const gp = groupProcPolicy(G);
  639 |   if (!G || !wl || !gp || gp.auditmode !== '2') throw new Error('测试组不是审计 + 白名单，先跑 E-6');
  640 |   P.addPid(wl.pid, env.names.white);
  641 |   const prog = programs();
  642 |   const unknown = prog['pl05-unknown'].path;
  643 |   const s = await open();
  644 |   try {
  645 |     const libs0 = listLibs(wl.pid);
  646 |     await test.step('页面：日志页把 pl05-unknown 加到 PL05测试-白', async () => {
  647 |       if (listProcs('white', wl.pid).some((x) => x[0] === unknown)) { R.seg('日志页加白', 'RECORD', '名单里已有（重跑）'); return; }
  648 |       const r = await ops.addFromLog(s.page, G, unknown, env.t18.host, 'white', env.names.white);
  649 |       ev.save('E-7', 'add-from-log.json', r);
  650 |       const w = await until('名单进程表出现 pl05-unknown', () => listProcs('white', wl.pid), (x) => x.some((y) => y[0] === unknown), { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
  651 |       const row = (w.value || w.last || []).find((y) => y[0] === unknown);
  652 |       R.seg('日志页加白', ops.ok(r) && row ? 'PASS' : 'FAIL', row ? 'STATUS=' + row[3] + ' 哈希=' + row[1] : JSON.stringify(r.json).slice(0, 200));
  653 |       if (row) R.seg('加白的哈希 = 13.18 上算的', String(row[1]).toLowerCase() === prog['pl05-unknown'].md5 ? 'PASS' : 'FAIL', row[1]);
  654 |     });
  655 |     const mark = term.logMark('t18');
  656 |     await test.step('页面：名单页发布', async () => {
```