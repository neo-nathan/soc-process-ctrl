---
name: update-changelog
description: 新建或追加 changelog/ 修改记录,并重新生成 changelog/INDEX.md。凡有持久化项目变更(改代码/文档/规则/skill、实测得出新证据、审查或实施循环推进一轮)都必须同回合使用;同一 loop 的后续轮次追加到同一文件。INDEX.md 是生成物,禁止手工编辑,靠 .claude/scripts/gen-index.py 重算。
---

# update-changelog — 写 changelog 并刷新索引

## 核心原则

- changelog 记「这次具体改了什么、为什么、怎么验证、边界是什么」;项目现在什么状态归
  `CurrentStatus.md`(用 `update-current-status`),两者不混写。
- `changelog/INDEX.md` 是 **生成物**:每条、每个数字都由 `.claude/scripts/gen-index.py`
  从各 changelog 的 frontmatter 和二级标题机械提取。Agent 开机只读它顶部「最近 3 个自然日」
  区块,不扫 changelog 原文;有需要再按索引精确打开某一篇。
- 索引靠脚本重算,不靠记忆同步——所以写完 changelog 必须同回合重跑生成器,退出码非 0 即未完成。

## 触发判断

有以下任一情况,同回合必须写(新建或追加):

- 改了代码、文档、规则(需求 / 设计 / demo / CLAUDE.md / skill / 脚本)并落盘;
- 在 101 实测、核对 SOC 源码得出新证据,或纠正了旧结论;
- 审查/实施循环推进了一轮(轮次详情追加到该 loop 的同一 changelog);
- 用户拍板了一个影响后续工作的决定。

不触发:普通问答、无新结论的只读调查、临时重试、纯排版。

## 新建还是追加

- **追加**:同一审查/自检循环的后续轮次;同一任务在同一回合内的补充动作;
  **同一天、同一主题的小改动**(如 demo 与设计文档的同步微调),避免 changelog 碎成一地。
  用 `## 追加(YYYY-MM-DD HH:mm TZ):主题` 作二级标题接在文末,**文件名时间戳不变**。
- **新建**:新任务、新主题,或用户明确开新一轮工作。

## 步骤

1. 取创建时刻:`date +%Y%m%d-%H%M` 和 `date +%Z`,禁止心算或手写时间。
2. 判定新建还是追加(见上)。追加则跳到第 5 步。
3. 新建文件 `changelog/log-{YYYYMMDD}-{HHmm}-{主题}.md`,以 `assets/changelog.template.md` 为骨架。
4. 写 frontmatter:
   - `name`:一句话主题,和文件名主题一致;
   - `description`:**结论式一句话,不超过 150 字**(中文一字一算)。写「最终结果 + 关键边界」,
     不复述过程、不列命令;细节放正文和二级标题。生成器会检查字数,超了拒绝生成。
5. 写正文,固定四段二级标题:`改了什么` / `为什么` / `怎么验证` / `边界`。
   二级标题会被提取进索引,标题要能独立说明这一段是什么;追加段同理。
   追加后若最终结论变了,同步改 `description`(仍受 150 字限制)。
6. 不写凭据、不写带凭据的命令;地址与密码只在 `CLAUDE.local.md`。
7. 重跑生成器(在仓库任意位置执行):

   ```bash
   python3 .claude/scripts/gen-index.py changelog --write
   ```

   退出码非 0 就按 stderr 提示修(缺字段、description 超长、文件名不合规、条目变少),修完再跑。
8. 自检:`python3 .claude/scripts/gen-index.py changelog --check` 退出码 0;
   打开 `changelog/INDEX.md` 顶部「最近 3 个自然日」区块,确认本条在最上方、段落列表正确。
9. 若本次变更同时改变了项目阶段、文档状态、阻塞或下一步,另用 `update-current-status`;
   状态页「最近 3 个自然日摘要」一节只放指向 `changelog/INDEX.md` 的指针,不再重复摘要。

## 完成门

- 文件名符合时间戳规则,frontmatter 有 `name` + `description`,description ≤ 150 字;
- 正文四段齐全(追加段可只写改动和验证);
- 生成器 `--write` 与 `--check` 都退出码 0;
- 索引最近区块能看到本条;
- 正文与 description 无凭据。

## 禁止

- 手工编辑 `changelog/INDEX.md`(下次生成即被覆盖,等于白改);
- 改已有 changelog 的文件名时间戳;
- 删除 changelog——它是历史记录。确需删除必须有用户明确指令,并用 `--allow-shrink` 放行收缩哨兵;
- 把 changelog 内容抄进 `CurrentStatus.md`。

## 索引说明文字要改怎么办

改 `assets/INDEX.head.tmpl`(头部说明模板),再重跑生成器;条目内容改各 changelog 的 frontmatter。
