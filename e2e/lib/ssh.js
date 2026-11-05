/**
 * SSH 封装：sshpass -e 从环境变量 SSHPASS 取口令（不进命令参数）；
 * 要执行的脚本从标准输入传给远端 bash，参数用数组，不拼命令字符串。
 */
'use strict';
const { spawnSync } = require('child_process');

const RETRY_HOST = '193.168.14.15'; // 只有中心允许登录失败重试（见 run 里的说明）

const OPTS = ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
  '-o', 'LogLevel=ERROR', '-o', 'ConnectTimeout=10'];

/**
 * 在远端执行一段 bash 脚本，返回 { code, out, err }。
 * @param {string} host   目标地址
 * @param {string} pass   SSH 口令（只经 SSHPASS 环境变量传给 sshpass）
 * @param {string} script 远端执行的 bash 内容
 * @param {number} [timeoutMs]
 */
function run(host, pass, script, timeoutMs) {
  for (let i = 1; ; i++) {
    const r = spawnSync('sshpass', ['-e', 'ssh', ...OPTS, 'root@' + host, 'bash', '-s'], {
      input: script,
      env: Object.assign({}, process.env, { SSHPASS: pass }),
      encoding: 'utf8',
      timeout: timeoutMs || 60000,
      maxBuffer: 64 * 1024 * 1024,
    });
    if (r.error) throw r.error;
    const res = { code: r.status, out: r.stdout || '', err: r.stderr || '' };
    // 登录这一步就失败（ssh 自己退出 255 / sshpass 报口令错 5）时远端脚本根本没执行，重试是安全的。
    // 只对中心 14.15 重试：它在连接很密时偶尔会拒一次正确口令，隔几秒再连就好。
    // 终端不重试：终端可能开了登录失败锁定，口令真错时重试会叠加失败次数、把 root 锁住（同事也在用）。
    const loginFail = (res.code === 255 || res.code === 5) &&
      /Permission denied|Connection (reset|refused|closed)|timed out|kex_exchange/i.test(res.err);
    if (!loginFail || host !== RETRY_HOST || i >= 3) return res;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000 * i); // 同步等 3 秒、6 秒
  }
}

/** 同 run，但非 0 退出直接抛错（带 stderr）。 */
function runOk(host, pass, script, timeoutMs) {
  const r = run(host, pass, script, timeoutMs);
  if (r.code !== 0) throw new Error('远端 ' + host + ' 退出码 ' + r.code + '：' + r.err.slice(0, 500));
  return r.out;
}

/** 把字符串包成 bash 单引号字面量，用于把值安全地嵌进远端脚本。 */
function q(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

module.exports = { run, runOk, q };
