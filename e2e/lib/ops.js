/**
 * 页面操作公共库：只做「在页面上点」这一层，每个函数返回触发的接口响应 { params, json }。
 * 所有写请求都会先经过 page.js 的护栏（组号 / pid 不合规直接中止），这里不重复校验。
 * 选择器来自 14.15 前端代码：view/sys/info.js（组信息）、view/sys/overview.js（移动终端）。
 */
'use strict';
const P = require('./page');

/** 接口是否成功：后端统一返回 { r: { code, msg }, data }，code 为 0 表示成功 */
function ok(resp) {
  return !!(resp && resp.json && resp.json.r && String(resp.json.r.code) === '0');
}

/**
 * 勾选 / 取消勾选一个复选框。SOC 页面常用 iCheck 插件：原生 input 透明，要点它上面的 ins 覆盖层；
 * 没被 iCheck 包住的就直接点 input。最后读 checked 状态核对。
 */
async function setCheck(input, want) {
  if ((await input.isChecked()) === want) return true;
  const helper = input.locator('xpath=following-sibling::ins[contains(@class,"iCheck-helper")]');
  if (await helper.count()) await helper.click({ timeout: 10000 });
  else await input.click({ timeout: 10000 });
  return (await input.isChecked()) === want;
}

/** 在表格 #tbClient 里勾选含某段文字（如 IP）的那一行；找不到返回 false */
async function checkRow(page, text) {
  const row = page.locator('#tbClient tbody tr[data-index]', { hasText: text }).first();
  if (!(await row.count())) return false;
  return setCheck(row.locator('input[name=btSelectItem]'), true);
}

/** 分组管理：在根管理组（g=1）下新增子组。新增接口写死继承父组（inherit=1） */
async function createSubGroup(page, name) {
  await P.openHash(page, '#sys/info?g=1');
  await page.locator('a.tabA[da-toggle=subGroupInfo]').click({ timeout: 15000 });
  await page.locator('#custom-toolbar a[data-type=addSubGroup]').first().click({ timeout: 10000 });
  await page.locator('#addGroup').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#txtGroupName').fill(name);
  const wait = P.waitApi(page, 'Group/editGroup');
  await page.locator('#btnSaveGroup').click();
  return wait;
}

/** 组信息页：设置「开启继承父组策略」并保存（只改 GROUPINFO.ISINHERIT） */
async function setInherit(page, groupId, inherit) {
  await P.openHash(page, '#sys/info?g=' + groupId);
  const box = page.locator('#inheritParent');
  await box.waitFor({ state: 'attached', timeout: 15000 });
  await page.waitForTimeout(1000); // 等页面按当前组回填勾选状态
  const done = await setCheck(box, !!inherit);
  if (!done) throw new Error('「继承父组」复选框没切换成功');
  const wait = P.waitApi(page, 'Group/editGroup');
  await page.locator('#groupInfoSave').click();
  return wait;
}

/**
 * 终端管理页：把含 ip 的终端移到名为 groupName 的组。
 * fromGroup 是终端当前所在组号（决定打开哪个组的终端列表）。
 */
async function moveTerminal(page, ip, fromGroup, groupName) {
  await P.openHash(page, '#sys/overview?g=' + fromGroup);
  await page.locator('#tbClient tbody tr[data-index]').first().waitFor({ timeout: 30000 });
  if (!(await checkRow(page, ip))) throw new Error('终端列表第一页没找到 ' + ip);
  await page.locator('#btnMoveTo').click({ timeout: 10000 });
  await page.locator('#mMoveTo').waitFor({ state: 'visible', timeout: 10000 });
  await treeCheck(page, '#targetGroup', groupName);
  const wait = P.waitApi(page, 'Group/moveComputer');
  await page.locator('#btnSaveMoveTo').click();
  return wait;
}

/**
 * zTree 组树里勾选名为 name 的节点（单选圆点或复选框都是 <a> 前面的兄弟 span.chk）。
 * 树默认折叠，子组要先展开父组才渲染：找不到就把折叠的节点逐层展开，最多 5 层。
 * 只点 span.chk，不碰树上的其他控件（如策略中心应用范围树里的「继承」勾选框）。
 */
