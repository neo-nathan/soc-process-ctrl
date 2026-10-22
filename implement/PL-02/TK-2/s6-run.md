# S-6 执行记录（主 Agent 照 TK-1/tester/browser-cases.md 第 101-226 行跑；Claude in Chrome 标签 88508848）

## 6.0（101 本机 21:23 CST 之后，ssh 只读）
processManage.js 58064f62b0c900d7b1b9e4cf0ef9c08f；layout.html 7f5ccd7ba36d4c7ea36dfbf1c09ec9c1；log.js 1defe5ddc5af6351ddb1688f0ed378ef；list.js ddfe927d9230088ad5ef68dbd0090c78；list.html d34d7edc6b83975d408b7b1401ef7b94；bwlistModal.js bd40efd44a7a42d7c4005e62c447c151；grep -c listModal processManage.js = 0 → 绿

## 6.0c（只读 SQL）
P0 = 35,36,37,38,39,40,41,42,43,60,64；PNAME LIKE '%PL02%' 0 行；RPW_WPROC 9、RPW_BPROC 0、POLICYOBJECT 2464；逐行指纹存 TK-1/tester/db-before-s6-policy-rows.txt（44 行）、db-before-s6-wproc.txt（11 行），policy 指纹与 TK-1 测后 db-after-policy-rows.txt 相同 → 绿

## 6.1
- 整页打开 https://193.168.10.101:10443/Indexinfo/home（新标签）→ 菜单「进程管控」→「概览」
- 片段 F：{"loaded":true,"keys":["container","render","destroy"],"hasListModal":false} → 绿
- 片段 B（B0）：6983
- 页签「日志」→ 高级搜索 → 时间范围「全部」→ 表格 1 行：2026-10-14 14:49:21 a.txt 11111 /opt/BDFZ/ESM/a.txt 王五 193.168.12.25 在黑名单 已拦截（L0），勾选前 chk=false，勾选 → 「加白」→「新建白名单」
- S0（打开态）：{"count":1,"visible":true,"cls":"modal hide in","title":"新建白名单","rows":["* 名单名称：","* 系统类型： Linux/信创","备 注："],"sysText":"Linux/信创","nameVal":"","namePh":"请输入","nameMax":"300","nameOninput":"RsCore.validateXss(this)","descVal":"","descPh":"选填","descMax":"200","descOninput":"RsCore.validateXss(this)","footerBtns":["关闭","确定"],"hasClose":1,"hasBeizhu":true,"hasMiaoshu":false,"btnDataAttr":"195:e2ac61a1","btnJqData":"2:597a9d","btnHandlers":{"self|click.log|":1},"styleSig":["500px","334px","13px"],"textHash":"41:23c5c341","text":"新建白名单 * 名单名称： * 系统类型： Linux/信创 备 注： 关闭 确定"}
- 公共弹窗「关闭」（ref 点击一次未生效，按坐标再点一次关闭）→ 选择白名单弹窗「取消」；两弹窗 visible=false、.modal-backdrop=0；全程未点「确定」「确认」
- 菜单「概览」→ 页签「日志」，不开弹窗，S0c（关闭态）：{"count":1,"visible":false,"cls":"modal hide","title":"新建白名单","rows":["* 名单名称：","* 系统类型： Linux/信创","备 注："],"sysText":"Linux/信创","nameVal":"","namePh":"请输入","nameMax":"300","nameOninput":"RsCore.validateXss(this)","descVal":"","descPh":"选填","descMax":"200","descOninput":"RsCore.validateXss(this)","footerBtns":["关闭","确定"],"hasClose":1,"hasBeizhu":true,"hasMiaoshu":false,"btnDataAttr":"195:e2ac61a1","btnJqData":"2:597a9d","btnHandlers":{"self|click.log|":1},"styleSig":["500px","334px","13px"],"textHash":"41:23c5c341","text":"新建白名单 * 名单名称： * 系统类型： Linux/信创 备 注： 关闭 确定"}
- 从整页打开到记完 S0c 未进白名单 / 黑名单页

