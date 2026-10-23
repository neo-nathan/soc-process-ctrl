# PL-03 101 浏览器实测结果（文本证据）

- 时间：2026-10-22 21:33～21:43 EDT（= 10-23 09:33～09:43 CST）；Claude in Chrome，用户登录 optadmin；确认登录态只用 `RsCore.ajax`。
- 101 文件指纹（实测时）：`bwlistAdapter.js` 78e8cdacade702f91cf00091a7e826a4、`list.js` 366f6f189d4598c487e84111c1bfa6be、`list.html` d34d7edc6b83975d408b7b1401ef7b94（未改）、`bwlistMock.js` 先 ad638ec01e272efb88140a701f27d7ed，09:41 CST 修 `dispatch` 后 2ecf0a998f447ece90e46a8566779446。
- 实际执行顺序：S-1 白 → S-2 → S-3 → S-1 黑 → S-5（PID 40 拒绝）→ S-4 创建 PID 77、加进程 → S-5（PID 77 成功）→ S-4 编辑 → S-6 → S-7 → S-4 删除 PID 77 → 修 dispatch 后复测 S-5 拒绝。下表按用例编号排，不等于执行顺序。
- 请求参数用页面里装的只读 XHR 记录器取（只记 URL、请求体、响应）；预期按同一时刻只读 SQL（`sql-baseline-20261023-0925CST.txt`）算。

| # | 结果 | 实测要点 |
|---|---|---|
| S-1 白 | PASS | 请求只有 `policytype=2`、`timeRange=0`；11 条 = SQL；页面顺序 36,37,38,40,41,42,43,60,64,75,76（后端是 76…36 倒序）；STATUS 2→待发布、1→`--`；PID 40「待发布」0 进程；进程总数 7 = SQL 添加数之和；终端数 0；无「已筛选」 |
| S-1 黑 | PASS | `policytype=3`、`timeRange=0`；1 条 PID 39「有变更」0 进程；展开后「发布」灰（发布后进程数为 0）、「应用到组」灰 |
| S-2 | PASS | 本周→`timeRange=1` 11 条；本月→2 11 条；上月→3 0 条；发布状态 0/1/2/3→`status` 1/2/4/3，结果 4/7/0/0 条；已应用→`objrange=1` 0 条；未应用→`objrange=0` 11 条；有新增→`procstatus=1` 6 条；有移除→`procstatus=2` 0 条；只填起 10-22→`begintime` 4 条；只填止 10-19→`endtime` 7 条（含当天）；起止 10-19～10-21 7 条；同一天 10-22 4 条；系统类型 Linux→`eptype=2` 11 条。有条件时第二个请求 = `policytype`+`timeRange=0`，Y=11；「已筛选出 X 个，共 Y 个」X≠Y 时显示（在高级搜索框内，如 4/11） |
| S-3 | PASS | 关键字 `TEST`→7 条（test1…test8）；`  白名单 `（首尾空格）→60,75,76；`服务器`→60,75,76；本周+`test6`→40,41；再加待发布→`status=2`+前端筛 40,41；再加无变更→PID 40；请求里从不出现 `kw`，无变更不发 `procstatus` |
| S-4 | PASS | 页面「创建白名单」建 `PL03测试-白1`→PID 77 立即出现在末尾（`--`、0 进程）；`addProcToWBList` 加 1 个进程后刷新→「待发布」0+1，进程总数 8；页面「编辑」改名→`PL03测试-白1改` 立即更新；页面「删除」→消失，11 条 |
| S-5 | PASS（修 1 处后） | PID 77 待发布+1 点发布：确认框「发布后进程数为 1」，成功提示「已发布，应用到组后下发」，没有请求发往后端，列表仍「待发布」。PID 40 待发布+0 点发布：mock 拒绝（code 4「发布后进程数为 0…」）。**发现旧缺陷**：mock `dispatch` 裸调 `RsCore.msg.warn` 丢了 `this`，报「this.run is not a function」、提示弹不出、`complete` 被打断；修复上传后复测：提示正常显示，页面无报错 |
| S-6 | PASS | 所有名单都不是已发布，「应用到组」全灰；`getWBListUsedGroupId`→`{aUsedGroupId:[],aLockGroupId:[]}`；`setWBListGroups`（PID 77 待发布）→code 4「先发布…」；名单页→概览：mock 已卸载、`RsCore.ajax` 未被包；回名单页：只包一层，`getWBList` 走真接口 200 |
| S-7 | PASS | （白名单页，当时测试名单 PID 77 还没删，共 12 条）把下一次列表请求改到不存在的地址：core.js 只弹 1 次提示，表格不卡「正在加载」，再刷新恢复 12 条；jQuery 正规 `abort()` 后加载遮罩收起 |

收尾核库（09:42 CST）：`PL03%` 名单 0 条、测试进程 0 行；12 条名单的 STATUS、添加数、组数与开工基线完全一致。

说明：实测中我给 `RsCore.msg.warn` 叠了几层记录钩子，曾造成提示被重复计数和调用栈溢出（控制台 6 条报错都来自这些匿名钩子）；之后 `location.reload()` 整页重载、无钩子环境下重测了 S-5 拒绝和 S-7。

内审第 1 轮整改后（10-23 09:50 CST）：`bwlistAdapter.js`、`list.js` 只改注释，重传后指纹 `bwlistAdapter.js` 7c197a4748c81a62d524b784d21ee337、`list.js` b8b61a228c9ae5f4a2f82c5423479b84（`bwlistMock.js` 2ecf0a99…、`list.html` d34d7edc… 不变），本地与 101 一致；整页重载冒烟：白名单 11 条、顺序与 S-1 相同、底部 11 个 / 7 个。

内审第 2 轮整改后（10-23 09:54 CST）：`bwlistMock.js` 只改文件头一句注释（`usedGroup` 已实现），重传后 d76b79d6e4d249ac3302c6cf7e589d91；其余三个文件不变（7c197a47… / b8b61a22… / d34d7edc…），本地与 101 一致。
