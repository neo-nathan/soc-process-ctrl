/**
 * PL-05 测试配置。浏览器不由 Playwright 启动：用例通过 CDP 连到常驻的有头浏览器（lib/browser.js），
 * 复用用户手动登录的会话。用例有先后依赖，单线程、按文件名顺序跑。
 */
'use strict';
module.exports = {
  testDir: './specs',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60 * 60 * 1000,          // 单个用例最长 1 小时（含等终端心跳、上报）
  expect: { timeout: 30 * 1000 },
  reporter: [['list']],
  outputDir: './test-results',
};
