/**
 * 终端探针。13.18 是被测终端：可以在 /tmp/pl05/ 放测试程序、运行、删除；
 * 13.220 只读：只能读 ptfile/、pwdata/、rss.def.log。写操作碰到 13.220 直接抛错。
 */
'use strict';
const env = require('./env');
const ssh = require('./ssh');

const RAV = '/opt/BDFZ/RAV/data';
const LOG = RAV + '/rss.def.log';
const DIR = '/tmp/pl05';
const HOSTS = {
  t18: () => [env.t18.host, env.secret.t18Ssh()],
  t220: () => [env.t220.host, env.secret.t220Ssh()],
};

function sh(which, script, timeoutMs) {
  const [h, p] = HOSTS[which]();
  return ssh.runOk(h, p, script, timeoutMs);
}
function mustBe18(which) {
  if (which !== 't18') throw new Error('写操作只允许在 13.18 上做，13.220 只读');
}

/** 记下日志当前行数（之后只看新行） */
function logMark(which) {
  return parseInt(sh(which, 'wc -l < ' + LOG).trim(), 10);
}

/**
 * 读 mark 之后的新行，可按正则过滤。日志若被轮转（行数变少），从新文件开头读并标记 rotated。
 * 返回 { lines, rotated, now }
 */
function logSince(which, mark, pattern) {
  const out = sh(which, 'n=$(wc -l < ' + LOG + '); echo "$n"; if [ "$n" -ge ' + mark +
    ' ]; then tail -n +' + (mark + 1) + ' ' + LOG + '; else cat ' + LOG + '; fi', 120000);
  const all = out.split('\n');
  const now = parseInt(all.shift(), 10);
  let lines = all.filter(Boolean);
  if (pattern) lines = lines.filter((l) => pattern.test(l));
  return { lines, rotated: now < mark, now };
}

/** 列目录下文件：[{md5, mtime, file}]；sub 为 'ptfile' 或 'pwdata' */
function listFiles(which, sub) {
  const path = sub === 'ptfile' ? 'ptfile/' + env.procmGuid : sub;
  const out = sh(which, 'cd ' + RAV + ' && find ' + ssh.q(path) +
    ' -type f 2>/dev/null | sort | while read f; do echo "$(md5sum "$f" | cut -c1-32)|$(stat -c %Y "$f")|$f"; done');
  return out.split('\n').filter(Boolean).map((l) => {
    const [md5, mtime, file] = l.split('|');
    return { md5, mtime: +mtime, file };
  });
}

/** 读某个 ptfile 的内容 */
function readFile(which, rel) {
  return sh(which, 'cat ' + ssh.q(RAV + '/' + rel));
}

/**
 * 在 13.18 准备测试程序：复制 /usr/bin/sleep，末尾追加「用途 + 轮次」，每轮、每份哈希都不同。
 * 返回 { 名字: { path, md5, sha256 } }（哈希在 13.18 上算，转小写）。
 */
function prepPrograms(round, names) {
  const lines = ['set -e', 'mkdir -p ' + DIR];
  names.forEach((n) => {
    const p = DIR + '/' + n;
    lines.push('cp /usr/bin/sleep ' + p, 'printf %s ' + ssh.q('PL05 ' + n + ' ' + round) + ' >> ' + p,
      'chmod 755 ' + p, 'echo "' + n + '|' + p + '|$(md5sum ' + p + ' | cut -c1-32)|$(sha256sum ' + p + ' | cut -c1-64)"');
  });
  const out = sh('t18', lines.join('\n'));
  const r = {};
  out.split('\n').filter(Boolean).forEach((l) => {
    const [n, path, md5, sha256] = l.split('|');
    r[n] = { path, md5: md5.toLowerCase(), sha256: sha256.toLowerCase() };
  });
  return r;
}

/** 在 13.18 运行测试程序（睡 secs 秒），返回 { code, startedAt(秒) }；被拦截时 code 非 0 */
function runProgram(name, secs) {
  const [h, p] = HOSTS.t18();
  const r = ssh.run(h, p, 'date +%s; ' + DIR + '/' + name + ' ' + (secs || 2) + '; echo "rc=$?"');
  const m = /rc=(\d+)/.exec(r.out);
  return { code: m ? +m[1] : -1, startedAt: parseInt(r.out, 10), raw: (r.out + r.err).slice(0, 500) };
}

/** 13.18 上能否正常执行普通命令（拦截兜底检查用） */
function healthy(which) {
  const [h, p] = HOSTS[which]();
  const r = ssh.run(h, p, 'ls / >/dev/null && echo OK', 20000);
  return r.code === 0 && /OK/.test(r.out);
}

/** 还原：删掉 /tmp/pl05/（只在 13.18）。返回目录是否已不存在 */
function cleanup(which) {
  mustBe18(which || 't18');
  return /gone/.test(sh('t18', 'rm -rf ' + DIR + '; [ ! -e ' + DIR + ' ] && echo gone || echo left'));
}

/** 终端当前时间（unix 秒） */
function now(which) {
  return parseInt(sh(which, 'date +%s'), 10);
}

module.exports = { logMark, logSince, listFiles, readFile, prepPrograms, runProgram, healthy, cleanup, now, DIR };
