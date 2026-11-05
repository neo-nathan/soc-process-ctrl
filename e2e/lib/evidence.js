/**
 * 证据落盘：implement/PL-05/<轮次>/<用例>/<名字>。
 * 写之前把口令值和 MYSQL_PWD= / REDISCLI_AUTH= / SSHPASS= 后面的内容替换成 ***。
 * 轮次编号 = 开始时的北京时间 YYYYMMDDHHmm，由环境变量 PL05_ROUND 传入（同一轮各 spec 共用）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const env = require('./env');

const ROOT = path.resolve(__dirname, '../../implement/PL-05');

function round() {
  if (process.env.PL05_ROUND) return process.env.PL05_ROUND;
  // 没传就按北京时间现算
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + p(d.getUTCHours()) + p(d.getUTCMinutes());
}

function redact(text) {
  let s = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
  env.allSecrets().forEach((v) => { s = s.split(v).join('***'); });
  return s.replace(/(MYSQL_PWD|REDISCLI_AUTH|SSHPASS)=\S+/g, '$1=***');
}

function dir(caseId) {
  const d = path.join(ROOT, round(), caseId);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** 存文本 / JSON 证据，返回相对仓库根的路径 */
function save(caseId, name, content) {
  const f = path.join(dir(caseId), name);
  fs.writeFileSync(f, redact(content));
  return path.relative(path.resolve(ROOT, '../..'), f);
}

/** 追加一行到本轮结果汇总 results.jsonl */
function result(caseId, status, note, extra) {
  const f = path.join(ROOT, round(), 'results.jsonl');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.appendFileSync(f, redact(JSON.stringify(Object.assign({ case: caseId, status, note, at: new Date().toISOString() }, extra || {}))) + '\n');
}

module.exports = { round, redact, save, dir, result, ROOT };
