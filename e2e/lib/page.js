/**
 * 页面工具：打开页面、等接口返回、提交前核参数（护栏）。
 *
 * 护栏（PL-05 R-12）：拦截所有写接口的请求，按白名单核参数，不符合就直接中止这次请求（不发到 14.15），
 * 并记下违规，用例结束时断言「没有违规」。规则：
 *   - 应用范围（Policycenter/editUsedObject、Procmanager/usedGroup）：组号只能是测试组（清空 = 空数组也允许）；
 *     pid 只能是本轮自建的策略 / 名单；
 *   - 改继承（group/pOpenClose）、改组 / 删组（Group/editGroup 带 id、Group/delGroup）：只能是测试组；
 *     新建组（Group/editGroup 不带 id）：只能在根管理组下建 PL05测试组；
 *   - 移终端（Group/moveComputer）：只能移 13.18，目标只能是测试组或根管理组；
 *   - 改 / 删策略、名单（Policycenter/editPolicy、delPolicy，Procmanager 的 releaseWBList、delWBList、
 *     addProcToBW、addWByWhere、editWBList、addWBList 等）：pid 只能是本轮自建的；新建只能用 PL05测试 开头的名字；
 *   - 批量删组、加黑名单组等其他写接口：一律中止。
 *   - Group/changeOrder（删组后页面自动给其他组重排）：中止但只记成「预期拦截」，不算违规（用户决定不改同事组排序）。
 * 读接口（get / show / query / is… 开头）放行。所有 POST 请求都记进网络日志，供存证。
 */
'use strict';
const env = require('./env');

const fs = require('fs');
const path = require('path');
const evidence = require('./evidence');

// 当前测试对象（测试组号、自建策略 / 名单的 PID）存在本轮证据目录的 state.json，
// 多个 spec 文件、多次运行（同一轮次）共用；还原用例也靠它知道要清哪些对象。
function stateFile() { return path.join(evidence.ROOT, evidence.round(), 'state.json'); }
function load() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch (e) { return { groupId: null, pids: {} }; }
}
function store(s) { fs.mkdirSync(path.dirname(stateFile()), { recursive: true }); fs.writeFileSync(stateFile(), JSON.stringify(s, null, 2)); }
function setGroup(id) { const s = load(); s.groupId = id == null ? null : String(id); store(s); }
/** 登记自建对象：pid → 名字 */
function addPid(pid, name) { const s = load(); s.pids[String(pid)] = name || ''; store(s); }
function removePid(pid) { const s = load(); delete s.pids[String(pid)]; store(s); }

/**
 * 把表单体解析成 { 键: [值…] }。数组参数 aObjId[]、aObjId[0] 统一成 aObjId；
 * 对象数组 bwlist[0][pid] 存成 bwlist.pid（jQuery 序列化的写法）。
 */
function parseForm(body) {
  const o = {};
  new URLSearchParams(body || '').forEach((v, k) => {
    let key = k.replace(/\[\d*\]$/, '');
    const m = /^([^\[]+)\[\d+\]\[([^\]]+)\]$/.exec(k);
    if (m) key = m[1] + '.' + m[2];
    (o[key] = o[key] || []).push(v);
  });
  return o;
}
const one = (f, k) => (f[k] || [])[0];

