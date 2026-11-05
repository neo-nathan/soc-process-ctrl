/**
 * 问题 A、B 最小复现（给终端开发的证据）。和 E-1～E-12 不同：
 *   - 全新名单、全新测试程序，A 和 B 分开测，互不干扰：
 *       R-1 准备：建白名单（含 rp-w-in）、黑名单（含 rp-b-in），都只发布一次；建测试组、不继承、挂白名单、移入 13.18；
 *       R-2 问题 B·白：审计模式下运行白名单里的 rp-w-in 和名单外的 rp-w-out；
 *       R-3 问题 A：给已下发的白名单再加 rp-a-new、再发布，看终端是否下载新 zip；
 *       R-4 问题 B·黑：组换成黑名单，运行黑名单里的 rp-b-in 和名单外的 rp-b-out。
 *   - 名单哈希手工录入 MD5（ALGO=0），不走学习采集；页面录入后存库为小写。
 *   - 进程策略用组从根管理组照抄来的默认策略（审计、uptimer=70），不新建策略（避开问题 C）。
 *   - 每一步都把终端完整日志段（按时间截取，含轮转文件）、pwdata 文件和 md5、procwlu.lib、
 *     名单 zip 解开后的 json、中心 Redis 名单项、审计日志库行存进 implement/PL-05/<轮次>/<用例>/。
 *   - 跑完不还原（保留现场给终端开发看）；还原另用 90-restore 或手工。
 * 写操作只走页面并经过 page.js 护栏；中心只读查库 / Redis；终端只在 13.18 的 /tmp/pl05/ 放程序。
 * 运行：PL05_ROUND=<轮次> npx playwright test specs/50-repro-ab.spec.js -g R-1（逐条跑）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const env = require('../lib/env');
const center = require('../lib/center');
const term = require('../lib/terminal');
const ssh = require('../lib/ssh');
const ev = require('../lib/evidence');
const P = require('../lib/page');
const ops = require('../lib/ops');
const { until, LIMIT } = require('../lib/wait');
const { open, recorder } = require('../lib/run');
const C = require('../lib/cases');

// 本复现用的名单名（护栏要求 PL05测试 开头）和测试程序名
const WHITE = 'PL05测试-复现白';
const BLACK = 'PL05测试-复现黑';
const PROGS = ['rp-w-in', 'rp-w-out', 'rp-a-new', 'rp-b-in', 'rp-b-out'];
const RAV = '/opt/BDFZ/RAV/data';

// ---------------------------------------------------------------------------
// 取证辅助
// ---------------------------------------------------------------------------

/** 本轮测试程序：第一次调用时在 13.18 生成（复制 sleep + 末尾追加名字和轮次，哈希各不相同），之后读文件 */
function progs() {
  const f = path.join(ev.ROOT, ev.round(), 'programs.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { /* 还没生成 */ }
  const r = term.prepPrograms(ev.round(), PROGS);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(r, null, 2));
  return r;
}

/** 终端当前时间，格式和 rss.def.log 行首一致：YYYY-MM-DD HH:MM:SS（终端是北京时间） */
function termTime() {
  return ssh.runOk(env.t18.host, env.secret.t18Ssh(), 'date "+%Y-%m-%d %H:%M:%S"').trim();
}

/**
 * 取终端 rss.def.log 从 since（含）开始的全部行。日志写得很快（约 2.5 MB/小时）、满 5 MB 轮转成
 * rss.def.log.log 且只留一份，所以把轮转文件和当前文件拼起来按行首时间截取，不靠行号。
 */
function termLogSince(since) {
  const script = 'cd ' + RAV + ' && cat rss.def.log.log rss.def.log 2>/dev/null | ' +
    "awk -v t=" + ssh.q(since) + " '/^20[0-9][0-9]-[0-9][0-9]-[0-9][0-9] / && substr($0,1,19)>=t {f=1} f {print}'";
  return ssh.runOk(env.t18.host, env.secret.t18Ssh(), script, 120000);
}

