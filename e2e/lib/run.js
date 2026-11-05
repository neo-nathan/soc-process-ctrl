/**
 * 用例公共骨架：连浏览器、装护栏、开新页；结束时断开（不关常驻浏览器）。
 * 每个用例用 step() 记录各段结论，最后写进本轮 results.jsonl。
 */
'use strict';
const browserLib = require('./browser');
const P = require('./page');
const ev = require('./evidence');

async function open() {
  const { browser, context } = await browserLib.connect();
  if (!(await browserLib.loggedIn(context))) throw new Error('浏览器没有登录 14.15，请用户在常驻浏览器里手动登录后再跑');
  const guard = await P.installGuard(context);
  const page = await context.newPage();
  const errors = P.watchErrors(page);
  return {
    browser, context, page, guard, errors,
    async close(caseId) {
      if (caseId) ev.save(caseId, 'network-posts.json', guard.posts);
      await context.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
      await page.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

/** 用例结论收集器：segs 是各段结果；finish 汇总成 PASS / FAIL / TIMEOUT / BLOCKED 并落盘 */
function recorder(caseId) {
  const segs = [];
  return {
    segs,
    seg(name, status, note) { segs.push({ name, status, note }); console.log('  [' + status + '] ' + caseId + ' ' + name + (note ? '：' + note : '')); },
    finish(extra) {
      const order = ['FAIL', 'TIMEOUT', 'BLOCKED', 'RECORD', 'PASS'];
      const worst = segs.reduce((w, s) => (order.indexOf(s.status) < order.indexOf(w) ? s.status : w), 'PASS');
      ev.save(caseId, 'segments.json', segs);
      ev.result(caseId, worst, segs.filter((s) => s.status !== 'PASS').map((s) => s.name + '：' + (s.note || s.status)).join('；'), extra);
      return worst;
    },
  };
}

module.exports = { open, recorder };
