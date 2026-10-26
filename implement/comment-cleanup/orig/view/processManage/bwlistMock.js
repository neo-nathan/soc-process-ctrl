/**
 * 进程管控 · 白名单 / 黑名单列表页的 mock 模块（前端自己模拟的假接口）
 *
 * 依据：PL-01 §四（mock 接口约定）、PL-03 §3.3（列表切真接口后 mock 收窄）、设计文档 01 §9.1；后端完成后整个删掉。
 *
 * ⚠️ 10-23 起已停用（ENABLED = false）：应用到组切到了真接口——取已选组 Policycenter/getUsedGroupId、
 *   提交 Procmanager/usedGroup（见 list.js 的 URL_USED_GROUP / URL_SET_GROUPS）。下面拦的 2 个旧地址后端从来没有，
 *   开关关着时 install() 什么都不做，本模块不再起作用；等真接口跑稳后，连同 list.js 里的 install / remember / uninstall 调用一起删。
 *
 * 一、它做什么（大白话）
 *   名单页打开时调 install()，本模块临时「包一层」全局的 RsCore.ajax：
 *   只拦下面 2 个地址，其他请求原样交给原来的 RsCore.ajax，一个字不改；
 *   离开名单页（destroy）时调 uninstall()，把 RsCore.ajax 还原成原来的函数。
 *     1. Procmanager/getWBListUsedGroupId  应用到组：取已选组（PL-01 §4.4，分组树组件内部会调）
 *     2. Procmanager/setWBListGroups       应用到组：提交勾选的组（PL-01 §4.5；后端真接口叫 usedGroup，北京 10-23 09:44 起已实现、要已发布才能改，名字和参数待统一，还没接）
 *   名单列表 getWBList 从 PL-03 起不再拦，直接走真接口（参数、字段的转换在同目录 bwlistAdapter.js）；
 *   创建、编辑、删除（createWBList / editWBList / delWBList）也不拦，走真接口。
 *   发布从 10-23 起也不拦：名单页直接调后端真接口 Procmanager/releaseWBList（原来 mock 的 publishWBList 已删，
 *   成功提示的两种文字也挪到 list.js 的 publishOkMsg）。
 *
 * 二、开关
 *   ENABLED  true = 用 mock；后端完成后改成 false，install() 什么都不做，上面 2 个请求直接走真接口。
 *   （PL-01 时的 MODE='fake' 全假数据模式已在 PL-03 删除：列表不再被拦，它已无从生效。）
 *
 * 三、应用到组怎么判断（PL-03 Q1，用户拍板「方案 1」）
 *   名单页每次拿到列表，调 remember(type, rows) 把「转换后的真实行」交给本模块记下（按类型、按 PID，替换上一次的）。
 *   应用到组就用记下的这一行判断能不能做；**成功只返回提示，不记内存、不改列表**
 *   （列表永远只显示后端的真实数据，PL-03 R-4）。
 *
 * 四、返回格式和真后端一样（PL-01 F-12，core.js 的 RsCore.ajax）
 *   后端返回 {r:{code, action, msg}, data}：
 *     code = 0       → 调成功回调 callback(data, code, msg)
 *     code = 1       → 调 error(data, code, msg)，并弹「系统异常,请联系管理员！」+ msg
 *     其他非 0 code  → 调 error(data, code, msg)，并弹「错误」+ msg（参数里带 hideMsg 时不弹）
 *   不管成功失败，最后都调 complete(req)。本模块对拦下的请求照这个规则处理，
 *   所以调用方的写法和调真接口完全一样。
 *   ⚠️ 回调是「异步」的（setTimeout 0 之后才调），和真接口一样，不会在 RsCore.ajax 返回之前执行。
 *   本模块自己造的错误 code：2 = 参数错误，3 = 名单不存在，4 = 当前状态不允许（应用到组）。
 *
 * 五、公开导出（define 返回的对象）—— 签名和用途
 *   install()            → boolean  包装 RsCore.ajax。ENABLED 为 false、或页面上没有 RsCore.ajax 时什么都不做，返回 false；
 *                                   已经包过一次时不会再包第二层，直接返回 true（离开页面再回来不会叠两层，PL-01 R-2、S-11）。
 *                                   本模块的包装被别的代码在外面又包了一层、uninstall 没能还原时（见下面 uninstall），
 *                                   install 什么都不改，返回 false：不能把那个外层当成原函数存起来，否则放行的请求会无限递归；
 *                                   这时本模块的包装仍在链条里，照常拦截 2 个地址。外层拆掉之后 uninstall / install 恢复正常。
 *   uninstall()          → boolean  把 RsCore.ajax 还原成 install() 之前的原函数；还原了返回 true，本来就没包返回 false。
 *                                   不清 remember 记下的行（离开页面再回来，列表会重新取、重新记）。
 *                                   如果别的代码在本模块之后又包了一层 RsCore.ajax（现在没有这种代码），这里不去动它，返回 false。
 *   isInstalled()        → boolean  RsCore.ajax 现在是不是被本模块包着。
 *   isEnabled()          → boolean  读开关 ENABLED。
 *   setEnabled(bool)     → void     改开关（测试 / 演示用），只影响之后的 install()，不会自动卸载已装的包装。
 *   remember(type, rows) → void     记下最近一次列表的行（type 2 白 / 3 黑；rows = bwlistAdapter 转换后的行，至少要有
 *                                   PID、PUBSTATUS）。替换这一类上一次记的；
 *                                   type 不是 2 / 3 时不记；rows 不是数组时按空数组（= 这一类一条都不认）。
 *   reset()              → void     清空 remember 记下的行（测试用，相当于整页刷新）。
 *   URLS                 → string[] 被拦截的 2 个地址（副本，改它不影响模块）。
 *   MSG                  → object   成功提示文字：只剩 APPLY（PL-01 §4.5，设计 8.8 第 12 条；发布的两种挪到 list.js）。
 *
 * 六、2 个地址的入参、出参（调用方式和真接口一样：RsCore.ajax(url, param, callback, complete, error)）
 *   ⚠️ 这 2 个地址的 param 必须传「对象」（如 {pid: 60, policytype: 2}）。真的 RsCore.ajax 也接受 'pid=60&policytype=2' 这种
 *      拼好的字符串，但本模块只从对象里读参数，传字符串会被当成没传参数（返回参数错误）。
 *   getWBListUsedGroupId 入参 pid、productid、eptype（分组树组件固定这样发）。
 *                        出参 data = {aUsedGroupId: [], aLockGroupId: []}：一律为空（mock 不再记组）。
 *   setWBListGroups      入参 pid、policytype、aObjId（勾选的全部组）。只有「已发布」能做（设计 7.5）；成功 data = ''，msg = MSG.APPLY，不记组。
 *   提交应用到组要求这条名单在 remember 记下的、同一类型的行里；否则返回 code 3「名单不存在。」。
 *
 * 写法：RequireJS AMD 模块，只用 ES5（不用 let / const / 箭头函数 / 模板字符串 / Object.assign 等）。
 */
