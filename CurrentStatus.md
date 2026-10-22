# CurrentStatus — 项目当前状态

> 本文件是当前事实快照，不是 changelog。新 Agent 应先完整读取本文件，再按任务打开权威入口。

## 当前结论

- **项目处于设计收尾、前端编码准备阶段**：为 SOC 中心新增「终端进程管控」（通过进程策略和黑白名单控制终端进程运行），一期只做 Linux。
- **黑白名单列表页前端**：实施计划 [PL-01](plans/PL-01-黑白名单列表页前端实施计划.md) 10-22 04:51 EDT 实施完成（PASS），报告 [IMPL-20261022-0449-PL-01](implement/IMPL-20261022-0449-PL-01.md)；本项目只写前端，后端由其他同事在 101 上开发（代码未进 svn），列表补充字段、发布、应用到组仍走前端 mock，待后端定稿联调；独立外审未做；本仓库已本地提交 `aecb6b6`（未推送），svn 未提交。名单页的创建 / 编辑后由 [PL-02](plans/PL-02-名单页创建编辑弹窗独立实施计划.md) 改为名单页自带弹窗（新文件 `bwlistModal.js`），不再依赖同事共用的 `processManage.js`。
- **名单页自带创建编辑弹窗（PL-02）**：10-22 10:1x EDT 实施完成（PASS），报告 [IMPL-20261022-1012-PL-02](implement/IMPL-20261022-1012-PL-02.md)；101 上 `processManage.js` 已还原成同事版（`58064f62…`），本地工作副本已按用户决定 `svn revert` 成 svn 原版；§七 S-1～S-7 在 101 通过；计划已标「已完成」；用户决定不做外审（改为循环自检）；本仓库已本地提交（未推送），svn 未提交。
- **开发设计文档 v1.0**（2026-10-15）：按 v0.9 审查报告修订完成，之后有 10-18、10-19、10-20、10-21 多次补充（取消「进程名称」查询条件、名单弹窗系统类型写进标题、「进程所属终端」弹窗去掉「状态」列和「所在组」搜索项、概览「策略模式」合并为一个标签 / 终端上报一个值 0～6、进程管理高级搜索精简为一行、所有时间条件改为「时间范围：全部 / 本周 / 本月 / 上月 / 指定」），均已同步 demo。v1.0 本身还没做过独立审查。
- **核心设计结论**见设计文档第 0 节 K1～K14：沿用 PROCM 产品身份；进程策略复用策略中心；白名单 / 黑名单是 `POLICY` 里用名单专用产品号的记录，只挂组；名单明细打成 zip 由终端下载。
- **给领导的概要设计 00**（单文件 html，按 demo 页面组织）2026-10-19 新增，10-20 同步弹窗改动；它是一次性交付物，领导满意后从项目移除，不与 01 同步维护。
- **待对齐 15 项**（设计文档 12.1，10-21 PL-01 TK-1 新增 P22、P23）全部按推荐暂定，其中高优先级 5 项（P9、P2、P8、P19、P22）定错要返工。
- **项目治理三机制**（CurrentStatus / changelog / insights）2026-10-21 从 soc-cascade-syslog 移植建立；此前的修改历史以 `git log` 为准。同日移植计划实施编排 skill `implement-plan`，用来执行放行后的 PL-01。

## 阶段与文档状态