## 6.2
- ① 菜单「白名单」→「创建白名单」→ 片段 A：{"visible":true,"title":"创建白名单","rows":["* 白名单名称：","* 系统类型： Linux/信创","描述："],"nameVal":"\"\"","namePh":"示例：办公区终端白名单","descVal":"\"\"","descPh":"选填，说明这条白名单用在哪里、放行什么","sysEditable":0,"sysText":"Linux/信创","footerBtns":["取消","创建"],"nameMax":"100","descMax":"200","hasBeizhu":false}；右上角叉存在（find 命中 button「×」）→ 绿
- ② 名称为空点「创建」（第一次用 ref 点击未生效，截图后按坐标点）：被动探针记到提示「请输入名单名称！」1 条；Procmanager 请求 0 个；弹窗仍开 → 绿
- ③ 名称 PL02测试-S6白、描述 PL02测试S6描述，等提示消失后点「创建」一次：点后立即按钮 disabled=true；3 秒后提示「创建成功。」1 条、弹窗关、遮罩 0、表格出现该名称；网络 createWBList 1 + getWBList 1 → 绿
- ④ SQL：PID 69 / PL02测试-S6白 / PL02测试S6描述 / POLICYTYPE 2 / EPTYPE 2；RPW_WPROC 0、RPW_BPROC 0（公共「确定」按钮上仍留着 6.1 日志页写的参数，名单页没带进来）→ 绿
- ④（续）展开 PL02测试-S6白 行 →「编辑」→ 片段 A：{"visible":true,"title":"编辑白名单","rows":["* 白名单名称：","* 系统类型： Linux/信创","描述："],"nameVal":"\"PL02测试-S6白\"","descVal":"\"PL02测试S6描述\"","sysEditable":0,"sysText":"Linux/信创","footerBtns":["取消","保存"],"nameMax":"100","descMax":"200","hasBeizhu":false} → 绿
- ⑤ 改为 PL02测试-S6白已编辑 / PL02测试S6描述已改，点「保存」一次：提示「修改成功。」1 条、弹窗关、遮罩 0、表格名称更新；网络 editWBList 1 + getWBList 1，createWBList 0 → 绿
- ⑥ SQL：PID 69 PL02测试-S6白已编辑 / PL02测试S6描述已改 / POLICYTYPE 2；名单 PID 集合 = P0 + 69 → 绿
- 6.2b 菜单「黑名单」→「创建黑名单」→ 片段 A：{"visible":true,"title":"创建黑名单","rows":["* 黑名单名称：","* 系统类型： Linux/信创","描述："],"namePh":"示例：挖矿程序黑名单","descPh":"选填，说明这条黑名单用在哪里、拦截什么","sysEditable":0,"footerBtns":["取消","创建"],"nameMax":"100","descMax":"200","hasBeizhu":false} →「取消」，弹窗关、遮罩 0、未提交 → 绿

## 6.3
- 菜单「概览」（未刷新）：B1 = 6983（= B0）；.procm-bwlist 0、#procmListModal 0 → 绿
- 页签「日志」，不开弹窗，S1c：{"count":1,"visible":false,"cls":"modal hide","title":"新建白名单","rows":["* 名单名称：","* 系统类型： Linux/信创","备 注："],"sysText":"Linux/信创","nameVal":"","namePh":"请输入","nameMax":"300","nameOninput":"RsCore.validateXss(this)","descVal":"","descPh":"选填","descMax":"200","descOninput":"RsCore.validateXss(this)","footerBtns":["关闭","确定"],"hasClose":1,"hasBeizhu":true,"hasMiaoshu":false,"btnDataAttr":"195:e2ac61a1","btnJqData":"2:597a9d","btnHandlers":{"self|click.log|":1},"styleSig":["500px","334px","13px"],"textHash":"41:23c5c341","text":"新建白名单 * 名单名称： * 系统类型： Linux/信创 备 注： 关闭 确定"}
- 高级搜索 → 时间范围「全部」→ 同一条 L0（chk=false → 勾选，「当前已选择 1 条记录」）→「加白」→「新建白名单」，S1：{"count":1,"visible":true,"cls":"modal hide in","title":"新建白名单","rows":["* 名单名称：","* 系统类型： Linux/信创","备 注："],"sysText":"Linux/信创","nameVal":"","namePh":"请输入","nameMax":"300","nameOninput":"RsCore.validateXss(this)","descVal":"","descPh":"选填","descMax":"200","descOninput":"RsCore.validateXss(this)","footerBtns":["关闭","确定"],"hasClose":1,"hasBeizhu":true,"hasMiaoshu":false,"btnDataAttr":"195:e2ac61a1","btnJqData":"2:597a9d","btnHandlers":{"self|click.log|":1},"styleSig":["500px","334px","13px"],"textHash":"41:23c5c341","text":"新建白名单 * 名单名称： * 系统类型： Linux/信创 备 注： 关闭 确定"}
- 比较（python 逐字段，跳过 styleSig 单列）：C1 S1c vs S0c 差异字段 []；C2 S1 vs S0 差异字段 []；C3 S0 / S0c / S1 / S1c 静态字段对照 layout.html:591-619 全部一致；C4 styleSig 相等（500px、334px、13px）。比较脚本自证能红：把 S1 标题改坏 + 多挂一个 procmListModal 处理，输出 ['btnHandlers','title'] → C1～C4 绿

