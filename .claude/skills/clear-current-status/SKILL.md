---
name: clear-current-status
description: 核实并精炼项目根 CurrentStatus.md，清除重复、过期、冲突和历史流水，但禁止清空文件或删除仍有效的当前事实。用户要求清理/精简状态页时使用；超过 200 行或 20 KiB、最近摘要节被写成按天流水、出现重复项/失效链接/新旧冲突，或最后精炼超过 7 天且期间有更新时也必须使用。
---

# clear-current-status — 清理并精炼当前状态

## 安全定义

本 skill 的「清理」不是清空，也不是机械删掉三天前的内容。目标是从当前权威事实**重新构建**一份简短、自洽、可接手的快照：

- 保留仍影响当前行动的事实；
- 删除重复、过期、冲突和历史过程；
- 过程历史留在 changelog / review / Git；
- 让 Agent 不翻 changelog 也能掌握当前阶段、阻塞和下一步。

固定结构、状态值、真值优先级与 `update-current-status` 完全相同，以它的 SKILL.md 为准，本文件不重复。

## 触发条件

- 用户执行或明确要求 `/clear-current-status`；
- 检查脚本返回 `RESULT=CLEAR_REQUIRED`（超过 200 行 / 20 KiB、重复标题、重复状态项、下一步含已完成或超过 5 项、当前进行中超过 3 项、出现「历史审查轨迹」「已由上方取代」「仅供回溯」等历史标记）；
- 状态页与权威文件、现场或 Git 冲突；
- 距「最后精炼」超过 7 个自然日且期间有过更新。

## 前置闸门：并行工作区禁写（先做，不通过就别往下走）

与 `update-current-status` **共用同一条禁令和同一个机械判据**：状态页不允许在
`git worktree` 拉出来的并行工作区里改动——清理比更新改得更多，在并行工作区里做后果更重。

（`cd` 到状态页所在目录原样跑，勿改写成 `git -C`）：

```bash
[ "$(env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR git rev-parse --git-dir)" -ef "$(env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR git rev-parse --git-common-dir)" ] && echo "主工作区" || echo "并行工作区"
```

> 不要用 `--path-format=absolute`（要 git ≥ 2.31，且老 git 会原样回显未知选项导致误判）。
> 判据须与 `update-current-status/scripts/check_current_status.py` 保持同语义。

输出 `并行工作区` ⇒ **停手**，告诉用户回主工作区清理。
唯一例外是用户明确指令，第 13 步脚本加 `--allow-worktree`（会留 `WARN` 痕迹），
**不得由执行者自行决定使用**。

## 执行流程

1. 完整读取 `update-current-status/SKILL.md` 和当前 `CurrentStatus.md`。
2. 执行并记录：

   ```bash
   git status --short --branch
   git diff -- CurrentStatus.md
   wc -l -c CurrentStatus.md
   shasum -a 256 CurrentStatus.md
   ```

3. 记录其他任务的未提交状态检查点；如果清理期间文件并发变化，重新读取并合并，禁止用旧快照强写。
4. 从当前权威入口重建事实，至少核实：
   - `requirements/requirements-raw.md`（原始需求）；
   - `architecture/01-进程管控设计文档.md`（给开发的设计，看版本记录、第 0 节结论、12.1 待对齐清单）；
   - `architecture/00-*.html`（给领导的概要设计，一次性交付物，领导满意后会移除；已移除就跳过）；
   - `demo/` 有效页面（作废页面清单见 `CLAUDE.md`）；
   - `others/dbscript/rpw.sql`、`others/policy/policy.md`；
   - `review/` 最新一份审查报告；
   - 实时 Git 现场；
   - 状态页中仍标为进行中、阻塞或下一步的对象。
5. 对每一条「当前进行中」的 changelog/review 恢复入口，读取其最新轮次和时间戳；恢复入口中的最新检查点优先于旧状态页文字。
6. 逐段分类：

   | 分类 | 处理 |
   |---|---|
   | 当前有效事实 | 保留并简写为当前态 |
   | 当前进行中 | 保留一个可恢复检查点 |
   | 当前阻塞 / 待确认 | 保留影响、关闭条件和下一动作 |
   | 当前下一步 | 保留并排序，最多 5 项 |
   | 最近三天结果 | 不在状态页保留，收成指向 `changelog/INDEX.md` 的指针 |
   | 重复 | 合并到唯一主题位置 |
   | 过期 | 删除 |
   | 冲突 | 按真值优先级核实后只保留正确结论 |
   | 历史过程 | 确认 changelog/review/Git 里有追溯入口后删除 |
   | 设计 / 需求正文 | 改成结论加权威链接 |
   | 只存在于状态页的有效知识 | 先迁移到正确的权威文件（或 insights），再从状态页简写 |

7. 冲突按真值优先级处理；只保留核实后的一个结论，不保留两个版本回避判断。
8. 按固定八节重写；同一项、任务和阻塞只留一次，下一步最多 5 项。
9. 把「最近 3 个自然日摘要」一节收成一行指向 `changelog/INDEX.md` 的指针。
10. 删除逐轮审查意见、版本演进、完整修改清单、已完成删除线和失效链接。
11. 不新建 `CurrentStatus-archive.md`（那只是把噪音换个地方存）。
12. 用 `date '+%Y-%m-%d %H:%M %Z'` 取时间，更新「最后更新」和「最后精炼」。
13. 用 `update-changelog` 新建本次清理的 changelog，记录清理前后体量、保留原则、删除类别、冲突修正和验证结果。然后运行：

    ```bash
    python3 .claude/skills/update-current-status/scripts/check_current_status.py CurrentStatus.md
    git diff --check
    ```

14. 对未跟踪的新文件逐个执行：

    ```bash
    git diff --no-index --check /dev/null <file>
    ```

## 真值与删除边界

- 三天窗口由 `changelog/INDEX.md` 生成器承担，只约束过程摘要，不约束仍有效的当前事实（例如「后端 PHP 5.6」「名单只挂组」这类早已定下但仍有效的事实要保留）。
- 设计定稿、编码实现、101 联调、客户验收必须分开，不能互相冒充。
- 旧环境曾可用不等于当前可用。
- 删除状态页历史文字不删除 changelog、review 或 Git 历史。
- 不改需求、设计、demo 语义去迁就状态页。
- 不执行 reset、checkout、revert 或其他会丢失未提交修改的命令。
- 检查脚本返回 PASS 只说明结构与可机械发现的问题通过，不能替代恢复入口和权威事实的语义对账。

## 完成门

- 目标不超过 150 行、15 KiB；确有必要可超过软目标，但不得超过 200 行、20 KiB；
- 固定章节齐全、顺序正确；
- 没有重复项、新旧冲突、失效链接和已完成下一步；
- 「最近 3 个自然日摘要」一节只有指向 `changelog/INDEX.md` 的指针；
- 新 Agent 只读状态页就能说出当前阶段、阻塞和下一动作；
- 清理前已有的未提交状态语义仍保留；
- **不在并行工作区清理**（前置闸门已判定；用 `--allow-worktree` 跳过时，必须能指出用户的明确指令出处）；
- 检查脚本返回 `RESULT=PASS`。
