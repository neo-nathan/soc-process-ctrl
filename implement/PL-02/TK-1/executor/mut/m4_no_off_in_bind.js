/**
 * 进程管控 · 白名单 / 黑名单列表页自带的「创建 / 编辑名单」弹窗（PL-02 TK-1；计划 §四、§五）
 *
 * 一、为什么单独一个文件
 *   PL-01 TK-4 时，名单页的创建 / 编辑借用公共布局 layout.html 里的「新建名单」弹窗，确认逻辑写在公共布局模块
 *   view/processManage.js 里；同事部署时会把那个公共文件盖回他的版本，名单页的创建、编辑随之失效（PL-02 §1.1）。
 *   而且公共弹窗的「确定」按钮由公共布局模块绑定点击处理，名单页若在别处再绑一段，点一次会发两个请求（PL-02 F-2）。
 *   所以 PL-02 改成：弹窗 HTML 放在名单页自己的 list.html 里（#procmListModal），逻辑放在本文件，
 *   名单页不再依赖公共布局模块和公共弹窗（PL-02 Q1）。
 *
 * 二、对外只有 3 个函数（PL-02 §四）
 *   bind($view)  名单页 init 渲染完 list.html 之后调。记下页面容器，在容器上用事件委托绑「取消」「创建 / 保存」、弹窗 hidden，
 *                命名空间 .procmListModal（不与 list.js 的 .procmList 混用）；先 off 同命名空间再绑，重复调用不会重复绑定。
 *   open(opts)   工具栏「创建…」、展开行「编辑」调。按 opts 填好弹窗并显示，返回 true；
 *                弹窗不在页面上（还没 bind、或 list.html 里没有 #procmListModal）或参数不对时返回 false，
 *                由 list.js 提示「弹窗没有加载成功，请刷新页面后重试」。
 *                opts（和 PL-01 TK-4 公共弹窗接口的 open 一致，另加 name、namePlaceholder、descPlaceholder）：
 *                  mode             'create' 创建 / 'edit' 编辑（其他值算参数不对）
 *                  title            弹窗标题，如「创建白名单」「编辑黑名单」（由 list.js 按白 / 黑配置拼好）
 *                  policytype       2 白名单、3 黑名单（创建时传给 createWBList）
 *                  systype          系统类型 1 Windows / 2 Linux/信创：创建时传给 createWBList；弹窗里只显示文字，不能改
 *                  pid              编辑时必填：名单 PID（编辑没有 pid 算参数不对）
 *                  pname、description  编辑时：原名称、原描述（用 val 填进输入框，不当 HTML）
 *                  onSaved          保存成功后调 onSaved(mode, data)，名单页在里面刷新表格（离开本页或白黑切换由 list.js 的 token 判断不刷）
 *                  name             「白名单」/「黑名单」，拼名称标签「白名单名称：」用
 *                  namePlaceholder、descPlaceholder  名称、描述输入框的占位文字（白、黑两份写在 list.js 配置里）
 *                本文件不写死任何白 / 黑文案（PL-02 §五「占位」），白 / 黑文字全部从 opts 来。
 *   release()    名单页 destroy 里调。弹窗开着就关掉（去掉 body 上的遮罩），清掉上下文和页面容器；
 *                之后回来的请求不再动页面（提示照弹，onSaved 照调，由 list.js 的 token 判断不刷新）。
 *
 * 三、页面行为（PL-02 §五）
 *   打开：创建 = 空表单；编辑 = 带出原名称、原描述。每次打开都按本次参数重填（标题、标签、系统类型、两个输入框、占位、按钮文字），不留上次的值。
 *         系统类型只显示文字：创建固定 Linux/信创（list.js 传 systype=2），编辑显示这条名单自己的系统类型。
 *   提交：名称、描述都先去掉首尾空格（$.trim）；名称为空 → 提示「请输入名单名称！」，不关弹窗、不发请求。
 *         创建调 Procmanager/createWBList（pname、description、policytype、systype，不带进程 = 只建名单）；
 *         编辑调 Procmanager/editWBList（pid、pname、description）；请求回来之前「创建 / 保存」按钮置灰，防连点。
 *   成功：弹接口给的提示 → 弹窗还是这一次打开的才关 → 调 onSaved。
 *   失败：core.js 的 RsCore.ajax 已经弹过「错误」+ 原因（PL-01 F-12），这里不再弹；弹窗留着、按钮恢复，可以改了再点或取消。
 *   关闭：取消（本文件绑）、右上角叉（data-dismiss，bootstrap 自己关）、Esc（bootstrap 自己关）都会触发弹窗的 hidden，
 *         hidden 里清掉这一次的上下文。
 *   不做二次认证（PL-01 Q1）。
 *
 * 四、「这一次打开」怎么认
 *   每次 open 新建一个上下文对象 ctx 存进 state.ctx；弹窗关掉、release、重新 bind 时 state.ctx 清空。
 *   请求回来时用「state.ctx === 发请求时的 ctx」判断弹窗还是不是那一次打开的：是才关弹窗、才恢复按钮，
 *   不是（用户已关掉、又打开了另一次、或已离开页面）就不碰弹窗。写法同 list.js 的 submitConfirm（ctx.busy + 按钮 disabled，PL-02 F-6）。
 *
 * 写法：RequireJS AMD 模块（模块名 processManage/bwlistModal），只用 ES5（不用 let / const / 箭头函数 / 模板字符串 / class）。
 */
