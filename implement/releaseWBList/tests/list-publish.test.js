// 发布切真接口后 list.js 的单测（不加载整个页面模块，只从源码里抠出要测的几段来跑）
//   1. URL_PUBLISH 已是 Procmanager/releaseWBList
//   2. publishOkMsg：按后端返回的 OBJCOUNT 选两种提示；OBJCOUNT 缺失时退回看这一行的 GROUPNUM
//   3. CONFIRM 配置：发布用 publishOkMsg，删除照弹后端 msg；submitConfirm 成功回调调 cfg.okMsg
// 用法：node list-publish.test.js [list.js 路径]
var assert = require('assert');
var fs = require('fs');
var vm = require('vm');
var FILE = process.argv[2] || '/Users/nick/Workspace/ESMCenterST/public/esm/view/processManage/list.js';
var src = fs.readFileSync(FILE, 'utf8');

// 抠出一段：从 start 正则开始，到第一个「行首 4 空格 + }」为止（函数）；常量就抠一行
function grab(re) {
    var m = src.match(re);
    assert.ok(m, '源码里没找到：' + re);
    return m[0];
}
var code = [
    grab(/var URL_PUBLISH = [^\n]*/),
    grab(/var TXT_HEARTBEAT = [^\n]*/),
    grab(/var TXT_PUBLISH_APPLIED = [^\n]*/),
    grab(/var TXT_PUBLISH_UNAPPLIED = [^\n]*/),
    grab(/function toInt\(v\) \{[\s\S]*?\n    \}/),
    grab(/function publishOkMsg\(data, row\) \{[\s\S]*?\n    \}/)
].join('\n');
var ctx = {};
vm.createContext(ctx);
vm.runInContext(code + '\nthis.out = {URL_PUBLISH: URL_PUBLISH, A: TXT_PUBLISH_APPLIED, U: TXT_PUBLISH_UNAPPLIED, f: publishOkMsg};', ctx);
var o = ctx.out;

assert.strictEqual(o.URL_PUBLISH, 'Procmanager/releaseWBList');
assert.strictEqual(o.A, '已发布，组内终端下次心跳（默认 5 分钟内）生效');   // 与原 mock MSG.PUBLISH_APPLIED 一字不差
assert.strictEqual(o.U, '已发布，应用到组后下发');                           // 与原 mock MSG.PUBLISH_UNAPPLIED 一字不差
console.log('PASS 接口地址与两种提示文字');

assert.strictEqual(o.f({ OBJCOUNT: 2 }, { GROUPNUM: 0 }), o.A);      // 以后端返回为准
assert.strictEqual(o.f({ OBJCOUNT: '1' }, { GROUPNUM: 0 }), o.A);    // 字符串数字
assert.strictEqual(o.f({ OBJCOUNT: 0 }, { GROUPNUM: 3 }), o.U);      // 后端说 0 就是 0，不看列表
assert.strictEqual(o.f({ OBJCOUNT: '0' }, { GROUPNUM: 3 }), o.U);
assert.strictEqual(o.f({}, { GROUPNUM: 2 }), o.A);                   // 后端没给 OBJCOUNT：退回看 GROUPNUM
assert.strictEqual(o.f({ OBJCOUNT: null }, { GROUPNUM: 0 }), o.U);
assert.strictEqual(o.f('', { GROUPNUM: 1 }), o.A);                   // data 不是对象
assert.strictEqual(o.f(null, null), o.U);                            // 都没有：按没有应用范围
assert.strictEqual(o.f({ OBJCOUNT: 'abc' }, { GROUPNUM: 5 }), o.U);  // 给了但不是数字：按 0
console.log('PASS publishOkMsg 9 种输入');

// CONFIRM 配置与 submitConfirm 接线（文本判据）
var confirm = grab(/CONFIRM: \{[\s\S]*?\n        \},/);
assert.ok(/publish: \{[\s\S]*url: URL_PUBLISH,[\s\S]*okMsg: function \(data, msg, row\) \{ return publishOkMsg\(data, row\); \}/.test(confirm));
assert.ok(/del: \{[\s\S]*url: URL_DEL,[\s\S]*okMsg: function \(data, msg\) \{ return msg; \}/.test(confirm));
var submit = grab(/submitConfirm: function \(kind\) \{[\s\S]*?\n        \},/);
assert.ok(/RsCore\.msg\.success\(cfg\.okMsg\(data, msg, ctx\.row\)\);/.test(submit));
assert.ok(!/RsCore\.msg\.success\(msg\)/.test(submit));
assert.ok(/RsCore\.ajax\(cfg\.url, \{ pid: ctx\.row\.PID, policytype: op\.cfg\.type \}/.test(submit));
console.log('PASS CONFIRM 与 submitConfirm 接线');

// 全文不再出现旧地址（只允许出现在「由 mock 的 publishWBList 切过来」那句说明里）
var hits = src.split('\n').filter(function (l) { return /publishWBList/.test(l); });
assert.strictEqual(hits.length, 1, hits.join('\n'));
assert.ok(/切过来/.test(hits[0]));
console.log('PASS 旧地址只剩 1 句说明');
console.log('ALL PASS');
