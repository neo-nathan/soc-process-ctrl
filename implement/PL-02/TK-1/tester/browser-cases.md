# PL-02 TK-1 计划级验收 — 浏览器用例（101 实测）

- 执行人：TK-1 Tester（独立验收，期望值只取基线原文）
- 执行时间：2026-10-22 07:58–08:16 EDT（101 本机 19:58–20:16 CST）
- 返工 r2：2026-10-22 08:43–09:01 EDT，只改两处——S-6 整节重写（内审 I1）、片段 D 校准原因（内审 S2）；其余用例结果不变、未重跑。改前留底 `browser-cases.r1.md`（md5 `b185817a7a6cbcbbdfb51c00c2a836e9`）；S-6 片段副本 `s6-snippets.js`
- 浏览器：Claude in Chrome（依据 PL-02 §六「浏览器测试：用 Claude in Chrome」），在 Claude 标签组里新开标签 88508838，测完已关
- 被测文件（101 md5，测后 20:16 CST 重核仍一致）：list.js `ddfe927d…`、list.html `d34d7edc…`、bwlistModal.js `bd40efd4…`；未改 processManage.js `a2b0eb10…`（PL-01 版）、processManageList.css `20cbd116…`、layout.html `7f5ccd7b…`
- 入口：首页 → 左侧菜单「进程管控」→「概览」/「白名单」/「黑名单」（正式入口，不在控制台调 bwlistModal / RsCore.ajax）
- 网络计数口径：每步操作前 `read_network_requests(clear:true)`，操作后再读，只认这一步新出现的请求（集合差，不用累计数）
- 测试数据：名称一律 `PL02测试-` 开头（PL-02 §七）；全部经名单页「删除」走正式入口删掉，见 data-checks.md

## 控制台只读检查片段（ES5，原样）

A. 弹窗状态（只读 DOM）：
```js
(function(){ var el=document.getElementById('procmListModal'); var $el=$(el);
  function rowText(i){ return $.trim($el.find('.modal-body .content-box').eq(i).text()).replace(/\s+/g,' '); }
  var inp=$el.find('.modal-body input[type=text]'), ta=$el.find('.modal-body textarea'); var sys=$el.find('.modal-body .content-box').eq(1);
  return JSON.stringify({visible:$el.is(':visible'), title:$.trim($el.find('.modal-header h3').text()), rows:[rowText(0),rowText(1),rowText(2)],
    nameVal:JSON.stringify(inp.val()), namePh:inp.attr('placeholder'), descVal:JSON.stringify(ta.val()), descPh:ta.attr('placeholder'),
    sysEditable: sys.find('input,select,textarea,[contenteditable=true]').length, sysText: $.trim(sys.children().not('.import-icon').not('label').text()),
    footerBtns:$el.find('.modal-footer button').map(function(){return $.trim($(this).text())+(this.disabled?'(灰)':'');}).get(),
    nameMax:inp.attr('maxlength'), descMax:ta.attr('maxlength'), hasBeizhu:$el.text().indexOf('备注')>=0}); })()
```
B. `RsCore.ajax` 是否被包裹（只读）：`RsCore.ajax.toString().length`（进名单页前在首页、概览各记一次作为「原始值」）
C. 事件绑定数（只读 jQuery 内部数据）：
```js
(function(){ function scan(el){ var ev=$._data(el,'events'); var out={}; if(!ev) return out;
  for (var t in ev){ for (var i=0;i<ev[t].length;i++){ var h=ev[t][i]; if((h.namespace||'').indexOf('procmListModal')>=0){ var k=t+'|'+(h.selector||''); out[k]=(out[k]||0)+1; } } } return out; }
  var cpc=$('.c-page-content')[0]; return JSON.stringify({modalCount: document.querySelectorAll('#procmListModal').length, backdrops: $('.modal-backdrop').length, cpcHandlers: cpc? scan(cpc):'none'}); })()
```
（先沿 `#procmListModal` 的祖先链逐个扫过，命名空间 `procmListModal` 的处理函数只挂在 `DIV.c-page-content` 上。）
D. 提示计数：被动 `MutationObserver`（只记录新出现的 `.alert` 及文字，不改页面行为；测完 `disconnect` 并删掉 `window.__pl02probe`）。
   - **校准**（r1 实测）：空名称连点两次（间隔 <1 秒）只记到 1 条；间隔 5 秒连点两次记到 2 条。
   - **原因（r2 更正，内审 S2）**：r1 写的「公共提示组件在提示显示期间不再新建节点」**不对**。核实依据：① 101 `core.js` 只读副本 `PL-02/101-ref/core.js` 第 1006-1023 行 `run`：每弹一次提示都先 `msgbox.empty()`，再插入新的 `<div class="mask">` 和 `<div class="alert …">`，提示淡出后才 `.html('')` 清空；② 101 页面样式只读（2026-10-22 08:45 EDT 左右，新开标签只读 `document.styleSheets`，没点任何按钮）：`.msg-box { position: absolute; z-index: 99999999 }`、`.msg-box .mask { position: fixed; inset: 0 }`，即提示显示期间有一层盖住整个窗口的遮罩；③ r1 的 S-5 最后一行观察项也实测到提示期间「取消」点不到。所以 <1 秒的第二次点击**落在遮罩上、没有点到「创建」**，没有触发第二次校验，页面上本来就只有 1 条提示——探针记 1 条是如实的，不是漏数；间隔 5 秒时第一条已淡出、遮罩已清空，第二次点击才点到按钮。
   - **结论修订**：这次校准只证明了「探针能数出前后两次、间隔开的提示」。它**没有证明**探针数不出「同一时刻程序连着弹两次、文字相同」的提示（按 `run` 源码，第二次也会新建 `.alert` 节点，按新增节点记录的探针应能数到 2 条），**也没有证明**能数到——r1 探针源码没有落盘，看不出它有没有按文字去重。所以 S-5「只出一次提示」：第二个提示文字不同时结论可靠；文字相同时取决于探针写法，未实测。建议 TK-3 重跑 S-5 时把探针源码落盘（按新增 `.alert` 节点逐个记录、不按文字去重）。
   - 附带说明：S-4「双击只发 1 次」的结果也可能同时受这层遮罩影响（若请求很快返回、成功提示先弹出），但「请求回来前按钮置灰」已由 S-1 第 5 行「点击后立即读：创建按钮 disabled=true」单独实测证实，不靠 S-4 推断。

