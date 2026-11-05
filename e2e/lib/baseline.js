/**
 * 同事数据不变检查：读 implement/PL-05/baseline/db-baseline.tsv（TK-0 采的基线），和 14.15 现值比。
 * 比三样：
 *   - 同事策略 PID 3、22、25、26 的 UPDATETIME、MD5(POLICYJSON)；
 *   - 这些策略在基线里的全部关联（POID、PID、OBJTYPE、OBJID）还在。允许多出「指向测试组」的关联
 *     （新建测试组会照抄父组关联），但不允许多出指向其他组的；
 *   - 13.220 的 GROUPID 没变。
 * 返回 { ok, notes[] }，notes 写清哪里不一样。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const center = require('./center');
const env = require('./env');
const P = require('./page');

const FILE = path.join(__dirname, '..', '..', 'implement', 'PL-05', 'baseline', 'db-baseline.tsv');

/** 把基线文件按「## 标题」切成段：{ 标题: [[列…]…] } */
function sections() {
  const out = {};
  let cur = null;
  fs.readFileSync(FILE, 'utf8').split('\n').forEach((l) => {
    if (l.indexOf('## ') === 0) { cur = l.slice(3).split('\t')[0].trim(); out[cur] = []; return; }
    if (cur && l.trim()) out[cur].push(l.split('\t'));
  });
  return out;
}

function check() {
  const s = sections();
  const notes = [];
  // ① 策略本身：基线列 PID,PNAME,…,UPDATETIME(第 8 列),MD5(POLICYJSON)(第 9 列)
  const pol = s['POLICY PROCM 相关'] || [];
  const nowPol = center.sql('SELECT PID, UPDATETIME, MD5(POLICYJSON) FROM POLICY WHERE PID IN (' + env.colleague.pids.join(',') + ')');
  pol.forEach((b) => {
    const n = nowPol.find((r) => r[0] === b[0]);
    if (!n) notes.push('策略 PID ' + b[0] + ' 不见了');
    else if (n[1] !== b[7] || n[2] !== b[8]) notes.push('策略 PID ' + b[0] + ' 变了：' + n[1] + ' ' + n[2]);
  });
  // ② 关联：基线列 POID,PID,OBJTYPE,OBJID,CREATETIME
  const po = s['POLICYOBJECT PROCM 相关策略的全部关联'] || [];
  const nowPo = center.sql('SELECT POID, PID, OBJTYPE, OBJID FROM POLICYOBJECT WHERE PID IN (' + env.colleague.pids.join(',') + ')');
  po.forEach((b) => {
    if (!nowPo.find((r) => r[0] === b[0] && r[1] === b[1] && r[2] === b[2] && r[3] === b[3])) notes.push('关联 POID ' + b[0] + '（PID ' + b[1] + ' → 组 ' + b[3] + '）不见了');
  });
  const G = P.load().groupId;
  nowPo.forEach((r) => {
    if (po.find((b) => b[0] === r[0])) return;
    if (r[2] === '1' && G && r[3] === G) return; // 指向测试组的照抄关联，允许
    notes.push('多出关联 POID ' + r[0] + '（PID ' + r[1] + ' → 类型 ' + r[2] + ' 对象 ' + r[3] + '）');
  });
  // ③ 13.220 所在组：基线 EPINFO 段第 4 列是 GROUPID
  const ep = (s['EPINFO 两台终端'] || []).find((r) => r[1] === env.t220.sguid);
  const nowEp = center.sql("SELECT GROUPID FROM EPINFO WHERE SGUID='" + env.t220.sguid + "'")[0];
  if (ep && (!nowEp || nowEp[0] !== ep[3])) notes.push('13.220 组号变了：' + (nowEp && nowEp[0]));
  return { ok: notes.length === 0, notes };
}

module.exports = { check, sections };

/**
 * 13.220 只读快照（计划要求每个用例都记一次它的 ptfile 列表和 PSTAMP，确认测试没碰到它）。
 * 和 TK-0 基线比：ptfile 进程管控文件的 md5 集合、EPINFO.PSTAMP。
 *   - 都没变：same=true；
 *   - 变了：same=false，同时看它的 ptfile 是否和它所在组 pgl_<组号> 一致（一致说明是正常下发，多半是同事改了它的组）。
 * 只读：SSH 只列文件（terminal.listFiles，13.220 不重试登录）、库只 SELECT。
 */
function t220() {
  const term = require('./terminal');
  const txt = fs.readFileSync(path.join(path.dirname(FILE), 'terminal-13.220.txt'), 'utf8');
  const sec = txt.split('## ptfile PROCM')[1].split('## ')[0];
  const baseMd5 = sec.split('\n').map((l) => l.split(' ')[0]).filter((x) => /^[0-9a-f]{32}$/.test(x)).sort();
  const ep = (sections()['EPINFO 两台终端'] || []).find((r) => r[1] === env.t220.sguid) || [];
  const now = center.sql("SELECT GROUPID, PSTAMP FROM EPINFO WHERE SGUID='" + env.t220.sguid + "'")[0] || [];
  const files = term.listFiles('t220', 'ptfile');
  const nowMd5 = files.map((f) => f.md5).sort();
  const same = nowMd5.join() === baseMd5.join() && now[1] === ep[6];
  let matchesGroup = null;
  if (!same) {
    const items = center.procmItems(now[0]) || [];
    matchesGroup = items.map((i) => i.md5).sort().join() === nowMd5.join();
  }
  return { same, matchesGroup, base: { pstamp: ep[6], ptfile: baseMd5 }, now: { group: now[0], pstamp: now[1], ptfile: files } };
}

module.exports.t220 = t220;
