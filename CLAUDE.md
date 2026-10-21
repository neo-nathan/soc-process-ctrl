# CLAUDE.md

# 项目目标
为 SOC 中心新增 「终端进程管控」功能，核心需求就是：通过进程策略和黑白名单控制终端上的进程运行。

# 原始需求
`requirements/requirements-raw.md`

# 页面 demo
- `demo/`
- 学习任务列表.html （作废），进程采集记录列表.html（作废）
- 统计分析.html（作废）

# 数据库脚本
- `others/dbscript/rpw.sql`

# SOC 中心源代码
- `/Users/nick/Workspace/ESMCenterST/`

# 典型工作流（新任务开工必读）

新任务开工，按顺序读：

1. **完整读取** `CurrentStatus.md`（不存在则用 `update-current-status` 首次创建）。它是当前事实和进度的快速入口，不是 changelog。
2. 执行 `git status --short --branch` 核实实时工作区；状态页里的「仓库现场」不能代替实时检查。若处在 `git worktree` 并行工作区（判定命令见 `update-current-status` skill 的前置闸门），**不写 `CurrentStatus.md`**，进展只写进 `changelog/`。
3. 先跑 `python3 .claude/scripts/gen-index.py changelog --write` 刷新索引，再**只读** `changelog/INDEX.md` 顶部「一、最近 3 个自然日」区块；**不扫 changelog 原文**。只有用户要求追查历史、恢复未完成的循环、`CurrentStatus.md` 指向某条必要证据，或状态与权威文件 / 现场冲突时，才按索引链接精确读相关 changelog / review。
4. 读 `insights/INDEX.md`，挑与本次任务相关的跨任务经验（和 memory 双向同步）。
5. 设计、编码类任务的基线：原始需求 `requirements/requirements-raw.md`、页面 `demo/`（作废页面见上方「页面 demo」）、开发设计 `architecture/01-进程管控设计文档.md`（其中 12.1 是待对齐清单）、客户端协议 `others/policy/policy.md`、数据库脚本 `others/dbscript/rpw.sql`。需要核实 101 环境数据时，访问参数在 `CLAUDE.local.md`，只读。

每完成一步有持久化项目变更的工作，同回合用 `update-changelog` 写 changelog 并重跑生成器刷新 `changelog/INDEX.md`；只有当前事实、阶段、文档状态、检查点、阻塞或下一步发生变化时，才用 `update-current-status` 更新 `CurrentStatus.md`。有可复用的踩坑经验，用 `update-insights` 沉淀到 memory + `insights/`。

# 核心文档与目录

| 路径 | 用途 |
|---|---|
| `CurrentStatus.md` | 当前事实快照；供 Agent 快速接手，不记录修改过程 |
| `changelog/log-{YYYYMMDD}-{HHmm}-{主题}.md` | 修改历史、原因、验证和边界；时间戳规则见下方「时间戳命名规则」 |
| `changelog/INDEX.md` | changelog 索引（生成物，开工只读顶部「最近 3 个自然日」区块）；`python3 .claude/scripts/gen-index.py changelog --write` 生成 |
| `insights/insight-{YYYYMMDD}-{HHmm}-{主题}.md` | Agent 经验教训（跨任务可复用的经验 / 坑 / 约束）；和 memory 双向同步 |
| `insights/INDEX.md` | insights 索引 + memory 恢复手册（生成物）；`python3 .claude/scripts/gen-index.py insights --write` 生成 |
| `requirements/requirements-raw.md` | 原始需求 |
| `architecture/01-进程管控设计文档.md` | 给开发的设计文档（有版本演进，受审查） |
| `architecture/00-进程管控概要设计.html` | 给领导看的概要设计（按页面组织，单文件 html）；一次性交付物，领导满意后从项目移除，不与 01 同步维护 |
| `demo/` | 页面演示（有效页面与作废页面见上方「页面 demo」） |
| `screenshot/` | 现有 SOC 中心页面截图 |
| `research/{NN}-{主题}.md` | 调研文档 |
| `review/RV-{类型}-{YYYYMMDD}-{HHmm}-{受审对象}.md` | 审查报告；类型：req / design / impl / others。现有 3 份 `RV-20261013-0833-PL-06-v0.7/0.8/0.9.md` 是本规则建立前的历史命名（审查对象都是 `architecture/01`），不改名 |
| `others/dbscript/rpw.sql`、`others/policy/policy.md` | 数据库脚本、客户端策略协议 |
| `.claude/skills/`、`.claude/scripts/` | 三机制的 skill 与生成 / 检查脚本（入库）；`.claude/launch.json` 等本机配置不入库 |

