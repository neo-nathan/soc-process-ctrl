/**
 * 还原：E-11（名单）、E-12（终端、策略、组）。无论前面用例结果如何都要执行，可以重复执行：
 * 每一步先查现状再动手（对象不存在就跳过、13.18 已在根管理组就跳过……）。
 * 所有写操作只走页面，写请求仍过 page.js 护栏（只放行本轮自建的 pid、测试组、13.18）。
 * 顺序：E-11 先删名单 → E-12 移回终端 → 清测试策略应用范围（关联为 0 才删，避开策略中心删除缺陷）→ 删策略 → 删组。
 */
'use strict';
const { test, expect } = require('@playwright/test');
const env = require('../lib/env');
const term = require('../lib/terminal');
const ev = require('../lib/evidence');
const P = require('../lib/page');
const ops = require('../lib/ops');
const center = require('../lib/center');
const { until, LIMIT } = require('../lib/wait');
const { open, recorder } = require('../lib/run');
const {
  findGroup, groupLinks, ep18, ptfileMatches, colleague, findPolicy, groupProcPolicy, listProcs, groupListItem, epstate18,
} = require('../lib/cases');

// 本轮可能建过的名单：[类型, 名字]
const LISTS = [['white', env.names.white], ['white', env.names.white2], ['black', env.names.black]];

/** 库里某策略 / 名单的全部关联条数（任何对象） */
function linkCount(pid) {
  return parseInt(center.sql("SELECT COUNT(*) FROM POLICYOBJECT WHERE PID='" + pid + "'")[0][0], 10);
}

