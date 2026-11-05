/**
 * 用例公共辅助：查库 / Redis / 终端的探针组合、名单建 / 发布 / 应用并逐层核对的流程、同事数据检查。
 * 10-white、20-black、90-restore 共用；只做「查」和「在页面上点」，所有写请求仍经过 page.js 护栏。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');
const env = require('./env');
const center = require('./center');
const term = require('./terminal');
const ev = require('./evidence');
const P = require('./page');
const ops = require('./ops');
const base = require('./baseline');
const { until, LIMIT } = require('./wait');

/** 测试组：按名字查 GROUPINFO，返回 { id, parent, inherit } 或 null */
function findGroup() {
  const r = center.sql("SELECT ID, PARENTID, ISINHERIT FROM GROUPINFO WHERE GROUPNAME='" + env.names.group + "'");
  return r.length ? { id: r[0][0], parent: r[0][1], inherit: r[0][2] } : null;
}
/** 某组上的全部策略关联（只看进程管控产品的策略） */
function groupLinks(gid) {
  return center.sql("SELECT po.POID, po.PID, p.PNAME, p.POLICYTYPE FROM POLICYOBJECT po JOIN POLICY p ON p.PID=po.PID " +
    "WHERE po.OBJTYPE=1 AND po.OBJID='" + gid + "' AND UPPER(p.PRODUCTID) LIKE '" + env.procmGuid + "%' ORDER BY po.PID");
}
function ep18() {
  const r = center.sql("SELECT GROUPID, PSTAMP, ONLINESTATE FROM EPINFO WHERE SGUID='" + env.t18.sguid + "'")[0];
  return { group: r[0], pstamp: r[1], online: r[2] };
}
/** 终端 ptfile 里进程管控文件的 md5 集合是否等于中心 pgl_<组> 进程管控项的 md5 集合 */
function ptfileMatches(gid) {
  const items = center.procmItems(gid) || [];
  const files = term.listFiles('t18', 'ptfile');
  const want = items.map((i) => i.md5).sort().join(',');
  const have = files.map((f) => f.md5).sort().join(',');
  return { ok: want.length > 0 && want === have, want, have, files, items: items.map((i) => ({ policytype: i.policytype, policyver: i.policyver, md5: i.md5 })) };
}
function colleague(R, caseId) {
  const b = base.check();
  ev.save(caseId, 'colleague-check.json', b);
  R.seg('同事数据没变', b.ok ? 'PASS' : 'FAIL', b.notes.join('；'));
  // 13.220 只读快照：和 TK-0 基线一样记 PASS；变了只记录（可能是同事改了它的组），并注明是否和它自己组的下发一致
  let t;
  try { t = base.t220(); } catch (e) { t = { err: String(e).slice(0, 200) }; }
  ev.save(caseId, 't220-snapshot.json', t);
  R.seg('13.220 ptfile、PSTAMP 和基线一致', t.err ? 'RECORD' : (t.same ? 'PASS' : 'RECORD'),
    t.err ? '读取失败：' + t.err : (t.same ? 'PSTAMP=' + t.now.pstamp : '有变化：PSTAMP ' + t.base.pstamp + ' → ' + t.now.pstamp + '，和它所在组 ' + t.now.group + ' 的下发' + (t.matchesGroup ? '一致' : '不一致')));
}

/**
 * 本轮测试程序：第一次调用时在 13.18 准备全部 5 个（复制 sleep + 末尾追加用途和轮次），
 * 哈希存进本轮 programs.json，之后的用例直接读，保证同一轮里同一个程序哈希不变。
 */
function programs() {
  const f = path.join(ev.ROOT, ev.round(), 'programs.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { /* 还没准备 */ }
  const r = term.prepPrograms(ev.round(), ['pl05-learn', 'pl05-probe', 'pl05-unknown', 'pl05-black', 'pl05-normal']);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(r, null, 2));
  return r;
}
/** 13.18 某路径在 since（终端 unix 秒）之后的审计日志 */
function auditRows(procPath, since) {
  return center.sql("SELECT ID, TIME, LOGEDATE, PROCPATH, ACTIONREASON, PROCACTION, FILEHASH, ALGO FROM RPW_PROCESSAUDITINFO " +
    "WHERE SGUID='" + env.t18.sguid + "' AND PROCPATH='" + procPath + "' AND LOGEDATE>=" + since + ' ORDER BY ID');
}
function epstate18() {
  return center.sql("SELECT EPKEY, VALUE, INSERTTIME FROM EPSTATE WHERE SGUID='" + env.t18.sguid + "' AND EPKEY IN ('procaudit','procdef')");
}
/** 当前组 pgl_ 里进程策略项的 uptimer（取不到按 60） */
function uptimerOf(gid) {
  const it = (center.procmItems(gid) || []).find((i) => i.policytype === '1');
  const v = it && parseInt(center.tag(it.xml, 'uptimer'), 10);
  return v > 0 ? v : 60;
}

