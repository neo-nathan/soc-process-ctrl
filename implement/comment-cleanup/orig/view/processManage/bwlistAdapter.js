/**
 * 进程管控 · 白名单 / 黑名单列表页：真接口 Procmanager/getWBList 的「转换层」（PL-03 TK-1，Q4）
 *
 * 一、它做什么（大白话）
 *   页面内部的查询条件（op.cond）和表格要读的字段，跟 101 后端 getWBList 的参数名、返回字段都不一样。
 *   本模块只做两头翻译，页面其他代码一个字都不用知道后端长什么样：
 *     发请求前：toQuery(type, cond)  页面条件 → 后端参数（见第二节对照表）
 *     拿到结果：toList(rows, cond)   后端每行 → 页面一行（第三节），排序，再做后端做不了的两项筛选（第四节）
 *   ⚠️ 后端参数名、字段名、编号再变（同事还在改，PL-03 R-1），只改本文件，list.js 不动。
 *
 * 二、参数对照（PL-03 §3.1；后端 controllers/Procmanager.php getWBListAction）
 *   页面条件              → 后端参数
 *   type 2 白 / 3 黑      → policytype（原值；后端现版只认这个名字，不再带旧名 type）
 *   systype 1 / 2         → eptype（原值；空就不传）
 *   ctime、cfrom、cto 都空 → timeRange=0（必须显式传：后端缺省是 1 = 只查本周）
 *   ctime week/month/lastmonth（日期都空）→ timeRange 1 / 2 / 3
 *   cfrom 或 cto 不空     → timeRange=0 + begintime=cfrom + endtime=cto（YYYY-MM-DD 原样，后端自己把止日加一天，含当天）
 *   pubstatus 0/1/2/3     → status 1/2/4/3（编号对调：页面 0「--」= 后端 1 空白名单；页面 2 已发布 = 后端 4）
 *   scope 1 / 0           → objrange 1 / 0（原值）
 *   delta add / del       → procstatus 1 / 2（名单里存在「添加」/「移除」状态的进程）
 *   delta none（无变更）   → 不传，前端自己筛（后端 0 的意思是「存在已确认的进程」，不是「无变更」）
 *   kw 名称关键字          → 不传，前端自己筛（后端没有这个条件）
 *   空值（undefined / null / 空串）一律不传 = 不限；数字 0 / 字符串 '0' 不算空（pubstatus=0、scope=0 都是有效条件）。
 *   页面不会给出表外的值；万一给了（比如 ctime='xyz'、pubstatus='9'），这一项按「不限」处理、不往后端传，免得后端报「参数错误」。
 *
 * 三、字段对照（PL-03 §3.2；后端 models/BaseDA/Procmanager.php getWBList）
 *   页面只读下面 6 个补充字段（列、按钮置灰、说明框都靠它们，PL-01 R-3；底部统计 10-23 已从页面去掉），后端其余字段原样保留：
 *     PROCNUM   已发布版本的进程数 = PROCCONFIRMCOUNT（已确认）+ PROCREMOVECOUNT（待移除的还在已发布版本里）
 *               这样「发布后进程数 = PROCNUM + ADDNUM − DELNUM」等于后端 PROCCOUNT（PL-03 R-2：假设后端只把已确认的进程标成移除）
 *               前提：名单进程表里没有 STATUS 为 NULL 的行——后端 PROCCOUNT 把 NULL 也算有效进程，三个分项计数却都不含它；
 *               rpw.sql 里 STATUS 是 NOT NULL，101 库 10-23 实查也是 0 行（若出现，「进程数」列和发布确认里的发布后进程数会少算，设计 12.1 P24 ⑨）
 *     ADDNUM    = PROCADDCOUNT
 *     DELNUM    = PROCREMOVECOUNT（后端移除进程的代码还没写，现在恒为 0，PL-03 F-3）
 *     PUBSTATUS = 后端 STATUS 1/2/3/4 → 0/1/3/2（以后端为准，不按进程数自己推；不在 1～4 的值按 0「--」）
 *     GROUPNUM  = OBJCOUNT（应用了这条名单的分组数）
 *     EPNUM     = 0（后端还没有终端数，PL-03 Q3）
 *   数字一律转整数，缺了或转不了按 0（后端有时把数字给成字符串）。
 *
 * 四、排序与前端筛选（PL-03 Q2、§3.1）
 *   排序：按创建时间升序，同一时间按 PID 升序（照设计 §9.1.2 / demo；后端是 PID 倒序，不用它的）。
 *   筛选：kw（去首尾空格后，名称包含它，不分大小写）、delta=none（ADDNUM = 0 且 DELNUM = 0）。
 *   total = 前端筛选之后的条数。
 *
 * 五、公开导出
 *   toQuery(type, cond) → object         后端参数对象（只含要传的键）
 *   toRow(raw)          → object         页面一行（原字段 + 6 个补充字段）
 *   toList(rawRows, cond) → {rows, total} 逐行 toRow → 排序 → 前端筛选；rawRows 不是数组时按空数组
 *   toProcRow(raw, eptype)               名单进程一行（第六节）
 *   toProcList(rawRows, cond, eptype, now) → {rows, total, all, addN, delN, allRows}  名单进程：转换 → 排序 → 筛选（第六节）
 *
 * 六、名单进程（PL-04 §4.1；后端 showWBList 返回 {rows, total}，每行 ID、PROCPATH、FILEHASH、ALGO、STATUS、CREATETIME）
 *   toProcRow 给每行补这些字段（原字段全保留）：
 *     ID        转整数
 *     PROCPATH  原样（转成字符串）
 *     PROCNAME  路径最后一段：Linux 只按 / 切（Linux 文件名里允许有 \）；Windows（eptype=1）按 \ 和 / 切（PL-04 Q7）
 *     FILEHASH  转小写（库里大多是大写，PL-04 F-4）
 *     ALGO      转整数；ALGOTEXT：0 → MD5、8 → SHA256、其他 →「未知算法」（101 有 5 行测试数据 ALGO=1）
 *     STATE     STATUS 1 → 'new'（新增，还没发布）、2 → 'pending'（已标记移除，还没发布）、其他 → 'normal'
 *     CREATETIME 原样（添加时间，后端是「YYYY-MM-DD HH:mm:ss」）
 *   toProcList：逐行 toProcRow → 排序 → 筛选
 *     排序：新增 → 待移除 → 其余（照 demo）；同一组按添加时间升序，再按 ID 升序（让结果每次一样）
 *     cond = {time, from, to, chg, field, kw}，缺的键按空；几个条件之间是「并且」：
 *       time  '' 全部 / 'week' 本周一~今天 / 'month' 本月 1 日~今天 / 'lastmonth' 上月 1 日~上月最后一天（照 demo RANGE）
 *       from / to  指定日期 YYYY-MM-DD（含首尾两天）；任一不空时忽略 time（两者只取一个，照 demo）
 *         按添加时间的日期部分（前 10 位）比；「今天」取北京日期（后端按 Asia/Shanghai，PL-04 F-10）：
 *         now（毫秒数，给单测注入用；不传取当前时刻）加 8 小时，再用 getUTC* 读年月日，和浏览器在哪个时区无关
 *       chg   '' 全部 / 'new' / 'pending' / 'normal'（= STATE）
 *       field 'path'（默认，进程路径）/ 'hash'（文件哈希）+ kw 关键字：去首尾空格、不分大小写、包含匹配（PL-04 Q6）
 *     返回：rows = 筛选后的行；total = 筛选后条数；all = 筛选前条数；
 *           addN / delN = 筛选前的新增数 / 待移除数（信息条 +N / -M 用）；allRows = 筛选前排好序的全部行（查重、至少保留 1 个用）
 *
 * 写法：RequireJS AMD 模块，只用 ES5（不用 let / const / 箭头函数 / 模板字符串 / Object.assign 等），
 *       不依赖 jQuery，所以能直接在 node 里单测。
 */
