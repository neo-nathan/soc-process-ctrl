/*
 * PL-01 整体审 I1 自测：名单页「指定日期」选择器的「今天」= 北京日期，每次打开选择器（onShow）现算，和 bwlistMock 的 dateRange 同口径。
 * 用法（三个时区各跑一次）：
 *   for tz in America/New_York Asia/Shanghai Pacific/Auckland; do TZ=$tz node bjtoday.test.js; done
 *   --mut=local ：用 TK-5 通过快照里的旧写法（本机日期、打开页面时算一次）代替，证明测试能变红；
 *   --mut=once  ：用 I1 第一次返工的写法（北京日期、但打开页面时只算一次；动手前留存的 63f2d112 版）代替，证明跨零点用例会红。
 * 做法：
 *   ① 从 list.js（或变异用的那份）原文里按大括号配对，把整个 initDatePicker 函数原样抽出来执行：
 *      view.find 返回两个假的输入框（记下交给 datetimepicker 的参数），new Date() 用替身返回可控的时刻；
 *      再以 {setOptions: 记录} 为 this 调两个 onShow，模拟「打开选择器」，读出 maxDate / minDate。
 *   ② 在内存里给 bwlistMock.js 源码多导出一个 dateRange（文件本身不改），setNow 固定同一时刻，
 *      取 dateRange({ctime:'month'}).to 和 dateRange({ctime:'week'}).to（都等于「今天」）。
 *   ③ 两边逐条相等，并且等于手算的北京日期；另外验证「开始不晚于结束」两条约束照旧。
 * 安全说明：new Function / eval 只执行本机 SOC 工作副本里我们自己的源码（list.js 的 initDatePicker、bwlistMock.js），
 *   不接任何外部输入，只在本地自测时用，不进 SOC 源码、不进本仓库。
 */
var fs = require('fs');
var mutArg = (process.argv.filter(function (a) { return a.indexOf('--mut=') === 0; })[0] || '').slice(6);
var LIST = {
    '': '/Users/nick/Workspace/ESMCenterST/public/esm/view/processManage/list.js',
    local: '/Users/nick/Workspace/soc-process-ctrl-work/PL-01/pass-snapshot/TK-5/public/esm/view/processManage/list.js',
    once: '/Users/nick/Workspace/soc-process-ctrl-work/PL-01/TK-5/executor/list.js.i1-once'
}[mutArg];
if (!LIST) { throw new Error('不认识的 --mut=' + mutArg); }
var MOCK = '/Users/nick/Workspace/ESMCenterST/public/esm/view/processManage/bwlistMock.js';

// ---- ① 抽出整个 initDatePicker 函数（大括号配对） ----
var src = fs.readFileSync(LIST, 'utf8');
var head = 'initDatePicker: function (view) {';
var a = src.indexOf(head);
if (a < 0) { throw new Error('没找到 initDatePicker'); }
var i = a + head.length - 1, depth = 0, end = -1;
for (; i < src.length; i++) {
    if (src[i] === '{') { depth++; }
    if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
}
var fnText = 'function (view) ' + src.slice(a + head.length - 1, end + 1);
var NOW = { ms: 0 };
var RealDate = Date;
function FakeDate(x) { return arguments.length === 0 ? new RealDate(NOW.ms) : new RealDate(x); }   // new Date() 返回可控时刻
FakeDate.UTC = RealDate.UTC;
FakeDate.now = function () { return NOW.ms; };
var initDatePicker = new Function('Date', 'return ' + fnText + ';')(FakeDate);

/** 假页面：两个输入框，记下 datetimepicker 的参数；open(which) 模拟打开选择器，返回 onShow 里 setOptions 的参数 */
function makePage(fromVal, toVal) {
    function box(v) { return { v: v, opts: null, val: function () { return this.v; }, datetimepicker: function (o) { this.opts = o; } }; }
    var els = { '.js_procm_from': box(fromVal || ''), '.js_procm_to': box(toVal || '') };
    initDatePicker({ find: function (sel) { return els[sel]; } });
    return {
        open: function (which) {
            var got = null;
            els[which === 'from' ? '.js_procm_from' : '.js_procm_to'].opts.onShow.call({ setOptions: function (o) { got = o; } });
            return got;
        }
    };
}

// ---- ② 加载 bwlistMock，内存里多导出 dateRange ----
var msrc = fs.readFileSync(MOCK, 'utf8');
var hook = 'return {\n        install: install,';
if (msrc.split(hook).length !== 2) { throw new Error('mock 导出位置变了'); }
msrc = msrc.replace(hook, 'return {\n        __dateRange: dateRange,\n        install: install,');
var mock;
(function () { var define = function (f) { mock = f(function () {}); }; eval(msrc); })();
function mockToday(ms, ctime) {
    mock.setNow(function () { return new RealDate(ms); });
    return mock.__dateRange({ cfrom: '', cto: '', ctime: ctime }).to;
}

