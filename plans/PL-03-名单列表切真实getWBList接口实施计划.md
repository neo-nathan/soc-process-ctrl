# PL-03 名单列表切真实 getWBList 接口实施计划 v0.2

> 引用本文写 **PL-03**；子任务写 `PL-03 TK-n`，事实写 `PL-03 F-n`，风险写 `PL-03 R-n`。
> 起草：2026-10-22 21:06 EDT（101 本机时间 10-23 09:06 CST）；本仓库 `main` = `51373ae`（领先远端 8 个提交）。
> 状态：**已完成**（2026-10-22 21:22 EDT 用户放行，Q4、Q5 按默认；用户要求不走 implement-plan、直接改，循环自检 + 独立内审 4 轮收敛；101 实测 S-1～S-7 通过；svn 未提交）。记录见 `changelog/log-20261022-2150-实施PL-03.md`，证据见 `implement/PL-03/`。计划外多修 1 处：mock `dispatch` 提示弹不出的旧缺陷。
> **v0.1 自检**：3 轮，修正 4 处——F-7 两个行号、F-5 脏数据成因改标「推断」并给依据、Q5 单测覆盖范围说准、TK-2 grep 判据排除注释。
> **v0.2 循环自检**（2026-10-22 21:15 EDT 起，用户要求「循环自检直到找不出问题」；101 指纹 10-23 09:12 CST 复核未变）：第 1 轮 8 项修正——F-1 补 `param()` 对 0 的处理和「只认 policytype」、新增 F-10（后端自己维护状态）/ F-11（不返回 PRODUCTID）/ F-12（PL-01 旧测试会失效）、§3.1 写明不再带旧名 `type`、删掉不成立的 `hideMsg` 说法、系统类型下拉只有 2、§3.3 补 `reset` 和 `EP_PER_GROUP`、§4.1 把要同步的 `list.js` 注释逐处列全（新增 `:519`、`:1148-1152` 两处，并写明文件头「只拦 4 个」改 3 个）；连带同步 TK-1 单测判据与存放位置、S-4、TK-5 清单、§八；第 2 轮修正 2 处——F-12 把旧测试的依赖说准（TK-4 harness 没直接用要删的导出）、TK-2 grep 判据补 `dateRange` / `EP_PER_GROUP` / `setNow`；第 3 轮修正 2 处——本说明里第 1 轮的处数写准、§4.2 设计 12.1 待对齐清单补齐到和 TK-5 给同事的清单一致；第 4 轮修正 1 处——§4.2 补「添加后又移除」怎么记，和 TK-5 清单逐项一致；第 5 轮未发现问题。
> 在哪改：
> - 页面代码：本地 SOC 源码工作副本 `/Users/nick/Workspace/ESMCenterST/`（只当编辑区），改完上传到 101 `/opt/BDFZ/ESM/data/web/` 测试。**svn 不提交**，等用户另行指令。
> - PHP 后端：**不改**（同事在开发）。设计文档 01 §9.1 同步改（TK-3）。
> 前置：[PL-01](PL-01-黑白名单列表页前端实施计划.md)（列表页、mock）、[PL-02](PL-02-名单页创建编辑弹窗独立实施计划.md)（名单页自带弹窗）都已完成。本计划只改「列表从哪取数」，页面外观、按钮规则不变。

## 一、背景与拍板

### 1.1 用户需求（2026-10-22）

- 用户原话：「先把 getWBList 接口切换为真实接口 需要适配参数和返回结果 其他先不动」。
- 现状：名单列表请求被 `bwlistMock.js` 拦下：它调真接口只拿名单的基本信息，进程数、发布状态、应用范围等 6 个字段按 PID 现编，高级查询也在前端做。101 后端 `getWBList` 现在已经能返回这些数、也能按条件查（F-1、F-2），可以切过去。

### 1.2 拍板（用户原话：「按方案 1：mock 发布/应用到组改用真实列表行校验，成功只弹提示、不改列表；其余按你的推荐（排序前端保持升序、EPNUM 先给 0）。先写成 PL-03 计划给我看。」）

