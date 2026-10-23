---
name: 发布切真实releaseWBList接口
description: 名单页发布改调 101 后端 releaseWBList，mock 只留应用到组 2 个地址，成功提示由前端按 OBJCOUNT 拼两种；单测与 101 实测通过（测试名单已删，6 个 zip 后端未清）；设计 01 同步并补 P24 ⑩～⑭；svn 未提交。
---

# 发布切真实 releaseWBList 接口

## 改了什么

- SOC 源码（`/Users/nick/Workspace/ESMCenterST/public/esm/view/processManage/`，已上传 101，svn 未提交）：
  - `list.js`：`URL_PUBLISH` 改为 `Procmanager/releaseWBList`；新增 `TXT_PUBLISH_APPLIED` / `TXT_PUBLISH_UNAPPLIED` 和 `publishOkMsg(data, row)`（按后端返回的 `OBJCOUNT` 选提示，缺字段时退回看行的 `GROUPNUM`）；`CONFIRM` 两项加 `okMsg`，`submitConfirm` 成功时弹 `cfg.okMsg(...)`（删除仍弹后端 msg）；相关注释同步。
  - `bwlistMock.js`：删掉发布的拦截（`URL_PUBLISH`、`handlePublish`、`MSG.PUBLISH_*`），`URLS` 只剩 `getWBListUsedGroupId`、`setWBListGroups`；`findRow` 只留 `PUBSTATUS`；文件头说明同步。导出的函数名不变。
- 设计 01：第 0 节新增「10-22 补充：发布切真实 releaseWBList」；7.4 伪代码改名并在末尾补「101 后端现实现的差别」；第 9 节接口表发布行；9.1 开头、9.1.1 拦截点与 mock 说明；9.1.3 整节改写（出参、错误码、页面提示、实测）；12.1 P24 ⑧改写、新增 ⑩～⑭。
- 新增 `implement/releaseWBList/`：`tests/`（`mock.test.js` 8 项、`list-publish.test.js` 4 组、`amd.js`）、`evidence/`（测试前后只读查库、浏览器结果）。

## 为什么

- 用户要求把名单页「发布」从 mock 切到 101 已实现的真接口 `releaseWBList`（10-22 讨论后选推荐方案：只把发布从 mock 里拿掉、提示前端按 `OBJCOUNT` 拼、用新建的不应用到组的测试名单实测）。
- mock 只有一个总开关同时管 3 个地址，直接关会让应用到组也去调还没对齐的接口，所以只删发布这一路。
- 后端成功只回「发布成功。」，设计 8.8 第 12 条要两种说法，按后端返回的 `OBJCOUNT` 判断比看列表更准。

## 怎么验证

- 语法 `node --check`、ES5（acorn ecmaVersion 5）：两个文件都通过。
- 单测：`node implement/releaseWBList/tests/mock.test.js` 8 项全过（发布新旧地址都放行、应用到组照拦）；`node implement/releaseWBList/tests/list-publish.test.js` 全过（地址、两种文字和原 mock 一字不差、`publishOkMsg` 9 种输入、`CONFIRM` / `submitConfirm` 接线、旧地址只剩 1 句说明）。全 `public` 搜不到 `MSG.PUBLISH_*` 的引用。
- 和 101 上旧版逐处 diff 重读；上传前核 101 指纹 = 本地旧版（`b8b61a22…`、`d76b79d6…`），备份到 101 `/tmp/procm-release-bak-202610222220/`，上传后本地 = 101（`list.js` 22133e74…、`bwlistMock.js` 77448051…）。
- 101 实测 R-0～R-5 全部通过（`implement/releaseWBList/evidence/browser-results.md`）：测试名单 PID 81 加 1 个进程后页面发布，提示「已发布，应用到组后下发」，库 `STATUS`=4、进程 1→0、生成 6 个 zip，耗时约 0.1 秒；再发后端 code 6 并弹原因；页面删除后库里清干净。
- 读 101 后端代码（只读）：控制器 / 模型指纹 `f30eabe3…` / `3f6fad1e…`（北京 10-23 10:07）；ACL 已登记 `releaseWBList`，角色 `['2','8']`。

## 边界

- svn 未提交；本仓库未提交。
- 没测「有应用范围的名单发布」（会往终端推策略，共享环境不做），`OBJCOUNT > 0` 分支只有单测覆盖。
- 测试名单删除后，它的 6 个 zip 仍在 101 `ruc/libs/w/u/EAB1C51B2115966BADD4697E27EB28F6_*.zip`（后端删除不清 zip，P24 ⑫），本次未删，等用户决定。
- 第一次进页面时登录会话被清，原因未查明（当时本 Agent 没调接口）；重登后正常。
- 实测时其他名单（PID 41、42 等）的进程数在变，是同事的数据，未触碰。
- 后端发现（P24 ⑩～⑭）：包格式 / 路径 / 状态值和 7.4 不同且没有行锁、写 Redis 失败仍报成功、删除不清 zip、空名单加第一个进程变「有变更」、`algo=1` 存成 0；前端不处理，待转后端。

## 追加（2026-10-22 22:33 EDT）：经验沉淀与状态页

- `insights/insight-20261022-0447-101共享环境联调的坑.md` 补第 7 条坑、一条结论、一条检查项：本机 zsh 不按空格拆变量，`ssh $SSHO` 失败且被 `2>/dev/null` 吞掉，核指纹输出为空（PL-03 一次、本次一次；本次因「指纹对上才传」当场停住）。frontmatter 未改；memory `env101-shared-pitfalls.md` 同步一句；`gen-index.py insights --write / --check` 通过。
- `CurrentStatus.md`：当前结论、阶段表新增发布一行、后端不一致阻塞项（P24 14 项）、新增「测试 zip 留在 101」待决项、下一步 1/2/4、仓库现场；检查脚本 RESULT=PASS。

## 追加（2026-10-22 22:47 EDT）：测试 zip 先留着

- 用户定：101 上测试名单 PID 81 留下的 6 个 zip（`ruc/libs/w/u/EAB1C51B2115966BADD4697E27EB28F6_*.zip`）先不删，等后端看 P24 ⑫（删除名单不清 zip）时当现场；状态页待决项改为这个决定。