async function treeCheck(page, treeSel, name) {
  const a = page.locator(treeSel + ' a[title="' + name + '"]');
  for (let i = 0; i < 5 && !(await a.count()); i++) {
    const closed = page.locator(treeSel + ' span.switch[class*="_close"]');
    const n = await closed.count();
    if (!n) break;
    for (let k = 0; k < n; k++) await closed.first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
  }
  if (!(await a.count())) throw new Error(treeSel + ' 组树里没找到 ' + name);
  const chk = a.first().locator('xpath=preceding-sibling::span[contains(@class,"chk")][1]');
  if (!/_true/.test((await chk.getAttribute('class')) || '')) await chk.click({ timeout: 10000 });
  return /_true/.test((await chk.getAttribute('class')) || '');
}

/** 树里当前所有勾上的节点名（核对「只勾了测试组」用） */
async function treeChecked(page, treeSel) {
  return page.locator(treeSel + ' span.chk[class*="_true"]').evaluateAll((els) =>
    els.map((e) => { const a = e.parentNode.querySelector(':scope > a'); return a ? a.getAttribute('title') : '?'; }));
}

/**
 * 策略中心新建进程管控策略并配置应用范围（只勾 groupName 一个组）。
 * opts: { auditmode: '1' 学习 / '2' 审计 / '3' 拦截, uptimer: 秒, cloneName: 克隆来源策略名 }
 * onCreated(pid)：新建接口返回后立即回调（用来给护栏登记 pid，之后的应用范围提交才放行）。
 * 返回 { add, range, checked }：新建、应用范围两个接口的响应和提交前树上勾选的节点。
 */
async function createPolicy(page, name, groupName, opts, onCreated) {
  // 策略中心实际页面是 #strategy/overview（#strategy 只是外壳，直接用网址打开不会跳到默认子页）
  await P.openHash(page, '#strategy/overview');
  await page.locator('.creat_btn').first().click({ timeout: 30000 });
  const m = page.locator('#policyBoxModal');
  await m.waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#policyNameInput').fill(name);
  await page.locator('#policyNameInput').blur();
  // 选产品「进程管控」：前端会自动把终端类型定成 Linux，并拉克隆来源列表
  const copyList = P.waitApi(page, 'Policycenter/getPolicyForCopy');
  await page.locator('#productList').selectOption('processManage', { force: true });
  await copyList;
  // 克隆来源：按名字选（只是读它的策略内容做初值，不改它）
  const val = await page.locator('#policyList option', { hasText: opts.cloneName }).first().getAttribute('value');
  await page.locator('#policyList').selectOption(val, { force: true });
  await m.locator('.btn[da-type=toStep2]').click();
  // 第二步：开启、模式、上报间隔（克隆来的初值会被这里覆盖）
  const en = page.locator('#procauditEnable');
  await en.waitFor({ state: 'attached', timeout: 15000 });
  if (!(await setCheck(en, true))) throw new Error('「开启进程管控」没勾上');
  if (!(await setCheck(page.locator('input[name=auditmode][value="' + opts.auditmode + '"]'), true))) throw new Error('管控模式没选上');
  for (const id of ['#sjNotify', '#ljNotify']) await setCheck(page.locator(id), false); // 不通知
  await page.locator('#uptimer').fill(String(opts.uptimer));
  // 「配置应用范围」：先新建策略，返回新 pid
  const addWait = P.waitApi(page, 'Policycenter/addPolicy');
  await m.locator('.btn[da-type=toStep3]').click();
  const add = await addWait;
  if (!ok(add)) return { add };
  await onCreated(add.json.data);
  // 第三步：应用组树只勾测试组
  await page.locator('#groupTreePolicy').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1000);
  await treeCheck(page, '#groupTreePolicy', groupName);
  const checked = await treeChecked(page, '#groupTreePolicy');
  if (checked.length !== 1 || checked[0] !== groupName) throw new Error('应用范围树勾选的不只测试组：' + checked.join(','));
  const rangeWait = P.waitApi(page, 'Policycenter/editUsedObject');
  await m.locator('.btn[da-type=saveRange]').click();
  return { add, range: await rangeWait, checked };
}

module.exports = { ok, setCheck, checkRow, createSubGroup, setInherit, moveTerminal, treeCheck, treeChecked, createPolicy };

/**
 * 进程管理页：按进程路径搜索，返回表格里的行文字（每行一个字符串）。
 * 路径输入框在「高级搜索」里（工具栏图标按钮 [name=customSearch]），没展开就先点开。
 */