| # | 问题 | 拍板 |
|---|---|---|
| Q1 | 列表切走后，还在 mock 的「发布」「应用到组」怎么办（F-6） | **方案 1**：这两个 mock 改用「最近一次真实列表里这一行」的数据判断能不能做；成功只弹提示，**不改列表**、不在内存里记结果（列表永远只显示后端的真实数据） |
| Q2 | 排序 | 前端按创建时间**升序**重排（照设计 §9.1.2 / demo），同一时间按 PID 升序；不用后端的 PID 倒序 |
| Q3 | 终端数 `EPNUM`（后端没有） | 先给 0（现在应用到组没做，组数全是 0，「0 个组 0 台终端」不算错）；后端补字段后再接 |
| Q4 | **待确认（有默认）**：参数 / 字段转换代码放哪 | 默认：**新建** `view/processManage/bwlistAdapter.js`（真接口适配，长期保留）；`bwlistMock.js` 只剩发布、应用到组两个 mock（后端做完整个删掉）。`toRow` 从 `bwlistMock.js` 搬到新文件。理由：转换是给真接口用的，放在将来要删的 mock 文件里不合适；新文件只有名单页用，不会和同事冲突。用户若想少一个文件，放行时说「放 bwlistMock.js」，§三、§四 相应改 |
| Q5 | **待确认（有默认）**：`MODE='fake'`（全假数据、演示全部发布状态）还留不留 | 默认：**删掉**。列表不再被拦，fake 模式已经无从生效；留着是死代码。代价：页面上演示不了「已发布」（真库现在没有，F-5；「有变更」只有脏数据 PID 39）。这两种状态在页面上怎么显示、按钮怎么置灰是 `list.js` 的现有规则，本计划不改，PL-01 已用 fake 模式验收过；本计划只保证后端 `STATUS` 4 / 3 换成页面 2 / 3 是对的（TK-1 node 单测） |

## 二、已核实的事实（2026-10-22 21:06 EDT 前后实测，101 全部只读）