## 用例与结果

### S-1 创建（白、黑两页各一次）
依据 PL-02 §七 S-1「标题「创建白名单」/「创建黑名单」；标签、占位、按钮文案照 §五；系统类型显示 Linux/信创、不能改；名称为空点「创建」提示「请输入名单名称！」、不发请求；建成后弹窗关、表格出现新名单；库里 POLICYTYPE 分别为 2 / 3、EPTYPE=2，名单进程表里该名单 0 行」；文案依据 PL-02 §五「文案」、demo F-8（白名单列表.html / 黑名单列表.html :469、480-481、486、497-498、504-505）

| 步骤 | 期望（依据） | 实际 | 判定 |
|---|---|---|---|
| 白名单页点工具栏「创建白名单」，跑片段 A | 标题「创建白名单」；标签「* 白名单名称：」「* 系统类型：」「描述：」；名称占位「示例：办公区终端白名单」；描述占位「选填，说明这条白名单用在哪里、放行什么」；按钮「取消」「创建」；右上角叉（§五 文案） | title=创建白名单；rows=["* 白名单名称：","* 系统类型： Linux/信创","描述："]；namePh=示例：办公区终端白名单；descPh=选填，说明这条白名单用在哪里、放行什么；footer=["取消","创建"]；header 有 `button.close[data-dismiss=modal]`，截图可见叉 | 绿 |
| 同上，系统类型 | 显示「Linux/信创」、不能改（§五「系统类型只显示文字、不能改：创建固定「Linux/信创」」） | sysText=Linux/信创，该行无 input/select/textarea（sysEditable=0） | 绿 |
| 名称为空点「创建」 | 提示「请输入名单名称！」、不发请求、不关弹窗（§五「提交」） | 提示 `.alert-error`「请输入名单名称！」；Procmanager 请求 0 个；弹窗仍开 | 绿 |
| 名称只输入 3 个空格点「创建」（补充：§五「名称、描述都先去掉首尾空格」） | 同上 | 提示「请输入名单名称！」；请求 0 个 | 绿 |
| 名称 `  PL02测试-白创建  `、描述 `  PL02测试描述-白  `（前后各 2 空格）点「创建」一次 | 弹窗关；表格出现新名单；请求前按钮置灰（§五「提交」「成功」） | 点击后立即读：创建按钮 disabled=true；1 秒后弹窗关、遮罩 0、提示「创建成功。」；表格第 11 行出现「PL02测试-白创建」；网络：createWBList 1 + getWBList 1 | 绿 |
| 查库（data-checks.md Q2） | POLICYTYPE=2、EPTYPE=2；名称、描述去掉首尾空格；RPW_WPROC 0 行 | PID 65：`[PL02测试-白创建]`、`[PL02测试描述-白]`、POLICYTYPE 2、EPTYPE 2；WPROC/BPROC 0 行 | 绿 |
| 黑名单页点「创建黑名单」，跑片段 A | 标题「创建黑名单」；「* 黑名单名称：」；占位「示例：挖矿程序黑名单」「选填，说明这条黑名单用在哪里、拦截什么」；「取消」「创建」；页面上不出现白名单文案（§五 文案「斜杠前是白名单页、后是黑名单页」） | title=创建黑名单；rows=["* 黑名单名称：","* 系统类型： Linux/信创","描述："]；占位两条均为黑名单版；footer=["取消","创建"]；hasWhiteWord=false | 绿 |
| 黑：空名称点「创建」 | 提示「请输入名单名称！」、不发请求 | 提示 1 条；请求 0 个 | 绿 |
| 黑：`PL02测试-黑创建` / `PL02测试描述-黑` 点「创建」一次 | 弹窗关、表格出现、按钮请求前置灰；库 POLICYTYPE=3、EPTYPE=2、RPW_BPROC 0 行 | disabled=true；弹窗关；表格出现「PL02测试-黑创建」；createWBList 1 + getWBList 1；库 PID 67 POLICYTYPE 3、EPTYPE 2、BPROC 0 行 | 绿 |

### S-2 编辑（白、黑两页各一次）
依据 PL-02 §七 S-2「标题「编辑…」、按钮「保存」；带出原名称、描述；系统类型不能改；改完表格更新，库里 PNAME、DESCRIPTION 已改、POLICYTYPE 不变」；§五「标题…编辑时「编辑白名单」/「编辑黑名单」」「按钮…编辑时「保存」」「编辑显示这条名单自己的系统类型」

| 步骤 | 期望 | 实际 | 判定 |
|---|---|---|---|
| 白：展开「PL02测试-白创建」行 → 「编辑」，片段 A | 标题「编辑白名单」；按钮「取消」「保存」；名称=PL02测试-白创建、描述=PL02测试描述-白；系统类型文字、不能改（这条名单是 Linux） | title=编辑白名单；footer=["取消","保存"]；nameVal/descVal 为原值；sysText=Linux/信创、sysEditable=0；占位仍为白名单版 | 绿 |
| 改名 `PL02测试-白已编辑`、描述 `PL02测试描述-白已改`，点「保存」一次 | 表格更新；库 PNAME/DESCRIPTION 已改、POLICYTYPE 不变 | disabled=true（点后立即）；提示「修改成功。」；弹窗关；表格名称变为「PL02测试-白已编辑」；网络 editWBList 1 + getWBList 1；库 PID 65 已改、POLICYTYPE 2 | 绿 |
| 黑：展开「PL02测试-黑创建」→「编辑」 | 标题「编辑黑名单」；「保存」；原值带出；系统类型不能改 | title=编辑黑名单；footer=["取消","保存"]；原值；sysEditable=0；黑名单占位 | 绿 |
| 改 `PL02测试-黑已编辑` / `PL02测试描述-黑已改`，「保存」一次 | 表格更新；库已改、POLICYTYPE 仍 3 | 提示「修改成功。」；表格「PL02测试-黑已编辑 / PL02测试描述-黑已改」；editWBList 1 + getWBList 1；库 PID 67 已改、POLICYTYPE 3 | 绿 |

