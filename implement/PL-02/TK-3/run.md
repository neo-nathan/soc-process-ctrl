# TK-3 全量验收执行记录（主 Agent 照 TK-1/tester/browser-cases.md 跑；Claude in Chrome 标签 88508850；101 processManage.js = 同事版 58064f62…）

## 测前
- 名单 11 条（35-43、60、64）、POLICY 40 行、MAX(PID) 64、PL02 残留 0；逐行指纹 TK-3/db-before-policy-rows.txt（44 行）、db-before-wproc.txt（11 行）
- 首页 RsCore.ajax 长度 6983（S-7 原始值）；菜单进白名单页后 1019（mock 包一层），#procmListModal 1 个

## S-1 白名单页
- 「创建白名单」→ 片段 A：title 创建白名单；rows ["* 白名单名称：","* 系统类型： Linux/信创","描述："]；namePh 示例：办公区终端白名单；descPh 选填，说明这条白名单用在哪里、放行什么；footer ["取消","创建"]；sysEditable 0、sysText Linux/信创；nameMax 100、descMax 200；hasBeizhu false；hasClose 1；两框 oninput RsCore.validateXss(this) → 绿
- 空名称点「创建」：提示「请输入名单名称！」1 条，Procmanager 请求 0，弹窗仍开 → 绿（批量操作第一次点击坐标落空，截图后重做；以重做结果为准）
- 只输 3 个空格（框内值 "   "）点「创建」：提示「请输入名单名称！」1 条，请求 0 → 绿
- 名称 "  PL02测试-白创建  "、描述 "  PL02测试描述-白  " 点「创建」一次：点后立即 disabled=true；3 秒后提示「创建成功。」、弹窗关、遮罩 0、表格出现；网络 createWBList 1 + getWBList 1 → 绿
- SQL：PID 71 [PL02测试-白创建] [PL02测试描述-白]（首尾空格已去）POLICYTYPE 2、EPTYPE 2；名单进程 0 行；名单 12 条 → 绿

## S-1 黑名单页
- 菜单「黑名单」→「创建黑名单」→ 片段 A：title 创建黑名单；rows ["* 黑名单名称：","* 系统类型： Linux/信创","描述："]；namePh 示例：挖矿程序黑名单；descPh 选填，说明这条黑名单用在哪里、拦截什么；footer ["取消","创建"]；sysEditable 0；nameMax 100、descMax 200；hasBeizhu false；弹窗内无「白」字样 → 绿
- 空名称点「创建」：提示 1 条「请输入名单名称！」、请求 0 → 绿
- PL02测试-黑创建 / PL02测试描述-黑 点「创建」一次：点后 disabled=true；提示「创建成功。」、弹窗关、遮罩 0、表格出现；createWBList 1 + getWBList 1 → 绿
- SQL：PID 72 PL02测试-黑创建 / PL02测试描述-黑 / POLICYTYPE 3 / EPTYPE 2；RPW_BPROC 该名单 0 行；名单 13 条 → 绿

## S-2 黑名单页编辑（含 S-4 编辑计数）
- 展开 PL02测试-黑创建 →「编辑」→ 片段 A：title 编辑黑名单；footer ["取消","保存"]；nameVal PL02测试-黑创建、descVal PL02测试描述-黑；sysEditable 0；黑名单占位 → 绿
- 改为 PL02测试-黑已编辑 / PL02测试描述-黑已改，点「保存」一次：点后 disabled=true；提示「修改成功。」、弹窗关、表格名称和描述更新；网络 editWBList 1 + getWBList 1，createWBList 0 → 绿
- SQL：PID 72 PL02测试-黑已编辑 / PL02测试描述-黑已改 / POLICYTYPE 3；名单总数 13（编辑前后不变）→ 绿

## S-3 字段限制（黑名单页创建弹窗）
- maxlength 名称 100、描述 200（白、黑、创建、编辑四种打开状态的片段 A 都读到 100 / 200）；oninput 两框 RsCore.validateXss(this)
- 真键入：名称框键入 103 个汉字 → 值长度 100；描述框键入 225 个汉字 → 值长度 200（键入字数用 python len 核过）→ 绿
- 「备注」反向哨兵：各次片段 A hasBeizhu=false，标签为「描述：」→ 绿

## S-5 失败与关闭（黑名单页）
- 重名：名称 PL02测试-黑已编辑（已存在的黑名单）、描述空 → 提示 1 条「名单名称已存在。」；弹窗仍开；「创建」按钮 disabled=false；其他可见弹窗 0；网络 createWBList 1、无 getWBList → 绿
- 含非法字符：PL02测试-非法#字符 → 提示 1 条「搜索值包括非法字符」；弹窗开；按钮恢复；createWBList 1 → 绿
- 超过 33 个汉字：PL02测试- + 34 个「长」（共 36 个汉字，41 字符）→ 提示 1 条「搜索值包括非法字符」；弹窗开；按钮恢复；createWBList 1 → 绿（Q4 默认下属已知：后端按字节限长）
- 关闭：取消 / 右上角叉 / Esc 三种（关前都有草稿）都 visible=false、.modal-backdrop=0；每次重开创建弹窗名称、描述都为 "" → 绿
- 弹窗开着时浏览器后退：先菜单 概览 → 黑名单（见 S-7），开「创建黑名单」弹窗输入草稿（后退前遮罩 1、弹窗 visible）→ navigate back → 回到概览：遮罩 0、body.modal-open=false、可见弹窗 0、#procmListModal 0、RsCore.ajax 6983；read_console_messages(onlyErrors) 0 条 → 绿

