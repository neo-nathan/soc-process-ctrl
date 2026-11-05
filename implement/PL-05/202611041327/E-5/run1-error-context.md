# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 10-white.spec.js >> E-5 白名单下发
- Location: specs/10-white.spec.js:497:1

# Error details

```
Error: E-5 结论

expect(received).not.toBe(expected) // Object.is equality

Expected: not "FAIL"
```

# Test source

```ts
  415 |     const w = await until('STATUS 变 4', () => findPolicy(name), (x) => x.status === '4', { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
  416 |     pol = w.value || w.last;
  417 |     R.seg('发布后 POLICY.STATUS=4（已发布）', ops.ok(r) && w.ok ? 'PASS' : 'FAIL', 'STATUS=' + pol.status + ' POLICYVER=' + pol.ver + '；接口 ' + JSON.stringify(r.json).slice(0, 120));
  418 |   });
  419 |   const procs = listProcs(type, pol.pid);
  420 |   ev.save(caseId, 'list-procs.json', procs);
  421 |   R.seg('发布后进程行 STATUS=0（已确认）', procs.length && procs.every((x) => x[3] === '0') ? 'PASS' : 'FAIL', procs.map((x) => x[0] + ' STATUS=' + x[3]).join('；'));
  422 |   const libs = listLibs(pol.pid);
  423 |   ev.save(caseId, 'policyjson-userlibs.json', libs);
  424 |   const z = zipsMatch(type === 'black' ? 'b/u' : 'w/u', pol.pguid, libs);
  425 |   ev.save(caseId, 'zips.json', z);
  426 |   R.seg('中心 6 个 zip 的 md5 = POLICYJSON', z.ok ? 'PASS' : 'FAIL', '文件 ' + z.have.length + ' 个；version=' + (libs && libs.version));
  427 |   return { pol, procs, libs };
  428 | }
  429 | 
  430 | /**
  431 |  * 名单页把名单应用到测试组（只勾这一个），核提交参数，等库里测试组的名单关联换成它、Redis 名单项换成它、
  432 |  * 终端下载对应 zip。返回 { ok }。
  433 |  */
  434 | async function applyAndCheck(R, s, caseId, type, name, G, tag) {
  435 |   const pol = findPolicy(name);
  436 |   const fp = tag ? tag.replace(/：$/, '') + '-' : ''; // 证据文件名前缀：「换成白2：」→「换成白2-」
  437 |   const mark = term.logMark('t18');
  438 |   await test.step(tag + '页面：应用到测试组', async () => {
  439 |     const r = await ops.applyListToGroups(s.page, type, name, [env.names.group]);
  440 |     ev.save(caseId, fp + 'apply.json', r);
  441 |     let ids = [];
  442 |     (r.resp.params.aObjId || []).forEach((v) => { try { ids = ids.concat(JSON.parse(v)); } catch (e) { ids.push(v); } });
  443 |     R.seg(tag + '应用到组提交只含测试组', ops.ok(r.resp) && ids.map(String).join() === G ? 'PASS' : 'FAIL', '提交组号 ' + ids.join(',') + '；树上勾选 ' + r.checked.join(',') + '；接口 ' + JSON.stringify(r.resp.json).slice(0, 120));
  444 |   });
  445 |   const ptype = type === 'black' ? '3' : '2';
  446 |   const w = await until('测试组名单关联只剩 ' + name, () => groupLinks(G).filter((x) => x[3] === '2' || x[3] === '3'),
  447 |     (x) => x.length === 1 && x[0][1] === pol.pid, { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
  448 |   const links = groupLinks(G);
  449 |   ev.save(caseId, fp + 'links.json', links);
  450 |   R.seg(tag + '测试组上的名单关联只剩它', w.ok ? 'PASS' : 'FAIL', links.map((x) => x[1] + '(' + x[2] + ',type' + x[3] + ')').join('；'));
  451 |   const gi = groupListItem(G);
  452 |   ev.save(caseId, fp + 'pgl-list-item.json', gi);
  453 |   const u = gi && gi.userlibs;
  454 |   const want = { type: type === 'black' ? '2' : '1', dpath: type === 'black' ? 'ruc/libs/b/u' : 'ruc/libs/w/u' };
  455 |   const centerA = center.libFiles(type === 'black' ? 'b/u' : 'w/u', pol.pguid).find((f) => f.file === pol.pguid + '_aarch64.zip');
  456 |   const uA = u && (u.lib || []).find((l) => l.arch === 'aarch64');
  457 |   R.seg(tag + 'pgl 名单项指向它', gi && gi.policytype === ptype && u && u.type === want.type && u.dpath === want.dpath && u.name === pol.pguid &&
  458 |     uA && centerA && String(uA.md5).toUpperCase() === centerA.md5 ? 'PASS' : 'FAIL',
  459 |     gi ? 'policytype=' + gi.policytype + ' type=' + (u && u.type) + ' dpath=' + (u && u.dpath) + ' name=' + (u && u.name) + ' aarch64=' + (uA && uA.md5) + ' 中心文件=' + (centerA && centerA.md5) : '没有名单项');
  460 |   const items = center.procmItems(G) || [];
  461 |   R.seg(tag + 'pgl 里只有一个名单项', items.filter((i) => i.policytype === '2' || i.policytype === '3').length === 1 ? 'PASS' : 'FAIL', items.map((i) => 'type' + i.policytype).join(','));
  462 | 
  463 |   // 终端：收到名单变化、下载对应 zip
  464 |   const t0 = Date.now();
  465 |   const tw = await until('13.18 pwdata 有 ' + name + ' 的 zip 且 md5 一致', () => pwZip(pol.pguid), (x) => x && centerA && x.md5 === centerA.md5,
  466 |     { timeoutMs: LIMIT.centerToTerminal + LIMIT.libDownload, intervalMs: 15000 });
  467 |   ev.save(caseId, fp + 'pwdata.json', term.listFiles('t18', 'pwdata'));
  468 |   R.seg(tag + '终端下载 zip 且 md5 一致', tw.ok ? 'PASS' : 'TIMEOUT', tw.ok ? tw.value.file + '；用时 ' + Math.round((Date.now() - t0) / 1000) + ' 秒' : JSON.stringify(tw.last));
  469 |   const pt = ptfileMatches(G);
  470 |   ev.save(caseId, fp + 'ptfile-vs-pgl.json', pt);
  471 |   R.seg(tag + 'ptfile 与测试组 pgl 一致', pt.ok ? 'PASS' : 'FAIL', 'want ' + pt.want + ' / have ' + pt.have);
  472 |   const log = term.logSince('t18', mark, /OnMscPolicyChange|QueryPolicy|userlibs|\.zip|download/i);
  473 |   ev.save(caseId, fp + 'rss-log.txt', log.lines.join('\n'));
  474 |   R.seg(tag + '终端日志有 type="' + ptype + '" delete="0"', log.lines.some((l) => l.indexOf('type="' + ptype + '"') >= 0 && l.indexOf('delete="0"') >= 0) ? 'PASS' : 'FAIL', log.lines.length + ' 行');
  475 |   return { ok: w.ok && tw.ok };
  476 | }
  477 | 
  478 | test('E-4 建白名单并发布', async () => {
  479 |   const R = recorder('E-4');
  480 |   if (!P.load().groupId) throw new Error('没有测试组，先跑 E-1');
  481 |   const s = await open();
  482 |   try {
  483 |     const r = await ensurePublishedList(R, s, 'E-4', 'white', env.names.white, 'pl05-learn');
  484 |     if (r.pol) {
  485 |       const txt = await listRowText(s.page, 'white', env.names.white);
  486 |       await s.page.screenshot({ path: ev.dir('E-4') + '/list-page.png' });
  487 |       R.seg('名单页显示已发布', txt.indexOf('已发布') >= 0 ? 'PASS' : 'FAIL', txt.slice(0, 200));
  488 |     }
  489 |     colleague(R, 'E-4');
  490 |     R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  491 |   } finally {
  492 |     await s.close('E-4');
  493 |   }
  494 |   expect(R.finish(), 'E-4 结论').not.toBe('FAIL');
  495 | });
  496 | 
  497 | test('E-5 白名单下发', async () => {
  498 |   const R = recorder('E-5');
  499 |   const G = P.load().groupId;
  500 |   const pol = findPolicy(env.names.white);
  501 |   if (!G || !pol || pol.status !== '4') throw new Error('白名单没发布，先跑 E-4');
  502 |   P.addPid(pol.pid, env.names.white);
  503 |   const s = await open();
  504 |   try {
  505 |     R.seg('应用前测试组关联（只记录）', 'RECORD', groupLinks(G).map((x) => x[1] + '(' + x[2] + ')').join('；'));
  506 |     await applyAndCheck(R, s, 'E-5', 'white', env.names.white, G, '');
  507 |     const txt = await listRowText(s.page, 'white', env.names.white);
  508 |     await s.page.screenshot({ path: ev.dir('E-5') + '/list-page.png' });
  509 |     R.seg('名单页应用范围显示组【 1 】', /组【\s*1\s*】/.test(txt) ? 'PASS' : 'FAIL', txt.slice(0, 200));
  510 |     colleague(R, 'E-5');
  511 |     R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  512 |   } finally {
  513 |     await s.close('E-5');
  514 |   }
> 515 |   expect(R.finish(), 'E-5 结论').not.toBe('FAIL');
      |                                    ^ Error: E-5 结论
  516 | });
  517 | 
  518 | test('E-5b 白名单换白名单', async () => {
  519 |   const R = recorder('E-5b');
  520 |   const G = P.load().groupId;
  521 |   const w1 = findPolicy(env.names.white);
  522 |   if (!G || !w1 || w1.status !== '4') throw new Error('白名单没发布，先跑 E-4、E-5');
  523 |   P.addPid(w1.pid, env.names.white);
  524 |   const s = await open();
  525 |   try {
  526 |     const r = await ensurePublishedList(R, s, 'E-5b', 'white', env.names.white2, 'pl05-learn');
  527 |     if (!r.pol) return;
  528 |     await applyAndCheck(R, s, 'E-5b', 'white', env.names.white2, G, '换成白2：');
  529 |     const t1 = await listRowText(s.page, 'white', env.names.white);
  530 |     const t2 = await listRowText(s.page, 'white', env.names.white2);
  531 |     R.seg('换成白2：两个名单的应用范围', /---/.test(t1) && /组【\s*1\s*】/.test(t2) ? 'PASS' : 'FAIL', '白：' + t1.slice(0, 120) + ' ｜ 白2：' + t2.slice(0, 120));
  532 |     await applyAndCheck(R, s, 'E-5b', 'white', env.names.white, G, '换回白：');
  533 |     const u1 = await listRowText(s.page, 'white', env.names.white);
  534 |     const u2 = await listRowText(s.page, 'white', env.names.white2);
  535 |     await s.page.screenshot({ path: ev.dir('E-5b') + '/list-page.png' });
  536 |     R.seg('换回白：两个名单的应用范围', /组【\s*1\s*】/.test(u1) && /---/.test(u2) ? 'PASS' : 'FAIL', '白：' + u1.slice(0, 120) + ' ｜ 白2：' + u2.slice(0, 120));
  537 |     colleague(R, 'E-5b');
  538 |     R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  539 |   } finally {
  540 |     await s.close('E-5b');
  541 |   }
  542 |   expect(R.finish(), 'E-5b 结论').not.toBe('FAIL');
  543 | });
  544 | 
  545 | /** 日志页返回的行里属于 13.18 的（按整行 JSON 里有没有 13.18 的 IP 判断，不依赖字段名） */
  546 | function rowsOf18(rows) { return rows.filter((r) => JSON.stringify(r).indexOf('"' + env.t18.host + '"') >= 0); }
  547 | 
  548 | test('E-6 审计·白名单', async () => {
  549 |   const R = recorder('E-6');
  550 |   const G = P.load().groupId;
  551 |   const pol = findPolicy(env.names.policy);
  552 |   const wl = findPolicy(env.names.white);
  553 |   if (!G || !pol || !wl) throw new Error('缺测试组 / 测试策略 / 白名单，先跑 E-1～E-5');
  554 |   P.addPid(pol.pid, env.names.policy);
  555 |   const prog = programs();
  556 |   const learn = prog['pl05-learn'].path;
  557 |   const unknown = prog['pl05-unknown'].path;
  558 |   const s = await open();
  559 |   try {
  560 |     const links = groupLinks(G);
  561 |     R.seg('测试组当前关联（只记录）', 'RECORD', links.map((x) => x[1] + '(' + x[2] + ')').join('；'));
  562 |     if (!links.some((x) => x[1] === wl.pid)) R.seg('前提：测试组用的是 PL05测试-白', 'FAIL', '测试组上没有白名单关联');
  563 |     const mark = term.logMark('t18');
  564 |     await test.step('页面：策略页改审计模式并应用', async () => {
  565 |       const gp0 = groupProcPolicy(G);
  566 |       if (gp0 && gp0.auditmode === '2') { R.seg('改审计', 'RECORD', '已是审计（重跑）'); return; }
  567 |       const r = await ops.setAuditMode(s.page, G, '2');
  568 |       ev.save('E-6', 'edit-policy.json', r);
  569 |       R.seg('改审计（editPolicy 提交的是测试策略）', ops.ok(r) && (r.params.pid || [])[0] === pol.pid ? 'PASS' : 'FAIL', 'pid=' + (r.params.pid || []).join(',') + '；接口 ' + JSON.stringify(r.json).slice(0, 120));
  570 |     });
  571 |     const w = await until('pgl 进程策略 auditmode=2', () => groupProcPolicy(G), (x) => x && x.auditmode === '2', { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
  572 |     const gp = w.value || w.last;
  573 |     ev.save('E-6', 'pgl-proc-policy.json', gp);
  574 |     R.seg('pgl_<测试组> 进程策略 auditmode=2', w.ok ? 'PASS' : 'FAIL', gp ? 'auditmode=' + gp.auditmode + ' uptimer=' + gp.uptimer + ' notify=' + gp.notify + ' ver=' + gp.ver : '没有进程策略项');
  575 |     const t0 = Date.now();
  576 |     const tw = await until('13.18 ptfile 与测试组一致', () => ptfileMatches(G), (x) => x.ok, { timeoutMs: LIMIT.centerToTerminal, intervalMs: 15000 });
  577 |     ev.save('E-6', 'ptfile-vs-pgl.json', tw.value || tw.last);
  578 |     R.seg('终端收到审计策略', tw.ok ? 'PASS' : 'TIMEOUT', tw.ok ? '用时 ' + Math.round((Date.now() - t0) / 1000) + ' 秒' : JSON.stringify(tw.last).slice(0, 300));
  579 |     ev.save('E-6', 'rss-log-policy.txt', term.logSince('t18', mark, /OnMscPolicyChange|QueryPolicy/).lines.join('\n'));
  580 | 
  581 |     // 终端执行：白名单里的 pl05-learn 不该出日志，不在名单的 pl05-unknown 该出「不在白名单」
  582 |     const ts = term.now('t18');
  583 |     const runs = ['pl05-learn', 'pl05-unknown'].map((n) => Object.assign({ name: n }, term.runProgram(n, 2)));
  584 |     ev.save('E-6', 'runs.json', runs);
  585 |     R.seg('两个程序都能运行（审计不拦）', runs.every((r) => r.code === 0) ? 'PASS' : 'FAIL', runs.map((r) => r.name + ' rc=' + r.code).join('，'));
  586 |     const up = parseInt(gp && gp.uptimer, 10) || 60;
  587 |     const aw = await until('pl05-unknown 审计日志入库', () => auditRows(unknown, ts), (x) => x.length > 0, { timeoutMs: LIMIT.upload(up), intervalMs: 10000 });
  588 |     await new Promise((r) => setTimeout(r, 60000)); // unknown 到了以后再等 1 分钟，给 learn 万一有的日志留时间
  589 |     const u = auditRows(unknown, ts);
  590 |     const l = auditRows(learn, ts);
  591 |     ev.save('E-6', 'audit-rows.json', { since: ts, unknown: u, learn: l });
  592 |     R.seg('pl05-unknown 有日志：PROCACTION=0、ACTIONREASON=2', u.length && u.every((x) => x[5] === '0' && x[4] === '2') ? 'PASS' : (aw.ok ? 'FAIL' : 'TIMEOUT'),
  593 |       u.length + ' 条，ACTIONREASON=' + u.map((x) => x[4]).join('/') + '，PROCACTION=' + u.map((x) => x[5]).join('/') + '；入库用时 ' + Math.round(aw.ms / 1000) + ' 秒');
  594 |     if (u[0]) R.seg('日志哈希 = 13.18 上算的', String(u[0][6]).toLowerCase() === prog['pl05-unknown'].md5 ? 'PASS' : 'FAIL', u[0][6] + ' ALGO=' + u[0][7]);
  595 |     R.seg('pl05-learn（在白名单）没有日志', l.length === 0 ? 'PASS' : 'FAIL', l.length + ' 条');
  596 | 
  597 |     await test.step('页面：日志页按路径筛', async () => {
  598 |       const su = await ops.searchLog(s.page, G, 'procpath', unknown);
  599 |       ev.save('E-6', 'log-page-unknown.json', su);
  600 |       await s.page.screenshot({ path: ev.dir('E-6') + '/log-page-unknown.png' });
  601 |       R.seg('日志页筛得到 pl05-unknown（13.18）', rowsOf18(su.rows).length ? 'PASS' : 'FAIL', '共 ' + su.rows.length + ' 行，13.18 的 ' + rowsOf18(su.rows).length + ' 行');
  602 |       const sl = await ops.searchLog(s.page, G, 'procpath', learn);
  603 |       ev.save('E-6', 'log-page-learn.json', sl);
  604 |       const allLearn = auditRows(learn, 0).length; // 库里 13.18 这个路径的全部审计日志（本轮之前也算）
  605 |       R.seg('日志页筛不到 pl05-learn（13.18）', rowsOf18(sl.rows).length === 0 ? 'PASS' : (rowsOf18(sl.rows).length === allLearn && l.length === 0 ? 'RECORD' : 'FAIL'),
  606 |         '页面 13.18 的 ' + rowsOf18(sl.rows).length + ' 行；库里全部 ' + allLearn + ' 条、本轮 ' + l.length + ' 条');
  607 |     });
  608 |     await new Promise((r) => setTimeout(r, 20000));
  609 |     const st = epstate18();
  610 |     ev.save('E-6', 'epstate.json', st);
  611 |     R.seg('EPSTATE procaudit（只记录，设计 5.7 期望审计+白名单=2）', 'RECORD', st.map((r) => r[0] + '=' + r[1] + '@' + r[2]).join('，'));
  612 |     colleague(R, 'E-6');
  613 |     R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  614 |   } finally {
  615 |     await s.close('E-6');
```