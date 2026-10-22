# TK-1 Executor 交回原文（2026-10-22 05:5x EDT，主 Agent 从对话转存；self_check、changes 未改字，tests_added 第 1 条中间一段用「……」省略，blocked_questions 只保留问题与读法、去掉了 basis 字段）

## changes
- public/esm/view/processManage/bwlistModal.js：新建。是一个 AMD 模块（RequireJS 的模块写法），只用 ES5，导出 bind、open、release 三个函数。事件委托都挂在页面容器上，命名空间（给事件起的分组名）是 .procmListModal，绑之前先 off 同命名空间。open：按参数重填标题、「X名称：」标签、系统类型文字、两个输入框（用 val 填）、占位和按钮文字（创建/保存）。提交：名称、描述先 $.trim 去首尾空格；名称为空提示「请输入名单名称！」，不发请求。然后调 createWBList（pname、description、policytype、systype）或 editWBList（pid、pname、description）。请求回来前用 ctx.busy 加按钮 disabled 防连点。成功：先弹提示；弹窗还是这一次打开的才关；再调 onSaved。失败不再弹提示，按钮恢复。弹窗的 hidden 事件只认弹窗本身（e.target === this），触发时清上下文。release：弹窗开着就 hide（把 body 上的遮罩一起去掉），解绑事件，忘掉页面容器。文件里不写死任何白/黑文案。note：open 返回 false 的『参数不对』，我定为三种：opts 为空、mode 不是 create/edit、编辑时没有 pid（和 PL-01 listModal 的口径一样，只多了 mode 检查）。系统类型 1→Windows、2→Linux/信创，认不出的显示 --
- public/esm/view/processManage/list.html：在 .procm-bwlist 里、#procmSetGroup 后面新增 #procmListModal。外壳照公共弹窗：class 是 modal hide，宽 500，有 tabindex=-1、data-backdrop=static。去掉了 secondm-hide、alert_drag 和行内 z-index。3 个按钮都是 type=button；右上角叉带 data-dismiss，「取消」不带，由 bwlistModal 绑。名称 maxlength=100，描述 maxlength=200，两个输入框都保留 oninput=RsCore.validateXss(this)。标签改「描述：」，系统类型是文字，元素都用 js_procm_lm_ 开头的类。note：另外顺手改了两处已经说错的注释：文件头第 5-6 行（原来写『编辑复用公共弹窗』），工具栏创建按钮上方第 26 行。计划 §3.1 给 list.html 只写了『新增弹窗』，这两处请裁决，见 blocked_questions 第 2 条
- public/esm/view/processManage/list.js：1. 去掉 var layoutPage = require('processManage')，改成 require('processManage/bwlistModal')。2. TAB_CFG 白、黑两份各加 namePlaceholder、descPlaceholder，文字照计划 §五原文；getCfg 原样传出去。3. init 渲染完 list.html 后调 bwlistModal.bind(view)。4. openListModal 改调 bwlistModal.open，参数在原有基础上加 name、namePlaceholder、descPlaceholder，失败提示文案不变。5. destroy 改调 bwlistModal.release()。6. 注释同步：文件头第四节、openListModal 前的块注释、create/edit 两个 action 的注释、hideModals 注释（写明新弹窗由 release 关）、destroy 的注释。note：查重、token 判断、SYSTYPE_CREATE 这些原有逻辑都没动
- public/esm/css/processManageList.css：没改。note：计划写的是『只在新弹窗显示不对时加样式』，我没有浏览器判断显示对不对，所以一行没动；要不要补交给 Tester 在 101 上看。另外查到：公共弹窗原来的红星 span.import-icon 在全局样式里没有对应规则（只有 index.css:11176 的 .step-box-span .import-icon），新弹窗照外壳复制，星号颜色和原公共弹窗一样，不像 demo 那样是红色