| # | 事实 | 怎么核的 | 对计划的影响 |
|---|---|---|---|
| F-1 | **后端 `getWBListAction` 的入参**（101 `esmCenter/controllers/Procmanager.php`，md5 `da86bf47f018b7a4dba5446030dd883f`，北京 10-22 17:25 改）：`policytype` 2 / 3（必填，否则「参数错误。」code 1）；`eptype` 空 / 1 / 2；`timeRange` **缺省 1（本周）**，1 / 2 / 3 = 本周 / 本月 / 上月，其他值走 `begintime` / `endtime`（`yyyy-mm-dd`，`endtime` 后端自动加一天，即含当天；两个都空 = 不限）；`status` 空 / 1 空白名单 / 2 待发布 / 3 有变更 / 4 已发布；`objrange` 空 / 1 有 / 0 没有应用范围；`procstatus` 空 / 0 / 1 / 2 = 名单里**存在**已确认 / 添加 / 移除状态的进程。返回 `{rows, total}`，total = 条数，不分页。只认 `policytype`，**不再读旧名 `type`**。取参数的 `param()`（`controllers/My.php:156`，md5 `14b0b19567d370ee26b36ddce8c13509`）用 `isset` 判断、不用 `empty`，所以传 `'0'` 拿到的就是 `'0'`：`timeRange=0`、`objrange=0` 都有效 | 101 只读 `sed -n 1035,1110p`、`My.php:150-170` | §3.1 参数对照 |
| F-2 | **后端返回的每行字段**（101 `models/BaseDA/Procmanager.php` `getWBList`，md5 `f11e18569ab6abc637769d08abb9b2cc`，北京 10-22 17:00 改）：`PID、PGUID、PNAME、EPTYPE`（整数）`、SYSTYPE`（文案）`、POLICYTYPE、STATUS`（整数 1～4）`、STATUSTEXT、PROCCOUNT`（= 已确认 + 添加）`、PROCCONFIRMCOUNT`（STATUS=0）`、PROCADDCOUNT`（=1）`、PROCREMOVECOUNT`（=2）`、OBJCOUNT`（应用了它的分组数，只数 `OBJTYPE=1`）`、OBJRANGE`（文案）`、CREATEUSER、CREATETIME、DESCRIPTION`；`ORDER BY P.PID DESC`；没有终端数 | 同上 `sed -n 735,820p` | §3.2 字段对照；Q2、Q3 |
| F-3 | **后端还没有「移除进程」的代码**：控制器和模型里没有任何地方把名单进程写成 `STATUS=2`，只有发布时删 `STATUS=2` 的行（模型 `:1034`）。所以 `PROCREMOVECOUNT` 现在恒为 0；将来是「只把已确认的进程标成 2」还是「添加的也标 2」未知 | `grep -n "STATUS\s*=\s*2"` 两个文件 | §3.2 `PROCNUM` 的换算按「只标已确认的」假设（R-2） |
| F-4 | **后端「本周」截到下周一**（`library/Common.php:114` `getDateRanges`，先设 `Asia/Shanghai`；本周 = 本周一 ~ 下周一，本月 = 1 日 ~ 下月 1 日，上月 = 上月 1 日 ~ 本月 1 日，都是「含起不含止」）；mock 是截到今天。名单创建时间不会在未来，结果相同 | 101 只读 `sed` | 不用处理 |
| F-5 | **101 真库现有名单 12 条**（`RS_ESM_LOG.POLICY`，进程管控产品号）：白名单 11、黑名单 1；`STATUS` 只有 1、2、3，**没有 4（已发布）**；**脏数据**：PID 39（黑名单）`STATUS=3` 但 0 个进程，PID 40 `STATUS=2` 但 0 个进程——**推断**是同事早先把名单类型写进 `STATUS` 留下的（依据：PID 36～43 的 `STATUS` 恰好都等于各自的 `POLICYTYPE`，白 2、黑 3；10-22 新建的 PID 60～76 都是 1；状态页早有「`POLICY.STATUS` 存名单类型」的记录。其中有进程的碰巧和「待发布」吻合）；`POLICYOBJECT` 里这些名单都是 0 个组 | 只读 SQL（照后端同样的条件） | Q5；§3.2「状态以后端为准」；R-3；S-用例的预期按库算 |
| F-6 | **mock 的发布 / 应用到组依赖 mock 列表**：`handlePublish`（`bwlistMock.js:764` 起）、`handleSetGroups`（`:835` 起）先 `isKnown(pid)`，`known` 只在 mock 列表处理里填（`:737`）；再用 `currentFields(pid)` 判断状态，取的是按 PID 现编的假字段。列表不再被拦后，`known` 永远是空 → 两个操作都报「名单不存在。」；就算绕过，判断用的也是假状态，和页面上显示的真状态对不上 | 读代码 | Q1；TK-2 |
| F-7 | **`list.js` 里用到列表接口的地方**（本地 = 101，md5 `ddfe927d9230088ad5ef68dbd0090c78`）：`buildParams`（`:493`）按页面参数名拼；`tableAjax`（`:458`）发请求；`toTableData`（`:520`）逐行 `bwlistMock.toRow`；`updateFiltered`（`:554`，请求在 `:563`）另发一次只带 `{type}` 的 `getWBList` 取「共 Y 个」——切真接口后它会因为没有 `policytype` 报「参数错误。」，就算补上，不带 `timeRange=0` 也只数本周的；`bwlistMock` 在 `list.js` 里只用了 `install`、`uninstall`、`toRow` 三个 | `grep -n "bwlistMock\.\|URL_LIST" list.js` | TK-1 改这 4 处 |
| F-8 | **页面上的查询选项**（`list.html`）：时间 `ctime` 全部 / week / month / lastmonth + 指定日期；发布状态 `pubstatus` 全部 / 0（`{{emptyName}}`，即 `--`）/ 1 待发布 / 2 已发布 / 3 有变更；应用范围 `scope` 全部 / 1 / 0；进程变更 `delta` 全部 / add / del / none（无变更）；系统类型下拉 `systype`；关键字 `kw` | 读 `list.html:40-82`、`list.js:1100-1140` | §3.1 |
| F-9 | **101 上现在的文件**（10-23 09:06 CST）：`bwlistMock.js` `8ac7ae5d9f39e0ed8f0878289a941115`（rising 644）、`list.js` `ddfe927d…`（root 644）、`list.html` `d34d7edc6b83975d408b7b1401ef7b94`（root 644）、`bwlistModal.js` `bd40efd44a7a42d7c4005e62c447c151`；前三个和本地工作副本一致；没有 `bwlistAdapter.js` | `md5sum`、`ls -l` | TK-0 基线 |
| F-10 | **后端会自己维护名单状态**（模型 `refreshWBListStatus`，`:830` 起；加进程 `addWBListProc` 等调用它，`:1396`、`:1447`）：名单里一条进程记录都没有 → 1；原来是 4（已发布）→ 3；**其余一律 → 2**。所以新建名单加 1 个进程后变「待发布」（S-4 的依据）。顺带发现两点：①原来是 3（有变更）的名单再加进程会被改成 2（待发布），疑似后端 bug；②PID 40「待发布 + 0 进程」不符合这条规则，佐证它是脏数据（F-5） | 101 只读 `sed -n 830,858p` | S-4；TK-5 给同事的清单 |
| F-11 | **后端不返回 `PRODUCTID`**（F-2 字段里没有）。`list.js:964` 应用到组弹窗把 `row.PRODUCTID` 交给分组树，分组树只把它原样带给取已选组接口 `getWBListUsedGroupId`（`strategy/tree.js:369`）；这个接口现在由 mock 拦下、本计划后一律返回空，不读它 | `grep -n PRODUCTID` | 本计划不处理；§八 |
| F-12 | **PL-01 的旧测试依赖旧 mock**：`implement/PL-01/tests/TK-5/harness/selftest.js` 调 `setMode`（`:46`），`TK-5/bjtoday.test.js` 用 `dateRange`、`setNow`，本计划删掉后这两个脚本跑不起来；`TK-4/harness` 也加载 `bwlistMock`，没直接用要删的导出，在新代码上还能不能跑没核。`TK-3/es5check.js` 只收一个文件路径，和 mock 无关，可以直接复用 | 读脚本 | 旧脚本当历史证据，不改、不重跑；PL-03 的单测另放 `implement/PL-03/tests/` |