### S-3 字段限制
依据 PL-02 §七 S-3「名称最多输入 100 字、描述最多 200 字（maxlength）；标签是「描述」不是「备注」」；§五「字段」；01 §8.5「名称：必填，最长 100 字符」；01 §8.8 第 14 条「统一叫「描述」」

| 步骤 | 期望 | 实际 | 判定 |
|---|---|---|---|
| 读属性 | 名称 `maxlength="100"`、描述 `maxlength="200"`；两框 `oninput="RsCore.validateXss(this)"`（§五「字段」） | nameMax=100、descMax=200；两框 oninput=RsCore.validateXss(this)（白、黑、创建、编辑四种打开状态都读过 maxlength） | 绿 |
| 名称框键入 105 个汉字、描述框键入 205 个汉字 | 实际值长度 100 / 200 | nameLen=100、descLen=200 | 绿 |
| 反向哨兵：弹窗文字里不得出现「备注」 | hasBeizhu=false | 白/黑、创建/编辑各次均 false；标签 = ["白名单名称：","系统类型：","描述："] | 绿 |

### S-4 只发一次请求（反向哨兵，F-2）
依据 PL-02 §七 S-4「点一次「创建」/「保存」：网络里 createWBList / editWBList 恰好 1 次，没有多出的 createWBList；连点两次也只发 1 次；编辑后库里名单总数不变」；§五「请求回来前提交按钮置灰，防连点（F-6）」

| 步骤 | 期望 | 实际 | 判定 |
|---|---|---|---|
| 单击「创建」（白、黑、S-7 再一次，共 3 次） | createWBList 恰好 1 次 | 3 次均 createWBList=1（随后 getWBList 1，属刷新表格） | 绿 |
| 单击「保存」（白、黑各一次） | editWBList 恰好 1 次，createWBList 0 次 | 均 editWBList=1、createWBList=0 | 绿 |
| 双击「创建」（名称 `PL02测试-白连点`） | createWBList 1 次；库里只多 1 行 | createWBList=1；库只多 PID 66 一行；提示「创建成功。」1 条 | 绿 |
| 双击「保存」（PID 65 改描述 `PL02测试描述-白连点保存`） | editWBList 1 次、createWBList 0 次 | editWBList=1、createWBList=0；提示「修改成功。」1 条 | 绿 |
| 编辑前后数名单总数（data-checks.md Q3） | 不变 | 白编辑前 12 → 后 12；双击保存后 13（= 双击创建新增 1 行，编辑本身不增） | 绿 |

### S-5 失败与关闭
依据 PL-02 §七 S-5「名称重复、含非法字符、或超过 33 个汉字（F-11，Q4 默认下属已知）：只出一次提示（core.js 那次），弹窗不关、按钮恢复；取消、叉、Esc 都能关；再打开是本次的内容（创建为空、编辑为该行原值）；弹窗开着时用浏览器后退离开名单页，body 上不留遮罩，控制台无报错」；§五「失败」「关闭」「离开页面」；Q4（超长中文后端报「搜索值包括非法字符」属已知）

| 步骤 | 期望 | 实际 | 判定 |
|---|---|---|---|
| 创建：名称 `PL02测试-白创建`（与已有白名单重名） | 只 1 个提示；弹窗不关；按钮恢复 | 探针：1 条 `.alert-error`「名单名称已存在。」；无其他可见弹窗；`#procmListModal` 仍开；按钮「创建」未置灰；createWBList 1、无 getWBList | 绿 |
| 创建：`PL02测试-非法#字符` | 同上 | 1 条「搜索值包括非法字符」；弹窗开；按钮恢复；createWBList 1 | 绿 |
| 创建：`PL02测试-` + 34 个「长」（共 36 个汉字，> 33） | 同上；报「搜索值包括非法字符」属 Q4 已知 | 1 条「搜索值包括非法字符」；弹窗开；按钮恢复；createWBList 1；库里未建出 | 绿（Q4 已知现象，记录） |
| 编辑：改名 `PL02测试-编辑#非法` 点「保存」 | 同上；再打开为该行原值 | 1 条「搜索值包括非法字符」；弹窗开、标题仍「编辑白名单」、按钮「保存」恢复；editWBList 1；取消后再点「编辑」带出 `PL02测试-白已编辑` / `PL02测试描述-白已改`（库里原值） | 绿 |
| 取消 / 叉 / Esc 关闭（创建弹窗，各先输入草稿） | 都能关；遮罩去掉 | 取消、右上角叉、Esc 三种后 visible=false、`.modal-backdrop`=0 | 绿 |
| 再打开（创建） | 为空 | 成功创建后、取消后、叉后、Esc 后、浏览器后退离开再回来后重开：名称、描述都是 `""` | 绿 |
| 再打开（编辑） | 该行原值 | 改了不保存→取消→再「编辑」：带出原值；失败后取消再编辑：原值 | 绿 |
| 黑名单页开着创建弹窗（已输入草稿）→ 浏览器后退（回到概览） | body 上不留遮罩；控制台无报错 | 后退前遮罩 1；后退后 route=#processManage/overview、`.modal-backdrop`=0、`body.modal-open`=false、无可见 modal、`#procmListModal`=0；`read_console_messages(onlyErrors)` 0 条 | 绿 |
| 观察（非断言）：提示显示期间点「取消」 | — | 提示显示约 3 秒内，公共提示组件 `.msg-box` 里有一层全屏 `div.mask`（z-index 99999999）挡住点击，「取消」点不到；提示消失后再点即关。`.mask` 不在 `#procmListModal`、`.procm-bwlist` 内，属公共提示组件行为，不算本 TK 失败；本用例里的「取消」均在提示消失后点 | 记录 |