# 时间戳命名规则（changelog / insights / review 共用）

- **`{YYYYMMDD}-{HHmm}`** = 文件**创建**时刻的**本机系统时区**时间，取法固定为 `date +%Y%m%d-%H%M`，禁止心算或手写。到分钟，不带秒。
- 时间戳 = 创建时刻，后续追加内容**不改文件名**；历史文件一律不追溯改名。

# CurrentStatus 与 changelog 更新规则

两者职责不同：changelog 记「本次具体改了什么、为什么、怎么验证、边界是什么」；`CurrentStatus.md` 记「项目现在是什么状态、从哪里继续、下一步做什么」。

## CurrentStatus.md（必须通过 skill 更新）

- 当前事实发生变化时使用 `update-current-status`；同一主题必须替换 / 移动 / 删除旧状态，不得追加第二份过程记录。
- 用户要求清理，或超过 200 行 / 20 KiB、出现重复 / 冲突 / 失效链接 / 按天流水，或「最后精炼」超过 7 天且期间有更新时，使用 `clear-current-status`；清理不是清空，不得删除仍有效事实。
- 正常问答、无新结论的只读调查、临时重试和纯排版不更新状态页。
- 审查 / 自检循环每轮只覆盖「当前进行中」的同一恢复点；结束后移除进行中项，最终结果写入「阶段与文档状态」和阻塞项。逐轮详情只进单一 changelog / review。
- 固定八节结构、状态值和真值优先级以 `update-current-status` skill 为准。结尾必须同时有「最后更新」和「最后精炼」，格式 `YYYY-MM-DD HH:mm TZ`（TZ = `date +%Z`）。
- 「最近 3 个自然日摘要」一节只放指向 `changelog/INDEX.md` 的指针，不手写按天摘要。

## changelog/（维护走 `update-changelog` skill）

- 每个 changelog 必须有 `name` + `description` 字段；**`description` 不超过 150 字**（结论式一句话，细节放正文二级标题），超了生成器拒绝写入。
- 同一审查 / 自检循环的后续轮次，以及**同一天、同一主题的小改动**（如 demo 和设计文档的同步微调），追加到同一 changelog，不逐次新建；文件名时间戳 = 创建时刻，**不随追加改变**。
- **`changelog/INDEX.md` 是生成物，禁止手工编辑**；新建 / 追加 / 改 frontmatter 后同回合重跑 `python3 .claude/scripts/gen-index.py changelog --write`（退出码非 0 即未完成）。说明文字改 `.claude/skills/update-changelog/assets/INDEX.head.tmpl`。
- 开工重跑生成器会按当天日期刷新索引，git 里出现 `changelog/INDEX.md` 的未提交改动属正常，随下一次提交一起提交。
- changelog 只增不删；条目变少时生成器拒绝写入，确需删除须用户明确指令 + `--allow-shrink`。
- 2026-10-21 之前的修改历史没有 changelog，以 `git log` 为准，不倒推补写。

## insights/ 与 memory（维护走 `update-insights` skill）

- 可复用经验才进入 `insights/` 与 memory；二者同回合双向同步，写完立即 grep 对照。
- **`insights/` 是项目记忆的唯一持久载体**：memory 目录本机私有、**不进 git**，丢了要靠 `insights/` 重建；`insights/INDEX.md` 是索引兼恢复手册（见该文件第一节）。
- **`insights/INDEX.md` 是生成物，禁止手工编辑**。说明文字改 `.claude/skills/update-insights/assets/INDEX.head.tmpl`，条目内容改各 insight 的 frontmatter（**`description` 不超过 150 字**）。
- **动了下面三类东西，必须同回合重跑** `python3 .claude/scripts/gen-index.py insights --write`：①新增 insight 文件；②改已有 insight 的 frontmatter（`name` / `description`）；③memory 侧增删事实文件，或在 memory 正文里增删 insight 文件名引用（`↳ memory:` 映射是从 memory 正文里的 insight 全文件名机械提取的，不手写）。