/**
 * 终端现场快照：pwdata 文件（md5、大小、时间）、procwlu.lib 原文、本复现两个名单 zip 解开后的 json、
 * ptfile 里进程管控策略原文。zip 密码在中心代码里是常量，这里在终端上现读环境变量 PL05_ZIP_PW 解压，不落盘。
 */
function termSnapshot(pguids) {
  const pw = process.env.PL05_ZIP_PW || '';
  const lines = [
    'cd ' + RAV,
    'echo "== 终端时间 $(date "+%F %T")"',
    'echo "== pwdata（md5 大小 修改时间 文件）"',
    'for f in pwdata/*; do echo "$(md5sum "$f" | cut -c1-32) $(stat -c "%s %y" "$f" | cut -c1-30) $f"; done',
    'echo "== pwdata/procwlu.lib 原文"', 'cat pwdata/procwlu.lib; echo',
    'echo "== ptfile/' + env.procmGuid + '"',
    'for f in ptfile/' + env.procmGuid + '/*; do echo "--- $f $(md5sum "$f" | cut -c1-32) $(stat -c %y "$f" | cut -c1-19)"; cat "$f"; echo; done',
  ];
  (pguids || []).forEach((g) => {
    const z = 'pwdata/' + g + '_aarch64.zip';
    lines.push('echo "== ' + z + ' 解开后的 json"',
      '[ -f ' + z + ' ] && python3 -I -c ' + ssh.q('import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);z.setpassword(sys.stdin.read().encode());[print(n, z.read(n).decode()) for n in z.namelist()]') +
      ' ' + z + ' <<< ' + ssh.q(pw) + ' || echo "（终端上没有这个 zip 或解不开）"');
  });
  return ssh.runOk(env.t18.host, env.secret.t18Ssh(), lines.join('\n'), 60000);
}

/** 中心某名单 aarch64 zip 解开后的 json（中心没有 unzip，用 PHP 的 ZipArchive 不一定支持解密，所以拷到终端外的本机解） */
function centerZipJson(dir, pguid) {
  const f = '/opt/BDFZ/ESM/data/web/ruc/libs/' + dir + '/' + pguid + '_aarch64.zip';
  const b64 = center.sh('base64 -w0 ' + ssh.q(f) + ' 2>/dev/null; true').trim();
  if (!b64) return { file: f, err: '中心没有这个文件' };
  const buf = Buffer.from(b64, 'base64');
  const md5 = require('crypto').createHash('md5').update(buf).digest('hex').toUpperCase();
  // 在本机用 python 解（密码从环境变量传入，不进命令参数）
  const { spawnSync } = require('child_process');
  const r = spawnSync('python3', ['-I', '-c',
    'import sys,io,os,zipfile;z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()));z.setpassword(os.environ["PL05_ZIP_PW"].encode());[print(n, z.read(n).decode()) for n in z.namelist()]'],
  { input: buf, env: Object.assign({}, process.env), encoding: 'utf8' });
  return { file: f, md5, json: (r.stdout || '').trim(), err: (r.stderr || '').trim() || undefined, base64: b64 };
}

/** 13.18 在 since（终端 unix 秒）之后某路径的审计日志行 */
function audit(procPath, since) { return C.auditRows(procPath, since); }
const descRows = (rows) => rows.length ? rows.length + ' 条：' + rows.map((r) => r[1] + ' ACTIONREASON=' + r[4] + ' PROCACTION=' + r[5] + ' HASH=' + r[6]).join('；') : '0 条';

/** 运行一个测试程序并把命令行输出、开始时间记下 */
function runProg(name) {
  const r = term.runProgram(name, 2);
  return Object.assign({ name }, r);
}

