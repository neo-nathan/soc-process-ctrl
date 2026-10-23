# 应用到组切真接口 · 101 实测记录

- 时间：2026-10-23 02:2x～02:3x EDT（= 北京 10-23 14:27～14:33 CST）；Claude in Chrome，用户登录 optadmin；确认登录态只用 `RsCore.ajax`。
- 被测前端（101 与本地 SOC 工作副本指纹一致，sha256 前 16 位）：`list.js` `d2791599812addf6`、`bwlistMock.js` `192eabbe0de77aea`。页面实际加载的 `list.js` 带 `?ver=` 防缓存参数，内容已核对为新版。
- 后端：控制器 `esmCenter/controllers/Procmanager.php` 测试开始时 md5 `8cd7d161…`，测试结束时 `e9007d92…`（测试期间被同事改过）；模型 `models/BaseDA/Procmanager.php` 始终 `f143a08d…`。两版下 bug 现象一致。
- 测试名单：PID 75「数据库服务器白名单」（白名单，唯一「已发布」的名单）。测试组：`根管理组 / 业务组02 / 子组A / 子组A-02 / 子组A-02-01`（ID 17902277168931，没开继承、没有子组、没有终端；测试前已挂其他策略 3 条）。
  - 先试过 `业务组01/…/子组A-01-01`（ID 17902277164219）：它开了继承，树上不能单独勾（树组件固有规则），改用上面这个组。

| # | 用例 | 结果 |
|---|---|---|
| U-1 | mock 已关：`bwlistMock.isEnabled()` / `isInstalled()` | false / false，PASS |
| U-2 | `Policycenter/getUsedGroupId` 带产品号 `2DA19BD4-…`、pid 75 | code 0，`aUsedGroupId: []`、`aLockGroupId: []`，PASS |
| U-3 | 同上但 `productid` 为空 | code 1「参数错误」——证明必须补产品号 |
| U-4 | 页面打开 PID 75 的「应用到组」弹窗 | 标题「已应用组（数据库服务器白名单）」，树 605 个节点，已选 0，PASS |
| U-5 | 勾测试组 → 点「应用」 | 请求 `pid=75, policytype=2, aObjId=["17902277168931"]`；后端返回非 JSON「0:服务异常，请联系管理员」；**库已写入**（`POLICYOBJECT` 新增 1 行，组缓存 `heid_….pgl_17902277168931` 多了 PROCM `policytype=2` 一项）——后端 bug |
| U-6 | 后端报错原因（`logs/php_errors.log`） | `Unknown column 'Array' in 'where clause'`：`resetWBListRedis` → `RedisDataManager::updateClientPolicyVer($eid, $aGroups, 1, …)` 把组号数组当单个组号拼进 SQL |
| U-7 | 刷新列表后再打开弹窗 | 列表「1 个组 0 台终端」；弹窗测试组已勾、计数 1（取已选组回显正确），PASS |
| U-8 | 取消勾选 → 应用（第一版前端） | 请求 `aObjId=[]`，后端同样报错，库里关联已删 |
| U-9 | 前端兜底第一版（结果不明时刷新列表）：再勾 → 应用 | 弹「系统异常，请稍后再试！」，列表自动刷新为「1 个组 0 台终端」，PASS |
| U-10 | 同一弹窗不关、取消勾选 → 应用 | **没发请求**：弹窗记的「打开时已选」还是空，被当成「原来没组、现在没勾」直接关窗 → 前端改为结果不明时关弹窗 |
| U-11 | 修正后：重开弹窗（回显 1 组）→ 取消勾选 → 应用 | 请求 `aObjId=[]`，后端报错，弹窗自动关闭，列表刷新为「--」，PASS |
| U-12 | `usedGroup` 提交未发布的 PID 60 | code 4「该名单尚未发布，请先发布后再修改应用范围。」，库未改，PASS |

## 收尾核对（只读查库）

- PID 75：`POLICYOBJECT` 0 行（和测试前一致），`STATUS` 4；`UPDATETIME` 变为 2026-10-23 14:33:06（`usedGroup` 每次都会更新）。
- 测试组 17902277168931：`POLICYOBJECT` 3 行（和测试前一致）。
- PID 60：`POLICYOBJECT` 0 行，`UPDATETIME` 未变。
- Redis：测试组的组缓存里留着一条 PROCM `policytype=2`、内容为空 userlibs 的项（取消后后端按设计下发空名单的结果）；该组没有终端，不影响任何机器。
- `php_errors.log` 里本次测试产生 4 条 `Unknown column 'Array'`（14:27:50、14:29:53、14:31:59、14:33:06，对应 U-5、U-8、U-9、U-11）。
- **测试结束后别人也在用 PID 75**：14:34:32 又有一条同样的报错（调用栈同为 `usedGroupAction` → pid 75），库里 PID 75 在 14:34:31 新挂了组 ID 3「默认分组」，`UPDATETIME` 再变为 14:35:08，操作人同为 optAdmin 账号，不是本次测试发起的；未动这条数据。所以「PID 75 = 0 个组」只到 14:33:06 为止成立。
