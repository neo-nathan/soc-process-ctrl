# 发布切真接口 releaseWBList · 101 浏览器实测结果

- 时间：2026-10-22 22:2x EDT（北京 10-23 10:2x）；Claude in Chrome，用户登录 optAdmin。
- 101 文件指纹（本地 = 101）：`list.js` 22133e74…、`bwlistMock.js` 77448051…；`bwlistAdapter.js` 7c197a47…、`bwlistModal.js` bd40efd4…、`list.html` d34d7edc… 未改。旧版备份在 101 `/tmp/procm-release-bak-202610222220/`。
- 第一次进名单页时会话被清（页面弹「系统提示」后跳登录页），本 Agent 当时没调任何接口，原因未查明；用户重登后用 `RsCore.ajax` 调一次 `getWBList` 确认会话正常，之后未再掉。

| 编号 | 结果 | 做了什么 / 看到什么 |
|---|---|---|
| R-0 | PASS | 页面加载的是新文件：`bwlistMock.URLS` 只剩 `getWBListUsedGroupId`、`setWBListGroups`，`MSG` 只剩 `APPLY`，mock 已安装 |
| R-1 | PASS | 页面「创建白名单」建 `发布切真接口测试-白1`（PID 81）；`RsCore.ajax` 调 `addProcToWBList` 加 1 个进程（`/usr/bin/claude-release-test`）；刷新后这一行 `0 +1`，发布状态显示「有变更」（后端给的 STATUS 3，应为待发布，记 P24 ⑬） |
| R-2 | PASS | 展开行 →「发布」→ 确认框「确定发布「发布切真接口测试-白1」吗？发布后进程数为 1。发布后才能应用到组」→ 点「发布」：请求 `Procmanager/releaseWBList` 约 123 ms；提示「已发布，应用到组后下发」；弹窗关闭、表格刷新，这一行进程数 1、状态「已发布」 |
| R-3 | PASS | 库（只读）：PID 81 `STATUS`=4、`POLICYJSON` 写入 userlibs 内容；进程行 `STATUS` 1→0；`POLICYOBJECT` 0 行（没应用到组，没推 Redis）；`ruc/libs/w/u` 生成 6 个 zip（aarch64、loongarch64、loongarch64_3c6000、mips64、sw_9916、x86_64）。见 `after-publish-pid81.txt` |
| R-4 | PASS | 展开行：发布按钮置灰，悬停「没有变更，不需要发布」；直接调一次 `releaseWBList`：后端 code 6「名单没有改动，不需要发布。」，页面弹出该提示 |
| R-5 | PASS | 页面「删除」→ 确认框文案正确 → 删除成功，剩 12 条；库里 PID 81 和它的进程行都没了。**6 个 zip 没被删**（记 P24 ⑫，留在 101，未清理）。见 `after-delete.txt` |

未覆盖：有应用范围的名单发布（会往终端推策略，共享环境不做）——`OBJCOUNT > 0` 的提示分支只由单测 `tests/list-publish.test.js` 覆盖。
