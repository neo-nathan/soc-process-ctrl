# PL-02 TK-1 计划级验收 — 文档 / 代码层检查（grep，真跑）

依据：PL-02 §六 TK-1 完成判据「`grep -nE "layoutPage|addNewList|require\('processManage'\)" list.js bwlistModal.js` 为 0 处（注释里说明历史的除外；不用 listModal 做关键字，它会命中新文件名 bwlistModal）」

对象：SOC 源码本地工作副本 `/Users/nick/Workspace/ESMCenterST/public/esm/view/processManage/`
本地 md5：list.js `ddfe927d9230088ad5ef68dbd0090c78`、list.html `d34d7edc6b83975d408b7b1401ef7b94`、bwlistModal.js `bd40efd44a7a42d7c4005e62c447c151`（= 101，101 于 20:16 CST 重核一致）

## D-1 完成判据 grep（判据原样）
```
$ grep -nE "layoutPage|addNewList|require\('processManage'\)" list.js bwlistModal.js; echo "grep exit=$?"
grep exit=1
```
0 处命中（含注释也 0 处）：**绿**。

## D-2 补充 grep（防判据写法漏网，非判据本身）
```
$ grep -nE "require\(\s*[\"']processManage[\"']\s*\)" list.js bwlistModal.js      → exit=1（双引号 / 空格变体 0 处）
$ grep -nE "[\"']processManage[\"']" list.js bwlistModal.js                       → exit=1（依赖数组里的模块名 0 处）
$ grep -nE "(^|[^w])listModal" list.js bwlistModal.js | grep -v bwlistModal         → exit=1（旧 listModal 用法 0 处）
$ grep -n "addNewList" list.html                                                  → exit=1
```
全部 0 处：**绿**。

## D-3 补充：§五「两条占位文字写在 list.js 白、黑两份配置里，经 open(opts) 传给弹窗；bwlistModal.js 不写死白、黑文案」
```
$ grep -nE "办公区终端白名单|挖矿程序黑名单|放行什么|拦截什么|创建白名单|创建黑名单|编辑白名单|编辑黑名单" bwlistModal.js
19: *                  title            弹窗标题，如「创建白名单」「编辑黑名单」（由 list.js 按白 / 黑配置拼好）
```
唯一命中在文件头注释里（举例说明参数），代码里没有写死：**绿**。
`list.js` 里四条占位各出现 1 次（`grep -c` = 1/1/1/1）。

## D-4 语法
```
$ node --check bwlistModal.js   → ok（exit 0）
```
（本 TK 没有 node 层纯逻辑验收要求；这里只确认新文件能被解析。）
