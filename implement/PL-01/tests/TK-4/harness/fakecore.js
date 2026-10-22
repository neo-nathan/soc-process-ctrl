/*
 * PL-01 TK-4 本地自测用的假 RsCore（只在自测页面用，不进 SOC 源码）
 * RsCore.ajax 的回调规则照 101 js/core.js:1148-1276：
 *   code=0 → callback(data, code, msg)；code=1 → error + 弹「系统异常」；其他非 0 → error + 弹「错误」（hideMsg 时不弹）；
 *   网络 / HTTP 层失败（__backend.netFailNext）→ 不调 callback、不调 error，只弹提示；
 *   最后都调 complete(req)。回调异步（setTimeout）。
 * 假后端（照 101 controllers/Procmanager.php 的校验和返回文字）：
 *   getWBList（type 2/3）、getBWName、createWBList、editWBList、addProcToBW
 */
(function () {
    var log = window.__ajaxLog = [];       // 每次 RsCore.ajax 调用
    var msgs = window.__msgLog = [];       // 每次弹提示
    window.__errors = [];                  // 页面上没被捕获的脚本错误
    window.addEventListener('error', function (e) {
        window.__errors.push(String(e.message || e));
    });
    var nextPid = 900;
    window.__backend = {
        delay: 20,
        netFailNext: 0,       // >0：下一次 getWBList 按网络层失败处理（core.js 只调 complete）
        failNext: 0,          // >0：下一次 getWBList 返回这个 code
        failCreate: 0,        // >0：下一次 createWBList 返回这个 code
        failEdit: 0,          // >0：下一次 editWBList 返回这个 code
        rows: null
    };
    window.__resetBackend = function () {
        window.__backend.netFailNext = 0;
        window.__backend.failNext = 0;
        window.__backend.failCreate = 0;
        window.__backend.failEdit = 0;
        window.__backend.rows = {
            '2': [
                { PID: '101', PGUID: 'g101', PNAME: 'Web 服务白名单', EPTYPE: '2', POLICYTYPE: '2', CREATEUSER: 'optAdmin', CREATETIME: '2026-09-03 14:05:11', DESCRIPTION: '对外 Web 服务器', SYSTYPE: 'Linux' },
                { PID: '102', PGUID: 'g102', PNAME: '<img src=x onerror="window.__xss=1">名单', EPTYPE: '2', POLICYTYPE: '2', CREATEUSER: 'optAdmin', CREATETIME: '2026-10-18 10:48:02', DESCRIPTION: '<b>粗</b>"引号"', SYSTYPE: 'Linux' },
                { PID: '103', PGUID: 'g103', PNAME: 'test666', EPTYPE: '2', POLICYTYPE: '2', CREATEUSER: 'optAdmin', CREATETIME: '2026-10-20 16:30:45', DESCRIPTION: null, SYSTYPE: 'Linux' },
                { PID: '104', PGUID: 'g104', PNAME: 'win 名单', EPTYPE: '1', POLICYTYPE: '2', CREATEUSER: 'optAdmin', CREATETIME: '2026-10-21 08:00:00', DESCRIPTION: 'w', SYSTYPE: 'Windows' }
            ],
            '3': [
                { PID: '201', PGUID: 'g201', PNAME: '挖矿黑名单', EPTYPE: '2', POLICYTYPE: '3', CREATEUSER: 'optAdmin', CREATETIME: '2026-10-19 11:11:11', DESCRIPTION: 'xmrig', SYSTYPE: 'Linux' }
            ]
        };
    };
    window.__resetBackend();

    function ok(data, msg) {
        return { r: { code: 0, action: 0, msg: msg || '' }, data: data };
    }
    function notice(code, msg) {
        return { r: { code: code, action: 0, msg: msg }, data: '' };
    }
    function findRow(pid) {
        var all = window.__backend.rows['2'].concat(window.__backend.rows['3']);
        for (var i = 0; i < all.length; i++) {
            if (String(all[i].PID) === String(pid)) {
                return all[i];
            }
        }
        return null;
    }
    function backend(url, p) {
        var b = window.__backend;
        if (url === 'Procmanager/getWBList') {
            var t = String(p.type);
            if (t !== '2' && t !== '3') {
                return notice(1, '参数错误。');
            }
            if (b.netFailNext) {
                b.netFailNext = 0;
                return 'NETFAIL';
            }
            if (b.failNext) {
                var c = b.failNext;
                b.failNext = 0;
                return notice(c, '假后端故意失败');
            }
            var rows = JSON.parse(JSON.stringify(b.rows[t]));
            return ok({ rows: rows, total: rows.length });
        }
        if (url === 'Procmanager/getBWName') {
            var lt = String(p.policytype) === '3' ? '3' : '2';
            var names = b.rows[lt].map(function (r) { return { PID: r.PID, PNAME: r.PNAME }; });
            return ok({ rows: names, total: names.length });
        }
        if (url === 'Procmanager/createWBList') {
            // 照 101 createWBListAction 的校验顺序
            if (!p.pname) { return notice(2, '参数错误。'); }
            if (['2', '3'].indexOf(String(p.policytype)) < 0) { return notice(3, '参数错误。'); }
            if (['1', '2'].indexOf(String(p.systype)) < 0) { return notice(4, '参数错误。'); }
            if (b.failCreate) {
                var fc = b.failCreate;
                b.failCreate = 0;
                return notice(fc, '创建失败。');
            }
            var pid = String(++nextPid);
            b.rows[String(p.policytype)].push({ PID: pid, PGUID: 'g' + pid, PNAME: p.pname, EPTYPE: String(p.systype), POLICYTYPE: String(p.policytype), CREATEUSER: 'optAdmin', CREATETIME: '2026-10-21 23:00:00', DESCRIPTION: p.description, SYSTYPE: 'Linux' });
            return ok({ PID: pid, PROC: { SOURCE: p.proclist ? 'list' : 'none' } }, '创建成功。');
        }
        if (url === 'Procmanager/editWBList') {
            // 照 101 editWBListAction
            if (!p.pid || !p.pname) { return notice(2, '参数错误。'); }
            if (b.failEdit) {
                var fe = b.failEdit;
                b.failEdit = 0;
                return notice(fe, '修改失败。');
            }
            var row = findRow(p.pid);
            if (!row) { return notice(3, '名单不存在。'); }
            row.PNAME = p.pname;
            row.DESCRIPTION = p.description;
            return ok('', '修改成功。');
        }
        if (url === 'Procmanager/addProcToBW') {
            return ok({}, '加入成功。');
        }
        return notice(9, '假后端没有这个接口：' + url);
    }
    function showMsg(kind, title, content) {
        msgs.push({ kind: kind, title: title, content: content });
        var box = document.getElementById('fakeMsg');
        if (box) {
            box.textContent = '[' + kind + '] ' + (title || '') + ' ' + (content || '');
        }
    }
    function mk(kind) {
        return function (title, content) {
            showMsg(kind, title, content);
        };
    }
    window.GlobaluserInfo = { RSTOCKEN: 'x', level: 8, name: 'optAdmin', product: {} };
    window.isBM = '0';
    window.RsCore = {
        ajaxPath: '/',
        ajaxList: [],
        cache: { group: { eid: 'E1', list: {} } },
        config: { pageinfo: { processManage: { nav: [{ value: 'overview', name: '概览' }, { value: 'log', name: '日志' }, { value: 'policy', name: '策略' }] } } },
        load: {
            show: function () { window.__loadShow = (window.__loadShow || 0) + 1; },
            hide: function () { window.__loadHide = (window.__loadHide || 0) + 1; }
        },
        msg: { warn: mk('warn'), notice: mk('notice'), success: mk('success'), error: mk('error') },
        validateXss: function (input) {
            input.value = input.value.replace(/[<>&"]/g, '');
        },
        validateUserName: function () {},
        alertBoxDrag: function () {},
        reqTableError: function () {},
        ajaxClean: function () {
            window.__ajaxCleanCalls = (window.__ajaxCleanCalls || 0) + 1;
        },
        assist: {
            params2str: function (obj) {
                var arr = [];
                for (var key in obj) {
                    arr.push(key + '=' + encodeURIComponent(obj[key] === undefined ? '' : obj[key]));
                }
                return arr.join('&');
            },
            str2json: function (str) {
                var o = {};
                if (!str) {
                    return o;
                }
                var arr = str.split('&');
                for (var i = 0; i < arr.length; i++) {
                    var eq = arr[i].indexOf('=');
                    var k = eq < 0 ? arr[i] : arr[i].substring(0, eq);
                    o[k] = eq < 0 ? '' : decodeURIComponent(arr[i].substring(eq + 1));
                }
                return o;
            },
            getUrlSearchQuerys: function () {
                var h = window.location.hash;
                var i = h.indexOf('?');
                return i < 0 ? {} : window.RsCore.assist.str2json(h.substring(i + 1));
            }
        },
        ajax: function (url, param, callback, complete, error) {
            if (arguments.length === 2 && typeof param === 'function') {
                callback = param;
                param = '';
            }
            var p = param || {};
            log.push({ url: url, param: JSON.parse(JSON.stringify(p)), paramType: typeof param });
            setTimeout(function () {
                var json = backend(url, p);
                if (json === 'NETFAIL') {
                    // 照 core.js 的 jQuery error 分支：只弹提示，不调 error 回调
                    showMsg('warn', '系统异常 , 请稍后再试！');
                    if (complete) { complete({ status: 0, statusText: 'error' }); }
                    return;
                }
                var r = json.r;
                if (r.code === 0) {
                    if (callback) { callback(typeof json.data !== 'undefined' ? json.data : json, r.code, r.msg); }
                } else if (r.code === 1) {
                    if (error) { error(json.data, r.code, r.msg); }
                    showMsg('warn', '系统异常,请联系管理员！', r.msg);
                } else {
                    if (error) { error(json.data, r.code, r.msg); }
                    if (!p.hideMsg) {
                        showMsg('warn', '错误', r.msg);
                    }
                }
                if (complete) { complete({ status: 200 }); }
            }, window.__backend.delay);
        }
    };
    window.__originalAjax = window.RsCore.ajax;
})();
