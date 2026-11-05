/**
 * 轮询等待：每隔 intervalMs 调一次 probe()，check(值) 为真就返回；
 * 超时不抛错，返回 { ok:false, timeout:true, last }，由用例记 TIMEOUT（不是 PASS 也不是 FAIL）。
 */
'use strict';

async function until(desc, probe, check, opts) {
  const o = Object.assign({ timeoutMs: 30000, intervalMs: 5000, log: true }, opts || {});
  const t0 = Date.now();
  let last, err;
  for (;;) {
    try { last = await probe(); err = null; if (check(last)) return { ok: true, value: last, ms: Date.now() - t0 }; }
    catch (e) { err = e; }
    if (Date.now() - t0 >= o.timeoutMs) {
      if (o.log) console.log('[TIMEOUT] ' + desc + '，' + Math.round((Date.now() - t0) / 1000) + ' 秒');
      return { ok: false, timeout: true, last, err: err && String(err), ms: Date.now() - t0 };
    }
    await new Promise((r) => setTimeout(r, o.intervalMs));
  }
}

// §3.4 等待上限
const LIMIT = {
  pageToCenter: 30 * 1000,          // 页面操作 → 库和 Redis
  centerToTerminal: 7 * 60 * 1000,  // 中心改版本号 → 终端 ptfile 出现新策略
  libDownload: 3 * 60 * 1000,       // 终端收到名单 → pwdata 下载完成
  upload: (uptimer) => (uptimer + 180) * 1000, // 终端运行进程 → 审计日志入库
};

module.exports = { until, LIMIT };