### S-6 还原后回归（**只写不跑：等 TK-2 完成后，由主 Agent 照下列步骤跑**；r2 返工重写，r1 原文见 `browser-cases.r1.md` 第 98-121 行）
依据 PL-02 §七 S-6 原句：「101 processManage.js 是同事版（md5 = 58064f62…，或 R-1 情形下同事自己部署的、不含 listModal 的版本）；名单页创建、编辑照常（S-1、S-2 抽一条重跑）；日志页「加入名单 → 新建名单」能建成名单，成功后报 view 未定义、弹窗关不掉属 PL-01 F-8 ① 已知，按 Q2 记录、不算失败（只测日志页：进程管理页「选中加白 / 加黑」现被同事的 SYSTYPE 大小写问题全行拦住，见状态页阻塞项）；公共弹窗 #addNewListModal 的标题、文字不受名单页影响」；另依据 PL-02 Q1、Q2、F-2、R-1，PL-01 F-8 ①。**进程管理页不测**（原句括号里写明只测日志页）。

**「不受名单页影响」怎么判**（主 Agent 裁决 4、内审 I1）：前后比较。同一个标签页里，**名单页还没加载时**从日志页正式入口打开公共弹窗记快照；**进过名单页之后**从同一入口再打开记快照；两者逐字段比较。先记的快照是「还没受名单页影响时」的**实测对照值**，不是把 log.js 的写法当期望——期望只有一句「后 = 前」，出自原句。静态内容（标签、占位、maxlength、「备注」、按钮文字）另外逐字对照 101 layout.html 第 591-619 行原文（见下「静态对照表」）。**标题不对照原文的「新建名单」**：日志页打开公共弹窗时会自己改写标题（主 Agent 已只读核实 101 log.js 第 471 行；r2 预演实测打开后是「新建白名单」），所以标题只做前后比较。

**为什么分「打开态」「关闭态」两组快照**：打开公共弹窗时，日志页会重写标题和「确定」按钮的 data（log.js 第 417、471 行）。名单页如果改过这两样，会被这次重写盖掉，只比打开态看不出来。所以再加一组「关闭态」：在日志页签刚进入、还没打开公共弹窗时读（读到的是日志页上一次关弹窗后留下的状态）。前后两次关闭态都经过「离开日志页 → 再进日志页签」这同一段路，唯一的不同是中间有没有经过名单页——名单页对公共弹窗做的任何改写（文字、data、挂上去的点击处理）都会留在关闭态里。

**r2 预演（2026-10-22 08:44-08:58 EDT；101 当时 processManage.js 仍是 PL-01 版 a2b0eb10…，结果只用来确认入口走得通、片段能跑、能区分，不是 S-6 判定）**
- 日志页现在只有 1 条日志（101 只读 SQL：`RPW_PROCESSAUDITINFO` 共 1 行）：时间 `2026-10-14 14:49:21`、进程名称 `a.txt`、文件哈希 `11111`、路径 `/opt/BDFZ/ESM/a.txt`、终端 `王五`、IP `193.168.12.25`、原因「在黑名单」、动作「已拦截」。下称 **L0**。**日志页默认时间范围是「本周」，看不到 L0**：要点工具栏右侧「高级搜索」展开，把「时间范围」点成「全部」（左树保持「根管理组」，「子组终端」保持默认「不包含」，就能看到）。
- 101 实际入口文字（页面结构，用于定位）：日志页工具栏按钮是「加白」「加黑」（没有叫「加入名单」的按钮）；勾选 L0 点「加白」弹出 `#addBWListModal`，标题「请选择要加入的白名单（Linux/信创）」，按钮「取消」「确认」；弹窗右上角入口文字是「新建白名单」（不是「+ 创建名单」）；点它打开公共弹窗 `#addNewListModal`，按钮「关闭」「确定」。
- 片段 F（PL-01 版下）：`{"loaded":true,"keys":["container","render","destroy","listModal"],"hasListModal":true}`——能区分，TK-2 后应读到 `hasListModal:false`。
- 片段 E 打开态（本标签页没进过名单页）：title=`新建白名单`；rows=`["* 名单名称：","* 系统类型： Linux/信创","备 注："]`；sysText=`Linux/信创`；nameVal=`""`、namePh=`请输入`、nameMax=`300`；descVal=`""`、descPh=`选填`、descMax=`200`；两框 oninput=`RsCore.validateXss(this)`；footerBtns=`["关闭","确定"]`；hasClose=1；hasBeizhu=true；hasMiaoshu=false；btnDataAttr=`195:e2ac61a1`；btnJqData=`2:597a9d`；btnHandlers=`{"self|click.log|":1}`；styleSig=`["500px","334px","13px"]`。关掉、取消后**同一条 L0、同一个「加白」再打开一次**：title、btnDataAttr（仍 `195:e2ac61a1`）、处理函数（仍只有 `click.log` 1 个）都不变——同条件两次打开的 data 是稳定的，可以逐字比。
- 片段 E 关闭态（另一个新标签直接进日志页签、从没打开过公共弹窗）：title=`新建名单`、btnDataAttr=`0:1505`（即 `data=""`）、btnHandlers=`{"self|click.log|":1}`，其余静态字段同上。说明打开过一次之后，关闭态的标题和 data 会留着日志页写入的值——所以 S0c 必须在 6.1 打开、关闭**之后**再采，S1c 才有同口径的对照。
- 预演只打开、关闭、取消，没有点「确定」「确认」；前后只读 SQL：名单 PID 集合仍为 35-43、60、64，`PNAME LIKE '%PL02%'` 0 行，RPW_WPROC 9、RPW_BPROC 0。

**前置与停止条件**（主 Agent 照做，不需要临场判断）
- 全程用同一个 Claude in Chrome 新标签。6.1 开头整页刷新一次；**从 6.1 起到 6.5 结束，不得整页刷新**（刷新会把名单页留下的影响一起清掉，比较就失效），页面切换只用左侧菜单和页签。
- 网络计数口径同本文件开头：每次点「创建 / 保存 / 确定」前 `read_network_requests` 清空，点后等 3 秒再读，只认这一步新出现的请求（集合差，不用累计数）。
- 日志按身份找：每次都按 L0 的「时间 + 路径 + 哈希 + 终端」在表格里找那一行，不按「第几行」（日志表会增删，行号会变）。
- 遇到下列情况停下交主 Agent，不往下跑：6.0 判红；6.0 / 6.7 的「本次运行指纹」对不上；日志页一条日志都没有（日志页入口走不通）；6.7 清理后有残留。
- 默认只走「加白」这一条日志页入口；是否还要测「加黑 → 新建黑名单」，见本次交回的 blocked_questions（Q-S6-1），主 Agent 拍板前按「只测加白」跑。

