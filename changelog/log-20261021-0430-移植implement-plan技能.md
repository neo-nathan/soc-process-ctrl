---
name: 移植 implement-plan 技能
description: 从 soc-cascade-syslog 移植 implement-plan 并改成本项目形状：输入为放行的 plans/PL-NN，代码在 SOC svn 工作副本，测试用 node 脚本和 101 内置浏览器，上传 101 只由主 Agent 做，svn 不提交；CLAUDE.md 登记用法
---

# 移植 implement-plan 技能

- 时间:2026-10-21 04:30 EDT
- 触发:用户「将 soc-cascade-syslog 项目的 implement-plan skill 移植到本项目」

## 改了什么

- 新建 `.claude/skills/implement-plan/`（SKILL.md、RATIONALE.md、`references/` 下 Executor / Tester / 内审 / 整体审 4 个派活模板和 IMPL 报告模板，共 7 个文件）。先原样复制源 skill，再逐文件改写。
- **保留不动**：流程骨架（Executor 实现 → Tester 独立验收 → 主 Agent 静态审查闸门 → 内审 ≤2 轮 → 整体审 1 轮 → 收尾）、三条硬约束（S1 逐字引原文 / S2 全文供给 + 熔断拒绝 / S3 自检 + 验证）、权力清单、派活前自检七条、兜底总则、汇报纪律、整改纪律。
- **改成本项目形状**（逐条及理由见 skill 内 `RATIONALE.md` 第五节）：
  - 输入：用户放行的 `plans/PL-NN-*.md`（本项目没有 `/plan-to-task`、`tasks.md`）；基线文档清单、条款覆盖表由主 Agent 在阶段 1 从计划原文机械派生；TK 分「派活型」和「主 Agent 亲做型」（开工准备、上传、全量验收、收尾，如 PL-01 TK-0 / TK-6 / TK-7）。
  - 计划列为子任务产出的基线文档改动（如 PL-01 TK-1 改设计文档 01）走 Executor + 内审，范围不许超出计划，解决与「主 Agent 无权改基线」的冲突。
  - 新增「本项目的现场」一节：计划、基线、SOC 源码 svn 工作副本、101、本仓库各自在哪、谁能动；引文写法 `01 §8.8` / `PL-01 §四 4.3`；编码红线 PHP 5.6、前端只用 ES5。
  - 验证手段：`mvn` / JUnit / `-Penv-it` → `node --check`、node 脚本（AMD 模块用 `define` 替身）、101 内置浏览器实测、只读查库、grep 判据；「只跑默认测试 = 门没验」改为「只跑 node 脚本 = 页面没验」。
  - 工作区与 ACTUAL：本仓库 git 和 SOC 源码 svn 两边分别算；范围外清单加「开工从 101 拉下来的文件」。
  - 101 三条硬规矩：上传只由主 Agent 做且先比 md5；测试写库限计划范围；凭据不进 prompt / 留痕。Tester 用内置浏览器自己跑页面用例，同一时间只一个角色操作，遇登录页请用户登录。
  - 检查器：源 skill 指向旧项目 changelog 的五类断言，改为把 `[LINEREF]/[CLAIM]/[ARITH]/[ANCHOR]/[STAGE]` 的含义和「内容锚定、整行判等、反向变异自证」写进 SKILL 阶段 1 第 5 步。
  - 证据与外审：去掉计划 §2.2 / `evidence/` / `review-impl` 依赖；证据放计划指定位置或 `implement/PL-NN/`，scratchpad 脚本收尾复制进去，内置浏览器截图不落盘要如实写；外审改为提醒用户另派 Reviewer，报告 `review/RV-impl-*`。
  - 提交：本仓库照旧问用户再 commit；SOC 源码永不 svn commit。
  - 状态页：按本项目 `CLAUDE.md`，loop 期间只在「当前进行中」覆盖同一个恢复点、不写过程数字，其他节收尾更一次。
  - 全文「门 / 本门」（旧项目一个计划分多个门）统一改为「计划 / 本计划」；旧项目事故编号（PL-01 I1 / I2 / W1 等）在 SKILL 和 RATIONALE 开头声明与本项目 `plans/PL-01` 无关。