test('E-11 还原①：名单', async () => {
  const R = recorder('E-11');
  const G = (findGroup() || {}).id || P.load().groupId;
  const s = await open();
  try {
    // ① 策略若还不是审计（例如中断在拦截模式），先改回审计；测试组或测试策略不在了就跳过
    const pol = findPolicy(env.names.policy);
    const gp = G && groupProcPolicy(G);
    if (pol && gp && gp.auditmode !== '2' && groupLinks(G).some((x) => x[1] === pol.pid)) {
      P.addPid(pol.pid, env.names.policy);
      await test.step('页面：策略改回审计', async () => {
        const r = await ops.setAuditMode(s.page, G, '2');
        ev.save('E-11', 'edit-policy.json', r);
        R.seg('策略改回审计', ops.ok(r) && (r.params.pid || [])[0] === pol.pid ? 'PASS' : 'FAIL', 'pid=' + (r.params.pid || []).join(','));
      });
    } else {
      R.seg('策略改回审计', 'RECORD', '不需要：' + (gp ? 'auditmode=' + gp.auditmode : '测试组没有进程策略项'));
    }

    // ② 每个测试名单：已发布且有应用范围的先清空应用范围，再删除
    for (const [type, name] of LISTS) {
      const l = findPolicy(name);
      if (!l) { R.seg(name + ' 删除', 'RECORD', '不存在，跳过'); continue; }
      P.addPid(l.pid, name);
      const n0 = linkCount(l.pid);
      if (n0 > 0 && l.status === '4') {
        await test.step('页面：清空 ' + name + ' 的应用范围', async () => {
          const r = await ops.applyListToGroups(s.page, type, name, []);
          ev.save('E-11', 'clear-scope-' + l.pid + '.json', r);
          let ids = [];
          (r.resp.params.aObjId || []).forEach((v) => { try { ids = ids.concat(JSON.parse(v)); } catch (e) { ids.push(v); } });
          const w = await until(name + ' 关联清空', () => linkCount(l.pid), (x) => x === 0, { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
          R.seg(name + ' 清空应用范围', ops.ok(r.resp) && ids.length === 0 && w.ok ? 'PASS' : 'FAIL',
            '提交组号 [' + ids.join(',') + ']；关联 ' + n0 + ' → ' + w.value + '；接口 ' + JSON.stringify(r.resp.json).slice(0, 120));
        });
      } else if (n0 > 0) {
        R.seg(name + ' 清空应用范围', 'RECORD', '名单状态 ' + l.status + '（不是已发布，页面不让改应用范围），直接删除；删前关联 ' + n0 + ' 条');
      }
      await test.step('页面：删除 ' + name, async () => {
        const r = await ops.deleteList(s.page, type, name);
        ev.save('E-11', 'delete-' + l.pid + '.json', r);
        const gone = !findPolicy(name);
        const rows = listProcs(type, l.pid).length;
        const links = linkCount(l.pid);
        R.seg(name + ' 删除：POLICY、名单进程行、关联都没了', ops.ok(r) && gone && rows === 0 && links === 0 ? 'PASS' : 'FAIL',
          'POLICY ' + (gone ? '已删' : '还在') + '；' + (type === 'black' ? 'RPW_BPROC' : 'RPW_WPROC') + ' ' + rows + ' 行；关联 ' + links + ' 条；接口 ' + JSON.stringify(r.json).slice(0, 100));
      });
    }

    // ③ 测试组的 Redis：名单项变空或被删；终端收到（只记录 delete="1" / 空名单和 pwdata 残留）
    if (G && findGroup()) {
      const gi = groupListItem(G);
      ev.save('E-11', 'pgl-list-item.json', gi);
      const empty = !gi || !gi.userlibs || !gi.userlibs.name;
      R.seg('pgl_<测试组> 名单项为空或已删', empty ? 'PASS' : 'FAIL', gi ? 'policytype=' + gi.policytype + ' name=' + (gi.userlibs && gi.userlibs.name) : '没有名单项');
      const mark = term.logMark('t18');
      const tw = await until('13.18 ptfile 与测试组一致', () => ptfileMatches(G), (x) => x.ok, { timeoutMs: LIMIT.centerToTerminal, intervalMs: 15000 });
      ev.save('E-11', 'ptfile-vs-pgl.json', tw.value || tw.last);
      R.seg('终端收到名单清除', tw.ok ? 'PASS' : 'TIMEOUT', tw.ok ? '用时 ' + Math.round(tw.ms / 1000) + ' 秒' : JSON.stringify(tw.last).slice(0, 200));
      const log = term.logSince('t18', mark, /OnMscPolicyChange|userlibs|downlib|\.zip/i);
      ev.save('E-11', 'rss-log.txt', log.lines.join('\n'));
      R.seg('终端日志（只记录）', 'RECORD', log.lines.filter((l) => /delete="1"/.test(l)).length + ' 行 delete="1"，共 ' + log.lines.length + ' 行');
    } else {
      R.seg('pgl_<测试组> 名单项为空或已删', 'RECORD', '测试组已不存在，跳过');
    }
    const pw = term.listFiles('t18', 'pwdata');
    ev.save('E-11', 'pwdata.json', pw);
    R.seg('13.18 pwdata 里的名单库（只记录，不清理）', 'RECORD', pw.filter((f) => /_aarch64\.zip$/.test(f.file)).map((f) => f.file.replace('pwdata/', '')).join('，'));

    // ④ 名单页没有测试名单
    const left = LISTS.filter(([, name]) => findPolicy(name)).map(([, n]) => n);
    for (const type of ['white', 'black']) {
      await P.openHash(s.page, ops.listHash(type));
      await s.page.waitForTimeout(1500);
      await s.page.screenshot({ path: ev.dir('E-11') + '/list-page-' + type + '.png' });
    }
    const pageText = await s.page.locator('body').innerText();
    R.seg('名单页没有测试名单', left.length === 0 && pageText.indexOf('PL05测试-') < 0 ? 'PASS' : 'FAIL', left.length ? '库里还有：' + left.join(',') : '');
    colleague(R, 'E-11');
    R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  } finally {
    await s.close('E-11');
  }
  expect(R.finish(), 'E-11 结论').not.toBe('FAIL');
});

test('E-12 还原②：终端、策略、组', async () => {
  const R = recorder('E-12');
  const grp = findGroup();
  const G = grp ? grp.id : null;
  if (G) P.setGroup(G); // 护栏按 state.json 里的组号放行，重跑时要和库里一致
  const s = await open();
  try {
    // ① 13.18 移回根管理组
    const e0 = ep18();
    if (e0.group !== '1') {
      await test.step('页面：13.18 移回根管理组', async () => {
        const r = await ops.moveTerminal(s.page, env.t18.host, e0.group, '根管理组');
        ev.save('E-12', 'move-terminal.json', r);
        const w = await until('EPINFO.GROUPID=1', () => ep18().group, (x) => x === '1', { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
        R.seg('13.18 移回根管理组', ops.ok(r) && w.ok ? 'PASS' : 'FAIL', '组 ' + e0.group + ' → ' + w.value + '；提交 ' + JSON.stringify(r.params).slice(0, 120));
      });
    } else {
      R.seg('13.18 移回根管理组', 'RECORD', '已在根管理组，跳过');
    }

    // ② 测试策略：清空应用范围 → 关联为 0 → 删除
    const pol = findPolicy(env.names.policy);
    if (pol) {
      P.addPid(pol.pid, env.names.policy);
      const n0 = linkCount(pol.pid);
      if (n0 > 0) {
        await test.step('页面：策略中心清空测试策略的应用范围', async () => {
          const r = await ops.clearPolicyScope(s.page, env.names.policy);
          ev.save('E-12', 'clear-policy-scope.json', r);
          const w = await until('测试策略关联为 0', () => linkCount(pol.pid), (x) => x === 0, { timeoutMs: LIMIT.pageToCenter, intervalMs: 1000 });
          R.seg('测试策略应用范围清空', r.resp && ops.ok(r.resp) && w.ok ? 'PASS' : 'FAIL',
            '取消前勾选 ' + r.before.join(',') + '；关联 ' + n0 + ' → ' + w.value + (r.resp ? '；接口 ' + JSON.stringify(r.resp.json).slice(0, 100) : '；页面没发请求'));
        });
      }
      if (linkCount(pol.pid) === 0) {
        await test.step('页面：删除测试策略', async () => {
          const r = await ops.deletePolicy(s.page, env.names.policy);
          ev.save('E-12', 'delete-policy.json', r);
          R.seg('删除测试策略', ops.ok(r) && !findPolicy(env.names.policy) ? 'PASS' : 'FAIL', JSON.stringify(r.json).slice(0, 120));
        });
      } else {
        R.seg('删除测试策略', 'FAIL', '关联没清到 0（' + linkCount(pol.pid) + ' 条），不删，避开策略中心删除缺陷');
      }
    } else {
      R.seg('删除测试策略', 'RECORD', '不存在，跳过');
    }

    // ③ 删测试组：删前组里不能有终端；删后查 POLICYOBJECT 有没有指向它的残留
    if (G) {
      const eps = center.sql("SELECT COUNT(*) FROM EPINFO WHERE GROUPID='" + G + "'")[0][0];
      if (eps !== '0') {
        R.seg('删除测试组', 'FAIL', '组里还有 ' + eps + ' 台终端，不删');
      } else {
        await test.step('页面：删除测试组', async () => {
          const r = await ops.deleteGroup(s.page, env.names.group);
          ev.save('E-12', 'delete-group.json', r);
          R.seg('删除测试组', ops.ok(r) && !findGroup() ? 'PASS' : 'FAIL', JSON.stringify(r.json).slice(0, 120));
        });
        const residue = center.sql("SELECT POID, PID, OBJTYPE, OBJID FROM POLICYOBJECT WHERE OBJTYPE=1 AND OBJID='" + G + "'");
        ev.save('E-12', 'policyobject-residue.json', residue);
        R.seg('删组后没有指向测试组的关联残留', residue.length === 0 ? 'PASS' : 'FAIL',
          residue.length ? residue.map((x) => 'POID ' + x[0] + ' PID ' + x[1]).join('；') + '（删组不删关联，F-13）' : '');
        const redis = center.procmItems(G);
        R.seg('Redis pgl_<测试组>（只记录）', 'RECORD', redis && redis.length ? '还有 ' + redis.length + ' 项' : '没有了');
        if (!findGroup()) P.setGroup(null);
      }
    } else {
      R.seg('删除测试组', 'RECORD', '不存在，跳过');
    }

    // ④ 终端：ptfile 恢复成根管理组的下发（以当时 pgl_1 为准）；记 EPSTATE；删 /tmp/pl05/
    const tw = await until('13.18 ptfile 与根管理组一致', () => ptfileMatches('1'), (x) => x.ok, { timeoutMs: LIMIT.centerToTerminal, intervalMs: 15000 });
    ev.save('E-12', 'ptfile-vs-pgl1.json', tw.value || tw.last);
    R.seg('13.18 ptfile 恢复成根管理组的下发', tw.ok ? 'PASS' : 'TIMEOUT', tw.ok ? '用时 ' + Math.round(tw.ms / 1000) + ' 秒；' + tw.value.items.map((i) => 'type' + i.policytype).join(',')
      : 'want ' + (tw.last || {}).want + ' / have ' + (tw.last || {}).have);
    const st = epstate18();
    ev.save('E-12', 'epstate.json', st);
    R.seg('EPSTATE（只记录）', 'RECORD', st.map((r) => r[0] + '=' + r[1] + '@' + r[2]).join('，'));
    const gone = term.cleanup();
    R.seg('删掉 13.18 的 /tmp/pl05/', gone ? 'PASS' : 'FAIL', gone ? '目录已不存在' : '目录还在');

    await P.openHash(s.page, '#sys/overview?g=1');
    await s.page.waitForTimeout(2000);
    await s.page.screenshot({ path: ev.dir('E-12') + '/overview-root.png' });
    colleague(R, 'E-12');
    // 删组后页面自动调 Group/changeOrder 重排同事的组，护栏按用户决定拦下、只记录
    R.seg('护栏预期拦截（只记录）', 'RECORD', JSON.stringify(s.guard.expectedBlocks).slice(0, 300));
    R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  } finally {
    await s.close('E-12');
  }
  expect(R.finish(), 'E-12 结论').not.toBe('FAIL');
});