define(function (require) {   // 写法同目录其他模块；本模块不依赖别的模块（jQuery、RsCore 是页面全局的）
    // =====================================================================
    // 常量
    // =====================================================================

    /** 事件命名空间：本模块在页面容器上绑的事件都带它，off 时只去掉本模块自己的 */
    var NS = '.procmListModal';

    /** 弹窗（在 list.html 里，和发布 / 删除 / 应用到组三个弹窗放在一起） */
    var MODAL_SEL = '#procmListModal';

    /** 弹窗里的元素（都用 js_procm_lm_ 开头的类，lm = list modal） */
    var SEL_TITLE = '.js_procm_lm_title';            // 标题
    var SEL_NAME_LABEL = '.js_procm_lm_name_label';  // 名称标签（「白名单名称：」/「黑名单名称：」）
    var SEL_NAME = '.js_procm_lm_name';              // 名称输入框
    var SEL_SYSTYPE = '.js_procm_lm_systype';        // 系统类型文字
    var SEL_DESC = '.js_procm_lm_desc';              // 描述输入框
    var SEL_CANCEL = '.js_procm_lm_cancel';          // 「取消」按钮
    var SEL_OK = '.js_procm_lm_ok';                  // 「创建」/「保存」按钮

    /** 接口（PL-01 §4.6、PL-02 F-4） */
    var URL_CREATE = 'Procmanager/createWBList';     // 创建：pname、description、policytype、systype
    var URL_EDIT = 'Procmanager/editWBList';         // 编辑：pid、pname、description

    /** 系统类型的显示文字：1 = Windows、2 = Linux/信创（和 list.js 的 EPTYPE_TEXT 一致）；认不出的显示 -- */
    var SYSTYPE_TEXT = { '1': 'Windows', '2': 'Linux/信创' };

    // =====================================================================
    // 模块状态
    // =====================================================================
    var state = {
        $view: null,   // 页面容器（bind 时记下；release 后清空）
        ctx: null      // 这一次打开的上下文 {mode, pid, policytype, systype, onSaved, busy}；弹窗关掉时清空
    };

    // =====================================================================
    // 小工具
    // =====================================================================

    /** null / undefined 当空字符串，其余转成字符串（往 text / val / placeholder 里填用） */
    function str(v) {
        return (v === null || v === undefined) ? '' : String(v);
    }

    /** 系统类型 → 显示文字 */
    function systypeText(v) {
        var t = SYSTYPE_TEXT[str(v)];
        return t ? t : '--';
    }

    /** 取弹窗；还没 bind（或已 release）、或页面上没有这个弹窗时返回空的 jQuery 对象（length = 0） */
    function getModal() {
        return state.$view ? state.$view.find(MODAL_SEL) : $();
    }

    /** 弹窗现在是不是开着（bootstrap 2 的弹窗对象记在 data('modal') 上；没打开过就没有） */
    function isShown($m) {
        var m = $m.data('modal');
        return !!(m && m.isShown);
    }

    // =====================================================================
    // 提交
    // =====================================================================

    /**
     * 点了「创建」/「保存」：检查名称 → 按模式调创建 / 编辑接口（见文件头第三节）
     * ctx 是点按钮这一刻的上下文（先存下来：请求回来之前弹窗可能已经被关掉、上下文被清掉或换成下一次的）
     */
    function submit() {
        var ctx = state.ctx;
        var $m = getModal();
        if (!ctx || ctx.busy || !$m.length) {
            return;   // 没有打开中的弹窗，或上一次请求还没回来（防连点）
        }
        var pname = $.trim(str($m.find(SEL_NAME).val()));
        var desc = $.trim(str($m.find(SEL_DESC).val()));
        if (!pname) {
            RsCore.msg.warn('请输入名单名称！');   // 沿用公共弹窗原来的文案；不关弹窗、不发请求
            return;
        }
        var isEdit = ctx.mode === 'edit';
        // 只传接口约定里的参数：编辑只改名称和描述（设计 01 §8.5）；创建不带进程 = 只建名单（PL-01 §4.6）
        var param = isEdit
            ? { pid: ctx.pid, pname: pname, description: desc }
            : { pname: pname, description: desc, policytype: ctx.policytype, systype: ctx.systype };
        var $ok = $m.find(SEL_OK);
        ctx.busy = true;
        $ok.prop('disabled', true);   // 请求回来之前置灰，防连点（PL-02 F-6）
        RsCore.ajax(isEdit ? URL_EDIT : URL_CREATE, param, function (data, code, msg) {
            // 成功：接口已经做成了，提示照弹（哪怕已经关掉弹窗或离开本页）
            RsCore.msg.success(msg);
            // 弹窗还是这一次打开的才关（关掉会触发 hidden，hidden 里清上下文）
            if (state.ctx === ctx) {
                $m.modal('hide');
            }
            // 通知名单页刷新表格；已离开本页或白黑切换由 list.js 的 token 判断不刷
            if (typeof ctx.onSaved === 'function') {
                ctx.onSaved(ctx.mode, data);
            }
        }, function () {
            // complete：成功、失败、网络层失败都会到这里。
            // 失败时 core.js 已经弹过提示（PL-01 F-12），这里不再弹；还是这一次的弹窗就把按钮恢复，可以改了再点或取消
            ctx.busy = false;
            if (state.ctx === ctx) {
                $ok.prop('disabled', false);
            }
        });
    }

    // =====================================================================
    // 对外的 3 个函数（PL-02 §四）
    // =====================================================================

    /**
     * 记下页面容器并绑事件（事件委托挂在容器上，弹窗随页面重新渲染也不用重绑）
     * 先 off 同命名空间再绑：同一个容器重复调用不会重复绑定；换了容器时旧容器上的也去掉
     */
    function bind($view) {
        if (state.$view) {
            state.$view.off(NS);
        }
        state.ctx = null;   // 页面重新渲染了，弹窗是新的，之前的上下文作废
        state.$view = ($view && $view.length) ? $view : null;
        if (!state.$view) {
            return;
        }
        // 「取消」：关弹窗（关掉会触发 hidden，hidden 里清上下文）
        state.$view.on('click' + NS, MODAL_SEL + ' ' + SEL_CANCEL, function () {
            getModal().modal('hide');
            return false;
        });
        // 「创建」/「保存」
        state.$view.on('click' + NS, MODAL_SEL + ' ' + SEL_OK, function () {
            submit();
            return false;
        });
        // 弹窗关掉（提交成功、取消、叉、Esc 都会触发 hidden）：清掉这一次的上下文；只认弹窗自己的事件（子元素冒上来的不算）
        state.$view.on('hidden' + NS, MODAL_SEL, function (e) {
            if (e.target === this) {
                state.ctx = null;
            }
        });
    }

    /** 按 opts 填好弹窗并显示；返回 true = 打开了，false = 弹窗不在页面上或参数不对（见文件头第二节） */
    function open(opts) {
        var $m = getModal();
        if (!$m.length || !opts) {
            return false;
        }
        var mode = opts.mode;
        if (mode !== 'create' && mode !== 'edit') {
            return false;
        }
        var isEdit = mode === 'edit';
        if (isEdit && !opts.pid) {
            return false;
        }
        // 这一次打开的上下文（请求回来时用它判断弹窗还是不是这一次的，见文件头第四节）
        state.ctx = {
            mode: mode,
            pid: isEdit ? opts.pid : '',
            policytype: opts.policytype,
            systype: opts.systype,
            onSaved: opts.onSaved,
            busy: false
        };
        // 每次都按本次参数重填，不留上次的值；全部用 text / val / attr 填，用户数据不会当成 HTML 解析
        $m.find(SEL_TITLE).text(str(opts.title));
        $m.find(SEL_NAME_LABEL).text(str(opts.name) + '名称：');                 // 「白名单名称：」/「黑名单名称：」（红星在标签前面单独一个 span）
        $m.find(SEL_SYSTYPE).text(systypeText(opts.systype));                    // 只显示文字，不能改
        $m.find(SEL_NAME).val(isEdit ? str(opts.pname) : '').attr('placeholder', str(opts.namePlaceholder));
        $m.find(SEL_DESC).val(isEdit ? str(opts.description) : '').attr('placeholder', str(opts.descPlaceholder));
        $m.find(SEL_OK).text(isEdit ? '保存' : '创建').prop('disabled', false);  // 创建时「创建」、编辑时「保存」（PL-02 §五「按钮」）
        $m.modal('show');
        return true;
    }

    /** 离开页面时收尾：弹窗开着就关掉（去掉 body 上的遮罩），清掉上下文、解绑本模块的事件、忘掉页面容器 */
    function release() {
        var $m = getModal();
        state.ctx = null;   // 先清：之后回来的请求认不出这一次，不再碰弹窗和按钮
        if ($m.length && isShown($m)) {
            $m.modal('hide');   // bootstrap 2：关弹窗时把加在 body 上的遮罩一起去掉
        }
        if (state.$view) {
            state.$view.off(NS);
        }
        state.ctx = null;   // hide 触发的 hidden 也会清，这里再清一次兜底
        state.$view = null;
    }

    return {
        bind: bind,
        open: open,
        release: release
    };
});