## tests_added
- /Users/nick/Workspace/soc-process-ctrl-work/PL-02/TK-1/executor/bwlistModal.selftest.js：一共 77 项。U1-U14 测 bwlistModal 本身（jQuery 和 bootstrap 2 弹窗用最小替身）……H1-H8 静态检查 list.html 新弹窗的结构和属性；J1-J6 静态检查 list.js 的配置、调用处、完成判据 grep，以及 ES5 红线
- /Users/nick/Workspace/soc-process-ctrl-work/PL-02/TK-1/executor/mut/*.js：6 个变异体，5 个被抓红：去掉 ctx 判断、去掉 busy、去掉 trim、release 不 hide、编辑时留旧值。剩下的 m4（去掉 bind 里第二次 off）是等价变异

## blocked_questions（3 条，主 Agent 裁决见 changelog「TK-1 Executor 交回与裁决」）
1. release() 之后，请求才成功回来，还要不要调 onSaved？读法 A（已实现）：照常调 onSaved，由 list.js 的 token 判断不刷新；读法 B：release 之后连 onSaved 也不调。倾向 A。
2. list.html 里两处说旧做法的注释，我已经顺手改了，保不保留？倾向保留。
3. open 返回 false 的『参数不对』包括哪些？读法一（已实现）：opts 为空、mode 不是 create/edit、编辑时没有 pid；读法二：创建时也检查 policytype、systype。倾向读法一。

## self_check
- reread.solves_original：名单页已经不再 require('processManage')，也不再用公共弹窗或 #addNewListBtn：创建、编辑走自己的 #procmListModal 和 .js_procm_lm_ok，这样同事盖回 processManage.js 不影响名单页，也不会一次点击发两个请求（F-2）。grep 确认 listModal 已没有调用方
- reread.same_class_all_fixed：list.js 里依赖公共弹窗的地方一共 4 处：require、openListModal、destroy、文件头第四节。另外改了 4 处写着『公共弹窗』的注释：openListModal 块注释、create、edit、hideModals 和 destroy 注释。list.html 里 2 处说旧做法的注释也改了。第 15、453 行的『PL-01 TK-4』说的是 tableAjax 补调 error，和弹窗无关，没动
- reread.no_new_problem：新弹窗的选择器都在 #procmListModal 下面，类名用新的 js_procm_lm_ 前缀，不会碰到 list.js 原有的 .js_procm_modal_cancel 等处理。命名空间用 .procmListModal，不和 .procmList 混；destroy 最后的 $c.off() 本来就会全部解绑。弹窗里没有 select，initEvent 里的 selectric 不受影响。TK-5 三个弹窗的逻辑没动。list.html 新增部分没有 {{ }}，mustache 渲染不受影响
- reread.no_over_edit：只改了 list.js、list.html，新建了 bwlistModal.js。CSS、processManage.js、layout.html、core.js、PHP 都没碰（md5 前后一致）。list.html 两处注释属于范围外的顺手修改，已报 blocked_questions 第 2 条
- reread.text_matches_code：逐条对过：bwlistModal 文件头写的三个函数、提交和成功失败的顺序、『这一次打开』的判断方法，都和代码一致。list.html 注释写『取消不带 data-dismiss、叉带』，和标签一致。hideModals 注释写新弹窗由 release 关，和 destroy 的代码一致
- reread.found_and_fixed：文件头注释末尾写成了『；)』，已改成『。）』；define(function () 改成 define(function (require)，和同目录其他模块写法一致；hideModals 原注释『本页开着的弹窗都关掉』加新弹窗后就不准了，改成写明只关 3 个，新弹窗由 release 关
- verify.syntax：node --check public/esm/view/processManage/list.js && node --check public/esm/view/processManage/bwlistModal.js → exit 0
- verify.own_tests：node /Users/nick/Workspace/soc-process-ctrl-work/PL-02/TK-1/executor/bwlistModal.selftest.js → 77/77 全绿。变异测试 6 个里 5 个被抓红，1 个是等价变异
- verify.existing_callers：grep -rn 'listModal' view js（排除 bwlistModal）；grep "require('processManage')" view；grep -nE "layoutPage|addNewList|require\('processManage'\)" list.js bwlistModal.js → listModal 只剩 processManage.js 自己的定义和注释；require('processManage') 0 处；完成判据 grep 0 处（exit=1）
- verify.scope：新出现的只有 ?public/esm/view/processManage/bwlistModal.js（bd40efd4…）。md5 变了的：list.js 00efaceb→ddfe927d，list.html ed7c0bc4→d34d7edc。没变的：processManageList.css 20cbd116、processManage.js a2b0eb10。svn status 里的 Index.php、index2.php 开工前就是 M，没碰
- blocked：跑不了的只有浏览器里的真实显示和交互：弹窗位置、星号颜色、bootstrap 真实的 Esc 和遮罩。按分工由 Tester 在 101 上用 S-1～S-5、S-7 验