async function searchProc(page, procPath) {
  await P.openHash(page, '#processManage/processMana');
  await page.locator('#tbClient tbody tr').first().waitFor({ timeout: 30000 });
  const box = page.locator('#customSearchBox .js_procpath');
  // 「高级搜索」是表格工具栏上的图标按钮 [name=customSearch]（没有文字），点一下展开搜索条件
  if (!(await box.isVisible())) await page.locator('[name=customSearch]').first().click({ timeout: 10000 });
  await box.waitFor({ state: 'visible', timeout: 10000 });
  await box.fill(procPath);
  const wait = P.waitApi(page, 'Procmanager/procManager');
  await page.locator('#strategyListSearch').click();
  const r = await wait;
  await page.waitForTimeout(800);
  const rows = await page.locator('#tbClient tbody tr[data-index]').allInnerTexts();
  return { rows, resp: r };
}
module.exports.searchProc = searchProc;

/** 名单页地址：type 'white' / 'black' */
function listHash(type) { return '#processManage/list?tab=' + type; }

/** 名单页：创建名单（只建名单，不带进程） */
async function createList(page, type, name) {
  await P.openHash(page, listHash(type));
  await page.locator('.js_procm_create').first().click({ timeout: 30000 });
  const m = page.locator('#procmListModal');
  await m.waitFor({ state: 'visible', timeout: 10000 });
  await m.locator('.js_procm_lm_name').fill(name);
  const wait = P.waitApi(page, 'Procmanager/createWBList');
  await m.locator('.js_procm_lm_ok').click();
  return wait;
}

/**
 * 名字整段精确匹配的正则：hasText 传字符串是「包含」匹配，PL05测试-白 会连 PL05测试-白2 一起匹配上，
 * 点错名单护栏也拦不住（两个都是自建的），所以一律用首尾锚定的正则。
 */
function exactName(name) { return new RegExp('^\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$'); }

/** 名单页里某名单那一行（按名字精确匹配） */
function listRow(page, name) {
  return page.locator('#tbClient tbody tr[data-index]').filter({ has: page.locator('.js_procm_name', { hasText: exactName(name) }) }).first();
}

/** 名单页：展开某个名单那一行，点下面的操作按钮（edit / proc / group / publish / del） */
async function listOp(page, type, name, opName) {
  await P.openHash(page, listHash(type));
  const row = listRow(page, name);
  await row.waitFor({ timeout: 30000 });
  await row.locator('.js_procm_name').click();
  const btn = page.locator('.procm-append-tr .js_procm_op[data-op="' + opName + '"]').first();
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  if ((await btn.getAttribute('aria-disabled')) === 'true') throw new Error(name + ' 的「' + opName + '」按钮是灰色：' + (await btn.getAttribute('title')));
  await btn.click();
}

/** 名单页：发布（确认框点确定） */
async function publishList(page, type, name) {
  await listOp(page, type, name, 'publish');
  const m = page.locator('#procmPublishModal');
  await m.waitFor({ state: 'visible', timeout: 10000 });
  const wait = P.waitApi(page, 'Procmanager/releaseWBList');
  await m.locator('.js_procm_publish_ok').click();
  return wait;
}

/**
 * 名单页：应用到组。groups 是要勾的组名数组（空数组 = 全部取消）；
 * 先把树上已勾的都取消，再勾 groups；点「应用」后若弹覆盖确认就点确定。
 * 返回 { resp, checked }：接口响应、提交前树上勾选的节点名。
 */
async function applyListToGroups(page, type, name, groups) {
  await listOp(page, type, name, 'group');
  const m = page.locator('#procmSetGroup');
  await m.waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#procmGroupTree li').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  // 取消已勾的（只点 span.chk）
  for (const t of await treeChecked(page, '#procmGroupTree')) {
    const chk = page.locator('#procmGroupTree a[title="' + t + '"]').first().locator('xpath=preceding-sibling::span[contains(@class,"chk")][1]');
    await chk.click({ timeout: 5000 });
  }
  for (const g of groups) await treeCheck(page, '#procmGroupTree', g);
  const checked = await treeChecked(page, '#procmGroupTree');
  if (checked.sort().join(',') !== groups.slice().sort().join(',')) throw new Error('应用到组树上勾选的和预期不一致：' + checked.join(','));
  const wait = P.waitApi(page, 'Procmanager/usedGroup');
  await m.locator('.js_procm_group_ok').click();
  const c = page.locator('#procmGroupConfirm');
  if (await c.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false)) await c.locator('.js_procm_group_confirm_ok').click();
  return { resp: await wait, checked };
}