- `CLAUDE.md`：典型工作流加一段「执行放行的计划用 `implement-plan`」；目录表 `.claude/skills/` 一行补上它。

## 为什么

- 用户要求移植；PL-01 已落盘待放行，放行后要按 TK 执行，需要一套编排、分权、审查的流程。
- 源 skill 是给 Java/Maven 项目写的，直接搬会在第一步就卡住（要 `tasks.md`、跑 `mvn`、读本仓库没有的旧 changelog），这正是 `insights/insight-20261021-0105-从其他项目移植治理机制的体检要点.md` 记过的坑。
- 关键事实都是当场核实的：
  - SOC 前端 `public/esm/view` 138 个 JS 文件零箭头函数、零模板字符串（唯一的反引号在 `behaviorAudit/logJiLian.js` 的注释里），只有 `strategy/tree.js` 一个文件用了 `let` → 定「前端只用 ES5」红线；
  - 本机没有 `php` → PHP 语法检查要到 101 上用 5.6 跑；
  - 派一个子 Agent 实测：子 Agent 能直接用内置浏览器工具（`mcp__Claude_Browser__*`），与主会话共用面板和登录态 → 页面验收交给 Tester 自己跑；
  - `git check-ignore -v` 确认新目录没被 `.gitignore` 吞掉。

## 怎么验证

- 残留扫描：在 SKILL.md 和 5 个模板里 grep `mvn|JDK|Java|syslog|ESM_RULE|tasks\.md|plan-to-task|review-impl|evidence/|Redis/ES|DC-0|RQ-0|§2\.2|pom|Javadoc|env-it|通用规则|IT\.java|Test\.java|gb2312|门级|本门|门放行` 等，剩余命中只在「移植说明」「旧项目事故」和「本项目还没有 review-impl」这类有意保留的句子里。
- 槽位对账：4 个派活模板的全部 `{槽位}` 与 SKILL 各节「必带:」逐项比对，补齐 3 处缺口（Tester 的运行环境、内审的两角色 `self_check` 原文、整体审的计划路径）。
- 步骤引用：grep「阶段 1 第 N 步」，指向的第 2 / 3 / 5 步内容都对。
- 与源文件 `diff -u` 逐处重读，自检修正：「`list.js` 在 TK-5 也要改」是推断，改成「可能」；let/const 措辞改为「一个文件」；RATIONALE「新增只有两样」与表格不符，改写；「整个 loop 只在收尾更新状态页」与本项目 `CLAUDE.md` 冲突，改为「当前进行中」覆盖恢复点；汇报纪律里的 gb2312 例子换成本项目的公共弹窗回归例子。
- 独立复审：见下方追加段（0 blocker / 7 important / 5 suggestion，全部核实属实并整改）。

## 边界

- 只移植 `implement-plan`；它在源项目的上下游 `/plan-to-task`（拆子任务）、`review-impl`（外审）、`approve-review` 等没有移植，skill 里已改为不依赖它们。
- skill 还没有真跑过；第一次用于 PL-01 时，若流程与现场不符，按 skill RATIONALE 第四节的规矩改。
- 源项目 skill 不改。

## 追加(2026-10-21 04:39 EDT):独立复审与整改

