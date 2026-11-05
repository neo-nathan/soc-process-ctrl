# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 10-white.spec.js >> E-4 建白名单并发布
- Location: specs/10-white.spec.js:478:1

# Error details

```
Error: 远端 193.168.14.15 退出码 255：Permission denied, please try again.
Permission denied, please try again.
root@193.168.14.15: Permission denied (publickey,gssapi-keyex,gssapi-with-mic,password).

```

# Test source

```ts
  1  | /**
  2  |  * SSH 封装：sshpass -e 从环境变量 SSHPASS 取口令（不进命令参数）；
  3  |  * 要执行的脚本从标准输入传给远端 bash，参数用数组，不拼命令字符串。
  4  |  */
  5  | 'use strict';
  6  | const { spawnSync } = require('child_process');
  7  | 
  8  | const OPTS = ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
  9  |   '-o', 'LogLevel=ERROR', '-o', 'ConnectTimeout=10'];
  10 | 
  11 | /**
  12 |  * 在远端执行一段 bash 脚本，返回 { code, out, err }。
  13 |  * @param {string} host   目标地址
  14 |  * @param {string} pass   SSH 口令（只经 SSHPASS 环境变量传给 sshpass）
  15 |  * @param {string} script 远端执行的 bash 内容
  16 |  * @param {number} [timeoutMs]
  17 |  */
  18 | function run(host, pass, script, timeoutMs) {
  19 |   const r = spawnSync('sshpass', ['-e', 'ssh', ...OPTS, 'root@' + host, 'bash', '-s'], {
  20 |     input: script,
  21 |     env: Object.assign({}, process.env, { SSHPASS: pass }),
  22 |     encoding: 'utf8',
  23 |     timeout: timeoutMs || 60000,
  24 |     maxBuffer: 64 * 1024 * 1024,
  25 |   });
  26 |   if (r.error) throw r.error;
  27 |   return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
  28 | }
  29 | 
  30 | /** 同 run，但非 0 退出直接抛错（带 stderr）。 */
  31 | function runOk(host, pass, script, timeoutMs) {
  32 |   const r = run(host, pass, script, timeoutMs);
> 33 |   if (r.code !== 0) throw new Error('远端 ' + host + ' 退出码 ' + r.code + '：' + r.err.slice(0, 500));
     |                           ^ Error: 远端 193.168.14.15 退出码 255：Permission denied, please try again.
  34 |   return r.out;
  35 | }
  36 | 
  37 | /** 把字符串包成 bash 单引号字面量，用于把值安全地嵌进远端脚本。 */
  38 | function q(s) {
  39 |   return "'" + String(s).replace(/'/g, "'\\''") + "'";
  40 | }
  41 | 
  42 | module.exports = { run, runOk, q };
  43 | 
```