| # | 步骤 | 期望 | 依据 |
|---|---|---|---|
| 6.0 | 101 只读（ssh）：`cd /opt/BDFZ/ESM/data/web/public/esm/view && md5sum processManage.js layout.html processManage/log.js processManage/list.js processManage/list.html processManage/bwlistModal.js; grep -c listModal processManage.js` | **processManage.js**：= `58064f62b0c900d7b1b9e4cf0ef9c08f` 且 listModal 0 处 → 绿；或（R-1）≠ `a2b0eb109e241e94902535e6a52852b0` 且 listModal 0 处 → 绿，记下 md5；= `a2b0eb10…`，或 listModal > 0 → **红，停下**（TK-2 没完成，后面都不跑）。**其余 5 个文件记作「本次运行指纹」**：layout.html 应 = `7f5ccd7ba36d4c7ea36dfbf1c09ec9c1`、log.js 应 = `1defe5ddc5af6351ddb1688f0ed378ef`（静态对照基准、日志页代码没变）；list.js / list.html / bwlistModal.js 应 = 主 Agent 最近一次上传后记下的 md5（TK-1 r1 上传值是 `ddfe927d…` / `d34d7edc…` / `bd40efd4…`）；任一对不上 = 同事动过，停下 | §七 S-6 首句；R-1「只核对它不带 listModal、记录 md5」；§六「上传规则」 |
| 6.0c | 101 只读 SQL 测前基线（同目录 `ro-query.sh`，凭据走环境变量）：① `SELECT GROUP_CONCAT(PID ORDER BY PID) FROM POLICY WHERE POLICYTYPE IN (2,3)`，记名单 PID 集合 **P0**；② `SELECT PID,PNAME FROM POLICY WHERE PNAME LIKE '%PL02%'`；③ `SELECT (SELECT COUNT(*) FROM RPW_WPROC),(SELECT COUNT(*) FROM RPW_BPROC),(SELECT COUNT(*) FROM POLICYOBJECT)`；④ data-checks.md Q0 的两条逐行指纹 SQL，结果存 `db-before-s6-policy-rows.txt`、`db-before-s6-wproc.txt` | ② 应 0 行。若有 `PL02测试-` 开头的残留（以前没清干净）：属本计划自建数据，先经名单页展开行「删除」删掉，再重采 ①-④；不是 `PL02测试-` 开头的行，与本计划无关，不动 | §七 首句「只改、只删本计划自己新建的名单（名称统一用 PL02测试- 开头），同事的数据一条不动，测完删掉」 |
| 6.1 | 整页刷新 101 首页 → 左侧菜单「进程管控」→「概览」→ 跑片段 F、片段 B（记 **B0**）→ 页签「日志」→「高级搜索」展开 → 时间范围点「全部」→ 按身份找到 L0 并勾选（勾前先看复选框，已勾就不再点；表格下方应显示「当前已选择 1 条记录」）→ 工具栏「加白」→ 弹窗右上角「新建白名单」→ 公共弹窗出现后跑片段 E，记 **S0（打开态）** → 点公共弹窗「关闭」→ 选择名单弹窗点「取消」（**两处都不点确定 / 确认，不写库**）→ 左侧菜单「概览」→ 页签「日志」→ 不打开任何弹窗，跑片段 E，记 **S0c（关闭态）**。从整页刷新到记完 S0c，**不进白名单 / 黑名单页** | 片段 F：`loaded=true` 且 `hasListModal=false`；`hasListModal=true` → **停下交主 Agent**（6.0 已确认 101 文件不含 listModal，浏览器里跑的却还是带 listModal 的版本，说明运行环境不是「还原后」，后面的比较全部无效；可能是缓存）；`loaded=false` 只记录不判。S0、S0c 是对照值，只记录；另按「静态对照表」核 S0、S0c 的静态字段（规则见 C3）。找不到 L0：勾当前表格里任意一条，把它的「时间 + 路径 + 哈希 + 终端」记作新的 L0，6.3 用同一条；表格一条日志都没有 → 停下 | 「不受名单页影响」= 与还没受名单页影响时比（裁决 4、I1）；片段 F 依据 §七 S-6「不含 listModal 的版本」、R-1 |
| 6.2 | 左侧菜单「白名单」，照 S-1、S-2 白名单重跑一条：① 点「创建白名单」→ 片段 A；② 名称为空点「创建」；③ 名称 `PL02测试-S6白`、描述 `PL02测试S6描述`，点「创建」一次；④ SQL 查这一条（记下 PID）→ 展开这一行点「编辑」→ 片段 A；⑤ 改成 `PL02测试-S6白已编辑` / `PL02测试S6描述已改`，点「保存」一次；⑥ SQL 再查 | ① 同 S-1 第 1、2 行：title=`创建白名单`；rows=`["* 白名单名称：","* 系统类型： Linux/信创","描述："]`；namePh=`示例：办公区终端白名单`；descPh=`选填，说明这条白名单用在哪里、放行什么`；footerBtns=`["取消","创建"]`；有右上角叉；sysText=`Linux/信创`、sysEditable=0；nameMax=100、descMax=200；hasBeizhu=false。② 提示「请输入名单名称！」；Procmanager 请求 0 个；弹窗不关。③ 弹窗关；表格出现该名称；createWBList 恰好 1 个（随后的 getWBList 是刷新表格，不算）。④ 库（`SELECT PID,PNAME,POLICYTYPE,EPTYPE FROM POLICY WHERE PNAME LIKE 'PL02测试-S6白%'`；`SELECT COUNT(*) FROM RPW_WPROC WHERE BWID=<PID>`）：POLICYTYPE=2、EPTYPE=2；RPW_WPROC 里该 PID **0 行**——**此时公共「确定」按钮上还留着 6.1 日志页写下的参数**，这一行同时验证名单页不会把这些残留参数带进自己的创建（F-2、PL-01 F-8 ②）；编辑弹窗：title=`编辑白名单`、footerBtns=`["取消","保存"]`、nameVal/descVal=原值、sysEditable=0。⑤ editWBList 恰好 1 个、createWBList 0 个；提示后弹窗关、表格名称更新。⑥ PNAME、DESCRIPTION 已改，POLICYTYPE 仍 2；名单 PID 集合 = P0 + 这 1 个 PID | §七 S-6「名单页创建、编辑照常（S-1、S-2 抽一条重跑）」；§七 S-1、S-2、S-3（maxlength、「描述」）、S-4（各 1 次请求）；§五「文案」「字段」「提交」；F-2 |
| 6.2b | 左侧菜单「黑名单」→ 点「创建黑名单」→ 片段 A → 点「取消」（不提交、不写库） | 同 S-1 第 7 行：title=`创建黑名单`；rows[0]=`* 黑名单名称：`；namePh=`示例：挖矿程序黑名单`；descPh=`选填，说明这条黑名单用在哪里、拦截什么`；footerBtns=`["取消","创建"]`。目的（方法说明，不是期望来源）：让名单页白、黑两套配置都打开过自己的弹窗，再去比公共弹窗——目标环境是「已被名单页用过」的状态，不是干净态 | §七 S-1 第 7 行期望；§五「文案」 |
| 6.3 | 左侧菜单「概览」（不刷新）→ 跑片段 B（记 **B1**）→ 页签「日志」→ 不打开任何弹窗，跑片段 E，记 **S1c（关闭态）** →「高级搜索」时间范围点「全部」→ 勾选 L0（与 6.1 同一条；同样先看复选框，已勾就不再点，表格下方应为「当前已选择 1 条记录」）→「加白」→「新建白名单」→ 跑片段 E，记 **S1（打开态）** | 按下方「比较规则」C1-C4 判。另：B1 = B0（离开名单页后 `RsCore.ajax` 没留下包裹） | §七 S-6「公共弹窗 #addNewListModal 的标题、文字不受名单页影响」；Q1「不再用公共弹窗」；F-2；§七 S-7 |
| 6.4 | 在公共弹窗名称框输入 `PL02测试-S6日志新建`（描述留空）→ 网络清空 → 点「确定」一次 → 等 3 秒 → 读网络；读控制台（`read_console_messages`，onlyErrors，pattern `view`）；跑片段 E | **判定只有一条：建成了**——SQL `SELECT PID,PNAME,POLICYTYPE,EPTYPE FROM POLICY WHERE PNAME='PL02测试-S6日志新建'` 恰好 1 行（记下 PID，6.7 用）。0 行 → **红**。下面两种都**不判红**，只记录：(a) 控制台报 `view is not defined` / `ReferenceError … view`、公共弹窗关不掉 → 记「PL-01 F-8 ① 复现，已知，交同事」；(b) 没有这条报错、弹窗正常关闭 → 记录（可能同事自己修了，R-1）。POLICYTYPE、EPTYPE 的值，以及这条名单有没有把 L0 的进程一起加进 RPW_WPROC，是日志页（同事代码）的行为，只记录不判 | §七 S-6「能建成名单，成功后报 view 未定义、弹窗关不掉属 PL-01 F-8 ① 已知，按 Q2 记录、不算失败」；Q2 |
| 6.5 | 看 6.4 那一次点击的网络记录 | `Procmanager/createWBList` **恰好 1 个**；多于 1 个 → **红**（名单页的处理还挂在公共「确定」按钮上，正是 F-2「点一次两段都执行、多发一个 createWBList」） | F-2（反向哨兵）；Q1 |
| 6.6 | 关掉公共弹窗：片段 E 若 visible=true，先点公共弹窗「关闭」；仍 true 再按 Esc；仍 true 才整页刷新（并注明「6.6 在刷新后测」）。选择名单弹窗若还开着，点「取消」。→ 左侧菜单「白名单」→ 点「创建白名单」→ 片段 A →「取消」 | 片段 A 结果与 6.2 ① 完全相同（title、rows、占位、footerBtns、nameMax 100、descMax 200、hasBeizhu=false）。若是刷新后测的，只能说明名单页弹窗本身文案没变，不能说明「不被公共弹窗流程改写」，结果里写明 | 补充（导航未列、基线相关）：§五「文案」；Q1；§一 1.1「不要跟别人冲突」 |
| 6.7 | 清理：白名单页展开 `PL02测试-S6白已编辑`、`PL02测试-S6日志新建` 两行，分别点「删除」→ 确认弹窗「删除」（`PL02测试-S6日志新建` 若 6.4 查到 POLICYTYPE=3，就到黑名单页删）。然后只读 SQL：① `PNAME LIKE '%PL02%'`；② 名单 PID 集合；③ `SELECT COUNT(*) FROM RPW_WPROC WHERE BWID IN (<6.2、6.4 记下的两个 PID>)`，RPW_BPROC 同；④ 6.0c ③ 的三个计数；⑤ 两条逐行指纹 SQL，存 `db-after-s6-policy-rows.txt`、`db-after-s6-wproc.txt`，分别与 6.0c 的 diff；⑥ 重跑 6.0 的 md5 | ① 0 行；② = P0；③ 0、0；④ = 6.0c；⑤ diff 无差异；⑥ 与 6.0 的「本次运行指纹」逐个一致（运行期间同事没动过；否则本次 S-6 结果作废，交主 Agent）。③ 不为 0（名单删了、进程行还在）、② ≠ P0、④ 或 ⑤ 有差异 → **停下交主 Agent，不要自己用 SQL 删**（ro-query.sh 只读）；差异行若不是本次新建的 PID，多半是同事在 101 上的操作，交主 Agent 判 | §七 首句「同事的数据一条不动，测完删掉」；R-6；R-1 |

