// 在 node 里加载 RequireJS AMD 模块的极简垫片：define(fn) 执行 fn，返回它的导出
var fs = require('fs');
var vm = require('vm');
module.exports = function load(file, globals) {
    var exported;
    var sandbox = Object.assign({
        define: function (fn) { exported = fn(function () { return {}; }); },
        setTimeout: setTimeout, clearTimeout: clearTimeout, console: console
    }, globals || {});
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
    return { mod: exported, sandbox: sandbox };
};
