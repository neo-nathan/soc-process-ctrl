/**
 * 浏览器：一个常驻的有头 Chromium（带调试端口），用户在里面手动登录一次；
 * 测试脚本通过 CDP 连上它，复用已登录的会话（含 sessionStorage），不用存登录状态文件。
 *   node lib/browser.js start   启动常驻浏览器并打开登录页（后台常驻，关窗口即结束）
 *   connect()                   测试里连上它，返回 { browser, context }
 */
'use strict';
const path = require('path');
const { chromium } = require('@playwright/test');
const env = require('./env');

const PROFILE = path.resolve(__dirname, '../.auth/profile'); // 浏览器资料目录，不入库

async function start() {
  const port = new URL(env.cdpURL).port;
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    ignoreHTTPSErrors: true,
    viewport: null,
    args: ['--remote-debugging-port=' + port, '--ignore-certificate-errors', '--start-maximized'],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto(env.baseURL + '/');
  console.log('常驻浏览器已启动，调试端口 ' + port + '；请在窗口里手动登录 14.15。');
  ctx.on('close', () => process.exit(0));
}

async function connect() {
  const browser = await chromium.connectOverCDP(env.cdpURL);
  const context = browser.contexts()[0];
  return { browser, context };
}

/** 当前是否已登录：打开首页看是否还停在「登录」页 */
async function loggedIn(context) {
  const page = await context.newPage();
  try {
    await page.goto(env.baseURL + '/', { waitUntil: 'domcontentloaded' });
    return (await page.title()) !== '登录';
  } finally { await page.close(); }
}

module.exports = { start, connect, loggedIn };

if (require.main === module && process.argv[2] === 'start') start();