- **复审**：派一个不参与改写的 opus 子 Agent，拿 PL-01 逐个 TK 推演 skill 能否跑通。结论 FAIL：0 blocker、7 important、5 suggestion。主 Agent 逐条核实，全部属实（如本地 `processMana.js` 只有 211 行、`grep addNewListModal` 在本地 `processMana.js` / `log.js` 零命中；PL-01 F-6 原文写明「三处分歧不是本计划的范围」），无降级、无删除。
- **important 整改**：
  - I1 待确认项：计划给了默认的（Q8「不确认就不改」）照默认开工，不再与「确认前不许开工」打架。
  - I2 用例归属：阶段 1 第 4 步要求每个验收用例都归到某个派活型 TK 的 Tester；只挂在亲做型 TK 的（S-11）另行分配，主 Agent 不写用例。
  - I3 改动前基线：「与改动前一致」类回归（S-10），第一次上传 101 前派 Tester 只读采集，作为期望来源；Tester 模板加对应例外和「只采集」模式。
  - I4 / I5 / I6 101 比 svn 新：开工拉取的文件另存**拉取基线**，自检 / 静态审查 / 内审用 `diff <拉取基线>` 不用 `svn diff`（R-7）；计划引用但没拉的 101 文件放**只读参考副本**查调用点；中途同事又改过 → 更新拉取基线、记范围外、派原 Executor 合并、过 2.3 再上传。三处同步到 Executor / 内审模板与兜底总则。
  - I7 正式入口契约来源写进阶段 1 第 4 步（计划写明的入口 + Executor 公开签名）；Executor 模板加「TASK 列为本子任务产出的基线文档按计划原文改」例外，避免 TK-1 被拒。
  - 补充项：「宿主非干净态」例子去掉 F-6 ③ 名单重名（计划范围外，会造假 blocker），换成 S-11、残留测试名单、重复上传。
- **suggestion 整改**：截图留证做不到时开工当待确认项问用户；外审在本项目可选、不做时汇报要说明；changelog 段标题统一为 `## 追加(时间):Task TK-n / 整体审 / Final PASS`，删掉未定义的 `## Round`，整体审段补经验候选行；文档类 TK 通过后重取覆盖表引用的原句；切 `fake` 模式等开关由 Executor 改、主 Agent 上传。
- RATIONALE 第五节移植表补 5 行（拉取基线、改动前基线、用例归属 / 入口契约 / 待确认默认、外审可选、changelog 段标题），并把重复的「外审」两行合并。
- **整改后自检**：第 2 轮重读阶段 1、2.2，修 3 处引用措辞（「改动前基线」指错段名、「中途发现同事又改过」引用名与条目不一致、第 2 步「不做只读副本」与第 3 步 101 只读副本字面打架）；第 3 轮重跑残留扫描、槽位对账、跨文件关键词（拉取基线、101-ref、改动前实测、只采集改动前基线）均干净。整改后未再派第二轮独立复审。
- 经验候选: 移植流程类 skill 时拿目标项目的第一份真实计划逐步推演，才能暴露「源项目默认成立、目标项目不成立」的前提（如 svn diff 混入同事改动、本地副本比服务器旧）

## 追加(2026-10-21 05:12 EDT):循环自检 + 第二～四轮独立复审与整改

