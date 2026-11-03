---
name: 101 实测提交类按钮时拦截 RsCore.ajax 要按第一个参数（网址）判断
description: 在 101 页面实测会提交的按钮时，临时替换 RsCore.ajax 拦请求：它的签名是 ajax(url, param, …)，网址是第一个字符串参数，不是对象的 url 字段；点按钮前先确认拦截生效，点完用 performance 资源记录核对没有真发
---

# 101 实测提交类按钮时拦截 RsCore.ajax 要按第一个参数（网址）判断

**场景**：11-03 在 101 白名单页测「应用到组 → 覆盖确认 → 确定」，提交不能真发到后端（共享环境，且 usedGroup 有写库后报错的 bug），于是在页面里临时替换 `RsCore.ajax` 拦下 `Procmanager/usedGroup`。证据见 `changelog/log-20261103-0357-名单页删除与应用到组确认对齐策略中心.md` 04:13 追加段。

**现象 / 坑**：拦截代码写成 `function(o){ if (/usedGroup/.test(o.url)) … }`，但 `RsCore.ajax` 的签名是 `ajax(url, param, callback, complete, error, timeout)`（`ESMCenterST/public/esm/js/core.js`），第一个参数直接是网址字符串，`o.url` 为 undefined，拦截落空，真发了 1 次 usedGroup。所幸提交的组和库里一致，后端算不出增减没写库（只读查 `POLICYOBJECT` 行数、表最后写入时间、`php_errors.log` 核实）。

**结论**：拦 `RsCore.ajax` 一律按 `typeof url === 'string' && /接口名/.test(url)` 判断，参数在第二个；点真正会提交的按钮前先证明拦截生效，点完核对浏览器里没有该接口的网络记录。

**检查清单**：

1. 先读 `core.js` 里 `ajax: function (url, param, …)` 确认签名，再写拦截。
2. 拦截函数把参数存到 `window.__xxxCalls`，返回 `{abort:function(){}}`；保存原函数到 `window.__origAjax`。
3. 点提交后同时核对：`__xxxCalls.length` 等于预期，且 `performance.getEntriesByType('resource')` 里没有新增该接口网址。
4. 测完还原 `RsCore.ajax = window.__origAjax` 并刷新页面。
5. 万一真发了：立刻只读查库、查 `php_errors.log`，确认数据是否变化，如实写进 changelog。
