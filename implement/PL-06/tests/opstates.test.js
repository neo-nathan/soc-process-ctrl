// PL-06 TK-4 单测：名单页展开行「发布」「应用到组」按钮能不能点、悬停写什么
// list.js 的 opStates 不对外导出（PL-06 F-10），所以从源码里把 toInt、pubStatus、rowFacts、opStates 四个函数截出来跑。
// 期望值全部按 PL-06 §1.2（规则表）和 §3.1（悬停文字）手写，不从 list.js 里抄。
// 用法：node opstates.test.js <list.js 路径>
var fs = require('fs');
var file = process.argv[2];
var src = fs.readFileSync(file, 'utf8');

// 按「    function 名字(」截到函数结束的「\n    }\n」（list.js 里这四个函数都是 4 格缩进的顶层函数）
function cut(name) {
    var start = src.indexOf('    function ' + name + '(');
    if (start < 0) { throw new Error('源码里找不到函数 ' + name); }
    var end = src.indexOf('\n    }\n', start);
    if (end < 0) { throw new Error('函数 ' + name + ' 找不到结尾'); }
    return src.slice(start, end + 7);
}
var code = ['toInt', 'pubStatus', 'rowFacts', 'opStates'].map(cut).join('\n') + '\nreturn opStates;';
var opStates = new Function(code)();

var pass = 0, fail = 0;
function eq(label, actual, expected) {
    if (actual === expected) { pass++; }
    else { fail++; console.log('FAIL ' + label + '\n   实际: ' + JSON.stringify(actual) + '\n   期望: ' + JSON.stringify(expected)); }
}

// 构造一行：s 发布状态、gc 应用的组数、base 已发布进程数、add 新增、del 待移除
function row(s, gc, base, add, del) {
    return { PUBSTATUS: s, GROUPNUM: gc, EPNUM: gc * 3, PROCNUM: base, ADDNUM: add, DELNUM: del };
}

['白名单', '黑名单'].forEach(function (name) {
    var cases = [
        // [说明, 行, 期望 发布off, 发布tip, 应用到组off, 应用到组tip]
        // ---：两个都灰，悬停不变（§1.2 第 1 行；§3.1「不变」）
        ['--- 没应用', row(0, 0, 0, 0, 0), true, '没有进程，不能发布，请先添加进程', true, '没有进程，先添加并发布'],
        // 待发布：发布可（悬停不变）；应用到组灰，悬停改「先发布，再设置应用范围」（Q-3）
        ['待发布 没应用', row(1, 0, 0, 2, 0), false, '标记为已发布，应用到组后下发', true, '先发布，再设置应用范围'],
        // 下面两组正常操作到不了（没发布过挂不上组），按计划 TK-4「4 种状态 × 已应用 / 没应用」补齐：已应用时发布悬停沿用「发布并自动下发…」
        ['--- 已应用2组', row(0, 2, 0, 0, 0), true, '没有进程，不能发布，请先添加进程', true, '没有进程，先添加并发布'],
        ['待发布 已应用2组', row(1, 2, 0, 2, 0), false, '发布并自动下发到已应用的 2 个组', true, '先发布，再设置应用范围'],
        // 已发布：发布改为可（§1.2）；没应用悬停「应用到组后下发」（Q-2），已应用沿用「发布并自动下发到已应用的 N 个组」
        ['已发布 没应用', row(2, 0, 3, 0, 0), false, '应用到组后下发', false, '选要应用的组，选完自动下发'],
        ['已发布 已应用2组', row(2, 2, 3, 0, 0), false, '发布并自动下发到已应用的 2 个组', false, '修改应用的组，改完自动下发'],
        // 有变更（发布后 > 0）：发布可（不变）；应用到组改为可，悬停同已发布（Q-1）
        ['有变更 没应用', row(3, 0, 3, 1, 1), false, '标记为已发布，应用到组后下发', false, '选要应用的组，选完自动下发'],
        ['有变更 已应用5组', row(3, 5, 3, 1, 0), false, '发布并自动下发到已应用的 5 个组', false, '修改应用的组，改完自动下发'],
        // 有变更且发布后为 0：发布灰（悬停不变）；应用到组也可（F-7）
        ['有变更 发布后0 没应用', row(3, 0, 2, 0, 2), true, '发布后进程数为 0，至少保留 1 个进程；要删除这条' + name + '请直接删除它', false, '选要应用的组，选完自动下发'],
        ['有变更 发布后0 已应用1组', row(3, 1, 2, 0, 2), true, '发布后进程数为 0，至少保留 1 个进程；要删除这条' + name + '请直接删除它', false, '修改应用的组，改完自动下发'],
        // 脏数据（PL-06 F-14 PID 39：STATUS=3 但 0 个进程）：发布灰、应用到组可（R-4，后端会拒）
        ['有变更 0进程脏数据', row(3, 0, 0, 0, 0), true, '发布后进程数为 0，至少保留 1 个进程；要删除这条' + name + '请直接删除它', false, '选要应用的组，选完自动下发'],
        // 不认识的状态按 ---（pubStatus 兜底，行为不变）
        ['状态 9 按 ---', row(9, 0, 3, 0, 0), true, '没有进程，不能发布，请先添加进程', true, '没有进程，先添加并发布']
    ];
    cases.forEach(function (c) {
        var st = opStates(c[1], name);
        var tag = name + ' / ' + c[0];
        eq(tag + ' 发布 off', st.publish.off, c[2]);
        eq(tag + ' 发布 tip', st.publish.tip, c[3]);
        eq(tag + ' 应用到组 off', st.group.off, c[4]);
        eq(tag + ' 应用到组 tip', st.group.tip, c[5]);
        // 编辑、删除任何状态都能点（§1.2「不变」）
        eq(tag + ' 编辑 off', st.edit.off, false);
        eq(tag + ' 删除 off', st.del.off, false);
        eq(tag + ' 进程 off', st.proc.off, false);
    });
});

// 反向哨兵：被删掉的旧悬停一句都不能再出现（PL-06 §3.1 末段）
var oldTips = ['没有变更，不需要发布', '有变更还没发布，先发布再改应用范围', '先发布，只有已发布的'];
[0, 1, 2, 3].forEach(function (s) {
    [0, 2].forEach(function (gc) {
        [0, 2].forEach(function (del) {
            var st = opStates(row(s, gc, 2, 1, del), '白名单');
            oldTips.forEach(function (t) {
                eq('哨兵 s=' + s + ' gc=' + gc + ' del=' + del + ' 不含「' + t + '」',
                    (st.publish.tip + '|' + st.group.tip).indexOf(t) >= 0, false);
            });
        });
    });
});

// 发布成功提示：源码里只剩一个常量「发布成功。」，okMsg 直接返回它（§3.1「发布成功提示」）
eq('TXT_PUBLISH_OK_TO_APPLY 已删除', src.indexOf('TXT_PUBLISH_OK_TO_APPLY') < 0, true);
eq('TXT_PUBLISH_OK = 发布成功。', /var TXT_PUBLISH_OK = '发布成功。';/.test(src), true);
eq('okMsg 固定返回 TXT_PUBLISH_OK', /okMsg: function \(\) \{ return TXT_PUBLISH_OK; \}/.test(src), true);

console.log((fail === 0 ? 'ALL PASS' : 'HAS FAIL') + '  pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