- **触发**:用户「做一次循环自检，直到你找不出问题为止」。主 Agent 自检与三轮独立复审(各派一个不参与改写的 opus 子 Agent)交替进行,每轮发现全部回原文 / 现场核实,**全部属实,无降级、无删除**。
- **主 Agent 自检第 1 轮(16 处)**:本地 `log.js` 是 668 行,「两份都只有 211 行」写错(只有 `processMana.js` 是 211 行);机械前置写「三条」实列 4 条;没写何时新建本 loop changelog、何时放状态页恢复点;开工快照没写要在拉 101 文件**之前**记(PL-01 R-7);执行前提、「PHP 一行不改」不是逐字引文;`php -l` 要经 ssh 从标准输入喂给 101,不把文件放上去;Executor「改动范围」按整个工作区比会误报 → 改成动手前后比(已改动文件记 md5);Tester 控制台只读检查(S-11 看 `RsCore.ajax`)要明确允许;内审等式里 Tester 验收目录在 scratchpad、不进等式;整体审 `gate_reconciliation`(旧项目「门」)改 `plan_reconciliation`;报告模板补自检第 6 项;Codex 一句标成「以后若接」。
- **第二轮独立复审(1 blocker / 9 important / 8 suggestion)**,主要整改:
  - B1:范围外 ② 按文件名减,PL-01 TK-5(没列文件、活全在 TK-3 已通过的 `list.*` 上)会算出空 ACTUAL → 新增**通过快照**,②③ 按内容判,行级差异用「对照基准」。
  - 基线清单只放文档,SOC 源码走派活材料;`CLAUDE.md` 目录表登记 `implement/` 写成明确例外;计划写了脚本不入库(PL-01 TK-2)的不复制进 `implement/`。
  - 改动前基线只用于原文没给具体期望的部分(S-10 后半句),F-8 ① 这类要修的旧问题不作期望;TK-4「行为不变」与 F-8「TK-4 逐条修」读不通的开工时问用户。
  - 审查模板加写库范围槽位;Executor / Tester 禁止破坏性 svn / git 命令,审查员只读;R-5「先实测」由主 Agent 在派 Executor 前做;静态审查每次单独追加一段;Q8 默认不做的条目标注后内审 / 整体审照标注判。
  - suggestion:重试口径、Agent tool 有 `effort` 参数、新文件上传前查同名、`101-ref` 派活前重拉、Task 段按每轮内审各一段并用 `grep -cE '^## 追加.*:(Task|整体审)'` 对数(样例实测删一行候选会对不上)、覆盖表修订 / 人工必查项只追加、拉文件前本地已是 `M` 就停下问用户、`implement/` 落证据时才创建。
- **第三轮独立复审(0 / 5 / 2)**:中途合并同事改动不许覆盖工作副本(新版本进 `pull-baseline/`、旧的留 `.prev`);审查员拿到判定范围外用的快照 / 基线路径和 `101-ref/`;内审模板接住「按待确认项默认不做」;R-5 探测必须在同一模块层级(核实本地 `public/dep/require/css.js` 的 `normalize` 按发起模块换算相对路径,控制台顶层 `require` 会测出假的「能加载」);范围外 ① 也按内容判(`start-md5.txt`);scratchpad 路径写进状态页恢复点,换会话找不到就停下问。
- **第四轮独立复审(0 / 4)**:合并后上传的比对基准改用新拉取基线的 md5;Executor 模板新增**合并轮**块和「先行实测结论」槽位;整体审拿到逐文件对照基准、不用 `svn diff`;`git status` 一律加 `-uall`(实测未纳管目录不加会缩成一行、算不出 md5)。
- **每轮整改后的自检**:每轮都重读改动段、grep 同类说法,补过的漏改有 Tester 模板「只读 DOM」旧说法、3.1 漏了 PHP 语法检查、Tester 模板插入位置把原条目拆断、两处 `git status` 漏 `-uall`、TK-4 冲突写成「按第 1 步处理」(第 1 步对没默认的项是「不开工」,改为明确问用户)。
- **验证**:四个派活模板的槽位与 SKILL 各「必带」逐项对上;SKILL 引的 14 处 PL-01 原文 `grep -F` 逐字命中 14/14;旧项目残留只剩「移植说明」里有意保留的一句;引用的段名全部存在。skill 7 个文件共 1875 行(`wc -l`)。
- **规矩 2(删 / 合并了什么)**:没有删除流程机制;新增的都是让 PL-01 能跑通的修正,已补进 RATIONALE 第五节两行(通过快照 / 范围外按内容判、环境探测 / 待确认默认不做)。
- **边界**:第四轮的整改没有再派第五轮独立复审,只做了主 Agent 自检;skill 仍未实跑。
- 经验候选: 流程类 skill 的独立复审要一轮轮做到「整改本身」也被审过——第二轮的 blocker 整改(通过快照)又在第三、四轮各引出 4～5 条衍生问题,全在新机制和旧机制的接缝处