// ---------------------------------------------------------------------------
// R-1 准备
// ---------------------------------------------------------------------------
test('R-1 准备：新名单、测试组、挂白名单、移入 13.18', async () => {
  const R = recorder('R-1');
  const s = await open();
  try {
    const since = termTime();
    const p = progs();
    ev.save('R-1', 'programs.json', p);
    ev.save('R-1', 'programs-ls.txt', ssh.runOk(env.t18.host, env.secret.t18Ssh(), 'ls -l --time-style=full-iso /tmp/pl05/rp-*; md5sum /tmp/pl05/rp-*; sha256sum /tmp/pl05/rp-*'));
    R.seg('13.18 生成测试程序', Object.keys(p).length === PROGS.length ? 'PASS' : 'FAIL', PROGS.map((n) => n + '=' + p[n].md5.toUpperCase()).join('，'));
    ev.save('R-1', 'terminal-before.txt', termSnapshot([]));

    // 根管理组当前进程策略应是审计（默认策略 PID 3），测试组会照抄它
    const root = C.groupProcPolicy('1');
    ev.save('R-1', 'root-proc-policy.json', root);
    R.seg('根管理组进程策略是审计模式', root && root.auditmode === '2' && root.enable === '1' ? 'PASS' : 'FAIL', root ? 'auditmode=' + root.auditmode + ' uptimer=' + root.uptimer : '无');

    // 两个新名单：建 → 手工录入大写 MD5 → 发布（各只发布一次）
    for (const [type, name, prog] of [['white', WHITE, 'rp-w-in'], ['black', BLACK, 'rp-b-in']]) {
      await test.step('名单 ' + name, async () => {
        let pol = C.findPolicy(name);
        if (!pol) {
          const r = await ops.createList(s.page, type, name);
          ev.save('R-1', type + '-create.json', r);
          pol = (await until('POLICY 出现 ' + name, () => C.findPolicy(name), (x) => !!x, { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 })).value;
        }
        if (!pol) { R.seg(name + ' 新建', 'FAIL', '库里没出现'); return; }
        P.addPid(pol.pid, name); // 登记给护栏
        const md5 = p[prog].md5.toUpperCase();
        if (!C.listProcs(type, pol.pid).some((x) => x[0] === p[prog].path)) {
          const r = await ops.addProcManual(s.page, type, name, p[prog].path, md5);
          ev.save('R-1', type + '-add-proc.json', r);
        }
        const procs = (await until('名单进程行', () => C.listProcs(type, pol.pid), (x) => x.length > 0, { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 })).value || [];
        // 页面会把录入的哈希转成小写存库，所以不区分大小写比
        R.seg(name + ' 进程行', procs.length === 1 && procs[0][1].toUpperCase() === md5 && procs[0][2] === '0' ? 'PASS' : 'FAIL', JSON.stringify(procs));
        pol = C.findPolicy(name);
        if (pol.status !== '4' || procs.some((x) => x[3] !== '0')) {
          const r = await ops.publishList(s.page, type, name);
          ev.save('R-1', type + '-publish.json', r);
          pol = (await until('STATUS=4', () => C.findPolicy(name), (x) => x.status === '4', { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 })).value || C.findPolicy(name);
        }
        const libs = C.listLibs(pol.pid);
        ev.save('R-1', type + '-policyjson-userlibs.json', libs);
        const dir = type === 'black' ? 'b/u' : 'w/u';
        const z = C.zipsMatch(dir, pol.pguid, libs);
        ev.save('R-1', type + '-center-zips.json', z);
        const cj = centerZipJson(dir, pol.pguid);
        ev.save('R-1', type + '-center-zip-aarch64.json', cj);
        R.seg(name + ' 发布、中心 zip 一致', pol.status === '4' && z.ok ? 'PASS' : 'FAIL', 'PID ' + pol.pid + ' PGUID ' + pol.pguid + ' version ' + (libs && libs.version) + '；zip 内容 ' + (cj.json || cj.err));
      });
    }
    const white = C.findPolicy(WHITE);
    if (!white) return;

    // 测试组：根管理组下新建 → 不继承 → 挂白名单 → 移入 13.18（终端一次收到组策略 + 白名单）
    let g = C.findGroup();
    if (!g) {
      const r = await ops.createSubGroup(s.page, env.names.group);
      ev.save('R-1', 'create-group.json', r);
      g = (await until('测试组出现', () => C.findGroup(), (x) => !!x, { timeoutMs: LIMIT.pageToCenter, intervalMs: 2000 })).value;
    }
    if (!g) { R.seg('建测试组', 'FAIL', '库里没出现'); return; }
    P.setGroup(g.id);
    if (g.inherit !== '0') {
      const r = await ops.setInherit(s.page, g.id, false);
      ev.save('R-1', 'set-inherit.json', r);
      g = (await until('不继承', () => C.findGroup(), (x) => x.inherit === '0', { timeoutMs: LIMIT.pageToCenter, intervalMs: 2000 })).value || C.findGroup();
    }
    R.seg('测试组', g.inherit === '0' ? 'PASS' : 'FAIL', '组号 ' + g.id + ' ISINHERIT=' + g.inherit);

    const ap = await ops.applyListToGroups(s.page, 'white', WHITE, [env.names.group]);
    ev.save('R-1', 'apply-white.json', ap);
    const links = (await until('组上名单关联只剩复现白', () => C.groupLinks(g.id).filter((x) => x[3] === '2' || x[3] === '3'),
      (x) => x.length === 1 && x[0][1] === white.pid, { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 })).value;
    ev.save('R-1', 'group-links.json', C.groupLinks(g.id));
    R.seg('测试组挂上复现白', links ? 'PASS' : 'FAIL', JSON.stringify(C.groupLinks(g.id)));
    const gi = C.groupListItem(g.id);
    ev.save('R-1', 'redis-pgl-list-item.json', gi);
    ev.save('R-1', 'redis-pgl-proc-policy.json', C.groupProcPolicy(g.id));

    const ep = C.ep18();
    if (ep.group !== g.id) {
      const r = await ops.moveTerminal(s.page, env.t18.host, ep.group, env.names.group);
      ev.save('R-1', 'move-terminal.json', r);
    }
    const moved = await until('13.18 在测试组', () => C.ep18(), (x) => x.group === g.id, { timeoutMs: LIMIT.pageToCenter, intervalMs: 2000 });
    R.seg('13.18 移入测试组', moved.ok ? 'PASS' : 'FAIL', JSON.stringify(moved.value || moved.last));

    // 等终端收到：ptfile 和测试组 Redis 一致，且 pwdata 里有复现白的 zip、md5 和中心一致
    const t0 = Date.now();
    const pt = await until('ptfile 一致', () => C.ptfileMatches(g.id), (x) => x.ok, { timeoutMs: LIMIT.centerToTerminal, intervalMs: 15000 });
    const centerA = center.libFiles('w/u', white.pguid).find((f) => /_aarch64\.zip$/.test(f.file));
    const zw = await until('终端下载复现白', () => C.pwZip(white.pguid), (x) => x && centerA && x.md5 === centerA.md5, { timeoutMs: LIMIT.libDownload, intervalMs: 10000 });
    R.seg('终端收到策略并下载复现白', pt.ok && zw.ok ? 'PASS' : 'TIMEOUT', '用时 ' + Math.round((Date.now() - t0) / 1000) + ' 秒；终端 zip ' + JSON.stringify(zw.value || zw.last) + ' 中心 ' + (centerA && centerA.md5));
    await new Promise((r) => setTimeout(r, 5000)); // 给终端几秒加载 procwlu.lib
    ev.save('R-1', 'terminal-after.txt', termSnapshot([white.pguid]));
    ev.save('R-1', 'rss.def.log.segment.txt', termLogSince(since));
    ev.save('R-1', 'epstate.json', C.epstate18());
    R.seg('护栏没有中止请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  } finally {
    await s.close('R-1');
  }
  expect(R.finish(), 'R-1 结论').not.toBe('FAIL');
});

// ---------------------------------------------------------------------------
// R-2 问题 B·白：白名单里的程序是否还记「不在白名单」
// ---------------------------------------------------------------------------
test('R-2 问题 B·白', async () => {
  const R = recorder('R-2');
  const G = P.load().groupId;
  const white = C.findPolicy(WHITE);
  const p = progs();
  const since = termTime();
  const before = termSnapshot([white.pguid]);
  ev.save('R-2', 'terminal-before.txt', before);
  R.seg('终端 procwlu.lib 是复现白、含 rp-w-in 的 MD5', before.indexOf(white.pguid) >= 0 && before.toLowerCase().indexOf(p['rp-w-in'].md5) >= 0 ? 'PASS' : 'FAIL', '');
  const t0 = term.now('t18');
  const runs = [runProg('rp-w-in'), runProg('rp-w-out')];
  ev.save('R-2', 'runs.json', runs);
  const up = C.uptimerOf(G);
  // 等名单外的 rp-w-out 出日志（对照，证明审计在工作），再多等一个上报周期看 rp-w-in
  const w = await until('rp-w-out 出日志', () => audit(p['rp-w-out'].path, t0), (x) => x.length > 0, { timeoutMs: LIMIT.upload(up), intervalMs: 15000 });
  await new Promise((r) => setTimeout(r, (up + 20) * 1000));
  // 再跑一次 rp-w-in（排除「刚加载完名单」的时序问题），再等一个周期
  const t1 = term.now('t18');
  runs.push(runProg('rp-w-in'));
  await new Promise((r) => setTimeout(r, (up + 30) * 1000));
  const rowsIn = audit(p['rp-w-in'].path, t0);
  const rowsOut = audit(p['rp-w-out'].path, t0);
  ev.save('R-2', 'audit-rows.json', { since: t0, rerunAt: t1, 'rp-w-in': rowsIn, 'rp-w-out': rowsOut });
  R.seg('对照：名单外 rp-w-out 记「不在白名单」', rowsOut.length && rowsOut.every((r) => r[4] === '2') ? 'PASS' : 'FAIL', descRows(rowsOut) + '；等 ' + Math.round(w.ms / 1000) + ' 秒');
  R.seg('白名单里的 rp-w-in 不应出日志（问题 B）', rowsIn.length === 0 ? 'PASS' : 'FAIL', descRows(rowsIn));
  ev.save('R-2', 'terminal-after.txt', termSnapshot([white.pguid]));
  ev.save('R-2', 'rss.def.log.segment.txt', termLogSince(since));
  ev.save('R-2', 'epstate.json', C.epstate18());
  expect(R.finish(), 'R-2 结论').toBeDefined();
});

// ---------------------------------------------------------------------------
// R-3 问题 A：名单改内容再发布，终端是否下载新 zip
// ---------------------------------------------------------------------------
test('R-3 问题 A', async () => {
  const R = recorder('R-3');
  const s = await open();
  try {
    const G = P.load().groupId;
    let white = C.findPolicy(WHITE);
    P.addPid(white.pid, WHITE);
    const p = progs();
    const since = termTime();
    const zipBefore = C.pwZip(white.pguid);
    const cBefore = centerZipJson('w/u', white.pguid);
    ev.save('R-3', 'center-zip-before.json', cBefore);
    ev.save('R-3', 'terminal-before.txt', termSnapshot([white.pguid]));
    R.seg('改之前：终端 zip = 中心 zip', zipBefore && zipBefore.md5 === cBefore.md5 ? 'PASS' : 'FAIL', '终端 ' + (zipBefore && zipBefore.md5) + ' 中心 ' + cBefore.md5);

    // 页面：名单进程视图手工加 rp-a-new（大写 MD5），再发布
    const r1 = await ops.addProcManual(s.page, 'white', WHITE, p['rp-a-new'].path, p['rp-a-new'].md5.toUpperCase());
    ev.save('R-3', 'add-proc.json', r1);
    const r2 = await ops.publishList(s.page, 'white', WHITE);
    ev.save('R-3', 'publish.json', r2);
    await until('发布完成', () => C.findPolicy(WHITE), (x) => x.status === '4' && x.ver !== white.ver, { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
    white = C.findPolicy(WHITE);
    const cAfter = centerZipJson('w/u', white.pguid);
    ev.save('R-3', 'center-zip-after.json', cAfter);
    const libs = C.listLibs(white.pid);
    ev.save('R-3', 'policyjson-userlibs-after.json', libs);
    const gi = C.groupListItem(G);
    ev.save('R-3', 'redis-pgl-list-item-after.json', gi);
    R.seg('中心：同名 zip 内容和 md5 已变、Redis 指向新 md5', cAfter.md5 !== cBefore.md5 && gi && gi.raw.indexOf(cAfter.md5) >= 0 ? 'PASS' : 'FAIL',
      'zip 名不变 ' + white.pguid + '_aarch64.zip；md5 ' + cBefore.md5 + ' → ' + cAfter.md5 + '；新内容 ' + cAfter.json);

    // 终端：等收到这次变化（ptfile 和 Redis 一致），看 zip 有没有换成新的
    const t0 = Date.now();
    const pt = await until('ptfile 一致', () => C.ptfileMatches(G), (x) => x.ok, { timeoutMs: LIMIT.centerToTerminal, intervalMs: 15000 });
    R.seg('终端收到名单变化', pt.ok ? 'PASS' : 'TIMEOUT', '用时 ' + Math.round((Date.now() - t0) / 1000) + ' 秒');
    const zw = await until('终端 zip 换成新的', () => C.pwZip(white.pguid), (x) => x && x.md5 === cAfter.md5, { timeoutMs: LIMIT.libDownload, intervalMs: 10000 });
    const logA = termLogSince(since);
    ev.save('R-3', 'rss.def.log.segment.txt', logA);
    const hit = logA.split('\n').filter((l) => l.indexOf(white.pguid) >= 0 || /parse file failed|md5不同|md5 is diff/.test(l));
    ev.save('R-3', 'rss-log-key-lines.txt', hit.join('\n'));
    R.seg('终端应下载新 zip（问题 A）', zw.ok ? 'PASS' : 'FAIL', '终端 zip ' + JSON.stringify(zw.value || zw.last) + '；日志关键行 ' + hit.length + ' 行：' + hit.filter((l) => /md5不同|parse file failed/.test(l)).join(' ｜ ').slice(0, 400));
    ev.save('R-3', 'terminal-after.txt', termSnapshot([white.pguid]));

    // 再等两个终端处理周期（每 5 分钟一次），看终端会不会自己重试
    await new Promise((r) => setTimeout(r, 11 * 60 * 1000));
    const z2 = C.pwZip(white.pguid);
    ev.save('R-3', 'terminal-after-11min.txt', termSnapshot([white.pguid]));
    ev.save('R-3', 'rss.def.log.segment-11min.txt', termLogSince(since));
    R.seg('11 分钟后终端 zip（只记录）', 'RECORD', JSON.stringify(z2) + (z2 && z2.md5 === cAfter.md5 ? '（已更新）' : '（仍是旧的）'));
    R.seg('护栏没有中止请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  } finally {
    await s.close('R-3');
  }
  expect(R.finish(), 'R-3 结论').toBeDefined();
});

// ---------------------------------------------------------------------------
// R-4 问题 B·黑：黑名单里的程序是否记「在黑名单」
// ---------------------------------------------------------------------------
test('R-4 问题 B·黑', async () => {
  const R = recorder('R-4');
  const s = await open();
  try {
    const G = P.load().groupId;
    const black = C.findPolicy(BLACK);
    const white = C.findPolicy(WHITE);
    P.addPid(black.pid, BLACK);
    P.addPid(white.pid, WHITE);
    const p = progs();
    const since = termTime();
    const ap = await ops.applyListToGroups(s.page, 'black', BLACK, [env.names.group]);
    ev.save('R-4', 'apply-black.json', ap);
    const links = (await until('组上只剩复现黑', () => C.groupLinks(G).filter((x) => x[3] === '2' || x[3] === '3'),
      (x) => x.length === 1 && x[0][1] === black.pid, { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 })).value;
    ev.save('R-4', 'group-links.json', C.groupLinks(G));
    ev.save('R-4', 'redis-pgl-list-item.json', C.groupListItem(G));
    R.seg('测试组换成复现黑', links ? 'PASS' : 'FAIL', JSON.stringify(C.groupLinks(G)));
    const t0 = Date.now();
    const pt = await until('ptfile 一致', () => C.ptfileMatches(G), (x) => x.ok, { timeoutMs: LIMIT.centerToTerminal, intervalMs: 15000 });
    const centerB = center.libFiles('b/u', black.pguid).find((f) => /_aarch64\.zip$/.test(f.file));
    const zb = await until('终端下载复现黑', () => C.pwZip(black.pguid), (x) => x && centerB && x.md5 === centerB.md5, { timeoutMs: LIMIT.libDownload, intervalMs: 10000 });
    R.seg('终端收到并下载复现黑', pt.ok && zb.ok ? 'PASS' : 'TIMEOUT', '用时 ' + Math.round((Date.now() - t0) / 1000) + ' 秒');
    await new Promise((r) => setTimeout(r, 10000));
    const before = termSnapshot([black.pguid]);
    ev.save('R-4', 'terminal-before-run.txt', before);
    R.seg('终端 procwlu.lib 是复现黑、含 rp-b-in 的 MD5', before.indexOf('"name":"' + black.pguid) >= 0 && before.toLowerCase().indexOf(p['rp-b-in'].md5) >= 0 ? 'PASS' : 'FAIL', '');

    const tr = term.now('t18');
    const runs = [runProg('rp-b-in'), runProg('rp-b-out')];
    const up = C.uptimerOf(G);
    await new Promise((r) => setTimeout(r, (up + 30) * 1000));
    runs.push(runProg('rp-b-in')); // 再跑一次，排除加载时序
    ev.save('R-4', 'runs.json', runs);
    const w = await until('rp-b-in 出日志', () => audit(p['rp-b-in'].path, tr), (x) => x.length > 0, { timeoutMs: LIMIT.upload(up), intervalMs: 15000 });
    const rowsIn = audit(p['rp-b-in'].path, tr);
    const rowsOut = audit(p['rp-b-out'].path, tr);
    ev.save('R-4', 'audit-rows.json', { since: tr, 'rp-b-in': rowsIn, 'rp-b-out': rowsOut });
    R.seg('黑名单里的 rp-b-in 应记「在黑名单」（问题 B）', rowsIn.length && rowsIn.every((r) => r[4] === '1') ? 'PASS' : 'FAIL', descRows(rowsIn) + '；等 ' + Math.round(w.ms / 1000) + ' 秒');
    R.seg('名单外 rp-b-out（只记录）', 'RECORD', descRows(rowsOut));
    ev.save('R-4', 'terminal-after.txt', termSnapshot([black.pguid, white.pguid]));
    ev.save('R-4', 'rss.def.log.segment.txt', termLogSince(since));
    ev.save('R-4', 'epstate.json', C.epstate18());
    R.seg('护栏没有中止请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  } finally {
    await s.close('R-4');
  }
  expect(R.finish(), 'R-4 结论').toBeDefined();
});