function norm(ymdSlash) {   // 'Y/M/D'（不补零）→ 'YYYY-MM-DD'
    var p = String(ymdSlash).split('/');
    return p[0] + '-' + (Number(p[1]) < 10 ? '0' : '') + Number(p[1]) + '-' + (Number(p[2]) < 10 ? '0' : '') + Number(p[2]);
}
var pass = 0, fail = 0;
function check(name, ok, detail) {
    if (ok) { pass++; } else { fail++; }
    console.log((ok ? 'OK ' : 'XX ') + name + (detail ? ' | ' + detail : ''));
}
/** 在 ms 时刻打开两个选择器：上限（maxDate）都要 = 北京日期 = mock 的 month.to、week.to */
function checkAt(name, page, ms, expect) {
    NOW.ms = ms;
    var f = page.open('from'), t = page.open('to');
    var mm = mockToday(ms, 'month'), mw = mockToday(ms, 'week');
    check(name, /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(f.maxDate) && norm(f.maxDate) === expect && norm(t.maxDate) === expect && mm === expect && mw === expect,
        '开始框上限 ' + f.maxDate + ' 结束框上限 ' + t.maxDate + ' | mock month.to ' + mm + ' week.to ' + mw + ' | 期望 ' + expect);
}

// ---- ③ 固定时刻（绝对时刻，写成 UTC），期望 = 北京日期；每组都是「这一刻打开页面、这一刻打开选择器」 ----
var CASES = [
    ['美东 10-21 22:05（EDT）= 北京 10-22 10:05', Date.UTC(2026, 9, 22, 2, 5), '2026-10-22'],
    ['北京 10-22 07:59 = 美东 10-21 19:59', Date.UTC(2026, 9, 21, 23, 59), '2026-10-22'],
    ['奥克兰 10-22 01:00（NZDT）= 北京 10-21 20:00', Date.UTC(2026, 9, 21, 12, 0), '2026-10-21'],
    ['北京跨月前：10-31 23:59:59', Date.UTC(2026, 9, 31, 15, 59, 59), '2026-10-31'],
    ['北京跨月后：11-01 00:00:00', Date.UTC(2026, 9, 31, 16, 0, 0), '2026-11-01'],
    ['北京跨年前：12-31 23:59:59', Date.UTC(2026, 11, 31, 15, 59, 59), '2026-12-31'],
    ['北京跨年后：2027-01-01 00:00:00', Date.UTC(2026, 11, 31, 16, 0, 0), '2027-01-01'],
    ['北京闰日：2028-02-29 00:30', Date.UTC(2028, 1, 28, 16, 30), '2028-02-29'],
    ['美东冬令时 11-15 11:30（EST）= 北京 11-16 00:30', Date.UTC(2026, 10, 15, 16, 30), '2026-11-16']
];
CASES.forEach(function (c) {
    NOW.ms = c[1];
    checkAt(c[0], makePage(), c[1], c[2]);
});

// 跨北京零点：同一页面北京 10-22 23:59 打开，先在 23:59 打开选择器，再到 10-23 00:01 打开选择器 → 上限变成 10-23
NOW.ms = Date.UTC(2026, 9, 22, 15, 59);
var pg = makePage();
checkAt('跨零点 ①：北京 10-22 23:59 打开页面、打开选择器 → 上限 10-22', pg, Date.UTC(2026, 9, 22, 15, 59), '2026-10-22');
checkAt('跨零点 ②：页面不刷新，北京 10-23 00:01 再打开选择器 → 上限 10-23', pg, Date.UTC(2026, 9, 22, 16, 1), '2026-10-23');

// 约束照旧：结束框有值时，开始框上限 = 结束日期；开始框有值时，结束框下限 = 开始日期；都空时下限 false
NOW.ms = Date.UTC(2026, 9, 22, 2, 5);
var pc = makePage('2026-10-01', '2026-10-20');
var cf = pc.open('from'), ct = pc.open('to');
check('约束：结束框有值 → 开始框上限 = 结束日期 2026/10/20', cf.maxDate === '2026/10/20', JSON.stringify(cf));
check('约束：开始框有值 → 结束框下限 = 开始日期 2026/10/01、上限 = 北京今天', ct.minDate === '2026/10/01' && norm(ct.maxDate) === '2026-10-22', JSON.stringify(ct));
var pe = makePage('', '');
check('约束：开始框空 → 结束框下限 false', pe.open('to').minDate === false);

console.log('TZ=' + (process.env.TZ || '(本机)') + (mutArg ? ' [变异：' + mutArg + ']' : '') + ' 结果 ' + pass + '/' + (pass + fail) + (fail ? ' 有红' : ' 全绿'));
process.exit(fail ? 1 : 0);
