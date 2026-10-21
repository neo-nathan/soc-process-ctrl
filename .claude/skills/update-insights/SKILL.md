---
name: update-insights
description: 新增或修改 insights/ 经验条目、与本机 memory 双向同步,并重新生成 insights/INDEX.md。试错踩坑、异常纠偏、跨任务可复用的约束或经验产生时同回合使用;memory 侧增删事实文件或改 insight frontmatter 后也必须使用。INDEX.md 是生成物,禁止手工编辑,靠 .claude/scripts/gen-index.py 重算。
---

# update-insights — 沉淀经验并刷新索引

## 核心原则

- `insights/` 是项目记忆的**唯一持久载体**:Agent 的 memory 目录本机私有、不进 git,
  换机器/清缓存/误删就整个没了;`insights/` 入库,memory 丢了靠它重建。
- `insights/INDEX.md` 是它的索引,也是 memory 丢失后的恢复手册(见该文件第一节)。
  它是 **生成物**,由 `.claude/scripts/gen-index.py` 从各 insight 的 frontmatter 和 memory
  文件正文机械提取;禁止手工编辑。
- insight 与 memory **同回合双向同步**:一条经验要么两边都有,要么两边都没有。

## 触发判断

同回合必须使用:

- 试错踩坑、异常纠偏得到**跨任务可复用**的经验(下次做类似事直接照着避坑);
- 发现代码/文档推不出来的约束(环境陷阱、产品拍板、外部系统怪癖);
- memory 侧新增/删除了事实文件,或在 memory 正文里增删了 insight 文件名引用;
- 改了已有 insight 的 frontmatter(`name` / `description`)。

不触发:只对本次任务有效的一次性事实(那归 changelog 或 CurrentStatus);只改 insight 正文
不改 frontmatter(索引取不到正文,可不重跑)。

## 步骤

1. 先看 `insights/INDEX.md` 全量区块,确认没有同主题条目;有就更新那一条,不新建重复。
2. 取创建时刻 `date +%Y%m%d-%H%M`,新建 `insights/insight-{YYYYMMDD}-{HHmm}-{主题}.md`,
   以 `assets/insight.template.md` 为骨架。
3. 写 frontmatter:
   - `name`:一句话主题;
   - `description`:**不超过 150 字**(中文一字一算),写「场景 + 结论 + 怎么避坑」,
     让人只看索引就能判断要不要点开。生成器会检查字数,超了拒绝写入。
4. 正文写场景、证据、可直接照做的检查清单;引用证据给文件路径,不写凭据。
5. memory 同步(本机 `~/.claude/projects/<按仓库路径推导>/memory/`):
   - 新建或更新对应 memory 事实文件,frontmatter 按 memory 规范;
   - **在 memory 文件正文里写上 insight 的全文件名**——索引里的 `↳ memory:` 映射是从这里
     机械提取的,不手写;
   - `MEMORY.md` 加一行 `- [标题](文件名.md) — 钩子`,钩子 ≤ 120 字(它每次会话全量进上下文)。
6. 重跑生成器(在仓库任意位置执行):

   ```bash
   python3 .claude/scripts/gen-index.py insights --write
   ```

   退出码非 0 就按 stderr 提示修(缺字段、description 超长、文件名不合规、条目变少、
   memory 引用了不存在的 insight),修完再跑。
7. 自检:
   - `python3 .claude/scripts/gen-index.py insights --check` 退出码 0;
   - `grep -n "<insight 文件名>" <memory 目录>/*.md` 能命中,且索引里该条出现 `↳ memory:`;
   - 反向:memory 里每个引用的 insight 文件都存在(生成器断链数为 0)。
8. 同回合把本次变更写进 changelog(用 `update-changelog`)。

## memory 丢了怎么恢复

按 `insights/INDEX.md` 第一节操作:通读索引正文,按 `↳ memory:` 标注逐条重建 memory 文件,
再重建 `MEMORY.md`。恢复完重跑生成器,第二节的统计应回到「未见 memory 引用 = 0」附近。

## 完成门

- 文件名符合时间戳规则,frontmatter 有 `name` + `description`,description ≤ 150 字;
- memory 文件正文含 insight 全文件名,`MEMORY.md` 有对应一行;
- 生成器 `--write` 与 `--check` 都退出码 0,断链 0;
- changelog 已记录。

## 禁止

- 手工编辑 `insights/INDEX.md`;
- 改已有 insight 的文件名时间戳;
- 删除 insight 而不删对应 memory(或反过来);确需删除必须有用户明确指令,并用 `--allow-shrink` 放行;
- 在 insight 里写凭据。

## 索引说明文字要改怎么办

改 `assets/INDEX.head.tmpl`,再重跑生成器;条目内容改各 insight 的 frontmatter。
