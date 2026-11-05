// 只读：把 14.15 当前的库、Redis 和 TK-0 基线逐项比对，输出不一致处
const E = '/Users/nick/Workspace/soc-process-ctrl/e2e/lib/';
const center = require(E + 'center'), env = require(E + 'env');
const out = {};
// 两台终端的 EPINFO 关键列（组、策略版本）
out.epinfo = center.sql("SELECT SGUID, IP, GROUPID, PSTAMP FROM EPINFO WHERE SGUID IN ('475C1D126323B3E79B980CFF93E09AF9','78430109337043509D862FE36885AD79')");
// 组：基线没记 ORDERVAL，这里全量记下
out.groups = center.sql('SELECT ID, GROUPNAME, PARENTID, ISINHERIT, ORDERVAL FROM GROUPINFO ORDER BY ID');
// 进程管控策略：只应剩同事的 3、22、25、26
out.policies = center.sql("SELECT PID, PNAME, POLICYTYPE, UPDATETIME, MD5(POLICYJSON) FROM POLICY WHERE UPPER(PRODUCTID) LIKE '" + env.procmGuid + "%' ORDER BY PID");
out.links = center.sql("SELECT po.POID, po.PID, po.OBJTYPE, po.OBJID FROM POLICYOBJECT po JOIN POLICY p ON p.PID=po.PID WHERE UPPER(p.PRODUCTID) LIKE '" + env.procmGuid + "%' ORDER BY po.POID");
out.rows = center.sql("SELECT 'RPW_WPROC',COUNT(*) FROM RPW_WPROC UNION ALL SELECT 'RPW_BPROC',COUNT(*) FROM RPW_BPROC");
// Redis 三个组缓存里的进程管控项
out.redis = {};
['1', '3', '58659703'].forEach((g) => { out.redis[g] = (center.procmItems(g) || []).map((x) => x.policytype + ' ' + x.policyver + ' ' + x.md5); });
console.log(JSON.stringify(out, null, 1));
