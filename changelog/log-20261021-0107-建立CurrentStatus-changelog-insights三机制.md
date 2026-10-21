---
name: 建立 CurrentStatus / changelog / insights 三机制
description: 从 soc-cascade-syslog 移植 4 个 skill、索引生成器和状态页检查脚本,CLAUDE.md 补开工流程、目录表、时间戳与更新规则;状态页第二节改为「阶段与文档状态」;不搬 DC-03/04/08 等规范文档,10-21 之前的历史以 git log 为准
---

# 建立 CurrentStatus / changelog / insights 三机制

- 时间:2026-10-21 01:07 EDT
- 触发:用户要求参考 `/Users/nick/Workspace/soc-cascade-syslog/` 在本项目建立三机制;评估方案后用户拍板「动手」

## 改了什么

- `.gitignore`:原来整行忽略 `.claude/`,改为只忽略 `.claude/settings.local.json`、`.claude/launch.json`、`.claude/worktrees/`,让 skill 和脚本入库。
- 新增 `.claude/scripts/gen-index.py`:基于源项目,改三处:
  - 去掉「insight 两位序号」的旧兼容(本项目一律四位 HHmm);
  - memory 映射改按 insight **完整文件名**匹配(原来只按 日期-时分 前缀;本次两条 insight 同在 01:05 创建,前缀匹配把它们互相串到对方的 memory 上);
  - 新增反向断链检查:memory 引用了已不存在的 insight 时拒绝写入(原 skill 自检第 7 步声称生成器会查,实际没查)。
- 新增 4 个 skill(不带 Codex 用的 `agents/openai.yaml`):
  - `update-changelog`:照搬;触发条件里的「101/45 实测」改为「101 实测、核对 SOC 源码」;追加规则补「同一天、同一主题的小改动」。
  - `update-insights`:照搬;索引模板删掉两位序号说明。
  - `update-current-status`:重写;把源项目 DC-03 的固定结构、状态值、触发时机、真值优先级、禁止写入直接写进 skill;第二节「实施门状态」改为「阶段与文档状态」(表头 `| 项 | 状态 | 当前依据与边界 |`);并行工作区禁写闸门保留,删掉 DC-08 相关文字。检查脚本同步改章节名、表头和提示文字。
  - `clear-current-status`:重写;权威核实清单换成本项目的需求、设计 01/00、demo、rpw.sql、policy.md、review;DC-04 的分类表写进 skill。
- `CLAUDE.md`(保留用户未提交的格式改动,在末尾追加):典型工作流、核心文档与目录、时间戳命名规则、CurrentStatus 与 changelog 更新规则(含 insights 与 memory)四节。目录表只登记本项目实际存在的目录;审查报告命名规则只管以后,现有 3 份 `RV-20261013-0833-PL-06-v0.x.md` 注明为历史命名、不改名。
- 新建 `CurrentStatus.md`:按设计文档 v1.0 版本记录、12.1 待对齐清单和 git 现场首次建立。
- 新建 `insights/` 两条:给领导的设计文档按页面组织;移植治理机制的体检要点。
- memory:`single-design-doc` 补 insight 文件名;新建 `governance-migration-checklist`;`db101-access` 改为指向本项目 `CLAUDE.local.md`(原来指向 soc-cascade-syslog 的那份;核对过两份「101 数据服务」节内容并不完全相同,以本项目为准);`MEMORY.md` 同步。

## 为什么

- 让新会话能 1～2 分钟内接手:状态页给当前事实,changelog 索引给最近 3 天改动,insights 给可复用经验。
- `.claude/` 被忽略时,skill 和脚本只在本机,换机器就丢。
- 源项目的 DC-03/04/08、门号体系、`plans/`/`implement/`/`evidence/` 在本项目不存在,照搬会让 skill 第一步就读不存在的文件。

## 怎么验证

- 正常路径:`gen-index.py changelog --write/--check`、`insights --write/--check` 退出码均为 0,断链 0,两条 insight 各自只映射到 1 个 memory;`check_current_status.py CurrentStatus.md` 输出 `RESULT=PASS`(62 行 / 4620 字节,写本段之前实取)。
- 反例(在临时副本中做,不碰项目):description 超 150 字 → 拒绝写入;删掉一条 insight → 收缩保护拒绝;文件名不合规 → 不通过;状态页用旧章节名「实施门状态」→ FAIL;状态项重复 → CLEAR;最近摘要写日期流水、链接指向不存在文件 → FAIL;memory 引用不存在的 insight → 断链拒绝(验证后已还原 memory)。
- 并行工作区闸门:临时克隆里开 worktree,状态页检查 → FAIL;加 `--allow-worktree` → PASS 并留 WARN;主工作区副本 → PASS。
- `git check-ignore`:`.claude/skills/...` 不再被忽略,`.claude/launch.json` 仍被忽略。
- 复扫:`.claude/`、`CLAUDE.md`、状态页里无旧项目的 DC 文档号、门号、syslog 等残留(剩余命中都在本 changelog 和移植 insight 中,是描述移植本身);新文件和 memory 无凭据;`git diff --check` 与新文件 `--no-index --check` 无空白问题。