/**
 * 进程管理页：按路径搜出进程，勾第一行，加入名单 listName。
 * kind 'white' 点「选中加白」，'black' 点「选中加黑」。
 */
async function addProcFromMana(page, procPath, kind, listName) {
  const sr = await searchProc(page, procPath);
  if (!sr.rows.length) throw new Error('进程管理页搜不到 ' + procPath);
  if (!(await checkRow(page, procPath.split('/').pop()))) throw new Error('勾不上 ' + procPath);
  await page.locator(kind === 'white' ? '#addWhite' : '#addBlack').click({ timeout: 10000 });
  const m = page.locator('#addBWListModal');
  await m.waitFor({ state: 'visible', timeout: 10000 });
  const box = m.locator('.addListInput[pname="' + listName + '"]');
  await box.waitFor({ state: 'attached', timeout: 10000 });
  if (!(await setCheck(box, true))) throw new Error('名单 ' + listName + ' 勾不上');
  const wait = P.waitApi(page, 'Procmanager/addProcToBW');
  await page.locator('#addBWListBtn').click();
  const r = await wait;
  const sent = (r.params && r.params['proclist.procpath']) || [];
  if (sent.length !== 1 || sent[0] !== procPath) throw new Error('加入名单提交的路径不对：' + JSON.stringify(sent) + '，应为 ' + procPath);
  return r;
}

Object.assign(module.exports, { listHash, exactName, listRow, createList, listOp, publishList, applyListToGroups, addProcFromMana });

/**
 * 进程管控策略页（#processManage/policy?g=组号）改管控模式并保存。
 * mode：'1' 学习 / '2' 审计 / '3' 拦截。页面流程：点模式所在的 .sub-module 块（页面会顺手清掉上一模式的通知勾选）→
 * 「应用」#policy-save → 确认框 #resetPolicy 点「确定」#resetPolicyBtn → 公共 RsCore.editPolicy 提交 Policycenter/editPolicy。
 * 中心开了安全认证时会先弹二次认证（#doubleAuthModal），这里不处理，等不到接口就超时报错（14.15 没开）。
 * 返回 editPolicy 的 { params, json }。
 */
async function setAuditMode(page, gid, mode) {
  await P.openHash(page, '#processManage/policy?g=' + gid);
  const radio = page.locator('input.auditmode[value="' + mode + '"]');
  await radio.waitFor({ state: 'attached', timeout: 30000 });
  await page.waitForTimeout(1500); // 等策略内容回填完（回填会再设一次选中的模式）
  await radio.locator('xpath=ancestor::*[contains(@class,"sub-module")][1]').click({ timeout: 10000 });
  if (!(await radio.isChecked())) throw new Error('管控模式 ' + mode + ' 没选上');
  await page.locator('#policy-save').click({ timeout: 10000 });
  await page.locator('#resetPolicy').waitFor({ state: 'visible', timeout: 10000 });
  const wait = P.waitApi(page, 'Policycenter/editPolicy', 60000);
  await page.locator('#resetPolicyBtn').click();
  return wait;
}

/**
 * 进程管控日志页（#processManage/log?g=组号）按一个条件筛选。
 * searchType：'ip' / 'procpath' / 'filehash' / 'computername'（页面一次只能选一个）；时间范围用页面默认的「本周」。
 * 返回 { rows, total }：表格接口 Procmanager/getProcLogList 返回的行（字段同 RPW_PROCESSAUDITINFO，大写）。
 */
