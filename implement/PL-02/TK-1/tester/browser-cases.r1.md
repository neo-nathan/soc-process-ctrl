# PL-02 TK-1 计划级验收 — 浏览器用例（101 实测）

- 执行人：TK-1 Tester（独立验收，期望值只取基线原文）
- 执行时间：2026-10-22 07:58–08:16 EDT（101 本机 19:58–20:16 CST）
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
   - **校准**：空名称连点两次（间隔 <1 秒）只记到 1 条（公共提示组件在提示显示期间不再新建节点）；间隔 5 秒连点两次记到 2 条。
     → 本探针能数出「间隔开的提示」和「文字不同的第二个提示」，**数不出 3 秒内文字相同的重复提示**（见 summary）。

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

### S-6 还原后回归（**本次只写不跑：等 TK-2**）
依据 PL-02 §七 S-6「101 processManage.js 是同事版（md5 = 58064f62…，或 R-1 情形下同事自己部署的、不含 listModal 的版本）；名单页创建、编辑照常（S-1、S-2 抽一条重跑）；日志页「加入名单 → 新建名单」能建成名单，成功后报 view 未定义、弹窗关不掉属 PL-01 F-8 ① 已知，按 Q2 记录、不算失败（只测日志页…）；公共弹窗 #addNewListModal 的标题、文字不受名单页影响」；PL-02 Q2；PL-01 F-8 ①

由主 Agent 在 TK-2 完成后按下列步骤跑：

| # | 步骤 | 期望 | 依据 |
|---|---|---|---|
| 6.0 | 101 `md5sum view/processManage.js`；`grep -c listModal view/processManage.js` | = `58064f62b0c900d7b1b9e4cf0ef9c08f`；或（R-1）不是 `a2b0eb10…` 且 `listModal` 0 处 | §七 S-6、R-1 |
| 6.1 | 整页刷新首页 → 菜单「概览」→ 记 `RsCore.ajax.toString().length` 与片段 E（下）的公共弹窗快照 S0（**先于进入名单页**） | 记录值 | 「不受名单页影响」= 与未受名单页影响时的状态比 |
| 6.2 | 菜单「白名单」→ 重跑 S-1 白名单创建一条（`PL02测试-S6白`）+ S-2 编辑这一条 | 同 S-1、S-2 白名单各行期望（标题、文案、1 次请求、库值） | §七 S-6「S-1、S-2 抽一条重跑」 |
| 6.3 | 菜单「概览」→ 页签「日志」→ 勾选 1 条日志 →「加入名单 / 加白」→ 弹窗里「+ 创建名单」打开公共弹窗 `#addNewListModal` → 打开时跑片段 E 得快照 S1 | S1 的标签/占位/按钮/maxlength 与 S0 一致（名称 maxlength 300、描述 200、「备注」、「关闭」「确定」，即 101 layout.html:591-619 原文）；标题与「不经过名单页时打开」一致（见 blocked_questions Q-1） | §七 S-6「公共弹窗…不受名单页影响」；ENV layout.html 参考 |
| 6.4 | 在公共弹窗输入 `PL02测试-S6日志新建` → 「确定」 | 库里出现该名单（POLICYTYPE 2、EPTYPE 2）；之后若控制台报 `view is not defined`、弹窗关不掉 → 按 Q2 记「PL-01 F-8 ① 已知、交同事」，**不判红** | §七 S-6、Q2 |
| 6.5 | 6.4 期间网络 | 同一次点击 `createWBList` 只 1 次（名单页的 `bwlistModal` 不应再挂到公共按钮上） | F-2 反向哨兵 |
| 6.6 | 关掉公共弹窗（刷新页面亦可）→ 菜单「白名单」→ 点「创建白名单」跑片段 A | 名单页弹窗文案仍是 S-1 白名单期望（不被公共弹窗流程改写） | §五 文案 |
| 6.7 | 清理：名单页「删除」删掉 `PL02测试-S6白`、`PL02测试-S6日志新建`；SQL `PNAME LIKE '%PL02%'` 0 行；同事行指纹不变（data-checks.md Q6 写法） | 0 行；指纹一致 | §七 首句 |

片段 E（只读）：
```js
(function(){ var m=document.getElementById('addNewListModal'); return JSON.stringify(m ? { title: $.trim($('#addNewListTitle').text()),
  text: $.trim($(m).text()).replace(/\s+/g,' '), nameMax: $('#addNewLName').attr('maxlength'), namePh: $('#addNewLName').attr('placeholder'),
  descMax: $('#addNewLDesc').attr('maxlength'), descPh: $('#addNewLDesc').attr('placeholder'), btnData: $('#addNewListBtn').attr('data'),
  btnText: $.trim($('#addNewListBtn').text()), visible: $(m).is(':visible') } : 'missing'); })()
```
**本次 TK-1 期间的参考预检（未打开公共弹窗，只读 DOM，非 S-6 判定）**：进名单页前（概览）与名单页一轮创建/编辑后读到的 `#addNewListModal` 完全相同：title=新建名单；text=「新建名单 * 名单名称： * 系统类型： Linux/信创 备 注： 关闭 确定」；name maxlength 300、占位「请输入」；desc maxlength 200、占位「选填」；`#addNewListBtn` data=""、文字「确定」。与 101-ref/layout.html:591-619 原文一致。

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
