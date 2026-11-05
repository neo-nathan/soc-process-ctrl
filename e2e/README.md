# e2e：进程管控全链路测试（PL-05）

用 Playwright 在 14.15 SOC 中心页面上操作，同时 SSH 到中心和终端 13.18 查库、查 Redis、查终端文件和日志，
判断「页面操作 → 中心落库 → 下发 → 终端收到 → 终端执行 → 日志回传」每一段是否通。
计划见 `../plans/PL-05-进程管控全链路测试计划.md`，证据写到 `../implement/PL-05/<轮次>/`。

## 怎么跑

```bash
npm install                         # 只装 @playwright/test 1.60.0（对应本机已有的 chromium-1223）
npm run login                       # 起常驻有头浏览器（调试端口 9333），由人手动登录 14.15；窗口别关
source <口令环境脚本>                # 从 CLAUDE.local.md 现取口令导出成环境变量（脚本不入库）
PL05_ROUND=<轮次> npx playwright test specs/00-smoke.spec.js
```

- 测试脚本用 `connectOverCDP` 连到常驻浏览器，复用人工登录的会话；**脚本不输入任何密码**。
- `PL05_ROUND` 不给就按北京时间现算；同一轮的多个用例共用 `implement/PL-05/<轮次>/state.json`（测试组号、自建对象 PID）。

## 目录

| 路径 | 用途 |
|---|---|
| `lib/env.js` | 地址、测试对象名字、终端标识；口令只从环境变量取 |
| `lib/ssh.js` | 经 `sshpass -e` 在远端跑脚本，脚本走标准输入，口令不进命令参数 |
| `lib/center.js` | 中心只读探针：SQL 只许 SELECT / SHOW，Redis 只许读命令 |
| `lib/terminal.js` | 终端探针：日志定位、文件列表、准备测试程序（只在 13.18） |
| `lib/wait.js` | 轮询等待，超时返回 TIMEOUT |
| `lib/evidence.js` | 证据落盘、去敏、结果汇总 `results.jsonl` |
| `lib/browser.js` | 起常驻浏览器 / 连接浏览器 / 判断是否已登录 |
| `lib/page.js` | 护栏：拦截所有写接口，核参数，不合规直接中止请求 |
| `lib/run.js` | 用例公共开头结尾、分段结果记录 |
| `specs/` | 用例，编号与 PL-05 的 E-n 一致 |

## 红线（护栏 + 人工双保险）

- 同事的数据不动：只能改本轮自建的策略 / 名单和测试组；应用范围的组号只能是测试组。
- 未登记的写接口一律中止；新增读接口如果名字不带读前缀，要先读后端代码确认只读，再登记到 `page.js` 的 `READ_EXACT`。
- 13.220 只读；所有写操作只走页面，不直接改库或 Redis。
- `.auth/`（浏览器登录资料）、`node_modules/`、`test-results/` 不入库。