async function searchLog(page, gid, searchType, key) {
  await P.openHash(page, '#processManage/log?g=' + gid);
  await page.locator('#tbClient').waitFor({ timeout: 30000 });
  const box = page.locator('#customSearchBox .js_searchKey');
  if (!(await box.isVisible())) await page.locator('[name=customSearch]').first().click({ timeout: 10000 });
  await box.waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#customSearchBox .js_searchType').selectOption(searchType, { force: true });
  await box.fill(key);
  const wait = P.waitApi(page, 'Procmanager/getProcLogList');
  await page.locator('#customSearchBox .js_btn_search').click();
  const r = await wait;
  await page.waitForTimeout(800);
  // 核对请求里真的带上了筛选条件：页面重画会把填好的值冲掉，那时后端返回的是不筛选的全部日志
  const q = searchCond(r.params);
  if (!q || q.searchtype !== searchType || q.searchkey !== key) {
    throw new Error('日志页筛选条件没带上：期望 ' + searchType + '=' + key + '，实际 ' + JSON.stringify(q));
  }
  const d = (r.json && r.json.data) || {};
  return { rows: d.rows || [], total: d.total, params: r.params };
}

/** 从 getProcLogList 的请求参数里取 queryconditions（请求体是 JSON，被表单解析器整段当成了一个键） */
function searchCond(params) {
  for (const k of Object.keys(params || {})) {
    try { const o = JSON.parse(k); if (o && o.queryconditions) return o.queryconditions; } catch (e) { /* 不是 JSON 键，跳过 */ }
  }
  return null;
}

/**
 * 日志页：按路径筛出日志，勾选路径 = procPath 且含 rowText（终端 IP）的第一行，加白 / 加黑到 listName。
 * 返回 addProcToBW 的 { params, json }。
 */
async function addFromLog(page, gid, procPath, rowText, kind, listName) {
  const sr = await searchLog(page, gid, 'procpath', procPath);
  if (!sr.rows.length) throw new Error('日志页筛不到 ' + procPath);
  // 后端不认 searchtype=procpath（只认 computername / ip），表格里会混着别的进程，所以不能「勾第一行」；
  // 按「路径 + 终端 IP」精确找行，两样都对上才勾；提交后再核对请求里的路径，不对直接报错。
  const row = page.locator('#tbClient tbody tr[data-index]', { hasText: procPath }).filter({ hasText: rowText }).first();
  if (!(await row.count()) || !(await setCheck(row.locator('input[name=btSelectItem]'), true))) {
    throw new Error('日志页勾不上 ' + procPath + '（' + rowText + '）那一行');
  }
  await page.locator(kind === 'white' ? '#addWhite' : '#addBlack').click({ timeout: 10000 });
  const m = page.locator('#addBWListModal');
  await m.waitFor({ state: 'visible', timeout: 10000 });
  const box = m.locator('.addListInput[pname="' + listName + '"]');
  await box.waitFor({ state: 'attached', timeout: 10000 });
  if (!(await setCheck(box, true))) throw new Error('名单 ' + listName + ' 勾不上');
  const wait = P.waitApi(page, 'Procmanager/addProcToBW');
  await page.locator('#addBWListBtn').click();
  const r = await wait;
  const sent = (r.params && r.params['proclist.procpath']) || [];
  if (sent.length !== 1 || sent[0] !== procPath) throw new Error('加入名单提交的路径不对：' + JSON.stringify(sent) + '，应为 ' + procPath);
  return r;
}

Object.assign(module.exports, { setAuditMode, searchLog, addFromLog });

/**
 * 名单进程视图里「添加进程」手工录入：进程路径 + 文件哈希（MD5 32 位 / SHA256 64 位，页面按长度识别算法）。
 * 用于从没被学习采集到的程序（进程管理页搜不到，没法「选中加白 / 加黑」）。
 * 返回 Procmanager/addProcToWBList 的 { params, json }。
 */
async function addProcManual(page, type, listName, procPath, hash) {
  await listOp(page, type, listName, 'proc');
  await page.locator('.js_procm_proc_add').first().click({ timeout: 15000 });
  const box = page.locator('.js_procm_proc_addpath');
  await box.waitFor({ state: 'visible', timeout: 10000 });
  await box.fill(procPath);
  await page.locator('.js_procm_proc_addhash').fill(hash);
  await page.locator('.js_procm_proc_addhash').blur();
  const wait = P.waitApi(page, 'Procmanager/addProcToWBList');
  await page.locator('.js_procm_proc_addok').click();
  return wait;
}

Object.assign(module.exports, { addProcManual });

// ---------------------------------------------------------------------------
// 还原用（90-restore）：删名单、清策略应用范围、删策略、删组。每个都只走页面，写请求仍过护栏。
// ---------------------------------------------------------------------------

