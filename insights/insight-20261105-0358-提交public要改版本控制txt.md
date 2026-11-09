---
name: 提交 public 要同时改 public/版本控制.txt
description: SOC 源码 public/ 每次 svn 提交都要把 public/版本控制.txt 改成本次版本号（只一行、无末尾换行）并一起提交；r72265 以前本项目漏改。提交前 svn up public，按网址查最新号 +1，写入后 svn diff 核对。
---

# 提交 public 要同时改 public/版本控制.txt

**场景**：本项目往 SOC 源码 `public/` 提交前端改动（svn 仓库 `.../ESMCenterST/public`）。同事 shixx 的每次提交（r72239～r72268）都改 `public/版本控制.txt`，内容就是提交说明第一行的版本号。

**现象 / 坑**：本项目 r72265 及以前的提交只写了提交说明里的版本号，没改这个文件，用户 2026-11-05 指出。文件格式是一行版本号、**末尾没有换行**，用编辑器保存容易多出换行。

**结论**：每次提交 `public/` 都把 `public/版本控制.txt` 改成本次版本号，和代码文件一起提交。101 上部署目录里的同名文件内容和 svn 不同，属于部署侧，不去改。

**检查清单**：

1. `svn up public`（到顶级目录），拿到别人最新的 `版本控制.txt`。
2. 按网址查 `public` 最新版本号，末位 +1。
3. `printf '%s' "$NEXT" > public/版本控制.txt`（不带换行），`xxd` / `svn diff` 看到只改了数字、仍是「No newline at end of file」。
4. `svn ci` 的文件清单里带上 `public/版本控制.txt`；提交后 `svn log -r <rev> -v --xml` 看路径里有它。