define(function () {

    // =====================================================================
    // 对照表（第二、三节）
    // =====================================================================

    /** 页面「时间范围」点选项 → 后端 timeRange */
    var CTIME_TO_RANGE = { week: 1, month: 2, lastmonth: 3 };

    /** 页面发布状态 pubstatus → 后端 status（编号对调） */
    var PUB_TO_STATUS = { '0': 1, '1': 2, '2': 4, '3': 3 };

    /** 后端 STATUS → 页面 PUBSTATUS（上一张表反过来） */
    var STATUS_TO_PUB = { '1': 0, '2': 1, '3': 3, '4': 2 };

    /** 页面「进程变更」delta → 后端 procstatus；none 不在表里（前端自己筛） */
    var DELTA_TO_PROC = { add: 1, del: 2 };

    // =====================================================================
    // 小工具
    // =====================================================================

    /** 浅拷贝：把 src 的自有字段抄到 dst 上（代替 Object.assign） */
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

    /** 去首尾空格后的字符串；undefined / null 当空串 */
    function trim(v) {
        return (v === undefined || v === null) ? '' : String(v).replace(/^\s+|\s+$/g, '');
    }

    /** 从对照表里取值：key 在表里返回对应值，不在返回 undefined（用 hasOwnProperty，免得取到 toString 之类） */
    function pick(map, key) {
        return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
    }

    // =====================================================================
    // 第二节：页面条件 → 后端参数
    // =====================================================================

    /**
     * @param type 名单类型 2 白 / 3 黑（页面配置里的值，原样给 policytype）
     * @param cond 页面条件 op.cond：{systype, ctime, cfrom, cto, pubstatus, scope, delta, kw}，缺的键按空
     * @return 后端参数对象，只含要传的键
     */
    function toQuery(type, cond) {
        var c = cond || {};
        var q = { policytype: type };

        // 系统类型：空 = 全部，不传
        var systype = trim(c.systype);
        if (systype === '1' || systype === '2') {
            q.eptype = toInt(systype);
        }

        // 创建时间：指定日期优先（页面上两者本来互斥），其次快捷项，都没有 = 全部（显式 0）
        var from = trim(c.cfrom);
        var to = trim(c.cto);
        if (from !== '' || to !== '') {
            q.timeRange = 0;
            if (from !== '') {
                q.begintime = from;
            }
            if (to !== '') {
                q.endtime = to;
            }
        } else {
            var range = pick(CTIME_TO_RANGE, trim(c.ctime));
            q.timeRange = (range === undefined) ? 0 : range;
        }

        // 发布状态：页面 0～3 → 后端 1/2/4/3
        var status = pick(PUB_TO_STATUS, trim(c.pubstatus));
        if (status !== undefined) {
            q.status = status;
        }

        // 应用范围：1 / 0 原值（注意 0 是有效条件）
        var scope = trim(c.scope);
        if (scope === '1' || scope === '0') {
            q.objrange = toInt(scope);
        }

        // 进程变更：add / del 交给后端；none 前端筛（见 toList）
        var proc = pick(DELTA_TO_PROC, trim(c.delta));
        if (proc !== undefined) {
            q.procstatus = proc;
        }

        // kw 不传：后端没有关键字查询，前端筛（见 toList）
        return q;
    }

    // =====================================================================
    // 第三节：后端每行 → 页面一行
    // =====================================================================

    /** @param raw 后端返回的一行；@return 新对象：原字段全保留 + 6 个补充字段（整数） */
    function toRow(raw) {
        var r = raw || {};
        var row = extend({}, r);
        var pub = pick(STATUS_TO_PUB, String(toInt(r.STATUS)));
        row.PROCNUM = toInt(r.PROCCONFIRMCOUNT) + toInt(r.PROCREMOVECOUNT);
        row.ADDNUM = toInt(r.PROCADDCOUNT);
        row.DELNUM = toInt(r.PROCREMOVECOUNT);
        row.PUBSTATUS = (pub === undefined) ? 0 : pub;   // 不在 1～4 的值按 0「--」
        row.GROUPNUM = toInt(r.OBJCOUNT);
        row.EPNUM = 0;                                   // 后端还没有终端数（PL-03 Q3）
        return row;
    }

    // =====================================================================
    // 第四节：排序 + 前端筛选
    // =====================================================================

    /** 按创建时间升序；创建时间相同按 PID 升序（让结果每次一样） */
    function byCreateTime(a, b) {
        var ta = String(a.CREATETIME || '');
        var tb = String(b.CREATETIME || '');
        if (ta < tb) {
            return -1;
        }
        if (ta > tb) {
            return 1;
        }
        return toInt(a.PID) - toInt(b.PID);
    }

    /**
     * @param rawRows 后端 data.rows
     * @param cond    页面条件（用它的 kw、delta 做前端筛选）
     * @return {rows, total}，total = 筛选后的条数
     */
    function toList(rawRows, cond) {
        var c = cond || {};
        var list = Object.prototype.toString.call(rawRows) === '[object Array]' ? rawRows : [];
        var kw = trim(c.kw).toLowerCase();
        var onlyNone = trim(c.delta) === 'none';
        var all = [];
        var i;
        for (i = 0; i < list.length; i++) {
            all.push(toRow(list[i]));
        }
        all.sort(byCreateTime);
        var out = [];
        for (i = 0; i < all.length; i++) {
            var row = all[i];
            if (kw !== '' && String(row.PNAME === undefined || row.PNAME === null ? '' : row.PNAME).toLowerCase().indexOf(kw) < 0) {
                continue;   // 名称不含关键字
            }
            if (onlyNone && (row.ADDNUM > 0 || row.DELNUM > 0)) {
                continue;   // 无变更：新增、移除都要是 0
            }
            out.push(row);
        }
        return { rows: out, total: out.length };
    }

    // =====================================================================
    // 第六节：名单进程（PL-04）
    // =====================================================================

    /** 哈希算法编号 → 显示文字（后端 0 = md5、8 = sha256；其他按「未知算法」） */
    var ALGO_TEXT = { '0': 'MD5', '8': 'SHA256' };

    /** 后端进程行 STATUS → 页面状态（1 新增、2 待移除，其余都按普通） */
    var PROC_STATE = { '1': 'new', '2': 'pending' };

    /** 排序时三种状态的先后：新增 → 待移除 → 其余 */
    var STATE_ORDER = { 'new': 0, 'pending': 1, 'normal': 2 };

    /** null / undefined 当空串，其余转字符串（不去空格） */
    function str(v) {
        return (v === undefined || v === null) ? '' : String(v);
    }

    /**
     * 路径最后一段 = 进程名
     * @param path   进程路径
     * @param eptype 系统类型：1 = Windows（按 \ 和 / 切），其他都按 Linux（只按 / 切）
     */
    function procName(path, eptype) {
        var p = trim(path);
        var segs = toInt(eptype) === 1 ? p.split(/[\\\/]/) : p.split('/');
        return trim(segs[segs.length - 1]);
    }

    /** @param raw 后端 showWBList 的一行；@param eptype 名单的系统类型；@return 新对象（原字段 + 补充字段，见第六节） */
    function toProcRow(raw, eptype) {
        var r = raw || {};
        var row = extend({}, r);
        var algo = toInt(r.ALGO);
        var state = pick(PROC_STATE, String(toInt(r.STATUS)));
        row.ID = toInt(r.ID);
        row.STATUS = toInt(r.STATUS);
        row.PROCPATH = str(r.PROCPATH);
        row.PROCNAME = procName(r.PROCPATH, eptype);
        row.FILEHASH = str(r.FILEHASH).toLowerCase();
        row.ALGO = algo;
        row.ALGOTEXT = pick(ALGO_TEXT, String(algo)) || '未知算法';
        row.STATE = state || 'normal';
        row.CREATETIME = str(r.CREATETIME);
        return row;
    }

    /** 排序：先按状态（新增 → 待移除 → 其余），同一状态按添加时间升序，再按 ID 升序 */
    function byProcState(a, b) {
        var d = STATE_ORDER[a.STATE] - STATE_ORDER[b.STATE];
        if (d !== 0) {
            return d;
        }
        if (a.CREATETIME < b.CREATETIME) {
            return -1;
        }
        if (a.CREATETIME > b.CREATETIME) {
            return 1;
        }
        return a.ID - b.ID;
    }

    /** UTC 毫秒数 → 'YYYY-MM-DD'（只用 getUTC*，补零） */
    function ymd(ms) {
        var d = new Date(ms);
        var m = d.getUTCMonth() + 1;
        var day = d.getUTCDate();
        return d.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    }

    /**
     * 时间范围点选项 → [起, 止]（都是 'YYYY-MM-DD'，含首尾）；不认识的值返回 null（= 不限）
     * 「今天」= 北京日期：now 加 8 小时后用 getUTC* 读（北京没有夏令时，固定 UTC+8）
     */
    function timeRange(time, now) {
        var bj = new Date((typeof now === 'number' ? now : new Date().getTime()) + 8 * 3600 * 1000);
        var y = bj.getUTCFullYear();
        var m = bj.getUTCMonth();
        var d = bj.getUTCDate();
        var today = ymd(Date.UTC(y, m, d));
        if (time === 'week') {
            var dow = (bj.getUTCDay() + 6) % 7;   // 周一 = 0 … 周日 = 6
            return [ymd(Date.UTC(y, m, d - dow)), today];
        }
        if (time === 'month') {
            return [ymd(Date.UTC(y, m, 1)), today];
        }
        if (time === 'lastmonth') {
            return [ymd(Date.UTC(y, m - 1, 1)), ymd(Date.UTC(y, m, 0))];   // 本月 0 日 = 上月最后一天
        }
        return null;
    }

    /**
     * @param rawRows 后端 showWBList 的 data.rows（不是数组按空数组）
     * @param cond    {time, from, to, chg, field, kw}（见第六节）
     * @param eptype  名单的系统类型（取进程名用）
     * @param now     当前时刻毫秒数（可省，单测注入）
     */
    function toProcList(rawRows, cond, eptype, now) {
        var c = cond || {};
        var list = Object.prototype.toString.call(rawRows) === '[object Array]' ? rawRows : [];
        var all = [];
        var addN = 0;
        var delN = 0;
        var i;
        for (i = 0; i < list.length; i++) {
            var pr = toProcRow(list[i], eptype);
            if (pr.STATE === 'new') {
                addN++;
            } else if (pr.STATE === 'pending') {
                delN++;
            }
            all.push(pr);
        }
        all.sort(byProcState);

        // 日期条件：指定日期优先，其次点选项
        var from = trim(c.from);
        var to = trim(c.to);
        var range = null;
        if (from === '' && to === '') {
            range = timeRange(trim(c.time), now);
        }
        var chg = trim(c.chg);
        var kw = trim(c.kw).toLowerCase();
        var field = trim(c.field) === 'hash' ? 'FILEHASH' : 'PROCPATH';

        var out = [];
        for (i = 0; i < all.length; i++) {
            var row = all[i];
            var day = row.CREATETIME.slice(0, 10);
            if (chg !== '' && row.STATE !== chg) {
                continue;   // 变化状态不符
            }
            if (range && (day < range[0] || day > range[1])) {
                continue;   // 不在本周 / 本月 / 上月
            }
            if (from !== '' && day < from) {
                continue;   // 早于开始日期
            }
            if (to !== '' && day > to) {
                continue;   // 晚于结束日期
            }
            if (kw !== '' && row[field].toLowerCase().indexOf(kw) < 0) {
                continue;   // 路径 / 哈希不含关键字
            }
            out.push(row);
        }
        return { rows: out, total: out.length, all: all.length, addN: addN, delN: delN, allRows: all };
    }

    return {
        toQuery: toQuery,
        toRow: toRow,
        toList: toList,
        toProcRow: toProcRow,
        toProcList: toProcList
    };
});