## 三、适配规则

### 3.1 参数：页面条件 → 后端参数

页面内部的条件对象 `op.cond`（字段名不变）只在发请求前转换一次：

| 页面条件 | 后端参数 | 转换 |
|---|---|---|
| `type`（页面配置，2 / 3） | `policytype` | 原值。**不再同时带旧名 `type`**（现在的 mock 怕同事改回去，两个名字都带；后端现版只读 `policytype`，F-1）。后端若改名，只改 `bwlistAdapter.js`（R-1） |
| `systype` 空 / 1 / 2 | `eptype` | 原值；空就不传。页面下拉一期只有「全部」和 2（`list.html:23-24`），1 也照传 |
| `ctime`、`cfrom`、`cto` 都空 | `timeRange=0` | **必须显式传 0**（F-1 缺省是本周） |
| `ctime` = week / month / lastmonth（且日期都空） | `timeRange` = 1 / 2 / 3 | |
| `cfrom` 或 `cto` 不空 | `timeRange=0` + `begintime=cfrom` + `endtime=cto` | 原样 `YYYY-MM-DD`，后端自己加一天；`ctime` 忽略（和现在一样，页面上两者本来互斥） |
| `pubstatus` 0 / 1 / 2 / 3 | `status` 1 / 2 / 4 / 3 | 编号对调（页面 0 `--`=后端 1 空白名单；页面 2 已发布 = 后端 4） |
| `scope` 1 / 0 | `objrange` 1 / 0 | 原值（都按「组数 > 0」） |
| `delta` add / del | `procstatus` 1 / 2 | 「有新增」= 存在添加状态的进程，两边一致 |
| `delta` none（无变更） | **不传** | 后端 0 的意思是「存在已确认的进程」，不是「没有新增也没有移除」；**前端自己筛**：`ADDNUM = 0` 且 `DELNUM = 0` |
| `kw` | **不传** | 后端没有；**前端自己筛**：去首尾空格后，名称包含它、不分大小写（照现在 mock） |
| 空值 | 不传 | 后端空 = 不限；`0` 不是空（`pubstatus=0` → `status=1`，`scope=0` → `objrange=0`） |

