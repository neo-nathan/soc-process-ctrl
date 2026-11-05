/**
 * E-0 冒烟：页面能打开、探针能用、13.18 在线、进程管理页加白弹窗能打开（只开再取消，不提交）。
 */
'use strict';
const { test, expect } = require('@playwright/test');
const env = require('../lib/env');
const center = require('../lib/center');
const term = require('../lib/terminal');
const ev = require('../lib/evidence');
const P = require('../lib/page');
const { open, recorder } = require('../lib/run');

const PAGES = [
  ['概览', '#processManage/overview'],
  ['日志', '#processManage/log'],
  // 策略页要从网址的 ?g= 取当前组，正常从概览标签点过来会带上；这里也带上
  ['策略', '#processManage/policy?g=1'],
  ['进程管理', '#processManage/processMana'],
  ['白名单', '#processManage/list?tab=white'],
  ['黑名单', '#processManage/list?tab=black'],
  ['策略中心', '#strategy'],
];

test('E-0 冒烟', async () => {
  const R = recorder('E-0');
  const s = await open();
  try {
    await test.step('探针：中心库、Redis、两台终端', async () => {
      const ep = center.sql("SELECT IP, ONLINESTATE, GROUPID FROM EPINFO WHERE SGUID IN ('" + env.t18.sguid + "','" + env.t220.sguid + "')");
      ev.save('E-0', 'epinfo.json', ep);
      const t18 = ep.find((r) => r[0] === env.t18.host);
      R.seg('13.18 在线（EPINFO）', t18 && t18[1] === '1' ? 'PASS' : 'FAIL', JSON.stringify(t18));
      const items = center.procmItems(1);
      R.seg('Redis pgl_1 能解码', items && items.length ? 'PASS' : 'FAIL', (items || []).map((i) => i.policytype).join(','));
      for (const w of ['t18', 't220']) {
        const ok = term.healthy(w);
        const mark = term.logMark(w);
        R.seg(w + ' SSH 可用、日志可读', ok && mark > 0 ? 'PASS' : 'FAIL', '日志行数 ' + mark);
      }
    });

    await test.step('7 个页面能打开', async () => {
      const errsBefore = s.errors.length;
      for (const [name, hash] of PAGES) {
        await P.openHash(s.page, hash);
        await s.page.waitForTimeout(2000);
        // 业务失败弹窗（bootbox / 警告提示）
        const warn = await s.page.locator('.bootbox:visible, .jGrowl-notification:visible').allInnerTexts().catch(() => []);
        R.seg('页面 ' + name, warn.length ? 'FAIL' : 'PASS', warn.join(' | ').slice(0, 200));
      }
      const newErrs = s.errors.slice(errsBefore);
      ev.save('E-0', 'console-errors.json', newErrs);
      // JS 异常判 FAIL；控制台 error（资源 404 等）只记录
      const jsErr = newErrs.filter((e) => e.indexOf('pageerror') === 0);
      R.seg('页面 JS 异常', jsErr.length ? 'FAIL' : 'PASS', jsErr.join(' | ').slice(0, 300));
      if (newErrs.length > jsErr.length) R.seg('控制台 error（只记录）', 'RECORD', (newErrs.length - jsErr.length) + ' 条，见 console-errors.json');
    });

    await test.step('观察：策略页不带组号直接打开', async () => {
      // 不带 ?g= 时 policy.js 取不到当前组会抛异常；正常操作不会走到，只记录不判失败
      const n = s.errors.length;
      await P.openHash(s.page, '#processManage/policy');
      await s.page.waitForTimeout(2000);
      const e = s.errors.slice(n).filter((x) => x.indexOf('pageerror') === 0);
      R.seg('策略页不带 ?g= 打开（只记录）', 'RECORD', e.length ? e.join(' | ').slice(0, 200) : '无异常');
    });

    await test.step('策略中心有「进程管控」产品', async () => {
      // 新建策略弹窗的产品下拉在点「新建」时才由 GlobaluserInfo.productNames 生成，这里直接读这个变量（不点按钮）
      await P.openHash(s.page, '#strategy');
      await s.page.waitForTimeout(2000);
      const info = await s.page.evaluate(() => ({ isBM: window.isBM, names: ((window.GlobaluserInfo || {}).productNames || []).map((x) => x.product) }));
      ev.save('E-0', 'product-names.json', info);
      // isBM=1 时弹窗只显示前 2 个产品，进程管控会被藏掉
      const ok = info.names.indexOf('processManage') >= 0 && String(info.isBM) !== '1';
      R.seg('策略中心产品列表有进程管控', ok ? 'PASS' : 'FAIL', 'isBM=' + info.isBM + '；' + info.names.join(','));
    });

    await test.step('概览里 13.18 在线', async () => {
      const p = P.waitApi(s.page, 'Procmanager/getClientsOverview');
      await P.openHash(s.page, '#processManage/overview?g=1');
      const r = await p;
      ev.save('E-0', 'overview.json', r.json);
      const rows = (r.json && r.json.data && r.json.data.rows) || [];
      const row = rows.find((x) => x.IP === env.t18.host);
      R.seg('概览 13.18', row ? (String(row.ONLINESTATE) === '1' ? 'PASS' : 'FAIL') : 'FAIL', row ? 'ONLINESTATE=' + row.ONLINESTATE : '概览第一页没找到 13.18');
    });

    await test.step('进程管理页：勾一行 → 选中加白 → 弹窗打开 → 取消', async () => {
      await P.openHash(s.page, '#processManage/processMana');
      // 表格行带 data-index 才是数据行（没数据时是一行「无数据」提示）
      const row = s.page.locator('#tbClient tbody tr[data-index]').first();
      await row.waitFor({ timeout: 30000 });
      // 复选框被 iCheck 插件包住：原生 input 透明，要点它上面的 ins.iCheck-helper 覆盖层
      await row.locator('td.bs-checkbox ins.iCheck-helper').click({ timeout: 10000 });
      const checked = await row.locator('input[name=btSelectItem]').isChecked();
      R.seg('勾选首行', checked ? 'PASS' : 'FAIL');
      await s.page.locator('#addWhite').click({ timeout: 10000 });
      const modal = s.page.locator('#addBWListModal');
      const shown = await modal.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);
      await s.page.screenshot({ path: ev.dir('E-0') + '/add-white-modal.png' });
      R.seg('加白弹窗能打开', shown ? 'PASS' : 'FAIL');
      if (shown) await modal.locator('.btn-cancel').click();
    });

    R.seg('护栏没有中止任何请求', s.guard.violations.length ? 'FAIL' : 'PASS', JSON.stringify(s.guard.violations).slice(0, 300));
  } finally {
    await s.close('E-0');
  }
  const st = R.finish();
  expect(st, 'E-0 结论').not.toBe('FAIL');
});
