/**
 * 中心探针（14.15）：只读。只跑 SELECT / SHOW、redis HGET / HGETALL / HKEYS、ls、md5sum。
 * MySQL、Redis 口令写进远端脚本的环境变量（经 ssh 标准输入传过去），不出现在任何命令参数里。
 */
'use strict';
const crypto = require('crypto');
const env = require('./env');
const ssh = require('./ssh');

const MYSQL = '/opt/BDFZ/ESM/bin/mysql --socket=/opt/BDFZ/ESM/run/mysql.sock -uroot -N -B ' + env.center.db;
const REDIS = '/opt/BDFZ/ESM/bin/redis-cli -h 127.0.0.1 -p 16379 --raw';
const WEB = '/opt/BDFZ/ESM/data/web';

function sh(script, timeoutMs) {
  return ssh.runOk(env.center.host, env.secret.centerSsh(), script, timeoutMs);
}

/**
 * 只读 SQL，返回二维数组（每行按制表符切开；NULL 保持字符串 'NULL'）。
 * 只允许 SELECT / SHOW 开头，防止误写。
 */
function sql(query) {
  const qs = query.trim();
  if (!/^(SELECT|SHOW)\b/i.test(qs)) throw new Error('中心探针只允许只读 SQL：' + qs.slice(0, 60));
  const script = 'export MYSQL_PWD=' + ssh.q(env.secret.mysql()) + '\n' +
    MYSQL + " <<'PL05SQL'\n" + qs.replace(/;?\s*$/, ';') + '\nPL05SQL\n';
  const out = sh(script);
  return out.split('\n').filter((l) => l.length).map((l) => l.split('\t'));
}

/** 跑一条或多条 redis-cli 只读命令（每个元素是参数数组），返回每条的原始输出。 */
function redis(cmds) {
  const allow = /^(HGET|HGETALL|HKEYS|GET|EXISTS|TYPE)$/i;
  const lines = cmds.map((c) => {
    if (!allow.test(c[0])) throw new Error('中心探针只允许只读 redis 命令：' + c[0]);
    return 'echo "@@PL05@@"; ' + REDIS + ' ' + c.map(ssh.q).join(' ');
  });
  const out = sh('export REDISCLI_AUTH=' + ssh.q(env.secret.redis()) + '\n' + lines.join('\n') + '\n');
  return out.split('@@PL05@@\n').slice(1).map((s) => s.replace(/\n$/, ''));
}

/** 解码某组 Redis 缓存 pgl_<组号> 里的进程管控项：[{policytype, policyver, xml, md5}] */
function procmItems(groupId) {
  const raw = redis([['HGET', 'heid_' + env.eid, 'pgl_' + groupId]])[0];
  if (!raw) return null; // 没有这个组的缓存
  return JSON.parse(raw)
    .filter((it) => String(it.policyproductid).toUpperCase() === env.procmGuid)
    .map((it) => {
      const xml = Buffer.from(it.policymaincontent, 'base64').toString('utf8');
      return { policytype: String(it.policytype), policyver: it.policyver, xml,
        md5: crypto.createHash('md5').update(xml).digest('hex') };
    });
}

/** 终端在 Redis 里的版本号和所在组：{ p_ver, g_info } */
function epCache(sguid) {
  const raw = redis([['HGETALL', 'hep_' + env.eid + sguid]])[0].split('\n');
  const o = {};
  for (let i = 0; i + 1 < raw.length; i += 2) o[raw[i]] = raw[i + 1];
  return { p_ver: o.p_ver, g_info: o.g_info };
}

/** 中心名单库文件：dir 为 'w/u' 或 'b/u'，返回 [{file, md5}]（md5 大写，和报文一致） */
function libFiles(dir, pguid) {
  const d = WEB + '/ruc/libs/' + dir;
  const pat = pguid ? ssh.q(pguid) + "'_'*" : '*';
  const out = sh('cd ' + ssh.q(d) + ' 2>/dev/null && for f in ' + pat + '; do [ -f "$f" ] && echo "$(md5sum "$f" | cut -c1-32) $f"; done; true');
  return out.split('\n').filter(Boolean).map((l) => {
    const [md5, file] = l.split(' ');
    return { file, md5: md5.toUpperCase() };
  });
}

/** 从 XML 里取简单标签值（只取第一个），够用即可，不做完整解析。 */
function tag(xml, name) {
  const m = new RegExp('<' + name + '>([^<]*)</' + name + '>').exec(xml || '');
  return m ? m[1] : null;
}

/** 取 <lib> 里某个架构的 md5 */
function libMd5(xml, arch) {
  const re = /<lib>\s*<md5>([^<]*)<\/md5>\s*<arch>([^<]*)<\/arch>\s*<\/lib>/g;
  let m;
  while ((m = re.exec(xml || ''))) if (m[2] === arch) return m[1];
  return null;
}

module.exports = { sql, redis, procmItems, epCache, libFiles, tag, libMd5, sh };
