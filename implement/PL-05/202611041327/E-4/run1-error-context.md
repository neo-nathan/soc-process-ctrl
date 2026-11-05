# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 10-white.spec.js >> E-4 建白名单并发布
- Location: specs/10-white.spec.js:478:1

# Error details

```
TimeoutError: locator.waitFor: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('#tbClient tbody tr[data-index]').filter({ has: locator('.js_procm_name').filter({ hasText: /^\s*PL05测试-白\s*$/ }) }).first() to be visible
    63 × locator resolved to hidden <tr class="" data-index="2">…</tr>

```

# Test source

```ts
  99  | 
  100 | /**
  101 |  * 策略中心新建进程管控策略并配置应用范围（只勾 groupName 一个组）。
  102 |  * opts: { auditmode: '1' 学习 / '2' 审计 / '3' 拦截, uptimer: 秒, cloneName: 克隆来源策略名 }
  103 |  * onCreated(pid)：新建接口返回后立即回调（用来给护栏登记 pid，之后的应用范围提交才放行）。
  104 |  * 返回 { add, range, checked }：新建、应用范围两个接口的响应和提交前树上勾选的节点。
  105 |  */
  106 | async function createPolicy(page, name, groupName, opts, onCreated) {
  107 |   // 策略中心实际页面是 #strategy/overview（#strategy 只是外壳，直接用网址打开不会跳到默认子页）
  108 |   await P.openHash(page, '#strategy/overview');
  109 |   await page.locator('.creat_btn').first().click({ timeout: 30000 });
  110 |   const m = page.locator('#policyBoxModal');
  111 |   await m.waitFor({ state: 'visible', timeout: 10000 });
  112 |   await page.locator('#policyNameInput').fill(name);
  113 |   await page.locator('#policyNameInput').blur();
  114 |   // 选产品「进程管控」：前端会自动把终端类型定成 Linux，并拉克隆来源列表
  115 |   const copyList = P.waitApi(page, 'Policycenter/getPolicyForCopy');
  116 |   await page.locator('#productList').selectOption('processManage', { force: true });
  117 |   await copyList;
  118 |   // 克隆来源：按名字选（只是读它的策略内容做初值，不改它）
  119 |   const val = await page.locator('#policyList option', { hasText: opts.cloneName }).first().getAttribute('value');
  120 |   await page.locator('#policyList').selectOption(val, { force: true });
  121 |   await m.locator('.btn[da-type=toStep2]').click();
  122 |   // 第二步：开启、模式、上报间隔（克隆来的初值会被这里覆盖）
  123 |   const en = page.locator('#procauditEnable');
  124 |   await en.waitFor({ state: 'attached', timeout: 15000 });
  125 |   if (!(await setCheck(en, true))) throw new Error('「开启进程管控」没勾上');
  126 |   if (!(await setCheck(page.locator('input[name=auditmode][value="' + opts.auditmode + '"]'), true))) throw new Error('管控模式没选上');
  127 |   for (const id of ['#sjNotify', '#ljNotify']) await setCheck(page.locator(id), false); // 不通知
  128 |   await page.locator('#uptimer').fill(String(opts.uptimer));
  129 |   // 「配置应用范围」：先新建策略，返回新 pid
  130 |   const addWait = P.waitApi(page, 'Policycenter/addPolicy');
  131 |   await m.locator('.btn[da-type=toStep3]').click();
  132 |   const add = await addWait;
  133 |   if (!ok(add)) return { add };
  134 |   await onCreated(add.json.data);
  135 |   // 第三步：应用组树只勾测试组
  136 |   await page.locator('#groupTreePolicy').waitFor({ state: 'visible', timeout: 15000 });
  137 |   await page.waitForTimeout(1000);
  138 |   await treeCheck(page, '#groupTreePolicy', groupName);
  139 |   const checked = await treeChecked(page, '#groupTreePolicy');
  140 |   if (checked.length !== 1 || checked[0] !== groupName) throw new Error('应用范围树勾选的不只测试组：' + checked.join(','));
  141 |   const rangeWait = P.waitApi(page, 'Policycenter/editUsedObject');
  142 |   await m.locator('.btn[da-type=saveRange]').click();
  143 |   return { add, range: await rangeWait, checked };
  144 | }
  145 | 
  146 | module.exports = { ok, setCheck, checkRow, createSubGroup, setInherit, moveTerminal, treeCheck, treeChecked, createPolicy };
  147 | 
  148 | /**
  149 |  * 进程管理页：按进程路径搜索，返回表格里的行文字（每行一个字符串）。
  150 |  * 路径输入框在「高级搜索」里（工具栏图标按钮 [name=customSearch]），没展开就先点开。
  151 |  */
  152 | async function searchProc(page, procPath) {
  153 |   await P.openHash(page, '#processManage/processMana');
  154 |   await page.locator('#tbClient tbody tr').first().waitFor({ timeout: 30000 });
  155 |   const box = page.locator('#customSearchBox .js_procpath');
  156 |   // 「高级搜索」是表格工具栏上的图标按钮 [name=customSearch]（没有文字），点一下展开搜索条件
  157 |   if (!(await box.isVisible())) await page.locator('[name=customSearch]').first().click({ timeout: 10000 });
  158 |   await box.waitFor({ state: 'visible', timeout: 10000 });
  159 |   await box.fill(procPath);
  160 |   const wait = P.waitApi(page, 'Procmanager/procManager');
  161 |   await page.locator('#strategyListSearch').click();
  162 |   const r = await wait;
  163 |   await page.waitForTimeout(800);
  164 |   const rows = await page.locator('#tbClient tbody tr[data-index]').allInnerTexts();
  165 |   return { rows, resp: r };
  166 | }
  167 | module.exports.searchProc = searchProc;
  168 | 
  169 | /** 名单页地址：type 'white' / 'black' */
  170 | function listHash(type) { return '#processManage/list?tab=' + type; }
  171 | 
  172 | /** 名单页：创建名单（只建名单，不带进程） */
  173 | async function createList(page, type, name) {
  174 |   await P.openHash(page, listHash(type));
  175 |   await page.locator('.js_procm_create').first().click({ timeout: 30000 });
  176 |   const m = page.locator('#procmListModal');
  177 |   await m.waitFor({ state: 'visible', timeout: 10000 });
  178 |   await m.locator('.js_procm_lm_name').fill(name);
  179 |   const wait = P.waitApi(page, 'Procmanager/createWBList');
  180 |   await m.locator('.js_procm_lm_ok').click();
  181 |   return wait;
  182 | }
  183 | 
  184 | /**
  185 |  * 名字整段精确匹配的正则：hasText 传字符串是「包含」匹配，PL05测试-白 会连 PL05测试-白2 一起匹配上，
  186 |  * 点错名单护栏也拦不住（两个都是自建的），所以一律用首尾锚定的正则。
  187 |  */
  188 | function exactName(name) { return new RegExp('^\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$'); }
  189 | 
  190 | /** 名单页里某名单那一行（按名字精确匹配） */
  191 | function listRow(page, name) {
  192 |   return page.locator('#tbClient tbody tr[data-index]').filter({ has: page.locator('.js_procm_name', { hasText: exactName(name) }) }).first();
  193 | }
  194 | 
  195 | /** 名单页：展开某个名单那一行，点下面的操作按钮（edit / proc / group / publish / del） */
  196 | async function listOp(page, type, name, opName) {
  197 |   await P.openHash(page, listHash(type));
  198 |   const row = listRow(page, name);
> 199 |   await row.waitFor({ timeout: 30000 });
      |             ^ TimeoutError: locator.waitFor: Timeout 30000ms exceeded.
  200 |   await row.locator('.js_procm_name').click();
  201 |   const btn = page.locator('.procm-append-tr .js_procm_op[data-op="' + opName + '"]').first();
  202 |   await btn.waitFor({ state: 'visible', timeout: 10000 });
  203 |   if ((await btn.getAttribute('aria-disabled')) === 'true') throw new Error(name + ' 的「' + opName + '」按钮是灰色：' + (await btn.getAttribute('title')));
  204 |   await btn.click();
  205 | }
  206 | 
  207 | /** 名单页：发布（确认框点确定） */
  208 | async function publishList(page, type, name) {
  209 |   await listOp(page, type, name, 'publish');
  210 |   const m = page.locator('#procmPublishModal');
  211 |   await m.waitFor({ state: 'visible', timeout: 10000 });
  212 |   const wait = P.waitApi(page, 'Procmanager/releaseWBList');
  213 |   await m.locator('.js_procm_publish_ok').click();
  214 |   return wait;
  215 | }
  216 | 
  217 | /**
  218 |  * 名单页：应用到组。groups 是要勾的组名数组（空数组 = 全部取消）；
  219 |  * 先把树上已勾的都取消，再勾 groups；点「应用」后若弹覆盖确认就点确定。
  220 |  * 返回 { resp, checked }：接口响应、提交前树上勾选的节点名。
  221 |  */
  222 | async function applyListToGroups(page, type, name, groups) {
  223 |   await listOp(page, type, name, 'group');
  224 |   const m = page.locator('#procmSetGroup');
  225 |   await m.waitFor({ state: 'visible', timeout: 10000 });
  226 |   await page.locator('#procmGroupTree li').first().waitFor({ timeout: 15000 });
  227 |   await page.waitForTimeout(800);
  228 |   // 取消已勾的（只点 span.chk）
  229 |   for (const t of await treeChecked(page, '#procmGroupTree')) {
  230 |     const chk = page.locator('#procmGroupTree a[title="' + t + '"]').first().locator('xpath=preceding-sibling::span[contains(@class,"chk")][1]');
  231 |     await chk.click({ timeout: 5000 });
  232 |   }
  233 |   for (const g of groups) await treeCheck(page, '#procmGroupTree', g);
  234 |   const checked = await treeChecked(page, '#procmGroupTree');
  235 |   if (checked.sort().join(',') !== groups.slice().sort().join(',')) throw new Error('应用到组树上勾选的和预期不一致：' + checked.join(','));
  236 |   const wait = P.waitApi(page, 'Procmanager/usedGroup');
  237 |   await m.locator('.js_procm_group_ok').click();
  238 |   const c = page.locator('#procmGroupConfirm');
  239 |   if (await c.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false)) await c.locator('.js_procm_group_confirm_ok').click();
  240 |   return { resp: await wait, checked };
  241 | }
  242 | 
  243 | /**
  244 |  * 进程管理页：按路径搜出进程，勾第一行，加入名单 listName。
  245 |  * kind 'white' 点「选中加白」，'black' 点「选中加黑」。
  246 |  */
  247 | async function addProcFromMana(page, procPath, kind, listName) {
  248 |   const sr = await searchProc(page, procPath);
  249 |   if (!sr.rows.length) throw new Error('进程管理页搜不到 ' + procPath);
  250 |   if (!(await checkRow(page, procPath.split('/').pop()))) throw new Error('勾不上 ' + procPath);
  251 |   await page.locator(kind === 'white' ? '#addWhite' : '#addBlack').click({ timeout: 10000 });
  252 |   const m = page.locator('#addBWListModal');
  253 |   await m.waitFor({ state: 'visible', timeout: 10000 });
  254 |   const box = m.locator('.addListInput[pname="' + listName + '"]');
  255 |   await box.waitFor({ state: 'attached', timeout: 10000 });
  256 |   if (!(await setCheck(box, true))) throw new Error('名单 ' + listName + ' 勾不上');
  257 |   const wait = P.waitApi(page, 'Procmanager/addProcToBW');
  258 |   await page.locator('#addBWListBtn').click();
  259 |   return wait;
  260 | }
  261 | 
  262 | Object.assign(module.exports, { listHash, exactName, listRow, createList, listOp, publishList, applyListToGroups, addProcFromMana });
  263 | 
  264 | /**
  265 |  * 进程管控策略页（#processManage/policy?g=组号）改管控模式并保存。
  266 |  * mode：'1' 学习 / '2' 审计 / '3' 拦截。页面流程：点模式所在的 .sub-module 块（页面会顺手清掉上一模式的通知勾选）→
  267 |  * 「应用」#policy-save → 确认框 #resetPolicy 点「确定」#resetPolicyBtn → 公共 RsCore.editPolicy 提交 Policycenter/editPolicy。
  268 |  * 中心开了安全认证时会先弹二次认证（#doubleAuthModal），这里不处理，等不到接口就超时报错（14.15 没开）。
  269 |  * 返回 editPolicy 的 { params, json }。
  270 |  */
  271 | async function setAuditMode(page, gid, mode) {
  272 |   await P.openHash(page, '#processManage/policy?g=' + gid);
  273 |   const radio = page.locator('input.auditmode[value="' + mode + '"]');
  274 |   await radio.waitFor({ state: 'attached', timeout: 30000 });
  275 |   await page.waitForTimeout(1500); // 等策略内容回填完（回填会再设一次选中的模式）
  276 |   await radio.locator('xpath=ancestor::*[contains(@class,"sub-module")][1]').click({ timeout: 10000 });
  277 |   if (!(await radio.isChecked())) throw new Error('管控模式 ' + mode + ' 没选上');
  278 |   await page.locator('#policy-save').click({ timeout: 10000 });
  279 |   await page.locator('#resetPolicy').waitFor({ state: 'visible', timeout: 10000 });
  280 |   const wait = P.waitApi(page, 'Policycenter/editPolicy', 60000);
  281 |   await page.locator('#resetPolicyBtn').click();
  282 |   return wait;
  283 | }
  284 | 
  285 | /**
  286 |  * 进程管控日志页（#processManage/log?g=组号）按一个条件筛选。
  287 |  * searchType：'ip' / 'procpath' / 'filehash' / 'computername'（页面一次只能选一个）；时间范围用页面默认的「本周」。
  288 |  * 返回 { rows, total }：表格接口 Procmanager/getProcLogList 返回的行（字段同 RPW_PROCESSAUDITINFO，大写）。
  289 |  */
  290 | async function searchLog(page, gid, searchType, key) {
  291 |   await P.openHash(page, '#processManage/log?g=' + gid);
  292 |   await page.locator('#tbClient').waitFor({ timeout: 30000 });
  293 |   const box = page.locator('#customSearchBox .js_searchKey');
  294 |   if (!(await box.isVisible())) await page.locator('[name=customSearch]').first().click({ timeout: 10000 });
  295 |   await box.waitFor({ state: 'visible', timeout: 10000 });
  296 |   await page.locator('#customSearchBox .js_searchType').selectOption(searchType, { force: true });
  297 |   await box.fill(key);
  298 |   const wait = P.waitApi(page, 'Procmanager/getProcLogList');
  299 |   await page.locator('#customSearchBox .js_btn_search').click();
```