## S-7 离开页面
- 首页 RsCore.ajax 6983；白名单页 1019
- 黑名单页 → 菜单「概览」：ajax 6983（= 原始值）、#procmListModal 0、.procm-bwlist 0、遮罩 0、.c-page-content 上 procmListModal 命名空间处理 0 → 绿
- 概览 → 菜单「黑名单」：ajax 1019、#procmListModal 1、处理函数 {click cancel:1, click ok:1, hidden:1} → 绿
- 后退到概览（见 S-5 末行）同上 → 绿
- 概览 → 菜单「白名单」：ajax 1019、处理函数各 1；创建 PL02测试-白离开后 一次：createWBList 1 + getWBList 1、提示「创建成功。」1 条、控制台 0 报错 → 绿

## S-4 只发一次请求（白名单页）
- 单击「创建」：S-1 白、S-1 黑、S-7 共 3 次，createWBList 都恰好 1；单击「保存」：S-2 黑 editWBList 1、createWBList 0
- 双击「创建」（PL02测试-白连点）：createWBList 1 + getWBList 1；提示「创建成功。」1 条
- 库：双击创建后只多 PID 74（PL02测试-白连点）一行（名单 14 → 15，期间 S-7 建了 PID 73）→ 绿

## S-2 白名单页编辑 + S-5 编辑失败与重开
- 展开 PL02测试-白创建（PID 71）→「编辑」→ 片段 A：title 编辑白名单、footer ["取消","保存"]、nameVal PL02测试-白创建、descVal PL02测试描述-白、sysEditable 0、白名单占位 → 绿
- S-5 编辑失败：名称改 PL02测试-编辑#非法 →「保存」：提示 1 条「搜索值包括非法字符」；弹窗开、标题仍「编辑白名单」、按钮「保存」disabled=false；editWBList 1 → 绿；「取消」→ 关闭、遮罩 0；再点「编辑」→ 带出 PL02测试-白创建 / PL02测试描述-白（该行原值，失败改动未残留）→ 绿
- 改为 PL02测试-白已编辑 / PL02测试描述-白已改 点「保存」一次：点后 disabled=true；提示「修改成功。」；弹窗关；表格更新；editWBList 1 + getWBList 1 → 绿
- S-4 双击「保存」（描述改 PL02测试描述-白连点保存）：editWBList 1 + getWBList 1、createWBList 0；提示「修改成功。」1 条 → 绿
- 库：PID 71 PL02测试-白已编辑 / PL02测试描述-白连点保存 / POLICYTYPE 2；名单 15 条（编辑前后不变）→ S-2 白、S-4 双击保存 绿

## S-6
- 在 TK-2 完成后（101 本机 21:23 CST 起）已按用例 6.0～6.7 全部跑过并通过（记录 PL-02/TK-2/s6-run.md）；本次清理后重核 101 七个前端文件与 Procmanager.php 指纹与 S-6 运行时完全相同（见 cleanup.txt），S-6 结果有效，不重复写库

## 清理
- 白名单页删除 PL02测试-白已编辑、PL02测试-白离开后、PL02测试-白连点，黑名单页删除 PL02测试-黑已编辑（确认弹窗文字逐条读过，都是 PL02测试- 开头），各「删除成功。」1 条；表格 PL02 行 0、遮罩 0、控制台 0 报错；探针和只读函数已删除；标签 88508850 已关
- SQL（cleanup.txt）：PL02 或 PID>64 0 行；名单 11 条 35-43、60、64；BWID>64 名单进程 0 / 0；RPW_WPROC 9、RPW_BPROC 0、POLICYOBJECT 2464（= 测前）；TK-3/db-before-*.txt 与 db-after-*.txt diff 均无差异
- 101 指纹：processManage.js 58064f62…、layout.html 7f5ccd7b…、log.js 1defe5dd…、list.js ddfe927d…、list.html d34d7edc…、bwlistModal.js bd40efd4…、processManageList.css 20cbd116…、Procmanager.php da86bf47…（与 TK-0 / TK-1 上传 / TK-2 还原后记录一致）

## 结论
§七 S-1～S-7 全部通过（S-6 中 PL-01 F-8 ① 复现按 Q2 记「已知、交同事」；S-5 超 33 个汉字被后端拦属 Q4 已知；S-5「只出一次提示」：探针逐个记录新出现的 .alert 节点，不按文字去重，同文字重复提示另由 Executor 单测 U10 + 代码阅读兜底）。