| 项 | 状态 | 当前依据与边界 |
|---|---|---|
| 原始需求 | READY | `requirements/requirements-raw.md`；设计过程中已按产品答复同步改过几处（如第 39、122 行） |
| 页面 demo | READY | `demo/` 下 7 个有效页面（3 个作废页见 `CLAUDE.md`）；10-18～10-21 的改动（含 21:47 进程管理查询精简、时间范围）本地和云端已同步（云端 3 个：「进程管控 - 学习任务列表」含概览、审计日志；「进程管控列表」；「黑白名单列表」含白 / 黑名单、名单进程）（[changelog](changelog/log-20261021-2159-精简进程管理查询与时间范围.md)） |
| 开发设计文档 01 | IN_PROGRESS | v1.0 + 多次补充（最新 10-21 高级搜索两处改动，日志页时间改用现成 `getDateRanges`）+ 10-21 PL-01 TK-1 同步（名单接口名以 101 为准、名单沿用 3303、名单二次认证不做、新增 9.1 名单 mock 约定、12.1 新增 P22/P23；TK-1 内审第 2 轮 PASS）；12.1 待对齐 15 项未定；v1.0 本身未审查 |
| 概要设计 00（给领导） | IN_PROGRESS | 已写完并自检，10-21 同步高级搜索改动（4 张截图重截）；领导是否认可，建状态页时未核实 |
| v0.9 审查意见落实 | PASS | v0.9 审查报告（高 9 / 中 21 / 低 24）已在 v1.0 中修订落实；v1.0 本身未审查 |
| 编码实现 | IN_PROGRESS | 不在本仓库；101 上前后端开发在进行，未进 svn（PL-01 F-1）；与设计有分叉（设计文档版本记录 H1、PL-01 F-6） |
| 黑白名单列表页前端（PL-01） | PASS | 10-21 05:28 放行（Q8 按默认不改 `layout.html`）；TK-0～TK-7 全部完成，10-22 04:51 Final PASS（TK-0、TK-1、TK-2、TK-3、TK-4、TK-5 已 PASS；TK-6 全量验收 S-1～S-11 在 101 实测通过；整体审 1 条重要项已整改并过内审）；报告与证据 `implement/IMPL-20261022-0449-PL-01.md`、`implement/PL-01/`；SOC 源码新增 `bwlistMock.js`、`processManageList.css`，改 `list.html`、`list.js`（都已上传 101，svn 不提交；后又经 PL-02 修改）；PL-01 改过的 `processManage.js` 已由 PL-02 还给同事；独立外审未做；计划状态改「已完成」待用户决定 |
| 名单页创建编辑弹窗独立（PL-02） | PASS | 10-22 05:3x EDT 放行（Q4 按默认：前端按字数 100），10:1x EDT Final PASS；TK-1 内审 2 轮、整体审 1 轮收敛，§七 S-1～S-7 在 101 通过；报告与证据 `implement/IMPL-20261022-1012-PL-02.md`、`implement/PL-02/`（[changelog](changelog/log-20261022-0535-实施PL-02.md)）；SOC 源码新增 `bwlistModal.js`、改 `list.html`、`list.js`（都已在 101，svn 不提交）；101 `processManage.js` 还原为同事版，本地已 `svn revert`；用户决定不外审、计划已标「已完成」 |
| 项目治理三机制 | PASS | 2026-10-21 建立，生成器和检查脚本均通过 |
| 计划实施 skill（implement-plan） | READY | 2026-10-21 从 soc-cascade-syslog 移植并改成本项目形状；经四轮独立复审和循环自检（[changelog](changelog/log-20261021-0430-移植implement-plan技能.md)）；10-21～10-22 首次实跑于 PL-01、10-22 再用于 PL-02，都已完成；经验见 `insights/` 10-22 四条（PL-01 三条、PL-02 一条，另在留痕教训那条补了 PL-02 的内容） |

## 当前进行中

- 无。PL-02 已于 10-22 10:1x EDT 收尾（PASS）；用户 10-22 决定：commit 本仓库、计划标「已完成」、不做外审改循环自检、本地 `processManage.js` `svn revert`；本 loop 恢复入口 [changelog](changelog/log-20261022-0535-实施PL-02.md)，工作目录 `/Users/nick/Workspace/soc-process-ctrl-work/PL-02/`（证据已复制进 `implement/PL-02/`）。

## 阻塞项与待确认事项

- **101 进程管理页「选中加白 / 加黑」全行被拦（10-22 00:06 发现）**：同事 10-21 23:13 EDT 改的后端 `Procmanager` 返回 `SYSTYPE` = `Linux`，而 `processMana.js`（北京 10-22 15:30、16:35 又被同事改过，这段未动）按小写 `linux` / `windows` 判断，任何行都弹「既有 Windows 又有 Linux/信创」。不是 PL-01 改出来的；PL-01 整体审已在页面内存改一行 `SYSTYPE` 后从正式入口实测通过，真实用户仍被挡。关闭条件：用户转告同事、前后端写法对齐。
- **101 后端名单接口与前端约定不一致（联调注意，10-22 00:56 改写）**：同事 10-21 23:13 EDT 改的 `getWBListAction` 缺省 `timeRange=1`（只给北京本周，PL-01 mock 已显式传 0 绕开）；参数名与页面全不同（北京 10-22 13:14 起名单类型也改读 `policytype`，PL-01 mock 两个名字都带）（systype↔eptype、ctime↔timeRange、cfrom/cto↔begintime/endtime、pubstatus↔status、scope↔objrange、delta↔procstatus，kw 后端没有），关 mock 后高级查询会被静默忽略；发布状态编码后端 1～4 且「已发布 / 有变更」与 PL-01 §4.2 对调；返回字段名不同、EPTYPE 变整数。不阻塞 PL-01 前端（走 mock），阻塞联调。关闭条件：与后端对齐参数名、编码、字段后回改 mock 映射或 `list.js`。
- **12.1 高优先级待对齐（P9、P2、P8、P19、P22）**：影响名单报文 `policytype`、库文件格式、上报格式与方式（P8 ⑪ 含 10-21 新增的「策略模式一个值 0～6」键名、「无基线库」含义，暂沿用 `procaudit`，`rpw.sql` 注释未改）、各库种建库 / 升级脚本的明文源和改法；不阻塞设计文档继续修订，但阻塞编码定稿。关闭条件：客户端 / 产品 / 数据库脚本维护方 / 中心后端答复后回改设计文档。另有中、低优先级 10 项，见设计文档 12.1。
- **同事按 svn 部署可能覆盖名单页文件（PL-02 R-3）**：PL-02 后名单页不再依赖 `processManage.js`（已还给同事，10-22 22:11 CST 101 为同事版 `58064f62…`），公共文件冲突已解除；但 `list.js`、`list.html` 在 svn 里仍是旧版，同事按 svn 部署会把它们盖回去（新文件 `bwlistModal.js` 不会被盖）。关闭条件：把我们的前端文件 svn 提交（须用户指令，走 `svn-commit`；本地 `processManage.js` 已 revert，不会误带）。
- **101 页面实测要用户在 Chrome 登录（常驻风险）**：Agent 按安全规则不能输入密码。101 后端 `My.php:56-63` 对不带正确 `RSTOCKEN` 请求头的 POST 会直接销毁会话——10-21 22:1x TK-3 内审的一次裸 `fetch` 就把标签 88508831 的会话打掉了（白天两次「原因未查明」的清空很可能同因）。10-21 22:2x 用户已在该标签重新登录；之后所有角色确认会话只用 `RsCore.ajax` 或手工带 `RSTOCKEN` 头。
- **101 后端与设计的分歧待告知后端**：`POLICY.STATUS` 存名单类型而非发布状态、名单用进程管控产品号（设计 K3 是专用产品号，名单会混进策略中心列表）、名单可重名（PL-01 F-6）；审计日志页没登记 3303（PL-01 F-17）。不阻塞前端（发布状态先 mock），阻塞联调。关闭条件：后端答复后回改设计文档 12.1 或 mock。
- **概要设计 00 的领导反馈**：建状态页时不知道是否已交给领导、是否认可。关闭条件：用户告知结果。