/** 名单页：删除名单（任何状态都能删；已应用的，终端下次拉策略时清掉本地名单）。返回 delWBList 的 { params, json } */
async function deleteList(page, type, name) {
  await listOp(page, type, name, 'del');
  const m = page.locator('#procmDelModal');
  await m.waitFor({ state: 'visible', timeout: 10000 });
  const wait = P.waitApi(page, 'Procmanager/delWBList');
  await m.locator('.js_procm_del_ok').click();
  return wait;
}

/**
 * 策略中心列表里按名字找策略那一行并点开按钮行（点行本身展开，再点一次收起）。
 * 名字列要整段相等，防止「PL05测试-进程策略」匹配到别的相似名字。
 */
async function openPolicyRow(page, name) {
  await P.openHash(page, '#strategy/overview');
  const row = page.locator('#strategyList tbody tr[data-index]')
    .filter({ has: page.locator('td', { hasText: exactName(name) }) }).first();
  await row.waitFor({ timeout: 30000 });
  await row.click();
  const btns = page.locator('#strategyList tbody tr.append_tr');
  await btns.waitFor({ state: 'visible', timeout: 10000 });
  return btns;
}

/**
 * 策略中心：把策略的应用范围全部取消（组树上勾着的全取消后点「应用」）。
 * 后端会把这些组挂回该产品的默认策略。原来就一个没勾时页面不发请求，返回 null。
 * 返回 { resp, before }：接口响应、取消前树上勾着的节点名。
 */
async function clearPolicyScope(page, name) {
  const btns = await openPolicyRow(page, name);
  const tree = P.waitApi(page, 'Policycenter/getUsedGroupId', 30000).catch(() => null);
  await btns.locator('.set_group').click({ timeout: 10000 });
  await page.locator('#setGroup').waitFor({ state: 'visible', timeout: 10000 });
  await tree;
  await page.locator('#groupTree li').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1000); // 等树按已应用的组回填勾选
  const before = await treeChecked(page, '#groupTree');
  if (!before.length) { await page.locator('#setGroup .close, #setGroup [data-dismiss=modal]').first().click().catch(() => {}); return { resp: null, before }; }
  // 只取消勾选（只点 span.chk，不碰「继承」勾选框）；勾着的父节点取消后子节点跟着取消，所以每次重新取第一个
  for (let i = 0; i < 50; i++) {
    const on = page.locator('#groupTree span.chk[class*="_true"]');
    if (!(await on.count())) break;
    await on.first().click({ timeout: 5000 });
  }
  const left = await treeChecked(page, '#groupTree');
  if (left.length) throw new Error('应用范围树还有勾选没取消：' + left.join(','));
  const wait = P.waitApi(page, 'Policycenter/editUsedObject');
  await page.locator('#setGroupSysBtn').click();
  return { resp: await wait, before };
}

/** 策略中心：删除用户策略（确认框点确定）。返回 delPolicy 的 { params, json } */
async function deletePolicy(page, name) {
  const btns = await openPolicyRow(page, name);
  await btns.locator('.del_strategy').click({ timeout: 10000 });
  await page.locator('#delStrategy').waitFor({ state: 'visible', timeout: 10000 });
  const wait = P.waitApi(page, 'Policycenter/delPolicy');
  await page.locator('#confirmDelStrategy').click();
  return wait;
}

/** 分组管理：在根管理组的「子组」列表里删除名为 name 的组。返回 delGroup 的 { params, json } */
async function deleteGroup(page, name) {
  await P.openHash(page, '#sys/info?g=1');
  await page.locator('a.tabA[da-toggle=subGroupInfo]').click({ timeout: 15000 });
  const row = page.locator('#tbClient tbody tr[data-index]')
    .filter({ has: page.locator('td', { hasText: exactName(name) }) }).first();
  await row.waitFor({ timeout: 30000 });
  await row.locator('a.gdelete').click({ timeout: 10000 });
  await page.locator('#delGroup').waitFor({ state: 'visible', timeout: 10000 });
  const wait = P.waitApi(page, 'Group/delGroup');
  await page.locator('#btnDelGroup').click();
  return wait;
}

Object.assign(module.exports, { deleteList, openPolicyRow, clearPolicyScope, deletePolicy, deleteGroup });