`hideMsg`（`core.js` 读的「报错不弹提示」开关）：`list.js` 取列表、取总数都不传它，`toQuery` 也不处理；现在 mock 里「调用方带了就照带」那段随 mock 列表代码一起删。

### 3.2 返回：后端每行 → 页面一行

页面只读下面 6 个字段（`list.js` 的列、按钮置灰、说明框、底部统计都靠它们，PL-01 R-3），其他后端字段原样保留：

| 页面字段 | 取值 | 说明 |
|---|---|---|
| `PROCNUM` 已发布版本的进程数 | `PROCCONFIRMCOUNT + PROCREMOVECOUNT` | 待移除的还在已发布版本里；这样「发布后进程数 = PROCNUM + ADDNUM − DELNUM」= 后端 `PROCCOUNT`，自洽（R-2） |
| `ADDNUM` | `PROCADDCOUNT` | |
| `DELNUM` | `PROCREMOVECOUNT` | 现在恒 0（F-3） |
| `PUBSTATUS` | `STATUS` 1 / 2 / 3 / 4 → 0 / 1 / 3 / 2 | **以后端为准**，不按进程数自己推（筛选也是后端按 `STATUS` 筛，显示和筛选才一致）；不在 1～4 的值按 0 |
| `GROUPNUM` | `OBJCOUNT` | |
| `EPNUM` | 0 | Q3 |

数字一律转整数，缺了按 0。转换后按创建时间升序、同一时间按 PID 升序排（Q2），再做 §3.1 的两项前端筛选，`total` 取筛选后的条数。

脏数据（F-5）照后端状态显示：PID 39「有变更」但发布后进程数为 0 → 发布按钮按现有规则置灰（「至少保留 1 个进程」）；PID 40「待发布」+0 → 发布按钮能点，点了由 mock 按 §3.3 判断（发布后进程数 0 → 拒绝）。

### 3.3 mock 发布 / 应用到组（Q1）

- 名单页每次拿到列表（转换后的行），交给 `bwlistMock` 记下：`PID → 行`（含 `POLICYTYPE`），替换上一次的。
- `publishWBList`：PID 不在记录里、或 `policytype` 和记录不符 → 「名单不存在。」（code 3）；状态判断规则不变（`--` / 已发布 / 发布后进程数 ≤ 0 拒绝，code 4），**数据改取记下的真实行**；通过 → 只返回成功提示（有组 / 没组两种文案不变），**不记内存、不改列表**。
- `setWBListGroups`：同上取真实行，只有已发布能做（真库现在没有已发布的名单，F-5，所以页面上按钮一直是灰的）；通过 → 只返回成功提示，**不记组**。
- `getWBListUsedGroupId`：一律返回空（不再有内存里的组）。
- 导出 `reset` 保留，改成清空记下的行（原来清 `memo`、`known`），给单测用。
- 删掉随之没用的东西：`memo`、`applyMemo`、`currentFields`、`fakeFields`、`baseFields`、`known` 的旧填法、列表处理 `handleList` 及其筛选 / 日期（`dateRange`）/ 排序函数、`FAKE_SOURCE` / `FAKE_ROWS`、`MODE`、`EP_PER_GROUP`（只有 `applyMemo` 用）；导出里的 `getMode`、`setMode`、`setNow`、`fakeFields`、`toRow`、`EP_PER_GROUP` 一并删（Q4、Q5）。拦截地址从 4 个减为 3 个。

## 四、改动范围

### 4.1 SOC 源码（上传 101 测试，svn 不提交）

