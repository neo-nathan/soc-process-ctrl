# 重采说明（PL-01 改动前基线）

- 写这份说明的时间：2026-10-21 22:35 EDT（101 本机时间约 2026-10-22 10:3x CST）
- 原采集：2026-10-21 08:13～08:18 EDT，Chrome 标签 88508716，文件存在 /private/tmp/claude-501/…/scratchpad/PL-01/pre-upload-baseline/。本机重启后丢了
- 本次重采：2026-10-21 22:29～22:4x EDT，Chrome 标签 88508831（用户重新登录后的标签），步骤和口径都和原采集一样，文件名也沿用 step1…step5b
- 浏览器约束：没开新标签，没整页刷新，没关标签；只点了左侧菜单、页签、箭头、高级搜索、筛选项和「应用到组 → 取消」
- 会话检查：每步开始前用**带 RSTOCKEN 头**的 POST /Procmanager/getWBList type=2 确认，次次都是 code=0（第一次返回 8 行）；**没有发过裸 fetch 或 curl 的 POST**。全程没跳到登录页
- 写库：没有。只读；没建 PL01测试- 名单，也没有需要清理的东西

## 为什么现在采仍然算「改动前」
- 主 Agent 告知的前提：到目前为止上传到 101 的只有名单页自己的 list.html、list.js、bwlistMock.js、processManageList.css。名单页进入时临时包一层 RsCore.ajax，离开就还原。策略中心和进程管理页、日志页用到的公共文件 processManage.js 要到 TK-4 才上传
- 本次在 101 上只读核对（ssh md5sum / stat，10-22 10:34 CST）：
  - view/processManage.js = 58064f62b0c900d7b1b9e4cf0ef9c08f，和本地 pull-baseline、101-ref 里的拷贝一致，**内容还是拉取基线**。注意：它的修改时间是 2026-10-22 09:17:43 CST（= 10-21 21:17 EDT），比原采集晚，但内容没变，可能是同内容重写或恢复过
  - strategy/openLine.js = 147ff8fa…、strategy/index.html = 9d06b448…，和 101-ref 一致；strategy/tree.js = 7d9fea80…；这三个文件的修改时间都是 2026-10-21 17:00:58 CST（= 05:00 EDT），比原采集早，之后没动过
  - js/core.js = 61b3ff98…，和 101-ref 一致
  - 名单页 4 个文件已经在 101 上：list.html 52a48464…、list.js f1683a53…、bwlistMock.js 18f7665b…、css/processManageList.css 7600fd94…（这次采集没进名单页）
  - 顺带发现（不影响本次对比）：view/layout.html 在 101 上现在是 7f5ccd7b…（37341 字节，修改时间 10-21 17:32:15 CST = 05:32 EDT），和 pull-baseline 里的 10dd6892…（37333 字节）**不一样**，和 101-ref 一致。也就是说，TK-0 拉取之后、原采集之前，有人改过 layout.html。原采集和本次重采看到的是同一版，不影响两次对比；但 TK-4（Q8）上传 layout.html 前，比对基线要用 7f5ccd7b…，不能用 pull-baseline

## S-11 指纹核对（不在名单页时）
| 位置 | 长度 | SHA-256 前 16 位 | 形参 | 前 80 字符 |
|---|---|---|---|---|
| 首页（第 1 步前，hash 为空） | 6983 | 8c18fa21 1d7a484d | 6 | "function (url, param, callback, complete, error, timeout) {\r\n            if (arg" |
| 策略中心（第 4 步） | 6983 | 8c18fa21 1d7a484d | 6 | 同上 |
| 进程管理、概览、日志（第 5 步） | 6983 | （没算） | — | — |
- 和原记录（6983 / 8c18fa211d7a484d）**一致**

## 和原采集的差异汇总
- **没有内容差异**：step1～step5b 每一项读数都和原采集一致（逐项对比写在各文件末尾「与原采集对比」）
- 补充：5a 里「从其他模块第一次点『进程管理』会先落到概览」这次又复现了，而且两次点击隔了好几秒，所以从「可能是时机问题」改成「稳定复现的改动前菜单行为」