**比较规则（6.3 判定；逐条判，任一条红即 S-6 红）**

| # | 比较什么 | 期望 | 说明 |
|---|---|---|---|
| C1 | **S1c vs S0c**（关闭态），全部字段：count、visible、cls、title、rows、sysText、nameVal、namePh、nameMax、nameOninput、descVal、descPh、descMax、descOninput、footerBtns、hasClose、hasBeizhu、hasMiaoshu、btnDataAttr、btnJqData、btnHandlers、textHash、text | 逐字段相等 | 两次之间只隔着名单页（6.2、6.2b），任何差异只能来自名单页。title、rows、占位、maxlength、按钮文字、text 等是原句「标题、文字」；btnDataAttr、btnJqData、btnHandlers 是 Q1「不再用公共弹窗」、F-2「不与公共按钮冲突」的结构证据。btnDataAttr 两次都应是 6.1 日志页关弹窗后留下的同一个值；btnHandlers 多出 `procmListModal` 或任何新的「元素 / 事件.命名空间」= 名单页挂到了公共按钮上 |
| C2 | **S1 vs S0**（打开态），同上全部字段 | 逐字段相等 | 用户实际看到的「标题、文字」。btnDataAttr、btnJqData 两次都是日志页按同一条 L0、同一个「加白」写入的——r2 预演已证明同条件两次打开相等，所以按逐字相等比；只有 6.3 找不到 L0、改勾了别的日志时，这两项不比（注明原因），其余照比 |
| C3 | S0、S0c、S1、S1c 的静态字段 vs 101 layout.html:591-619 原文（下表） | 逐字一致 | S1 / S1c 不一致而 S0 / S0c 一致 → 已在 C1 / C2 判红。**S0 自己就和原文不一致**：S0 早于名单页，不可能是名单页造成的；6.0 已确认 layout.html md5 没变，则该字段是日志页打开时自己改写的——这一项只按 C1 / C2 前后比，记录交主 Agent，不判 S-6 红 |
| C4 | styleSig（弹窗宽、名称框宽、标签字号）S1 vs S0 | 只记录，不判 | 原句是「标题、文字」，不含样式；不相等时报主 Agent（可能是名单页样式漏出了 `.procm-bwlist` 范围，§3.1） |

