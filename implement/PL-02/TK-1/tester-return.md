# TK-1 Tester 交回原文摘录（2026-10-22 08:1x EDT，主 Agent 从对话转存 self_check 与 blocked_questions；内容未增删，但部分长句做了压缩（如 found_and_fixed、blocked_questions 的 why 字段）；用例全文与逐条结果以 tester/browser-cases.md、data-checks.md、doc-checks.md 为准）

## status
done；本次要跑的 S-1～S-5、S-7 全部是绿，没有红项；判据 grep 0 处命中；S-6 用例已写好，没跑，等 TK-2。

## blocked_questions（3 条，主 Agent 裁决见 changelog「TK-1 Tester 交回与裁决」）
1. S-6「公共弹窗 #addNewListModal 的标题、文字不受名单页影响」：ENV 把期望收窄成「= 101 layout.html 第 591-619 行原文」。读法一：打开时标题、标签、占位、maxlength 都要和 layout.html 静态原文逐字一致（含标题「新建名单」）；读法二：和「这次会话里没进过名单页时，从同一入口打开」的状态一致；静态内容再对照 layout.html 原文。倾向读法二。
2. S-5「取消、叉、Esc 都能关」：失败提示显示的约 3 秒内，「取消」点不动（公共提示组件 .msg-box 的全屏 div.mask，z-index 99999999）。读法一：提示显示期间也必须能关，判红；读法二：提示消失后能关就算通过。倾向读法二。
3. PL-01 F-12 写「弹「错误」+ 后端文字」，实测失败提示里没有「错误」二字。读法一：「错误」必须出现；读法二：「错误」指提示类型。倾向读法二。

## self_check
- reread.expectations_from_baseline：逐条回原文核对过：标题、标签、占位、按钮来自 PL-02 §五 和 demo :469/480-481/486/497-498/504-505；库值来自 §七 S-1/S-2；请求次数来自 §七 S-4；关闭和后退来自 §七 S-5、§五；包裹和事件来自 §七 S-7、§四 bind。没有一条期望取自实现的 JS 逻辑。只看过 list.html 的弹窗结构（为了定位元素）和 bwlistModal.js 的 grep 命中行（唯一命中是注释）
- reread.line_refs_correct：01 §8.5（第 953 行）、01 §8.8 第 14 条（第 987 行）、PL-02 §七 S-1～S-7（第 118-124 行）、§六 TK-1 判据（第 101 行）、§五（第 80-94 行）、§四 bind（第 72 行）、Q4（第 26 行）、PL-01 S-11（第 213 行）
- reread.ac_rt_all_covered：完成判据两条都跑了；§七 S-1～S-7 七个用例都写了，S-6 只写未跑（按分工）。补测：§五 去首尾空格、请求回来前按钮置灰、弹窗外观静态结构、bwlistModal.js 不写死白黑文案。测不到的：编辑「显示这条名单自己的系统类型」只能测 Linux，101 没有 Windows 名单
- reread.assertions_can_fail：断言都是精确比较：文案逐字、请求按集合差计数、库值带方括号检查空格、RsCore.ajax 源码长度跟进名单页前的原始值比、jQuery 事件处理函数逐个计数。提示计数探针做过校准：提示间隔 5 秒能数出 2 条，但 1 秒内两条相同文字的提示只记到 1 条。所以「只出一次提示」抓不到 3 秒内文字相同的重复提示，已写明
- reread.formal_entry_only：页面都从左侧菜单和路由进入；没有在控制台调用 bwlistModal.open 或 RsCore.ajax。控制台只做只读检查，外加一个被动 MutationObserver，测完已断开并删掉 window.__pl02probe。没有发裸 POST，没有用 $.get 拉 .js。数据层只做 SELECT（ro-query.sh 有写操作关键字拦截）
- reread.found_and_fixed：①失败提示显示期间点「取消」没关，查出是公共提示组件 .mask 挡住，改成等提示消失再点，并报进 blocked_questions；②探针校准发现 1 秒内两条相同文字的提示只记 1 条，写明局限，没有放宽断言；③GROUP_CONCAT 默认最长 1024 字符，改为逐行 MD5 存文件再 diff
- syntax：bash -n ro-query.sh（本 TK 无 node 验收脚本；另跑 node --check bwlistModal.js 只作解析确认）→ exit 0
- ran：page 38 条（绿 38、红 0）；data 5 组（绿 5）；doc 7 条（绿 7）
- all_assertions_executed：没被登录页挡住；S-6 按分工只写不跑；没有跳过任何用例
- red_tests：[]
- cleanup：PID 65、66、67、68 都在名单页展开行点「删除」删掉；删后 PNAME LIKE '%PL02%' OR PID>64 为 0 行；名单总数 11（同测前）；RPW_WPROC 9、RPW_BPROC 0、POLICYOBJECT 2464（同测前）；POLICY 全表 40 行逐行 MD5 与测前 diff 无差异；浏览器里新开的标签 88508838 已关
- blocked：""
- summary 补充局限：成功提示「创建成功。」「修改成功。」没能和接口返回的 msg 逐字比，因为工具读不到响应体
