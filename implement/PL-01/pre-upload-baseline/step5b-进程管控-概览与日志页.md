# 第 5 步（下）：进程管控 → 概览 → 日志页（改动前基线 · 重采）

- 采集时间：2026-10-21 22:35 EDT（重采；原采集 2026-10-21 08:18 EDT）
- 进入路径：接 5a（进程管理页）→ 左侧子菜单「概览」→ 页面顶部页签「日志」
- 采集前会话核验：带 RSTOCKEN 头的 POST /Procmanager/getWBList type=2 → code=0

## 概览页（中间经过，顺带记）
- 地址：#processManage/overview?g=1；标题：进程管控-概览
- 左侧有「终端分组」分组树（根管理组、默认分组、服务器、test1、业务组01…；截图上树标题后面带 [1/112]）
- 顶部页签：概览（选中） / 日志 / 策略
- 表头（#tbClient，9 列）：（勾选框） | 终端名称 | IP地址 | 所在组 | 操作系统 | 策略模式 | 策略来源 | 白名单 | 黑名单
- 行（2 行）：
  - huall-PC | 172.16.27.94 | 根管理组 | linux:lcserver | --- | 所在组 | linux:lcserver | linux:lcserver
  - 王五 | 193.168.12.25 | 根管理组 | linux:lcserver | --- | 所在组 | linux:lcserver | linux:lcserver
- 底部：「导出EXCEL」「当前已选择 0 条记录」「在线数：0 台 | 离线数：2 台 | 总数：2 台」

## 日志页：能打开
- 地址：https://193.168.10.101:10443/Indexinfo/home#processManage/log?g=1&l_time=week&l_action=&l_reason=&o_stype=&l_stype=computername&l_stxt=&l_limit=20&l_offset=0&l_order=1&l_sort=time
- 标题：进程管控-日志；页签：概览 / 日志（选中） / 策略
- 工具栏左：「加白」「加黑」；右：「高级搜索」、刷新、列设置
- 表头（#tbClient，9 列）：（勾选框） | 时间 | 进程名称 | 文件哈希 | 进程路径 | 终端名称 | IP地址 | 原因 | 动作
- 数据：空，显示「当前无相关数据展示」（默认时间范围 l_time=week，近一周）；没有分页文字
- RsCore.ajax.toString().length：6983（和第 4 步一样）
- 控制台：没有报错，也没有任何日志

## 没做的事
- 没点「加白」「加黑」，没打开「加入名单」「新建名单」，没写库

## 与原采集（08:18）对比
- 概览的表头、2 行、底部统计，日志页的地址、页签、按钮、表头、空数据、6983、控制台：**全部一致，没有差异**