**静态对照表（101 layout.html 第 591-619 行原文 → 片段 E 应读到的值；只读副本 `PL-02/101-ref/layout.html`）**

| 片段 E 字段 | layout.html 原文 | 应读到 |
|---|---|---|
| count、cls | `<div id="addNewListModal" class="modal hide" … data-backdrop="static" …>` | count=1；cls 以 `modal hide` 开头（打开时 Bootstrap 会再加 ` in`） |
| rows[0] | `<span class="import-icon">*</span>` `<label>名单名称：</label>` | `* 名单名称：` |
| rows[1]、sysText | `<span class="import-icon">*</span>` `<label>系统类型：</label>` `<span class="add-newl-type">Linux/信创</span>` | rows[1]=`* 系统类型： Linux/信创`；sysText=`Linux/信创` |
| rows[2]、hasBeizhu、hasMiaoshu | `<label class="w60 mr15" …>备&nbsp;&nbsp;注：</label>` | rows[2]=`备 注：`；hasBeizhu=true；hasMiaoshu=false |
| 名称框 | `<input class="big-input" type="text" id="addNewLName" maxlength="300" oninput="RsCore.validateXss(this)" … placeholder="请输入">` | nameMax=`300`；nameOninput=`RsCore.validateXss(this)`；namePh=`请输入` |
| 描述框 | `<textarea id="addNewLDesc" placeholder="选填" maxlength="200" oninput="RsCore.validateXss(this)" …>` | descPh=`选填`；descMax=`200`；descOninput=`RsCore.validateXss(this)` |
| footerBtns | `<button class="btn btn-cancel secondm-hide" data-dismiss="modal">关闭</button>` `<button id="addNewListBtn" class="btn btn-sure" data="">确定</button>` | `["关闭","确定"]` |
| hasClose | `<button type="button" class="close secondm-hide" data-dismiss="modal"></button>` | 1 |
| title | `<h3 class="alert_drag" id="addNewListTitle">新建名单</h3>` | **不对照**（日志页打开时会改写；只按 C1 / C2 前后比） |
| btnDataAttr | `data=""` | **不对照**（日志页打开时会改写；只按 C1 / C2 前后比） |