/** 返回违规原因；null 表示放行 */
function check(api, f) {
  const st = load();
  const G = st.groupId;
  const isTestPid = (p) => p != null && Object.prototype.hasOwnProperty.call(st.pids, String(p));
  const onlyTestGroup = (ids) => ids.every((x) => G && String(x) === G);
  const nameOk = (n) => typeof n === 'string' && n.indexOf('PL05测试') === 0;
  switch (api) {
    case 'policycenter/editusedobject':
    case 'procmanager/usedgroup': {
      if (!isTestPid(one(f, 'pid'))) return '应用范围的 pid 不是本轮自建对象：' + one(f, 'pid');
      // 组号有两种提交写法：aObjId[]=组号；策略中心是 aObjId[i][groupid]=组号（带锁定标志），两种都要核
      // 名单页是 aObjId='["组号",…]'（JSON 字符串），要拆开再核；拆不开就原样比（必然不等于组号 → 中止）
      const flat = [];
      (f.aObjId || []).forEach((v) => {
        if (/^\s*\[/.test(v)) { try { JSON.parse(v).forEach((x) => flat.push(String(x))); return; } catch (e) { /* 原样比 */ } }
        flat.push(v);
      });
      const ids = flat.concat(f['aObjId.groupid'] || []);
      // 出现了 aObjId 开头但不认识的键，宁可中止（防止换了写法后组号检查落空）
      const odd = Object.keys(f).filter((k) => k.indexOf('aObjId') === 0 && k !== 'aObjId' && k !== 'aObjId.groupid' && k !== 'aObjId.islock');
      if (odd.length) return '应用范围参数写法不认识：' + odd.join(',');
      if (!onlyTestGroup(ids)) return '应用范围里有测试组以外的组：' + ids.join(',');
      return null;
    }
    case 'group/popenclose':
      return G && one(f, 'groupid') === G ? null : '改继承的组不是测试组：' + one(f, 'groupid');
    case 'group/editgroup':
      if (one(f, 'id')) return G && one(f, 'id') === G ? null : '编辑的组不是测试组：' + one(f, 'id');
      return one(f, 'name') === env.names.group && one(f, 'parent_id') === '1' ? null : '新建组不是根管理组下的测试组';
    case 'group/delgroup':
      return G && one(f, 'id') === G ? null : '删除的组不是测试组：' + one(f, 'id');
    case 'group/movecomputer': {
      const clients = f.clients || [];
      const okClient = clients.length === 1 && clients[0] === env.t18.sguid;
      const okGroup = one(f, 'group') === '1' || (G && one(f, 'group') === G);
      return okClient && okGroup ? null : '移终端不符合：终端 ' + clients.join(',') + ' → 组 ' + one(f, 'group');
    }
    case 'policycenter/addpolicy':
    case 'procmanager/createwblist':
      return nameOk(one(f, 'policyname') || one(f, 'pname') || one(f, 'name')) ? null : '新建对象名字不是 PL05测试 开头';
    case 'policycenter/editpolicy':
    case 'policycenter/delpolicy':
    case 'procmanager/releasewblist':
    case 'procmanager/delwblist':
    case 'procmanager/editwblist':
    case 'procmanager/addproctowblist':
    case 'procmanager/delprocfrombw':
      return isTestPid(one(f, 'pid')) ? null : api + ' 的 pid 不是本轮自建对象：' + one(f, 'pid');
    case 'procmanager/addproctobw':
    case 'procmanager/addwbywhere': {
      // 加白加黑：目标名单在 bwlist[i][pid]，每一个都要是自建的
      const pids = f['bwlist.pid'] || [];
      return pids.length && pids.every(isTestPid) ? null : api + ' 的目标名单不是本轮自建：' + pids.join(',');
    }
    default:
      return 'UNKNOWN';
  }
}

// 名字不带读前缀、但已读后端代码确认只查不改的接口，逐个登记。
// 注意 isRead 另外把 indexinfo/index/common/user/menu 五个页面框架控制器整体放行；
// pid 只核第一个值、moveComputer 不核 objects[ep]、非 POST 一律放行。
// TODO: 复用这套脚本前先收紧以上几处。
const READ_EXACT = {
  'mycenter/myinfo': true, // 页头取当前用户、组织名、系统标题
  'sys/systemservidemonitor': true, // 页头服务状态：只用 ps 数后台进程个数，不写库
};

// 一定会被页面自动发出、但不允许放行的写接口：中止 + 只记录，不算违规
const EXPECTED_BLOCK = {
  'group/changeorder': '删组后页面自动给其他组重排（会改同事组的 ORDERVAL），按用户决定不放行，只记录',
};

/** 是否读接口（按方法名前缀判断，加上逐个登记的只读接口） */
function isRead(api) {
  if (READ_EXACT[api]) return true;
  const m = api.split('/')[1] || '';
  return /^(get|show|query|is|check|list|export|search|count|proc(eplist|wblist|manager)$)/.test(m) ||
    /^(indexinfo|index|common|user|menu)\//.test(api);
}

/**
 * 给 context 装护栏。返回 { violations, posts }：违规列表、全部 POST 记录（url + 参数）。
 * 未知的写接口：中止并记违规（宁可停也不误写）。
 */
async function installGuard(context) {
  const violations = [];
  const expectedBlocks = []; // 预期拦截（见 EXPECTED_BLOCK），只记录
  const posts = [];
  await context.route(/\/index\.php\/[A-Za-z]+\/[A-Za-z]+/, async (route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.continue();
    const m = /\/index\.php\/([A-Za-z]+\/[A-Za-z]+)/.exec(req.url());
    const api = m[1].toLowerCase();
    const f = parseForm(req.postData());
    posts.push({ at: new Date().toISOString(), api: m[1], params: f });
    if (isRead(api)) return route.continue();
    // 预期拦截：删测试组后页面会自动调 Group/changeOrder 给剩下的组（同事的组）重排。
    // 用户已定「不改同事组排序，只记录」，所以照样中止，但记进 expectedBlocks，不算违规
    if (EXPECTED_BLOCK[api]) {
      expectedBlocks.push({ api: m[1], why: EXPECTED_BLOCK[api], params: f });
      console.log('[护栏] 预期拦截 ' + m[1] + '：' + EXPECTED_BLOCK[api]);
      return route.abort('blockedbyclient');
    }
    const why = check(api, f);
    if (why === null) return route.continue();
    const v = { api: m[1], why: why === 'UNKNOWN' ? '未登记的写接口，已中止' : why, params: f };
    violations.push(v);
    console.log('[护栏] 中止 ' + m[1] + '：' + v.why);
    return route.abort('blockedbyclient');
  });
  return { violations, expectedBlocks, posts };
}

/**
 * 等某个接口的下一次响应：返回 { params, json }。
 * 要在触发动作之前调用（先挂等待，再点按钮）。
 */
function waitApi(page, apiPath, timeoutMs) {
  const re = new RegExp('/index\\.php/' + apiPath.replace('/', '\\/') + '(\\?|$)', 'i');
  return page.waitForResponse((r) => re.test(r.url()) && r.request().method() === 'POST', { timeout: timeoutMs || 30000 })
    .then(async (r) => {
      let json = null;
      try { json = await r.json(); } catch (e) { json = { raw: (await r.text()).slice(0, 500) }; }
      return { params: parseForm(r.request().postData()), json };
    });
}

/**
 * 打开某个 hash 页面（单页应用），等页面主体出现。
 * 网址和当前完全相同时 goto 只改 hash、不触发路由，页面停在原来的视图（比如名单页里切出去的进程视图），
 * 所以这种情况强制刷新一次，保证拿到的是这个网址的初始页面。
 */
async function openHash(page, hash) {
  const url = env.baseURL + '/Indexinfo/home' + hash;
  // 已在 /Indexinfo/home 上时，只换 # 后面的部分浏览器不会重新加载，页面是异步重画的：
  // 这时等到的元素可能还是旧画面的，填进去的值随后被重画冲掉。所以同一页面内一律跳转后再强制刷新。
  const sameDoc = page.url().split('#')[0] === url.split('#')[0];
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (sameDoc) await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** 收集页面上的错误：控制器异常、警告弹窗文字 */
function watchErrors(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  return errs;
}

module.exports = { load, setGroup, addPid, removePid, installGuard, waitApi, openHash, watchErrors, parseForm, check };