| 文件 | 动作 | 说明 |
|---|---|---|
| `public/esm/view/processManage/bwlistAdapter.js` | **新建**（Q4） | RequireJS AMD 模块 `processManage/bwlistAdapter`，ES5、不依赖 jQuery（能在 node 里单测）。导出：`toQuery(type, cond)` → 后端参数对象（§3.1）；`toRow(raw)` → 页面一行（§3.2）；`toList(rawRows, cond)` → `{rows, total}`（逐行 `toRow` → 排序 → 前端筛 `kw` / `none`）。文件头写清对照表和「后端字段变了只改这里」 |
| `public/esm/view/processManage/list.js` | 小改 | `require` 新模块；`buildParams` 改成 `bwlistAdapter.toQuery(op.cfg.type, op.cond)`；`toTableData` 改用 `toList`（要拿到当前条件），并把结果行交给 `bwlistMock.remember(type, rows)`；`updateFiltered` 的取总数请求改用 `toQuery(type, EMPTY_COND)`；注释同步：文件头 `:10-16`（「只拦 4 个名单地址」改 3 个、`bwlistMock.toRow` 改新模块）、`:192`、`:462`（兜底那行引用的「bwlistMock.js 文件头第六节」随 mock 文件头重写改引用）、`:519`、`:1148-1152`（日期选择器说和 mock 的 `dateRange` 同口径，mock 这段删了，改成只和后端 `getDateRanges` 同口径）。`grep -n "bwlistMock" list.js` 剩下的每一处都要读一遍、说法仍成立 |
| `public/esm/view/processManage/bwlistMock.js` | 改（删多于加） | 按 §3.3：只拦 3 个地址；新增 `remember(type, rows)`；发布 / 应用到组改用记下的行判断、成功不记内存；删 fake 模式和列表相关代码；文件头重写（`ENABLED` 开关说明保留：关掉后这 3 个请求直接走真接口） |

**不改**：`list.html`、`bwlistModal.js`、`processManageList.css`、`processManage.js`、`processMana.js`、`log.js`、`layout.html`、`js/core.js`、所有 PHP。

### 4.2 本仓库文档

| 文件 | 改什么 |
|---|---|
| `architecture/01-进程管控设计文档.md` | §9.1.1「数据来源 = 真名单 + 假字段」「MODE fake」两条改写为「列表走真接口，发布、应用到组仍 mock（只校验、不改列表）」；§9.1.2 补「后端实际参数 / 字段对照」（引用本计划 §三）；12.1 待对齐清单补：后端缺终端数、缺关键字查询、`procstatus=0` 语义与「无变更」不同、排序、脏数据清理、「有变更」再加进程会变「待发布」（F-10）、列表不返回 `PRODUCTID`（F-11）、移除进程接口未做（含「添加后又移除」怎么记，R-2）、发布接口名 `releaseWBList` 与前端 `publishWBList` 待统一（与 TK-5 给同事的清单一致） |
| `implement/IMPL-…-PL-03.md`、`implement/PL-03/` | 收尾时写报告、落证据 |
| `changelog/`、`CurrentStatus.md` | 按规则同步；状态页「101 后端名单接口与前端约定不一致」阻塞项按结果改写 |

## 五、子任务

