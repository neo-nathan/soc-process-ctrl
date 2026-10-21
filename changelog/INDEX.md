# changelog/ 索引(INDEX.md)

> **本文件是生成物,禁止手工编辑** —— 每次运行
> `python3 .claude/scripts/gen-index.py changelog --write` 都会整体覆盖。
> 说明文字改 `.claude/skills/update-changelog/assets/INDEX.head.tmpl`,
> 条目内容改各 changelog 文件的 frontmatter(`name` / `description`)和二级标题。
>
> **怎么用**:新任务开机先重跑生成器(刷新日期窗口),再只读下方「一、最近 3 个自然日」;
> 需要追查某次修改的细节时,按链接打开那一篇 changelog 原文,不要无差别扫目录。

## 一、最近 3 个自然日

> 窗口:2026-10-19 ~ 2026-10-21(按本机日期 2026-10-21 计算;重跑生成器即刷新)。新在上、旧在下。

### 2026-10-21

- **[建立 CurrentStatus / changelog / insights 三机制](log-20261021-0107-建立CurrentStatus-changelog-insights三机制.md)** \
  从 soc-cascade-syslog 移植 4 个 skill、索引生成器和状态页检查脚本,CLAUDE.md 补开工流程、目录表、时间戳与更新规则;状态页第二节改为「阶段与文档状态」;不搬 DC-03/04/08 等规范文档,10-21 之前的历史以 git log 为准 \
  ↳ 段落: 改了什么 · 为什么 · 怎么验证 · 边界 · 追加(2026-10-21 01:26 EDT):循环自检第 1 轮修正 9 处 · 追加(2026-10-21 01:28 EDT):循环自检第 2 轮修正 5 处并全量重验 · 追加(2026-10-21 01:28 EDT):循环自检第 3 轮修正 2 处

## 二、全量索引(共 1 篇,断链 0,按本机日期 2026-10-21 生成)

> 按自然月分组、组内按时间升序。`↳ 段落:` 是该篇正文的二级标题列表,
> 多轮追加的记录也能在这里看到追加段。
>
> 维护规则:新建 / 追加 / 改 frontmatter 后必须同回合重跑生成器;
> `description` 不超过 150 字,超了生成器拒绝写入;
> changelog 只增不删,条目变少时生成器会拒绝(误删保护),确需删除加 `--allow-shrink`。
> 写法见 `.claude/skills/update-changelog/SKILL.md`。

<!-- gen-index: body-start -->

### 2026-10

- **[建立 CurrentStatus / changelog / insights 三机制](log-20261021-0107-建立CurrentStatus-changelog-insights三机制.md)** \
  从 soc-cascade-syslog 移植 4 个 skill、索引生成器和状态页检查脚本,CLAUDE.md 补开工流程、目录表、时间戳与更新规则;状态页第二节改为「阶段与文档状态」;不搬 DC-03/04/08 等规范文档,10-21 之前的历史以 git log 为准 \
  ↳ 段落: 改了什么 · 为什么 · 怎么验证 · 边界 · 追加(2026-10-21 01:26 EDT):循环自检第 1 轮修正 9 处 · 追加(2026-10-21 01:28 EDT):循环自检第 2 轮修正 5 处并全量重验 · 追加(2026-10-21 01:28 EDT):循环自检第 3 轮修正 2 处