## 6.4
- 公共弹窗名称输入 PL02测试-S6日志新建（描述空），网络、控制台清空后点「确定」一次，等 3 秒
- 提示「创建成功。」1 条；控制台 1 条异常：ReferenceError: view is not defined（view/processManage.js 第 32～33 行，即同事版第 33 行 `view.find('#tbClient')`）；公共弹窗、选择名单弹窗都还开着（visible=true、遮罩 2）→ PL-01 F-8 ① 复现，按 Q2 记「已知、交同事」，不判红
- SQL：PL02测试-S6日志新建 恰好 1 行，PID 70、POLICYTYPE 2、EPTYPE 2 → 判定「建成了」：绿
- 只记录不判（同事日志页行为）：这条名单在 RPW_WPROC 里有 1 行（L0 的进程被一起加入）；设计 01 §8.2「「加白」跳过「拦截且原因为在黑名单」的」，L0 是「已拦截 + 在黑名单」，按设计应跳过 → 写进给同事的清单

## 6.5
- 6.4 那一次点击：Procmanager/createWBList 恰好 1 个（无 getWBList，日志页成功回调抛错前没刷新）→ 绿（F-2 反向哨兵）

## 6.6
- 公共弹窗「关闭」一次即关（未刷新）→ 选择名单弹窗「取消」，两弹窗关、遮罩 0
- 菜单「白名单」→「创建白名单」→ 片段 A：与 6.2 ① 完全相同（title 创建白名单；rows ["* 白名单名称：","* 系统类型： Linux/信创","描述："]；白名单占位；footer ["取消","创建"]；nameMax 100、descMax 200；hasBeizhu false）→「取消」→ 绿（未刷新下测得）

## 6.7
- 白名单页展开第 12 行 →「删除」→ 确认弹窗文案「删除白名单 确定删除「PL02测试-S6日志新建」吗？删除后不能恢复。 取消 删除」→「删除」：提示「删除成功。」
- 展开第 11 行 →「删除」→ 确认文案「确定删除「PL02测试-S6白已编辑」吗？删除后不能恢复。」→「删除」：提示「删除成功。」；表格 PL02 行 0、遮罩 0；探针已 disconnect 并删除 window.__pl02probe；标签 88508848 已关
- SQL：① PNAME LIKE '%PL02%' 0 行；② 名单 PID 集合 35-43、60、64 = P0；③ RPW_WPROC / RPW_BPROC 里 BWID IN (69,70) 0 / 0；④ 9 / 0 / 2464 = 6.0c；⑤ diff db-before-s6-policy-rows.txt db-after-s6-policy-rows.txt 无差异、wproc 两份无差异；⑥ 6 个文件 md5 与 6.0 逐个一致 → 绿

## 结论
S-6 第 6.0～6.7 步全部绿（6.4 的 PL-01 F-8 ① 复现按 Q2 记已知）。写库只有 PID 69、70 两条 PL02测试- 名单，都已从名单页正式入口删除。
