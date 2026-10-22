// PL-01 TK-3 自测：用 acorn（ecmaVersion 5）解析 list.js，出现 let/const/箭头函数/模板字符串/class 等 ES2015+ 语法就报错
// 用法：node es5check.js <list.js 路径>
var acorn = require('/Users/nick/.pi/agent/npm/node_modules/acorn');
var file = process.argv[2];
var src = require('fs').readFileSync(file, 'utf8');
try {
    acorn.parse(src, { ecmaVersion: 5 });
    console.log('ES5_PARSE_OK ' + file);
} catch (e) {
    console.log('ES5_FAIL ' + file + ' ' + e.message);
    process.exit(1);
}