| TK | 内容 | 执行方式 | 完成判据 |
|---|---|---|---|
| **TK-0 开工准备** | ①101 上算 `bwlistMock.js`、`list.js`、`list.html` 的 md5，应等于 F-9；不一致说明同事动过，停下问用户；②确认 101 上没有 `bwlistAdapter.js`；③备份这 3 个文件到 101 `/tmp/procm-pl03-bak-<时间>/`；④再读一遍 101 `getWBListAction` 和模型 `getWBList`，md5 和 F-1、F-2 不同就逐条对照 §三，变了先改本计划再开工；⑤只读 SQL 存一份 12 条名单的基线（F-5）；⑥本地 `svn status`、`git status` 记现场 | 主 Agent 亲做 | 基线 md5、备份路径、SQL 基线、两边现场写进 changelog |
| **TK-1 适配模块 + 列表接线** | 新建 `bwlistAdapter.js`；改 `list.js`（§4.1）。Tester 写 node 单测：§3.1 每一行、§3.2 每个字段（含 STATUS 4 种和越界值、缺字段、字符串数字）、排序（同时间按 PID）、`kw` 大小写和首尾空格、`none` 筛选、`toQuery` 空值与 0 的区别、结果里没有 `type` 和页面参数名。单测和脚本放 `implement/PL-03/tests/`，不改 PL-01 的旧脚本（F-12） | 派活（Executor → Tester → 内审） | node 单测全过；ES5 检查（照 PL-01 `tests/TK-3/es5check.js`）通过；上传后 S-1～S-4 通过 |
| **TK-2 mock 收窄** | 改 `bwlistMock.js`（§3.3）。Tester 补 node 单测：`remember` 后发布 / 应用到组的各分支（不在记录、类型不符、4 种状态、发布后 0、成功后再取列表不变）、`getWBListUsedGroupId` 返回空、`install` 只拦 3 个地址、getWBList 原样放行 | 派活（Executor → Tester → 内审） | 单测全过；`grep -nE "MODE|fakeFields|memo|handleList|FAKE_|dateRange|EP_PER_GROUP|setNow" bwlistMock.js` 在代码里为 0 处（注释里说明历史的除外）；上传后 S-5、S-6 通过 |
| **TK-3 设计文档同步** | 按 §4.2 改设计 01 | 派活（Executor → 内审） | 内审 PASS；§9.1 不再写「假字段」「fake 模式」 |
| **TK-4 全量验收** | TK-1～3 完成后按 §六 从头跑 | 主 Agent 跑 Tester 写的用例 | §六 全部通过 |
| **TK-5 收尾** | 整体审 1 轮；IMPL 报告（含「给同事的清单」：缺终端数 / 关键字、`procstatus=0` 语义、排序、脏数据 PID 36～43 的 `STATUS` 要按进程重算、「有变更」再加进程会变「待发布」（F-10）、移除进程接口和「添加后又移除」怎么记、列表不返回 `PRODUCTID`（F-11）、发布接口名 `releaseWBList` 与前端 `publishWBList` 待统一）；changelog、`CurrentStatus.md` | 主 Agent 亲做 | 自检问题全部回答；无遗留红项 |

顺序：TK-0 → TK-1 → TK-2 → TK-3 → TK-4 → TK-5。TK-1 和 TK-2 **一起上传**（只传 TK-1 时发布 / 应用到组会报「名单不存在」，F-6）；TK-1 的浏览器用例等 TK-2 上传后一起跑。

**上传规则**（照 PL-01 §六）：先比对 101 上已有文件的 md5 与 TK-0 基线（或上一次自己上传后的 md5）：一致才覆盖，覆盖后恢复原属主和权限（`list.*` 是 `root:root 644`，`bwlistMock.js` 是 `rising:rising 644`）；不一致说明同事又改了，先拉下来合并再传。新文件 `bwlistAdapter.js` 属主 `rising:rising 644`。每次上传后记新 md5，整页刷新再测。

**浏览器测试**：用 Claude in Chrome，用户先登录 101（安全规则不允许我输入密码）。确认登录态只用 `RsCore.ajax`，不发裸 POST（会销毁会话）。

## 六、验收用例（101 浏览器实测）

预期结果一律**按同一时刻的只读 SQL 算**（照后端同样的条件），不写死条数。需要「待发布、有新增」的名单时，用 `createWBList` + `addProcToWBList` 新建，名称统一 `PL03测试-` 开头，测完用 `delWBList` 删掉；同事的数据一条不动；**不调 `releaseWBList`**（会写策略包和 Redis，超出本计划）。

