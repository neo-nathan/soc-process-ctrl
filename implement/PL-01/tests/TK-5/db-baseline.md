# TK-5 Tester 开工前只读快照（2026-10-22 13:44 CST）
- 101 文件 md5 与 ENV 一致：list.js 8617207681fc73f7887c504d8751f4c9 / list.html bbec7810abb100d1c357602cc5d85b27 / processManageList.css 20cbd1160963477f8737f55a7193afcd / bwlistMock.js 8ac7ae5d9f39e0ed8f0878289a941115 / processManage.js a2b0eb109e241e94902535e6a52852b0
- 策略中心公共文件与改动前基线一致：strategy/index.html 9d06b448… / openLine.js 147ff8fa… / tree.js 7d9fea80… / core.js 61b3ff98…；strategy/index.js 90d973a7…（基线没记 index.js）
- POLICY 名单行：PID 35～43 共 9 条（8 白 1 黑），STATUS 2/3（=名单类型，F-6①）
- 同事数据指纹（PID 35～43，CONCAT_WS PID|PNAME|DESCRIPTION|POLICYTYPE|STATUS|POLICYJSON|UPDATETIME）：1d58998d205fea3af5253a77b7a88872（公式与 TK-4 不同，只与本文件前后比较）
- POLICY 总行数 38；POLICYOBJECT 2464；RPW_WPROC 9 行 md5 4c574ac8b8048ad9211146019b9dfb9b（与 TK-4 结束时一致）；RPW_BPROC 0 行