define(function (require) {

    // =====================================================================
    // 开关
    // =====================================================================

    /** 总开关：true 用 mock；后端接口完成后改成 false，页面直接走真接口，业务代码不改 */
    var ENABLED = false;   // 10-23 应用到组切真接口后关掉；不要再改回 true（拦的 2 个旧地址已不是页面用的地址）

    // =====================================================================
    // 常量
    // =====================================================================

    /** 被拦截的 2 个地址（PL-01 §4.4、§4.5）；其他地址（含名单列表 getWBList、发布 releaseWBList）一律原样放行 */
    var URL_USED_GROUP = 'Procmanager/getWBListUsedGroupId';
    var URL_SET_GROUPS = 'Procmanager/setWBListGroups';
    var URLS = [URL_USED_GROUP, URL_SET_GROUPS];

    /** 成功提示文字（PL-01 §4.5；设计 8.8 第 12 条：不说「立即」） */
    var MSG = {
        APPLY: '应用成功，组内终端下次心跳（默认 5 分钟内）生效'           // 应用到组成功
    };

    /** 本模块自己造的错误码（和后端 notice($msg, code) 一样走 core.js 的分支） */
    var CODE_PARAM = 2;      // 参数错误
    var CODE_NOT_FOUND = 3;  // 名单不存在（照后端 editWBListAction 的 notice('名单不存在。', 3)）
    var CODE_STATE = 4;      // 当前状态不允许（应用到组）

    // =====================================================================
    // 模块内部状态
    // =====================================================================

    /** install() 之前的原始 RsCore.ajax；没装时为 null */
    var originalAjax = null;

    /**
     * remember() 记下的最近一次列表行：rows[type][pid] = 那一行（type 是 '2' / '3'，pid 是字符串）。
     * 只读不改：应用到组成功后也不动它（PL-03 Q1）。
     */
    var rows = { '2': {}, '3': {} };

    // =====================================================================
    // 小工具（ES5 手写，不依赖 jQuery，方便在 node 里自测）
    // =====================================================================

    /** 浅拷贝：把 src 的自有字段抄到 dst 上，返回 dst（代替 Object.assign） */
    function extend(dst, src) {
        if (src) {
            for (var k in src) {
                if (Object.prototype.hasOwnProperty.call(src, k)) {
                    dst[k] = src[k];
                }
            }
        }
        return dst;
    }

    /** 转整数，转不了按 0 */
    function toInt(v) {
        var n = parseInt(v, 10);
        return isNaN(n) ? 0 : n;
    }

    /** 空值判断：undefined / null / 空串（去掉首尾空格后）算空；数字 0 不算空 */
    function isEmpty(v) {
        return v === undefined || v === null || String(v).replace(/^\s+|\s+$/g, '') === '';
    }

    /** PID 是否合法：纯数字且大于 0（照后端 editWBList / delWBList 的校验） */
    function isValidPid(pid) {
        return !isEmpty(pid) && /^\d+$/.test(String(pid)) && toInt(pid) > 0;
    }

    /** 名单类型是否合法：2 白 / 3 黑 */
    function isValidType(t) {
        return !isEmpty(t) && (String(t) === '2' || String(t) === '3');
    }

    /**
     * 按「类型 + PID」取记下的真实行；没有返回 null。
     * 返回的是一份副本里的几个数（都转成整数），判断时不会改到记下的原行。
     */
    function findRow(type, pid) {
        var map = rows[String(type)];
        var r = map ? map[String(toInt(pid))] : null;
        if (!r) {
            return null;
        }
        return {
            PUBSTATUS: toInt(r.PUBSTATUS)   // 应用到组只看发布状态（发布切真接口后，进程数、组数不再用）
        };
    }

    /** 记下最近一次列表的行（导出 remember，签名见文件头第五节） */
    function remember(type, list) {
        if (!isValidType(type)) {
            return;
        }
        var map = {};
        if (Object.prototype.toString.call(list) === '[object Array]') {
            for (var i = 0; i < list.length; i++) {
                var r = list[i];
                if (r && isValidPid(r.PID)) {
                    map[String(toInt(r.PID))] = r;
                }
            }
        }
        rows[String(type)] = map;
    }

    // =====================================================================
    // 返回结果：照 core.js RsCore.ajax 的 success 分支分发（PL-01 F-12）
    // =====================================================================

    /** 拼一个和后端一样的返回包 {r:{code, action, msg}, data} */
    function makeJson(code, msg, data) {
        return { r: { code: code, action: 0, msg: msg }, data: data };
    }

    /**
     * 按 code 调回调、弹提示（照抄 core.js ajax 的 success 里 code 0、1、default 三个分支）
     * ⚠️ core.js 的 RsCore.msg.warn 里面用 this.run(...) 弹框，必须以 RsCore.msg.warn(...) 的形式调用（this = RsCore.msg）；
     *    PL-01 时这里把 warn 取出来裸调，this 丢了，弹框直接报「this.run is not a function」——提示弹不出来，
     *    后面的 complete 回调也被这个报错打断（PL-03 实测发现，已改成下面带 this 的写法）。
     */
    function dispatch(json, p, callback, error) {
        var r = json.r;
        var core = (typeof RsCore !== 'undefined') ? RsCore : null;
        var warn = (core && core.msg && typeof core.msg.warn === 'function')
            ? function () { return core.msg.warn.apply(core.msg, arguments); }
            : null;
        if (r.code === 0) {
            if (typeof callback === 'function') {
                callback(typeof json.data !== 'undefined' ? json.data : json, r.code, r.msg);
            }
        } else if (r.code === 1) {
            if (typeof error === 'function') {
                error(json.data, r.code, r.msg);
            }
            if (warn) {
                if (r.action === 0) {
                    warn('系统异常,请联系管理员！', r.msg);
                } else if (r.action === 1) {
                    warn(r.msg);
                }
            }
        } else {
            if (typeof error === 'function') {
                error(json.data, r.code, r.msg);
            }
            if (warn && !p.hideMsg) {
                warn('错误', r.msg);
            }
        }
    }

    /** 把请求句柄登记到 RsCore.ajaxList，切页面时 RsCore.ajaxClean() 能统一取消（和真请求一样） */
    function pushAjaxList(handle) {
        if (typeof RsCore !== 'undefined' && RsCore && Object.prototype.toString.call(RsCore.ajaxList) === '[object Array]') {
            RsCore.ajaxList.push(handle);
        }
    }

    /**
     * 本地返回（不发网络请求）：setTimeout 0 之后按 code 分发，再调 complete。
     * 返回一个带 abort() 的句柄：在回调执行前 abort，就不再调成功 / 失败回调，只调 complete（和 jQuery 取消请求一样）。
     */
    function respondLater(json, p, callback, complete, error) {
        var finished = false;
        var req = { isMock: true, readyState: 4, status: 200, statusText: 'success', responseJSON: json };
        var timer = null;
        var handle = {
            isMock: true,
            abort: function () {
                if (finished) {
                    return;
                }
                finished = true;
                clearTimeout(timer);
                req.status = 0;
                req.statusText = 'abort';
                if (typeof complete === 'function') {
                    complete(req);
                }
            }
        };
        timer = setTimeout(function () {
            if (finished) {
                return;
            }
            finished = true;
            dispatch(json, p, callback, error);
            if (typeof complete === 'function') {
                complete(req);
            }
        }, 0);
        pushAjaxList(handle);
        return handle;
    }

    // =====================================================================
    // 2 个地址的处理
    // =====================================================================

    /** 1. 应用到组：取已选组 Procmanager/getWBListUsedGroupId（PL-01 §4.4；格式同 Policycenter/getUsedGroupId）：一律为空 */
    function handleUsedGroup(p, callback, complete, error) {
        if (isEmpty(p.pid)) {
            return respondLater(makeJson(CODE_PARAM, '参数错误。', null), p, callback, complete, error);
        }
        return respondLater(makeJson(0, '', { aUsedGroupId: [], aLockGroupId: [] }), p, callback, complete, error);
    }

    /** 2. 应用到组：提交 Procmanager/setWBListGroups（PL-01 §4.5；设计 7.5：只有已发布能改）：只校验、不记组 */
    function handleSetGroups(p, callback, complete, error) {
        if (!isValidPid(p.pid) || !isValidType(p.policytype)) {
            return respondLater(makeJson(CODE_PARAM, '参数错误。', null), p, callback, complete, error);
        }
        var f = findRow(p.policytype, p.pid);
        if (!f) {
            return respondLater(makeJson(CODE_NOT_FOUND, '名单不存在。', null), p, callback, complete, error);
        }
        if (f.PUBSTATUS !== 2) {
            // 文案照设计 7.2 / demo 的置灰原因
            var why = f.PUBSTATUS === 0 ? '还没有进程，先添加进程并发布。'
                : (f.PUBSTATUS === 1 ? '先发布，只有已发布的名单才能应用到组。'
                    : '有变更还没发布，先点「发布」再改应用范围。');
            return respondLater(makeJson(CODE_STATE, why, null), p, callback, complete, error);
        }
        return respondLater(makeJson(0, MSG.APPLY, ''), p, callback, complete, error);
    }

    /** 地址是不是要拦的那 2 个（去掉开头的 /，不分大小写；不是就返回 ''） */
    function matchUrl(url) {
        if (typeof url !== 'string') {
            return '';
        }
        var u = url.replace(/^\/+/, '').toLowerCase();
        for (var i = 0; i < URLS.length; i++) {
            if (URLS[i].toLowerCase() === u) {
                return URLS[i];
            }
        }
        return '';
    }

    /**
     * 包装后的 RsCore.ajax：参数和原函数一样 (url, param, callback, complete, error, timeout)。
     * 不是那 2 个地址：原样交给原函数（参数一个不改）。
     */
    function wrappedAjax(url, param, callback, complete, error, timeout) {
        // 已经 uninstall 了、但有人手里还留着这个包装函数的引用：一律交给现在的 RsCore.ajax（即原函数），不再拦截
        if (!originalAjax) {
            return RsCore.ajax.apply(RsCore, arguments);
        }
        var name = matchUrl(url);
        if (!name) {
            return originalAjax.apply(this, arguments);
        }
        // 照原函数：只传两个参数且第二个是函数时，它就是成功回调
        if (arguments.length === 2 && typeof param === 'function') {
            callback = param;
            param = '';
        }
        var p = (param && typeof param === 'object') ? param : {};
        if (name === URL_USED_GROUP) {
            return handleUsedGroup(p, callback, complete, error);
        }
        return handleSetGroups(p, callback, complete, error);
    }
    wrappedAjax.__bwlistMock = true;   // 标记：RsCore.ajax 现在是本模块的包装

    // =====================================================================
    // 安装 / 卸载
    // =====================================================================

    /** RsCore.ajax 现在是不是本模块的包装 */
    function isInstalled() {
        return typeof RsCore !== 'undefined' && !!RsCore && RsCore.ajax === wrappedAjax;
    }

    /** 包装 RsCore.ajax；已包过不再包第二层 */
    function install() {
        if (!ENABLED) {
            return false;
        }
        if (typeof RsCore === 'undefined' || !RsCore || typeof RsCore.ajax !== 'function') {
            return false;
        }
        if (RsCore.ajax === wrappedAjax) {
            return true;   // 已经装过（例如离开页面没卸载就又进来了），不叠第二层
        }
        if (originalAjax) {
            // 本模块的包装还在别人的链条里（别的代码在本模块之后又包了一层，uninstall 没能还原）：
            // 这时现在的 RsCore.ajax 是别人的外层，里面还调着本模块的包装。
            // 绝不能把这个外层当成「原函数」存起来，否则放行的请求会 外层 → 本模块 → 外层 … 无限递归。
            // 所以什么都不改，返回 false；本模块的包装仍在链条里照常拦截 2 个地址。
            return false;
        }
        originalAjax = RsCore.ajax;
        RsCore.ajax = wrappedAjax;
        return true;
    }

    /** 还原 RsCore.ajax */
    function uninstall() {
        if (!isInstalled() || !originalAjax) {
            return false;
        }
        RsCore.ajax = originalAjax;
        originalAjax = null;
        return true;
    }

    // =====================================================================
    // 公开导出（签名见文件头第五节）
    // =====================================================================
    return {
        install: install,
        uninstall: uninstall,
        isInstalled: isInstalled,
        isEnabled: function () {
            return ENABLED;
        },
        setEnabled: function (on) {
            ENABLED = !!on;
        },
        remember: remember,
        reset: function () {
            rows = { '2': {}, '3': {} };
        },
        URLS: URLS.slice(),
        MSG: extend({}, MSG)
    };
});