## 下一步

1. 用户决定：PL-01、PL-02 的 svn 提交时机（须用户指令，走 `svn-commit`）、何时推送本仓库远端。
2. 把 PL-02 IMPL 报告第 9 节「给同事的清单」（8 条：`view` 未定义一行改法、日志页加白没跳过拦截且在黑名单的日志、后端按字节限长等）转给同事。
3. 用户决定：计划 PL-01 的状态行是否标为完成、是否另派独立外审（`review/RV-impl-…-PL-01.md`）。
4. 把 PL-01 IMPL 报告第 9 节「需告知同事」清单转给后端同事（SYSTYPE 大小写、部署覆盖、名单名称转义、日志页日期口径等）；后端定稿后按「联调差异」调整 mock 入参与 `toRow`，再关 mock。
5. 跟进 12.1 高优先级待对齐项的答复（定了回改设计文档、demo、概要设计）；拿到领导对概要设计 00 的反馈后修改或移除 00。

## 最近 3 个自然日摘要

- 最近修改历史见 `changelog/INDEX.md` 顶部「一、最近 3 个自然日」区块（生成物，开机先重跑生成器刷新）。

## 当前权威入口

- 原始需求：[requirements/requirements-raw.md](requirements/requirements-raw.md)
- 开发设计文档：[architecture/01-进程管控设计文档.md](architecture/01-进程管控设计文档.md)（第 0 节结论、12.1 待对齐、14 改动清单）
- 实施计划：[plans/PL-01-黑白名单列表页前端实施计划.md](plans/PL-01-黑白名单列表页前端实施计划.md)、[plans/PL-02-名单页创建编辑弹窗独立实施计划.md](plans/PL-02-名单页创建编辑弹窗独立实施计划.md)；实施报告：[implement/IMPL-20261022-0449-PL-01.md](implement/IMPL-20261022-0449-PL-01.md)、[implement/IMPL-20261022-1012-PL-02.md](implement/IMPL-20261022-1012-PL-02.md)
- 给领导的概要设计：[architecture/00-进程管控概要设计.html](architecture/00-进程管控概要设计.html)
- 最新审查报告：[review/RV-20261013-0833-PL-06-v0.9.md](review/RV-20261013-0833-PL-06-v0.9.md)
- 页面 demo：`demo/`；数据库脚本：[others/dbscript/rpw.sql](others/dbscript/rpw.sql)；客户端协议：[others/policy/policy.md](others/policy/policy.md)
- SOC 中心源码：`/Users/nick/Workspace/ESMCenterST/`（不在本仓库）
- 调研：`research/01`～`research/05`

## 仓库现场

- 2026-10-22 10:23 EDT 核实：分支 `main`；PL-02 实施与收尾（状态页、changelog、insights、计划状态行、`implement/IMPL-20261022-1012-PL-02.md`、`implement/PL-02/`）随本次收尾一并本地提交，提交后工作区应干净、领先远端 7 个提交（未推送）；准确 HEAD 以 `git log -1` 为准。SOC 源码 svn 改动 7 个：用户自己的 `Index.php`、`index2.php`；PL-01 的 `bwlistMock.js`、`processManageList.css`；PL-02 新增 `bwlistModal.js`、改 `list.html`、`list.js`；都未提交。
- 开工仍须实时执行 `git status --short --branch`。

---

最后更新：2026-10-22 10:25 EDT
最后精炼：2026-10-21 01:06 EDT
