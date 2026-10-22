# PL-02 TK-1 计划级验收 — 数据层只读查询（101 MySQL RS_ESM_LOG）

- 执行工具：同目录 `ro-query.sh`（只放行单条 SELECT，拒绝写关键字；凭据运行时由环境变量传入，不落文件）
- 依据：PL-02 §七 S-1「库里 POLICYTYPE 分别为 2 / 3、EPTYPE=2，名单进程表里该名单 0 行」；S-2「库里 PNAME、DESCRIPTION 已改、POLICYTYPE 不变」；S-4「编辑后库里名单总数不变」；§七 首句「只改、只删本计划自己新建的名单（名称统一用 PL02测试- 开头），同事的数据一条不动，测完删掉」；§五「名称、描述都先去掉首尾空格」

## Q0 测前基线（07:58 EDT）

```sql
SELECT PID, PNAME, POLICYTYPE, EPTYPE, CREATETIME FROM POLICY WHERE POLICYTYPE IN (2,3) ORDER BY PID;
-- 11 行：PID 35-43、60、64（同事数据）
SELECT COUNT(*) AS LISTS FROM POLICY WHERE POLICYTYPE IN (2,3);          -- 11
SELECT COUNT(*) AS ALLPOLICY, MAX(PID) AS MAXPID FROM POLICY;            -- 40、64
SELECT PID,PNAME FROM POLICY WHERE PNAME LIKE 'PL02%' OR PNAME LIKE '%PL02测试%';   -- 0 行（无上一轮残留）
SELECT (SELECT COUNT(*) FROM RPW_WPROC) AS WPROC, (SELECT COUNT(*) FROM RPW_BPROC) AS BPROC, (SELECT COUNT(*) FROM POLICYOBJECT) AS POBJ;  -- 9、0、2464
```
逐行指纹（同事数据零改动的核对依据），存 `db-before-policy-rows.txt`、`db-before-wproc.txt`：
```sql
SELECT PID, MD5(CONCAT_WS('|',PID,PNAME,IFNULL(DESCRIPTION,''),IFNULL(POLICYTYPE,''),IFNULL(STATUS,''),EPTYPE,PRODUCTID,IFNULL(UPDATETIME,''),IFNULL(POLICYJSON,''),IFNULL(POLICYVER,''))) AS ROWMD5 FROM POLICY ORDER BY PID;
SELECT BWID, COUNT(*) AS N, MD5(GROUP_CONCAT(CONCAT_WS('|',ID,FILEHASH,PROCPATH,STATUS) ORDER BY ID)) AS FP FROM RPW_WPROC GROUP BY BWID;
```

## Q2 S-1 白名单创建后（20:02 CST）

```sql
SELECT PID, CONCAT('[',PNAME,']'), CONCAT('[',DESCRIPTION,']'), POLICYTYPE, EPTYPE, CREATEUSER, CREATETIME FROM POLICY WHERE PNAME LIKE '%PL02%';
```
| PID | PNAME（方括号看首尾空格） | DESCRIPTION | POLICYTYPE | EPTYPE |
|---|---|---|---|---|
| 65 | [PL02测试-白创建] | [PL02测试描述-白] | 2 | 2 |

页面输入是 `  PL02测试-白创建  `、`  PL02测试描述-白  `（前后各 2 空格）→ 库里已去掉首尾空格：**绿**（§五「提交」）。
```sql
SELECT (SELECT COUNT(*) FROM RPW_WPROC w JOIN POLICY p ON p.PID=w.BWID WHERE p.PNAME LIKE '%PL02%') AS WPROC_ROWS,
       (SELECT COUNT(*) FROM RPW_BPROC b JOIN POLICY p ON p.PID=b.BWID WHERE p.PNAME LIKE '%PL02%') AS BPROC_ROWS,
       (SELECT COUNT(*) FROM POLICY WHERE POLICYTYPE IN (2,3)) AS LISTS;   -- 0、0、12
```
（页面表格里新名单的进程数显示「0 +2」、发布状态「待发布」等，是 PL-01 mock 按 PID 算的假字段；库里名单进程 0 行才是 S-1 判据。）

## Q3 S-2 / S-4 白名单编辑后（20:08 CST）
| PID | PNAME | DESCRIPTION | POLICYTYPE | EPTYPE | UPDATETIME |
|---|---|---|---|---|---|
| 65 | [PL02测试-白已编辑] | [PL02测试描述-白已改] | 2 | 2 | 20:08:08 |

`LISTS` 编辑前 12 → 编辑后 12（不变）：**绿**。

## Q4 S-4 双击「保存」、双击「创建」后（20:09 CST）
| PID | PNAME | DESCRIPTION | POLICYTYPE |
|---|---|---|---|
| 65 | [PL02测试-白已编辑] | [PL02测试描述-白连点保存] | 2 |
| 66 | [PL02测试-白连点] | [] | 2 |

双击创建只多出 PID 66 一行（LISTS 13）：**绿**。

## Q5 S-1 / S-2 黑名单（20:11 CST）
| PID | PNAME | DESCRIPTION | POLICYTYPE | EPTYPE | CREATETIME | UPDATETIME |
|---|---|---|---|---|---|---|
| 67 | [PL02测试-黑已编辑] | [PL02测试描述-黑已改] | 3 | 2 | 20:10:28 | 20:11:11 |

POLICYTYPE=3、EPTYPE=2、编辑后仍 3；RPW_BPROC 该名单 0 行：**绿**。S-7 又建了 PID 68「PL02测试-白离开后」（POLICYTYPE 2）。

## Q6 清理后（20:16 CST）
测试新建 4 条（PID 65、66、67、68）全部经名单页展开行「删除」→ 确认弹窗「删除」走正式入口删掉（确认文案分别是「确定删除「PL02测试-白离开后」/「PL02测试-白连点」/「PL02测试-白已编辑」/「PL02测试-黑已编辑」吗？删除后不能恢复。」）。
```sql
SELECT PID,PNAME FROM POLICY WHERE PNAME LIKE '%PL02%' OR PID>64;          -- 0 行
SELECT COUNT(*) AS LISTS FROM POLICY WHERE POLICYTYPE IN (2,3);            -- 11（= 测前）
SELECT (SELECT COUNT(*) FROM RPW_WPROC WHERE BWID>64), (SELECT COUNT(*) FROM RPW_BPROC WHERE BWID>64),
       (SELECT COUNT(*) FROM RPW_WPROC), (SELECT COUNT(*) FROM RPW_BPROC), (SELECT COUNT(*) FROM POLICYOBJECT);   -- 0、0、9、0、2464（= 测前）
```
`diff db-before-policy-rows.txt db-after-policy-rows.txt` → 无差异（POLICY 全表 40 行逐行指纹一致）；
`diff db-before-wproc.txt db-after-wproc.txt` → 无差异。**同事数据零改动：绿。**
