# insights/ 索引(INDEX.md)

> **这份文件是「项目记忆」的入库备份索引。**
>
> Agent 的 memory 目录(本机为 `~/.claude/projects/-Users-nick-Workspace-soc-process-ctrl/memory`,目录名由仓库绝对路径机械推导)是**本机私有、不进 git** 的,
> 换机器、清缓存、误删都会整个丢失。`insights/` 进 git,所以它才是项目记忆的**唯一持久载体**;
> 这份 INDEX.md 让它从"一堆散文件"变成"可检索、可恢复的索引"。
>
> ⚠️ **本文件不会被自动加载进上下文**(与 `MEMORY.md` 不同),所以这里放的是**完整 description**
> (上限 150 字)而不是压缩过的一句话钩子 —— 恢复记忆时信息量优先。

## 一、memory 丢了怎么用它恢复

1. 确认 memory 目录空了或不完整:`ls ~/.claude/projects/-Users-nick-Workspace-soc-process-ctrl/memory/`(路径由生成器按仓库位置推导,换机器重跑即更新)
2. **通读本文件的索引正文**(第四节)。每条 = 一条可复用教训的标题 + 完整摘要 + 它原本对应的 memory 文件名。
3. 按 `↳ memory:` 标注的文件名,逐条重建 memory 事实文件:正文从对应 insight 文件里提炼,
   frontmatter 的 `name` 用 `↳ memory:` 里的 slug,`description` 可直接用本索引里的摘要。
4. 重建 `MEMORY.md` 索引:每条一行 `- [标题](文件名.md) — 钩子`。
   ⚠️ 钩子必须**压缩到 120 字以内** —— MEMORY.md 每次会话全量进上下文,写成长摘要会挤占注意力。
5. 没有 `↳ memory:` 标注的条目见下方说明,按价值自行决定要不要新建 memory 条目。

## 二、同步状态(生成时刻实测,本机日期 2026-10-21)

| 指标 | 数值 |
|---|---|
| insights 文件总数 | **2** |
| 其中 memory 侧**显式点名引用**的 | **2** |
| 未见 memory 显式引用的 | **0** |
| memory 事实文件总数 | **3** |
| 断链(索引→文件、memory→insight) | **0** |

⚠️ **「未见 memory 显式引用」不等于「没沉淀进 memory」**。映射是靠"memory 文件正文里有没有写出
insight 文件名"机械提取的,而写引用这件事本身是可选的 —— 有的 memory 条目内容上确实来自某条
insight,只是没留文件名。**所以这 0 条是"待人工确认"的候选,不是"缺口清单",
不要拿它当返工依据。**

## 三、维护规则

- ⚠️ **本文件是生成物,任何情况下都不要手工往索引正文加条目/改条目** —— 下次重跑就被覆盖,白写。
  正确做法是**重跑生成器**:`python3 .claude/scripts/gen-index.py insights --write`
  (仓库任意位置可跑;退出码非 0 即不通过)。完整流程见 `.claude/skills/update-insights/SKILL.md`。
- **三类改动都必须同回合重跑**,不止"新增 insight"一种:
  1. 新增 insight 文件;
  2. 改已有 insight 的 **frontmatter**(`name` / `description` —— 索引条目正文就取自这两个字段;
     只改 insight 正文不影响本文件,可不跑);
  3. **memory 侧增删事实文件,或在 memory 正文里增删 insight 文件名引用** —— 前者进第二节的
     「memory 事实文件总数」,后者定 `↳ memory:` 映射与关联数;改 `MEMORY.md` 本身不影响本文件。
  这条义务与"insights 和 memory 双向同步"是同一件事的两半。
- `description` 不超过 150 字,超了生成器拒绝写入;条目变少时生成器也拒绝(误删保护),
  确需删除加 `--allow-shrink`。
- `↳ memory:` 这一行的来源是机械提取,**不要手写**。重新生成映射:在 memory 文件正文里写上
  对应的 insight 文件名(全称),然后重跑生成器。
- 说明文字改 `.claude/skills/update-insights/assets/INDEX.head.tmpl`,不改本文件。
- 文件命名规则(时间戳)见 `CLAUDE.md`「时间戳命名规则」,本索引不重复。
- 历史文件一律不追溯改名。

## 四、索引正文

> 按自然月分组、组内按时间升序。`↳ memory:` 表示该条已在 memory 侧被显式引用。

<!-- gen-index: body-start -->

### 2026-10

- **[从其他项目移植治理机制(skill/脚本/CLAUDE.md 规则)的体检要点](insight-20261021-0105-从其他项目移植治理机制的体检要点.md)** \
  移植 skill、脚本和 CLAUDE.md 规则前先用 git check-ignore 确认 .claude/ 没被忽略;grep 清掉旧项目的文档号、环境和目录;只登记本项目真实存在的目录;旧规则和现存文件冲突时新规则只管以后,历史文件不改名 \
  ↳ memory: `governance-migration-checklist`
- **[给领导的设计文档按页面组织,不要做开发文档的压缩版](insight-20261021-0105-给领导的设计文档按页面组织.md)** \
  给领导看的概要设计要以 demo 页面为脉络、配截图、写成单文件 html,不写代码位置和协议细节;把开发设计文档压短的同视角版本领导会否掉。开发文档 01 不为领导改,00 一次性交付不维护 \
  ↳ memory: `single-design-doc`