| # | 用例 | 预期 |
|---|---|---|
| S-1 | 不设条件打开白、黑两页 | 网络里 `getWBList` 带 `policytype`、`timeRange=0`，不带页面参数名；条数 = SQL 全部名单；按创建时间升序；进程数列、发布状态列、组数与 SQL 按 §3.2 换算一致（含 PID 39、40 两条脏数据）；终端数 0；底部「进程总数」= 各行 `PROCCOUNT` 之和；没有「已筛选」提示 |
| S-2 | 后端能筛的条件逐个点：系统类型、本周 / 本月 / 上月、指定日期（只填起、只填止、都填、起止同一天）、发布状态 4 个、应用范围 2 个、有新增、有移除 | 每次请求参数按 §3.1；结果 = SQL；「已筛选出 X 个，共 Y 个」的 Y = SQL 全部名单数（取总数那次请求带 `policytype`、`timeRange=0`）；「已发布」「有移除」现在应为 0 条且表格正常显示空 |
| S-3 | 前端筛的两项：关键字（大小写、首尾空格、中文）、无变更；再和后端条件组合（如 待发布 + 关键字） | 请求里没有 `kw`、`procstatus`；结果 = SQL 再按 §3.1 筛；X、Y 正确 |
| S-4 | 创建、编辑、删除后列表 | 新名单立即出现（「--」、0 进程）；`addProcToWBList` 加 1 个进程后刷新变「待发布」+1（F-10）；编辑后名称更新；删除后消失（回归 PL-02） |
| S-5 | 发布（mock） | `PL03测试-` 待发布名单点发布：确认弹窗文案照旧，成功提示「已发布，应用到组后下发」，**列表状态不变**，库里 `POLICY.STATUS` 不变；网络里没有发往后端的 `publishWBList`；PID 40 这类「待发布 +0」点发布 → 提示发布后进程数为 0、不能发布 |
| S-6 | 应用到组（mock）与回归 | 所有名单「应用到组」都是灰的（真库没有已发布，F-5）；控制台调 `bwlistMock` 时 `getWBListUsedGroupId` 返回空；名单页 → 概览 → 名单页：`RsCore.ajax` 没被重复包裹，`getWBList` 不再被拦（PL-01 S-11 回归）；控制台无报错 |
| S-7 | 失败 | 断网或后端报错时只弹一次 `core.js` 的提示，表格不卡在「正在加载」（PL-01 TK-4 行为不变） |

## 七、风险

| # | 风险 | 应对 |
|---|---|---|
| R-1 | 同事还在改后端（控制器北京 10-22 17:25、模型 17:00 刚改），参数名或字段再变 | 转换只在 `bwlistAdapter.js` 一处；TK-0 第④步、TK-4 前各核一次 md5，变了按 §三 逐条对照 |
| R-2 | `PROCNUM` 换算基于「移除只标已确认的进程」的假设（F-3）；若后端把「添加后又移除」也记成 `STATUS=2`，`PROCNUM` 会多算 | 现在 `PROCREMOVECOUNT` 恒 0，不影响本次结果；写进给同事的清单，移除接口做完后复核 |
| R-3 | 脏数据（F-5）让页面出现「有变更 +0」「待发布 +0」 | 照后端状态显示，不在前端修正；清单里请同事按进程重算 PID 36～43 的 `STATUS` |
| R-4 | mock 发布「成功」但列表不变，测试的人会以为坏了 | 用户已拍板（Q1）；IMPL 报告和状态页写明；后端已有 `releaseWBList`，切真发布另立计划 |
| R-5 | 同事按 svn 部署会把 `list.js`、`bwlistMock.js` 盖回旧版（PL-02 R-3） | 收尾前重核 101 指纹；根治要提交 svn（须用户指令） |
| R-6 | 测试写了 101 真库 | 只操作 `PL03测试-` 开头的名单，测完删掉；不调发布 |

## 八、不在本计划内

- 发布切真接口 `releaseWBList`、应用到组的真接口（后端 `usedGroupAction` 还是空函数）。
- 后端补终端数、关键字查询、改 `procstatus=0` 语义、清脏数据、补 `PRODUCTID`（写进给同事的清单）。
- PL-01 旧测试脚本（F-12）：不改、不在新代码上重跑。
- 列表页外观、按钮置灰规则、说明框文案（PL-01 已定，不变）。
- svn 提交、PHP。
