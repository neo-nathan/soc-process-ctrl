# 第 4 步：改动前 RsCore.ajax 原函数指纹 + 控制台报错（改动前基线 · 重采）

- 采集时间：2026-10-21 22:32 EDT（重采；原采集 2026-10-21 08:16 EDT）
- 页面地址：https://193.168.10.101:10443/Indexinfo/home#strategy/overview?copen=0&g=1&open=1（接第 3 步，停在策略中心）
- 进入路径：同第 1～3 步（左侧菜单「策略中心」）
- 采集前会话核验：带 RSTOCKEN 头的 POST /Procmanager/getWBList type=2 → code=0
- 方式：控制台只读表达式（没调用 RsCore.ajax，也没改任何东西）

## RsCore.ajax 指纹
| 读的表达式 | 结果 |
|---|---|
| typeof RsCore.ajax | "function" |
| RsCore.ajax.toString().length | 6983 |
| String(RsCore.ajax).slice(0,80) | "function (url, param, callback, complete, error, timeout) {\r\n            if (arg"（原文带 \r\n 和 12 个空格缩进） |
| RsCore.ajax.length（形参个数） | 6 |
| RsCore.ajax.name | "ajax" |
| Object.keys(RsCore.ajax) | []（函数上没有挂自定义属性） |
| SHA-256(RsCore.ajax.toString()) 前 16 位 | 8c18fa21 1d7a484d |

- 补充：第 1 步之前，在首页（安全中心，hash 为空）读过一次，结果一样：6983 / 形参 6 个 / 8c18fa21 1d7a484d / 同样的前 80 字符
- 用法：以后判断「RsCore.ajax 是不是原函数 / 有没有被包两层」，就和上表的长度 6983、开头 80 字符、SHA-256 前 16 位比

## 控制台报错
- 没有。read_console_messages（onlyErrors=true，以及不过滤）都返回「没有消息」
- 说明：控制台记录从本次第一次读控制台开始（第 1 步之前，停在首页时）；按指令没有刷新页面，所以这之前页面加载阶段的报错收不到。记录范围覆盖第 1～4 步

## 与原采集（08:16）对比
- 7 项指纹全部一致；控制台都是「没有消息」：**没有差异**
