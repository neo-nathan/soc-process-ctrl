// 等价校验：去掉注释后，比较「改前」和「改后」的代码是否完全一样。
// 用法：node strip-equiv.js <改前文件> <改后文件>
// 退出码：0 = 一样；1 = 不一样（打印第一处差异）；2 = 参数错
// 思路：
//   JS  —— 手写一个小词法器，把代码切成记号（标识符、数字、字符串、正则、标点），丢掉注释和空白。
//          字符串、正则里的 // 和 /* 不会被当成注释。
//   CSS —— 去掉字符串外的 /* */ 注释，空白压成一个空格后比较。
//   HTML —— 去掉 <!-- --> 和 mustache 的 {{! }} 注释，空白压成一个空格后比较。
var fs = require('fs');
var path = require('path');

// ---------- JS 词法器 ----------
function jsTokens(src) {
    var toks = [];
    var i = 0, n = src.length;
    // 前一个有效记号，用来判断 / 是除号还是正则开头
    function prevAllowsRegex() {
        if (!toks.length) return true;
        var t = toks[toks.length - 1];
        if (/^[A-Za-z_$][\w$]*$/.test(t)) {
            // 关键字后面跟 / 是正则，普通变量后面跟 / 是除号
            return /^(return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else)$/.test(t);
        }
        if (/^[\d.]/.test(t) || t[0] === '"' || t[0] === "'" || t[0] === '/') return false;
        return !(t === ')' || t === ']' || t === '}');
    }
    while (i < n) {
        var c = src[i], d = src[i + 1];
        if (/\s/.test(c)) { i++; continue; }
        // 行注释
        if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
        // 块注释
        if (c === '/' && d === '*') {
            var e = src.indexOf('*/', i + 2);
            if (e < 0) throw new Error('块注释没有结尾，位置 ' + i);
            i = e + 2; continue;
        }
        // 字符串（ES5 只有单双引号；顺带支持反引号以防万一）
        if (c === '"' || c === "'" || c === '`') {
            var j = i + 1;
            while (j < n && src[j] !== c) { if (src[j] === '\\') j++; j++; }
            toks.push(src.slice(i, j + 1)); i = j + 1; continue;
        }
        // 正则字面量
        if (c === '/' && prevAllowsRegex()) {
            var k = i + 1, inClass = false;
            while (k < n) {
                if (src[k] === '\\') { k += 2; continue; }
                if (src[k] === '[') inClass = true;
                else if (src[k] === ']') inClass = false;
                else if (src[k] === '/' && !inClass) break;
                else if (src[k] === '\n') throw new Error('正则没有结尾，位置 ' + i);
                k++;
            }
            k++;
            while (k < n && /[a-z]/i.test(src[k])) k++; // 标志位 gimsuy
            toks.push(src.slice(i, k)); i = k; continue;
        }
        // 标识符 / 数字
        var m = /^[A-Za-z_$\d.][\w$.]*/.exec(src.slice(i, i + 200));
        if (m && !(c === '.' && !/\d/.test(d))) { toks.push(m[0]); i += m[0].length; continue; }
        // 其余一律按单个标点字符（多字符运算符会被拆开，但前后两边拆法一样，不影响比较）
        toks.push(c); i++;
    }
    return toks;
}

// ---------- CSS ----------
function cssNorm(src) {
    var out = '', i = 0, n = src.length;
    while (i < n) {
        var c = src[i];
        if (c === '/' && src[i + 1] === '*') {
            var e = src.indexOf('*/', i + 2);
            if (e < 0) throw new Error('CSS 注释没有结尾');
            i = e + 2; out += ' '; continue;
        }
        if (c === '"' || c === "'") {
            var j = i + 1;
            while (j < n && src[j] !== c) { if (src[j] === '\\') j++; j++; }
            out += src.slice(i, j + 1); i = j + 1; continue;
        }
        out += c; i++;
    }
    return out.replace(/\s+/g, ' ').trim().split(' ');
}

// ---------- HTML ----------
function htmlNorm(src) {
    return src.replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/\{\{![\s\S]*?\}\}/g, ' ')
        .replace(/\s+/g, ' ').trim().split(' ');
}

function norm(file) {
    var src = fs.readFileSync(file, 'utf8');
    var ext = path.extname(file);
    if (ext === '.js') return jsTokens(src);
    if (ext === '.css') return cssNorm(src);
    if (ext === '.html') return htmlNorm(src);
    throw new Error('不认识的扩展名 ' + ext);
}

var a = process.argv[2], b = process.argv[3];
if (!a || !b) { console.error('用法：node strip-equiv.js <改前> <改后>'); process.exit(2); }
var ta = norm(a), tb = norm(b);
var len = Math.max(ta.length, tb.length);
for (var x = 0; x < len; x++) {
    if (ta[x] !== tb[x]) {
        console.log('DIFF ' + path.basename(b) + ' 第 ' + x + ' 个记号：改前 ' + JSON.stringify(ta.slice(x - 3, x + 3)) + ' / 改后 ' + JSON.stringify(tb.slice(x - 3, x + 3)));
        process.exit(1);
    }
}
console.log('SAME ' + path.basename(b) + '（' + ta.length + ' 个记号）');
