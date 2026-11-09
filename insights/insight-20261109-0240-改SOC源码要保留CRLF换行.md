---
name: 改 SOC 源码要保留 CRLF 换行
description: SOC 源码有的文件是 CRLF 换行（如 log.js、processMana.html、log.html），Python 默认读写会全变 LF，svn diff 变成整文件改动；用 newline='' 读写，改完对比 CRLF 行数和 diff 行数。
---

# 改 SOC 源码要保留 CRLF 换行

**场景**：2026-11-09 按提示词验证报告，用 Python 脚本批量替换 `ESMCenterST/public/esm/view/processManage/` 下 7 个文件的文案（见 `changelog/log-20261109-0238-按提示词验证报告修订文案.md`）。

**现象 / 坑**：同目录文件换行方式不统一：`list.js`、`list.html`、`processMana.js`、`bwlistProc.js` 是 LF，`log.js`、`processMana.html`、`log.html` 是 CRLF（同事写的）。`open(p, encoding='utf-8')` 默认把 `\r\n` 读成 `\n`、写回 `\n`，3 个 CRLF 文件整文件变成 LF，`svn diff` 从几十行涨到 92KB；提交出去会把同事文件的每一行都记成自己改的。

**结论**：改 SOC 源码时保持原换行，不顺手统一。

**检查清单**：

1. Python 读写一律 `open(p, encoding='utf-8', newline='')`（读写都要加）；Edit 工具按原文件匹配即可。
2. 改完逐个对比：`svn cat 文件 | grep -c $'\r'` 与 `grep -c $'\r' 文件` 相等。
3. `svn diff | grep -c '^[-+][^-+]'` 应与实际改动行数相当；突然很大就是换行或编码变了，`svn revert` 后重做。
