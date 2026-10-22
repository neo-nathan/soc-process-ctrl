// 阶段 3.1 主 Agent 复跑 Executor 自测（改编自 TK-5 内审的运行脚本）：起无头 Chrome，打开本地自测页，执行 window.__selftest()，打印结果（不碰 101、不碰用户的 Chrome 标签）
var cp = require('child_process');
var http = require('http');
var port = 9355, url = process.argv[2];
var chrome = cp.spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + __dirname + '/chrome-prof', '--window-size=1920,1080', '--no-first-run', '--no-default-browser-check', 'about:blank'],
  { stdio: 'ignore' });
function getJSON(u) { return new Promise(function (res, rej) { http.get(u, function (r) { var b = ''; r.on('data', function (d) { b += d; }); r.on('end', function () { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); }); }
function sleep(n) { return new Promise(function (r) { setTimeout(r, n); }); }
(async function () {
  var list;
  for (var i = 0; i < 50; i++) { try { list = await getJSON('http://127.0.0.1:' + port + '/json/list'); break; } catch (e) { await sleep(200); } }
  var page = list.filter(function (t) { return t.type === 'page'; })[0];
  var ws = new WebSocket(page.webSocketDebuggerUrl);
  var id = 0, pending = {};
  function send(method, params) { return new Promise(function (res) { var i = ++id; pending[i] = res; ws.send(JSON.stringify({ id: i, method: method, params: params || {} })); }); }
  ws.onmessage = function (m) { var d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; } };
  await new Promise(function (r) { ws.onopen = r; });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: url });
  await sleep(4000);
  await sleep(4000);
  // 通用读法：兼容 {pass, fail, items}（TK-5）与 {pass, fail, failed, total}（TK-3、TK-4）两种返回
  var r = await send('Runtime.evaluate', { expression: '(async()=>{if(!window.__selftest)return JSON.stringify({err:"no __selftest"});var x=await window.__selftest();var bad=(x.failed||(x.items||[]).filter(function(i){return !i.ok;}));return JSON.stringify({total:x.total||((x.items||[]).length),pass:x.pass,fail:x.fail,red:bad.map(function(i){return (i.name||"")+" | "+(i.detail||"");})});})()', awaitPromise: true, timeout: 600000 });
  console.log(JSON.stringify(r.result && r.result.result ? r.result.result.value : r, null, 0));
  ws.close(); chrome.kill('SIGTERM');
  process.exit(0);
})().catch(function (e) { console.error('ERR', e); chrome.kill('SIGTERM'); process.exit(2); });