/** 按名字查自建策略 / 名单：{ pid, pguid, status, ver } 或 null */
function findPolicy(name) {
  const r = center.sql("SELECT PID, PGUID, STATUS, POLICYVER, UPDATETIME FROM POLICY WHERE PNAME='" + name + "'");
  return r.length ? { pid: r[0][0], pguid: r[0][1], status: r[0][2], ver: r[0][3], updated: r[0][4] } : null;
}
/** 测试组 pgl_ 里的进程策略项（policytype=1）解出来的关键字段 */
function groupProcPolicy(gid) {
  const it = (center.procmItems(gid) || []).find((i) => i.policytype === '1');
  if (!it) return null;
  return { ver: it.policyver, md5: it.md5, enable: center.tag(it.xml, 'enable'), auditmode: center.tag(it.xml, 'auditmode'),
    uptimer: center.tag(it.xml, 'uptimer'), notify: center.tag(it.xml, 'notify'), xml: it.xml };
}

/** 13.18 某路径的学习采集记录（RPW_EXECFILEINFO） */
function execRows(procPath) {
  return center.sql("SELECT ID, TIME, LOGEDATE, PROCPATH, FILEHASH, ALGO FROM RPW_EXECFILEINFO WHERE SGUID='" + env.t18.sguid + "' AND PROCPATH='" + procPath + "' ORDER BY ID");
}

// ---------------------------------------------------------------------------
// 名单（E-4 起）
// ---------------------------------------------------------------------------

/** 名单里的进程行：[PROCPATH, FILEHASH, ALGO, STATUS]（白名单查 RPW_WPROC，黑名单查 RPW_BPROC；BWID 即名单 PID） */
function listProcs(type, pid) {
  const t = type === 'black' ? 'RPW_BPROC' : 'RPW_WPROC';
  return center.sql('SELECT PROCPATH, FILEHASH, ALGO, STATUS FROM ' + t + " WHERE BWID='" + pid + "' ORDER BY ID");
}
/** 名单 POLICYJSON 解出来的 userlibs（{type,dpath,version,name,lib:[{md5,arch}]}）；没发布过返回 null */
function listLibs(pid) {
  const raw = (center.sql("SELECT POLICYJSON FROM POLICY WHERE PID='" + pid + "'")[0] || [])[0];
  try {
    const it = JSON.parse(raw)[0];
    return JSON.parse(Buffer.from(it.policymaincontent, 'base64').toString('utf8')).root.procaudit.userlibs;
  } catch (e) { return null; }
}
/**
 * 解名单报文里的 userlibs：Redis 里是 XML（<userlibs><type>…<lib><md5/><arch/></lib>…），
 * 库里 POLICYJSON 解出来是 JSON；两种都认，解不出返回 null。
 */
