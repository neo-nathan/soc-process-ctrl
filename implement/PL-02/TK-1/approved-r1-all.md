# TK-1 内审第 1 轮 · 主 Agent 核准后的 findings 与整改摘要（给第 2 轮内审作背景）

内审第 1 轮原始结论：FAIL，score 85，blocker 0 / important 4 / suggestion 3。主 Agent 核准：4 条 important 全部保留，无降级、无删除；S3 作为撤销项结案。

| id | 级别 | 标题（原文） | 归属 | 整改摘要 | 整改证据位置 |
|---|---|---|---|---|---|
| I1 | important | S-6 用例对公共弹窗「标题」的对照值没有采集步骤；覆盖表补充事项和裁决 4 互相矛盾 | 用例部分 → Tester；留痕部分 → 主 Agent | Tester 返工重写 S-6：6.1 在进名单页之前、经日志页同一入口打开公共弹窗采 S0（打开态）和 S0c（关闭态），6.3 采 S1 / S1c，按 C1～C4 比较；标题、按钮 data 只前后比，静态字段对照 layout.html:591-619。主 Agent 追加「条款覆盖表修订与裁决更正」段：「改动前基线」一条更正、裁决 4 事实描述更正 | `TK-1/tester/browser-cases.md` 第 101-226 行（改前 `browser-cases.r1.md`）；changelog「## 追加(2026-10-22 08:43 EDT):条款覆盖表修订与裁决更正」 |
| I2 | important | 状态页「当前进行中」的恢复点还停在 05:56，里面的事实已经失效 | 主 Agent | 用 update-current-status 只覆盖「当前进行中」：现处 TK-1 内审第 1 轮未过、S-6 返工、下一步内审第 2 轮；检查器加 `status-checkpoint` 断言 | `CurrentStatus.md` 第 32 行；changelog「人工必查项」段 |
| I3 | important | 裁决 2（保留 list.html 两处注释改动）没有引计划原文；RULINGS 里附的那句原文不支持这个结论 | 主 Agent | 裁决 2 补依据：PL-02 §二 F-5 影响列「TK-1 全部换掉，注释同步」、§三 3.1 list.html 动作「小改」 | changelog「条款覆盖表修订与裁决更正」段 |
| I4 | important | 条款覆盖表自称「从 PL-02 原文机械派生」，但 R-5 没有分给任何 TK；§三 3.1「不改」清单也不在任何 TK 行里 | 主 Agent | 覆盖表修订：TK-1 行补 R-5、§三 3.1「不改」清单；写明 F-1、F-3、F-9、F-10、F-11、R-1、R-2、R-4、R-6 的间接归属；检查器加 `cov-ids-missing` 断言（计划自定义的 21 个 F/R/Q 编号都须在 changelog 出现，修订前跑会报漏 F-9 F-10 R-5 R-6） | 同上 |
| S1 | suggestion | 裁决 3 说「与 PL-01 `listModal.open` 口径一致」不准确 | 主 Agent | 措辞更正为「比 PL-01 多一条 mode 检查」 | 同上 |
| S2 | suggestion | Tester 提示探针的校准原因可能写错了 | Tester | 第 34-37 行原因改为：<1 秒的第二次点击落在 core.js run 的全屏 .mask 上，没点到按钮；结论相应修订 | `browser-cases.md` 第 34-37 行 |
| S3 | suggestion | 静态审查第 1 次留下的 S1（红星颜色）可以撤销 | 主 Agent | 结案：核实不成立（101 实测红色），css 不改 | changelog「条款覆盖表修订与裁决更正」段 |

返工期间新增裁决：Q-S6-1（日志页只测「加白 → 新建白名单」），见 changelog「TK-1 Tester 返工交回与裁决」与紧接着的「Q-S6-1 裁决理由更正」两段（第一版理由引用设计 8.2 不当，已撤回改正）。
代码（list.js / list.html / bwlistModal.js）本轮没有改动，101 上的文件未重新上传。