片段 E（只读，ES5；原样副本同目录 `s6-snippets.js`，已 `node --check` 通过、并在 101 跑通过一次）：
```js
(function(){
  var m=document.getElementById('addNewListModal');
  if(!m) return 'missing';
  var $m=$(m), btn=document.getElementById('addNewListBtn'), nm=$('#addNewLName'), ds=$('#addNewLDesc');
  // 把字符串压成「长度:哈希」，只用于前后比较（data 原文含查询串，浏览器工具会拦截原文输出）
  function h32(s){ if(s==null) return null; s=String(s); var h=5381; for(var i=0;i<s.length;i++){ h=((h<<5)+h+s.charCodeAt(i))|0; } return s.length+':'+(h>>>0).toString(16); }
  // 第 i 个 .content-box 的文字（合并空白；&nbsp; 也算空白）
  function rowText(i){ return $.trim($m.find('.modal-body .content-box').eq(i).text()).replace(/\s+/g,' '); }
  // 沿「确定」按钮的祖先链数 jQuery 事件处理：直接绑在按钮上的 + 委托到按钮的（selector 能匹配按钮）
  function handlers(){
    var out={}, chain=[], n;
    for(n=btn; n; n=n.parentNode){ chain.push(n); }
    for(var c=0;c<chain.length;c++){
      var ev=$._data(chain[c],'events'); if(!ev) continue;
      for(var t in ev){ for(var i=0;i<ev[t].length;i++){ var hd=ev[t][i], hit=false;
        if(chain[c]===btn && !hd.selector){ hit=true; }
        else if(hd.selector){ try{ hit=$(btn).is(hd.selector); }catch(e){ hit=false; } }
        if(hit){ var who=(chain[c]===btn)?'self':(chain[c]===document?'document':(chain[c].id?('#'+chain[c].id):chain[c].nodeName));
          var k=who+'|'+t+'.'+(hd.namespace||'')+'|'+(hd.selector||''); out[k]=(out[k]||0)+1; } } } }
    return out;
  }
  // 按钮上的 jQuery data（不是 HTML 属性）；序列化失败时只记一个标记
  var jq; try{ jq=h32(JSON.stringify($(btn).data())); }catch(e){ jq='unserializable'; }
  return JSON.stringify({
    count: document.querySelectorAll('#addNewListModal').length,
    visible: $m.is(':visible'), cls: m.className,
    title: $.trim($('#addNewListTitle').text()),
    rows: [rowText(0), rowText(1), rowText(2)],
    sysText: $.trim($m.find('.add-newl-type').text()),
    nameVal: nm.val(), namePh: nm.attr('placeholder'), nameMax: nm.attr('maxlength'), nameOninput: nm.attr('oninput'),
    descVal: ds.val(), descPh: ds.attr('placeholder'), descMax: ds.attr('maxlength'), descOninput: ds.attr('oninput'),
    footerBtns: $m.find('.modal-footer button').map(function(){ return $.trim($(this).text())+(this.disabled?'(灰)':''); }).get(),
    hasClose: $m.find('.modal-header button.close').length,
    hasBeizhu: /备\s*注/.test($m.text()), hasMiaoshu: $m.text().indexOf('描述')>=0,
    btnDataAttr: h32($(btn).attr('data')), btnJqData: jq,
    btnHandlers: handlers(),
    styleSig: [$m.css('width'), nm.css('width'), $m.find('.content-box label').first().css('font-size')],
    textHash: h32($.trim($m.text()).replace(/\s+/g,' ')),
    text: $.trim($m.text()).replace(/\s+/g,' ')
  });
})()
```
片段 F（只读，读浏览器里实际加载的 processManage 模块）：
```js
(function(){ var d=window.require&&require.s&&require.s.contexts&&require.s.contexts._&&require.s.contexts._.defined; if(!d) return 'no-requirejs'; var m=d['processManage']; return JSON.stringify({loaded:!!m, keys:m?Object.keys(m):null, hasListModal:!!(m&&m.listModal)}); })()
```
片段 A、片段 B 用本文件开头的原样片段。

**执行记录（TK-2 后由主 Agent 填）**

| # | 实际 | 判定 |
|---|---|---|
| 6.0 | | |
| 6.0c | | |
| 6.1（F、B0、S0、S0c） | | |
| 6.2 ①-⑥ | | |
| 6.2b | | |
| 6.3（B1、S1c、S1；C1-C4） | | |
| 6.4 | | |
| 6.5 | | |
| 6.6 | | |
| 6.7 ①-⑥ | | |

**r1 参考预检（TK-1 期间、101 为 PL-01 版 processManage.js，未打开公共弹窗，只读 DOM，非 S-6 判定）**：进名单页前（概览）与名单页一轮创建 / 编辑后读到的 `#addNewListModal` 完全相同：title=新建名单；text=「新建名单 * 名单名称： * 系统类型： Linux/信创 备 注： 关闭 确定」；name maxlength 300、占位「请输入」；desc maxlength 200、占位「选填」；`#addNewListBtn` data=""、文字「确定」。与 101-ref/layout.html:591-619 原文一致。

### S-7 离开页面
依据 PL-02 §七 S-7「名单页 → 概览 → 名单页：RsCore.ajax 没被重复包裹（同 PL-01 S-11）；新弹窗的事件没有重复绑定（再创建一次仍只发 1 次请求）」；§四 bind「先 off 同命名空间再绑，重复调用不会重复绑定」；§五「离开页面…弹窗随页面清掉」

| 步骤 | 期望 | 实际 | 判定 |
|---|---|---|---|
| 进名单页前：首页、概览各读片段 B | 记原始值 | 首页 6983；概览 6983 | 基线 |
| 白 → 黑（菜单切换）→ 概览：片段 B、C | 概览上 `RsCore.ajax` = 原始值（未被留一层包裹）；`#procmListModal`=0（随页面清掉）；遮罩 0 | 6983；modalCount=0；`.procm-bwlist`=0；backdrops=0；`.c-page-content` 上 procmListModal 命名空间处理函数 0 个；控制台 0 报错 | 绿 |
| 概览 → 黑名单：片段 B、C | 名单页只有 1 个 `#procmListModal`；每个委托事件各 1 个处理函数 | ajax 1019（名单页 mock 包一层，与第一次进名单页时相同）；modalCount=1；handlers={click cancel:1, click ok:1, hidden:1} | 绿 |
| 黑名单页开弹窗 → 后退到概览：片段 B、C | 同第 2 行 | 6983；modalCount=0；遮罩 0；handlers 0；控制台 0 报错 | 绿 |
| 概览 → 白名单：片段 C；再创建一次 `PL02测试-白离开后` | 处理函数各 1 个；createWBList 恰好 1 次 | handlers 各 1；createWBList=1（+getWBList 1）；提示「创建成功。」1 条；控制台 0 报错 | 绿 |
| 反向哨兵：名单页 DOM 不得再有 `addNewList*` id | 0 | `.procm-bwlist [id^=addNewList]`=0 | 绿 |

### 补充：§五「弹窗外观」静态结构（导航未列、基线相关；不在 TK-1 完成判据内，只报告）
依据 PL-02 §五「外壳照 layout.html #addNewListModal 复制（F-7），id 改 #procmListModal…不用 addNewList*；去掉公共弹窗自己的挂钩类 secondm-hide、alert_drag 和行内 z-index…；按钮加 type="button"；data-backdrop="static"；放在 list.html 里和 TK-5 的三个弹窗在一起」

| 检查 | 期望 | 实际 | 判定 |
|---|---|---|---|
| 页面里 `#procmListModal` 个数、是否在 `.procm-bwlist` 内 | 1、是 | 1、是 | 绿 |
| class / data-backdrop / 行内 z-index | `modal hide`、`static`、无 z-index | cls=modal hide、static、inlineZ=""（style 只有 width:500px） | 绿 |
| `secondm-hide` / `alert_drag` / `[id^=addNewList]` | 0 / 0 / 0 | 0 / 0 / 0 | 绿 |
| 按钮 type | 底部两个、右上角叉都是 `type="button"` | 是 | 绿 |