function parseUserlibs(text) {
  try { return JSON.parse(text).root.procaudit.userlibs; } catch (e) { /* 不是 JSON，按 XML 解 */ }
  const m = /<userlibs>([\s\S]*)<\/userlibs>/.exec(text || '');
  if (!m) return null;
  const u = {};
  ['type', 'dpath', 'version', 'platform', 'name'].forEach((k) => { u[k] = center.tag(m[1], k); });
  u.lib = [];
  const re = /<lib>\s*<md5>([^<]*)<\/md5>\s*<arch>([^<]*)<\/arch>\s*<\/lib>/g;
  let x;
  while ((x = re.exec(m[1]))) u.lib.push({ md5: x[1], arch: x[2] });
  return u;
}
/** 测试组 pgl_ 里的名单项（policytype 2 白 / 3 黑），解出 userlibs；原文一并返回供存证 */
function groupListItem(gid) {
  const it = (center.procmItems(gid) || []).find((i) => i.policytype === '2' || i.policytype === '3');
  if (!it) return null;
  return { policytype: it.policytype, ver: it.policyver, userlibs: parseUserlibs(it.xml), raw: it.xml };
}
/** 6 个 zip 的 md5 是否和 POLICYJSON 里的一致：返回 { ok, files, libs } */
function zipsMatch(dir, pguid, libs) {
  const files = center.libFiles(dir, pguid);
  const want = (libs && libs.lib || []).map((l) => pguid + '_' + l.arch + '.zip=' + String(l.md5).toUpperCase()).sort();
  const have = files.map((f) => f.file + '=' + f.md5).sort();
  return { ok: want.length === 6 && want.join() === have.join(), want, have };
}
/** 13.18 pwdata 里某名单的 aarch64 zip：{ file, md5 } 或 null（md5 转大写好和报文比） */
function pwZip(pguid) {
  const f = term.listFiles('t18', 'pwdata').find((x) => x.file.indexOf(pguid + '_aarch64.zip') >= 0);
  return f ? { file: f.file, md5: f.md5.toUpperCase(), mtime: f.mtime } : null;
}
/** 名单页里某名单那一行的文字（找不到返回空串） */
async function listRowText(page, type, name) {
  await P.openHash(page, ops.listHash(type));
  const row = ops.listRow(page, name); // 按名字精确匹配，不会把「白」匹配成「白2」
  await row.waitFor({ timeout: 30000 }).catch(() => {});
  return (await row.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
}

/**
 * 建名单并发布：名单不存在就建、登记给护栏；名单里没有 procName 这个测试程序就加进去——
 * 默认从进程管理页勾选加入（被拦记 FAIL，不自动换路径），how='manual' 时在名单进程视图手工录入路径 + MD5；
 * 有未发布的改动就发布。返回 { pol, procs, libs }。caseId 用来存证。
 */
async function ensurePublishedList(R, s, caseId, type, name, procName, how) {
  let pol = findPolicy(name);
  await test.step('页面：名单页新建 ' + name, async () => {
    if (pol) { P.addPid(pol.pid, name); R.seg('新建名单', 'RECORD', '已存在（重跑），PID ' + pol.pid); return; }
    const r = await ops.createList(s.page, type, name);
    ev.save(caseId, 'create-list.json', r);
    const w = await until('POLICY 出现 ' + name, () => findPolicy(name), (x) => !!x, { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
    pol = w.value;
    if (pol) P.addPid(pol.pid, name); // 登记给护栏：之后加进程、发布、应用到组才放行
    R.seg('新建名单', ops.ok(r) && pol ? 'PASS' : 'FAIL', pol ? 'PID ' + pol.pid + '，STATUS=' + pol.status : JSON.stringify(r.json));
  });
  if (!pol) return { pol: null };

  const prog = programs()[procName];
  await test.step('页面：把 ' + procName + ' 加进名单', async () => {
    if (listProcs(type, pol.pid).some((r) => r[0] === prog.path)) { R.seg('加进程', 'RECORD', '名单里已有（重跑）'); return; }
    // how='manual'：在名单进程视图手工录入路径 + 哈希（程序没被学习采集过时用）；默认从进程管理页勾选加入
    let r;
    try {
      r = how === 'manual' ? await ops.addProcManual(s.page, type, name, prog.path, prog.md5)
        : await ops.addProcFromMana(s.page, prog.path, type, name);
    } catch (e) { r = { err: String(e) }; }
    ev.save(caseId, 'add-proc.json', r);
    const w = await until('名单进程表出现这一行', () => listProcs(type, pol.pid), (x) => x.some((row) => row[0] === prog.path), { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
    const row = (w.value || w.last || []).find((x) => x[0] === prog.path);
    R.seg(how === 'manual' ? '名单进程视图手工添加' : '进程管理页加进名单', !r.err && ops.ok(r) && row ? 'PASS' : 'FAIL', row ? '进程行 STATUS=' + row[3] + ' 哈希=' + row[1] + ' ALGO=' + row[2] : (r.err || JSON.stringify(r.json)).slice(0, 300));
    if (row) R.seg('名单里的哈希 = 13.18 上算的', [prog.md5, prog.sha256].indexOf(String(row[1]).toLowerCase()) >= 0 ? 'PASS' : 'FAIL', row[1]);
  });

  await test.step('页面：名单进程视图能看到', async () => {
    await ops.listOp(s.page, type, name, 'proc');
    const pane = s.page.locator('.js_procm_procpane');
    await s.page.waitForTimeout(2500);
    const txt = (await pane.innerText().catch(() => '')).replace(/\s+/g, ' ');
    await s.page.screenshot({ path: ev.dir(caseId) + '/list-proc.png' });
    R.seg('名单进程视图显示 ' + procName, txt.indexOf(procName) >= 0 ? 'PASS' : 'FAIL', txt.slice(0, 200));
  });

  await test.step('页面：名单页发布', async () => {
    pol = findPolicy(name);
    if (pol.status === '4' && listProcs(type, pol.pid).every((x) => x[3] === '0')) { R.seg('发布', 'RECORD', '已是已发布且无改动（重跑）'); return; }
    const r = await ops.publishList(s.page, type, name);
    ev.save(caseId, 'publish.json', r);
    const w = await until('STATUS 变 4', () => findPolicy(name), (x) => x.status === '4', { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
    pol = w.value || w.last;
    R.seg('发布后 POLICY.STATUS=4（已发布）', ops.ok(r) && w.ok ? 'PASS' : 'FAIL', 'STATUS=' + pol.status + ' POLICYVER=' + pol.ver + '；接口 ' + JSON.stringify(r.json).slice(0, 120));
  });
  const procs = listProcs(type, pol.pid);
  ev.save(caseId, 'list-procs.json', procs);
  R.seg('发布后进程行 STATUS=0（已确认）', procs.length && procs.every((x) => x[3] === '0') ? 'PASS' : 'FAIL', procs.map((x) => x[0] + ' STATUS=' + x[3]).join('；'));
  const libs = listLibs(pol.pid);
  ev.save(caseId, 'policyjson-userlibs.json', libs);
  const z = zipsMatch(type === 'black' ? 'b/u' : 'w/u', pol.pguid, libs);
  ev.save(caseId, 'zips.json', z);
  R.seg('中心 6 个 zip 的 md5 = POLICYJSON', z.ok ? 'PASS' : 'FAIL', '文件 ' + z.have.length + ' 个；version=' + (libs && libs.version));
  return { pol, procs, libs };
}

/**
 * 名单页把名单应用到测试组（只勾这一个），核提交参数，等库里测试组的名单关联换成它、Redis 名单项换成它、
 * 终端下载对应 zip。返回 { ok }。
 */
async function applyAndCheck(R, s, caseId, type, name, G, tag) {
  const pol = findPolicy(name);
  const fp = tag ? tag.replace(/：$/, '') + '-' : ''; // 证据文件名前缀：「换成白2：」→「换成白2-」
  const mark = term.logMark('t18');
  await test.step(tag + '页面：应用到测试组', async () => {
    const r = await ops.applyListToGroups(s.page, type, name, [env.names.group]);
    ev.save(caseId, fp + 'apply.json', r);
    let ids = [];
    (r.resp.params.aObjId || []).forEach((v) => { try { ids = ids.concat(JSON.parse(v)); } catch (e) { ids.push(v); } });
    R.seg(tag + '应用到组提交只含测试组', ops.ok(r.resp) && ids.map(String).join() === G ? 'PASS' : 'FAIL', '提交组号 ' + ids.join(',') + '；树上勾选 ' + r.checked.join(',') + '；接口 ' + JSON.stringify(r.resp.json).slice(0, 120));
  });
  // Redis 名单项和终端日志里的 policytype：按设计 P9 ①，白、黑名单都是 "2"，黑白靠 <userlibs><type> 区分（1 白 / 2 黑）。
  // 注意和库里 POLICY.POLICYTYPE（页面编号：白 2、黑 3）不是一套编号，下面查组关联仍按 2 / 3。
  const ptype = '2';
  const w = await until('测试组名单关联只剩 ' + name, () => groupLinks(G).filter((x) => x[3] === '2' || x[3] === '3'),
    (x) => x.length === 1 && x[0][1] === pol.pid, { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
  const links = groupLinks(G);
  ev.save(caseId, fp + 'links.json', links);
  R.seg(tag + '测试组上的名单关联只剩它', w.ok ? 'PASS' : 'FAIL', links.map((x) => x[1] + '(' + x[2] + ',type' + x[3] + ')').join('；'));
  const gi = groupListItem(G);
  ev.save(caseId, fp + 'pgl-list-item.json', gi);
  const u = gi && gi.userlibs;
  const want = { type: type === 'black' ? '2' : '1', dpath: type === 'black' ? 'ruc/libs/b/u' : 'ruc/libs/w/u' };
  const centerA = center.libFiles(type === 'black' ? 'b/u' : 'w/u', pol.pguid).find((f) => f.file === pol.pguid + '_aarch64.zip');
  const uA = u && (u.lib || []).find((l) => l.arch === 'aarch64');
  R.seg(tag + 'pgl 名单项指向它', gi && gi.policytype === ptype && u && u.type === want.type && u.dpath === want.dpath && u.name === pol.pguid &&
    uA && centerA && String(uA.md5).toUpperCase() === centerA.md5 ? 'PASS' : 'FAIL',
    gi ? 'policytype=' + gi.policytype + ' type=' + (u && u.type) + ' dpath=' + (u && u.dpath) + ' name=' + (u && u.name) + ' aarch64=' + (uA && uA.md5) + ' 中心文件=' + (centerA && centerA.md5) : '没有名单项');
  const items = center.procmItems(G) || [];
  R.seg(tag + 'pgl 里只有一个名单项', items.filter((i) => i.policytype === '2' || i.policytype === '3').length === 1 ? 'PASS' : 'FAIL', items.map((i) => 'type' + i.policytype).join(','));

  // 终端：先等 ptfile 和中心一致（终端真正收到了这次变化），再看 zip。
  // 不能只看 pwdata 里有没有这个 zip：换回之前用过的名单时，旧 zip 还留在终端上，会被误判成「已下载」。
  const t0 = Date.now();
  const applyAt = term.now('t18') - 5; // 用终端自己的时钟和 zip 的 mtime 比，避免两边时钟偏差；留 5 秒余量
  const zipBefore = pwZip(pol.pguid);
  const pw = await until('13.18 ptfile 与测试组 pgl 一致', () => ptfileMatches(G), (x) => x.ok, { timeoutMs: LIMIT.centerToTerminal, intervalMs: 15000 });
  ev.save(caseId, fp + 'ptfile-vs-pgl.json', pw.value || pw.last);
  R.seg(tag + 'ptfile 与测试组 pgl 一致（终端收到）', pw.ok ? 'PASS' : 'TIMEOUT', pw.ok ? '用时 ' + Math.round((Date.now() - t0) / 1000) + ' 秒' : 'want ' + (pw.last || {}).want + ' / have ' + (pw.last || {}).have);
  const tw = await until('13.18 pwdata 有 ' + name + ' 的 zip 且 md5 一致', () => pwZip(pol.pguid), (x) => x && centerA && x.md5 === centerA.md5,
    { timeoutMs: LIMIT.libDownload, intervalMs: 10000 });
  ev.save(caseId, fp + 'pwdata.json', { before: zipBefore, files: term.listFiles('t18', 'pwdata') });
  const z = tw.value;
  const fresh = z && z.mtime >= applyAt;
  R.seg(tag + '终端有这个名单的 zip 且 md5 一致', tw.ok ? 'PASS' : 'TIMEOUT', tw.ok ? z.file + (fresh ? '（本次下载）' : '（终端原来就有，未重新下载；文件时间 ' + new Date(z.mtime * 1000).toISOString() + '）') + '；收到后共用时 ' + Math.round((Date.now() - t0) / 1000) + ' 秒' : JSON.stringify(tw.last));
  const log = term.logSince('t18', mark, /OnMscPolicyChange|QueryPolicy|userlibs|\.zip|download/i);
  ev.save(caseId, fp + 'rss-log.txt', log.lines.join('\n'));
  R.seg(tag + '终端日志有 type="' + ptype + '" delete="0"', log.lines.some((l) => l.indexOf('type="' + ptype + '"') >= 0 && l.indexOf('delete="0"') >= 0) ? 'PASS' : 'FAIL', log.lines.length + ' 行');
  return { ok: w.ok && pw.ok && tw.ok };
}

/** 日志页返回的行里属于 13.18 的（按整行 JSON 里有没有 13.18 的 IP 判断，不依赖字段名） */
function rowsOf18(rows) { return rows.filter((r) => JSON.stringify(r).indexOf('"' + env.t18.host + '"') >= 0); }

module.exports = { findGroup, groupLinks, ep18, ptfileMatches, colleague, programs, auditRows, epstate18, uptimerOf, findPolicy, groupProcPolicy, execRows, listProcs, listLibs, parseUserlibs, groupListItem, zipsMatch, pwZip, listRowText, ensurePublishedList, applyAndCheck, rowsOf18 };