## 边界

- 不搬源项目的 DC-01 文档编号规范、DC-03/04/08 规范文档、`check_fuzzy_timestamps.sh`、Codex 软链和 `openai.yaml`。
- 10-14 至 10-20 的 17 个提交不倒推补写 changelog,历史以 `git log` 为准。
- 状态页里「概要设计 00 的领导反馈」未核实,写成待确认事项。
- 本次改动未提交 git,等用户指令。

## 追加(2026-10-21 01:26 EDT):循环自检第 1 轮修正 9 处

- **生成器 memory 映射再修**:上一版按正则「最短匹配到 .md」取文件名,遇到名字中间带 `.md` 的(如源项目 `insight-20260903-0342-移植CLAUDE.md体检清单.md`)会截短、误报断链,两个文件名用顿号相连时也会切错。改为:正向映射拿 `insights/` 里实际存在的文件名做子串匹配;反向悬空检测用贪婪正则并在空白、引号、括号、中文标点处截断。用临时 memory 目录跑三类边界用例(名字含 .md、顿号相连、引用不存在的文件),断言全过。
- **insights 索引模板**:引用的 CLAUDE.md 章节名「时间戳命名通用规则」改为实际的「时间戳命名规则」;「很多早期 memory 条目」(源项目的情况)改为通用说法。
- **update-changelog**:触发条件里的 `docs`(本项目没有)改为「需求 / 设计 / demo」。
- **clear-current-status**:权威清单里概要设计 00 补「已移除就跳过」(它是一次性交付物)。
- **CLAUDE.md**:清理触发条件补上「最后精炼超过 7 天且期间有更新」,与 clear-current-status 一致。
- **事实更正**:insight 和 memory `single-design-doc` 里「10-18 写过压缩版」与 git 不符——压缩版提交于 2026-10-19 01:23(a21768a)、同日 02:21 删除(d335c28),改按 git 写;状态页对 P19 的概括「国产库脚本」不准,改为「各库种建库 / 升级脚本的明文源和改法」(对照设计文档 12.1 P19 原文)。
- **用词**:insight 里用「他」指领导,改为不带代词的写法。

## 追加(2026-10-21 01:28 EDT):循环自检第 2 轮修正 5 处并全量重验

- 状态页第 1 轮改了 P19 表述却没改「最后更新」,补为 01:27(「最后精炼」不变)。
- 生成器说明的「硬规则」补第 5 条(memory 悬空引用算断链);第 3 条里的旧章节名「时间戳命名通用规则」改为 CLAUDE.md「时间戳命名规则」。
- insights 索引统计表「索引→文件 断链」改为「断链(索引→文件、memory→insight)」;update-insights 第 6 步的报错原因补上 memory 悬空引用。
- 机械核对:所有文件里反引号中的路径逐个确认存在(未命中的只有示意写法、裸文件名和明确不新建的 `CurrentStatus-archive.md`),所有指向 CLAUDE.md 章节的引用都能对上;第二批源项目专有词(外审、jar、四库、RQ / AR 编号等)复扫为 0。
- 生成器在上次反例之后改过两次,用验证脚本全量重跑:正例 5 项 + 反例 12 项,共 17 项全部通过。反例包括:description 超长、文件名不合规、删条目触发收缩保护、旧章节名、状态项重复、日期流水、失效链接、下一步含已完成、并行工作区及其放行开关。

## 追加(2026-10-21 01:28 EDT):循环自检第 3 轮修正 2 处

- 移植 insight 检查清单第 2 条的 grep 词原本只适用于 soc-cascade-syslog,改为注明「这是从该项目移植时用的词,换源项目要换词」。
- 同一条 insight 补第 7、8 条经验:照搬的脚本要拿本项目真实数据跑边界(本次暴露了源脚本的前缀串号和不存在的反向断链检查);机械核对所有路径和章节名引用。只改正文、不改 frontmatter,索引无需重建(`--check` 仍一致)。
