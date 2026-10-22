# PL-01 TK-1 验收结果

合计 166 条：PASS 161，FAIL 5

| 编号 | 断言 | 依据 | 结果 | 详情 |
|---|---|---|---|---|
| J1 | 正文 Procbwlist 残留 = 0（反向哨兵） | PL-01 §六 TK-1 | PASS |  |
| J1b | 改前 HEAD 含 Procbwlist 的行数 = 18（计划 §3.2 ① 的前提） | PL-01 §3.2 ①「Procbwlist/*（18 行）」 | PASS |  |
| J2.getProcList | 正文旧设计名 getProcList 残留 = 0（反向哨兵） | PL-01 F-16 | PASS |  |
| J2.getProcReportTerminals | 正文旧设计名 getProcReportTerminals 残留 = 0（反向哨兵） | PL-01 F-16 | PASS |  |
| J2.getProcInLists | 正文旧设计名 getProcInLists 残留 = 0（反向哨兵） | PL-01 F-16 | PASS |  |
| J2.getLists | 正文旧设计名 getLists 残留 = 0（反向哨兵） | PL-01 F-16 | PASS |  |
| J2.getSimpleLists | 正文旧设计名 getSimpleLists 残留 = 0（反向哨兵） | PL-01 F-16 | PASS |  |
| J2.addList | 正文旧设计名 addList 残留 = 0（反向哨兵） | PL-01 F-16 | PASS |  |
| J2.editList | 正文旧设计名 editList 残留 = 0（反向哨兵） | PL-01 F-16 | PASS |  |
| J2.delList | 正文旧设计名 delList 残留 = 0（反向哨兵） | PL-01 F-16 | PASS |  |
| J2.getListProcs | 正文旧设计名 getListProcs 残留 = 0（反向哨兵） | PL-01 F-16 | PASS |  |
| J2.addListProc | 正文旧设计名 addListProc 残留 = 0（反向哨兵） | PL-01 F-16 | PASS |  |
| J2.addProcsToLists | 正文旧设计名 addProcsToLists 残留 = 0（反向哨兵） | PL-01 F-16 | PASS |  |
| J2.publishList | 正文旧设计名 publishList 残留 = 0（反向哨兵） | PL-01 F-16 | PASS |  |
| J2.getListUsedGroupId | 正文旧设计名 getListUsedGroupId 残留 = 0（反向哨兵） | PL-01 F-16 | PASS |  |
| J2.setListGroups | 正文旧设计名 setListGroups 残留 = 0（反向哨兵） | PL-01 F-16 | PASS |  |
| J2.removeListProc | 正文旧设计名 removeListProc 残留 = 0（反向哨兵） | PL-01 F-16 | PASS |  |
| J2.restoreListProc | 正文旧设计名 restoreListProc 残留 = 0（反向哨兵） | PL-01 F-16 | PASS |  |
| J2.file | 正文无 Procbwlist.php | PL-01 §3.2 ①（14.1） | PASS |  |
| J2.in9.procManager | 第 9 节接口表含 procManager | PL-01 F-16 / §四 | PASS |  |
| J2.in9.procEpList | 第 9 节接口表含 procEpList | PL-01 F-16 / §四 | PASS |  |
| J2.in9.procWBList | 第 9 节接口表含 procWBList | PL-01 F-16 / §四 | PASS |  |
| J2.in9.getWBList | 第 9 节接口表含 getWBList | PL-01 F-16 / §四 | PASS |  |
| J2.in9.getBWName | 第 9 节接口表含 getBWName | PL-01 F-16 / §四 | PASS |  |
| J2.in9.createWBList | 第 9 节接口表含 createWBList | PL-01 F-16 / §四 | PASS |  |
| J2.in9.editWBList | 第 9 节接口表含 editWBList | PL-01 F-16 / §四 | PASS |  |
| J2.in9.delWBList | 第 9 节接口表含 delWBList | PL-01 F-16 / §四 | PASS |  |
| J2.in9.showWBList | 第 9 节接口表含 showWBList | PL-01 F-16 / §四 | PASS |  |
| J2.in9.addProcToWBList | 第 9 节接口表含 addProcToWBList | PL-01 F-16 / §四 | PASS |  |
| J2.in9.addProcToBW | 第 9 节接口表含 addProcToBW | PL-01 F-16 / §四 | PASS |  |
| J2.in9.addWByWhere | 第 9 节接口表含 addWByWhere | PL-01 F-16 / §四 | PASS |  |
| J2.in9.publishWBList | 第 9 节接口表含 publishWBList | PL-01 F-16 / §四 | PASS |  |
| J2.in9.getWBListUsedGroupId | 第 9 节接口表含 getWBListUsedGroupId | PL-01 F-16 / §四 | PASS |  |
| J2.in9.setWBListGroups | 第 9 节接口表含 setWBListGroups | PL-01 F-16 / §四 | PASS |  |
| J2.tbd | 第 9 节对移除、恢复标「待后端定名」/「待后端定」 | PL-01 F-16 影响列「后 2 个…标「待后端定名」」 | PASS |  |
| J2.101count | 101 控制器 Action 总数 = 15 | PL-01 F-16「读 101 controllers/Procmanager.php 全部 15 个 Action」 | PASS |  |
| J2.101.procManager | procManager 是 101 Action 且 101 ACL 角色 = [2,8]（文档现状列据此写「ACL 登记为 [2,8]，要改为 8m」） | PL-01 F-4 / F-16；01 第 9 节表格 | PASS |  |
| J2.101.procEpList | procEpList 是 101 Action 且 101 ACL 角色 = [2,8]（文档现状列据此写「ACL 登记为 [2,8]，要改为 8m」） | PL-01 F-4 / F-16；01 第 9 节表格 | PASS |  |
| J2.101.procWBList | procWBList 是 101 Action 且 101 ACL 角色 = [2,8]（文档现状列据此写「ACL 登记为 [2,8]，要改为 8m」） | PL-01 F-4 / F-16；01 第 9 节表格 | PASS |  |
| J2.101.getWBList | getWBList 是 101 Action 且 101 ACL 角色 = [2,8]（文档现状列据此写「ACL 登记为 [2,8]，要改为 8m」） | PL-01 F-4 / F-16；01 第 9 节表格 | PASS |  |
| J2.101.getBWName | getBWName 是 101 Action 且 101 ACL 角色 = [2,8]（文档现状列据此写「ACL 登记为 [2,8]，要改为 8m」） | PL-01 F-4 / F-16；01 第 9 节表格 | PASS |  |
| J2.101.createWBList | createWBList 是 101 Action 且 101 ACL 角色 = [2,8]（文档现状列据此写「ACL 登记为 [2,8]，要改为 8m」） | PL-01 F-4 / F-16；01 第 9 节表格 | PASS |  |
| J2.101.editWBList | editWBList 是 101 Action 且 101 ACL 角色 = [2,8]（文档现状列据此写「ACL 登记为 [2,8]，要改为 8m」） | PL-01 F-4 / F-16；01 第 9 节表格 | PASS |  |
| J2.101.delWBList | delWBList 是 101 Action 且 101 ACL 角色 = [2,8]（文档现状列据此写「ACL 登记为 [2,8]，要改为 8m」） | PL-01 F-4 / F-16；01 第 9 节表格 | PASS |  |
| J2.101.showWBList | showWBList 是 101 Action 且 101 ACL 角色 = [2,8]（文档现状列据此写「ACL 登记为 [2,8]，要改为 8m」） | PL-01 F-4 / F-16；01 第 9 节表格 | PASS |  |
| J2.101.addProcToWBList | addProcToWBList 是 101 Action 且 101 ACL 角色 = [2,8]（文档现状列据此写「ACL 登记为 [2,8]，要改为 8m」） | PL-01 F-4 / F-16；01 第 9 节表格 | PASS |  |
| J2.101.addProcToBW | addProcToBW 是 101 Action 且 101 ACL 角色 = [2,8]（文档现状列据此写「ACL 登记为 [2,8]，要改为 8m」） | PL-01 F-4 / F-16；01 第 9 节表格 | PASS |  |
| J2.101.addWByWhere | addWByWhere 是 101 Action 且 101 ACL 角色 = [2,8]（文档现状列据此写「ACL 登记为 [2,8]，要改为 8m」） | PL-01 F-4 / F-16；01 第 9 节表格 | PASS |  |
| J2.101no.publishWBList | publishWBList 在 101 上不存在（建议名） | PL-01 F-16「101 还没有」 | PASS |  |
| J2.101no.getWBListUsedGroupId | getWBListUsedGroupId 在 101 上不存在（建议名） | PL-01 F-16「101 还没有」 | PASS |  |
| J2.101no.setWBListGroups | setWBListGroups 在 101 上不存在（建议名） | PL-01 F-16「101 还没有」 | PASS |  |
| J2.map.getProcList | 接口表 getProcList → procManager 用途一致（「进程管理聚合列表」） | PL-01 F-16 | PASS |  |
| J2.map.getProcReportTerminals | 接口表 getProcReportTerminals → procEpList 用途一致（「某规则上报过的终端」） | PL-01 F-16 | PASS |  |
| J2.map.getProcInLists | 接口表 getProcInLists → procWBList 用途一致（「某规则所在的名单」） | PL-01 F-16 | PASS |  |
| J2.map.getLists | 接口表 getLists → getWBList 用途一致（「名单列表（参数 type=2/3）」） | PL-01 F-16 | PASS |  |
| J2.map.getSimpleLists | 接口表 getSimpleLists → getBWName 用途一致（「加白 / 加黑弹窗用的名单下拉」） | PL-01 F-16 | PASS |  |
| J2.map.addList | 接口表 addList → createWBList 用途一致（「新建 / 改名称描述 / 删除」） | PL-01 F-16 | PASS |  |
| J2.map.publishList | 接口表 publishList → publishWBList 用途一致（「发布」） | PL-01 F-16 | PASS |  |
| J2.map.getListUsedGroupId | 接口表 getListUsedGroupId → getWBListUsedGroupId 用途一致（「应用到组弹窗：取已应用的组（返回格式同 `Pol」） | PL-01 F-16 | PASS |  |
| J2.map.setListGroups | 接口表 setListGroups → setWBListGroups 用途一致（「应用到组：提交勾选的全部组，后端算差集，自动替换」） | PL-01 F-16 | PASS |  |
| J2.map.getListProcs | 接口表 getListProcs → showWBList 用途一致（「名单里的进程」） | PL-01 F-16 | PASS |  |
| J2.map.addListProc | 接口表 addListProc → addProcToWBList 用途一致（「手动添加 / 移除 / 恢复」） | PL-01 F-16 | PASS |  |
| J2.map.split | addProcsToLists 拆成 addProcToBW（规则键/日志 ID）+ addWByWhere（按条件） | PL-01 F-16「addProcToBW（按进程列表）+ addWByWhere（按查询条件）」 | **FAIL** | addProcToBW=\| `Procmanager/addProcToBW` \| 从进程管理、日志批量加入（按规则键、按日志 ID 两种入参，8.2、8.4） \| 8m \| 101 已有，ACL 登记为 `['2','8']`，要改为 8m；101 现在只收进程列表（规则键），8.2 要的按日志 ID 入参还没有，见 12.1 P23 \| \| addWByWhere=\| `Procmanager/addWByWhere` \| 进程管理页按搜索条件加白（后端按当前筛选条件重新查询，8.4） \| 8m \| 101 已有，ACL 登记为 `['2','8']`，要改为 8m \ |
| J2.del | 正文「前端没调用」= 0（反向哨兵，3.2 与第 9 节两处） | PL-01 §3.2 ①；F-16 | PASS |  |
| J2.pmrow | 第 9 节 procManager 行是「进程管理聚合列表」且不是「删除」 | PL-01 F-16「101 上它就是进程管理列表」 | PASS |  |
| J2.s21 | 2.1 组件图：Procmanager 包含名单，不再有独立名单控制器 | PL-01 §3.2 ① 2.1；Q4「统一放 Procmanager/*」 | PASS |  |
| J2.s82 | 8.2 接口行含 Procmanager/addProcToBW | PL-01 §3.2 ① 8.2；F-16 | PASS |  |
| J2.s84 | 8.4 接口行 = procManager、procEpList、procWBList、addProcToBW、addWByWhere | PL-01 §3.2 ① 8.4；F-16 | PASS |  |
| J2.s75 | 7.5 分组树 url = Procmanager/getWBListUsedGroupId，提交 = Procmanager/setWBListGroups | PL-01 §3.2 ① 7.5；§四 4.4/4.5 | PASS |  |
| J2.s141 | 14.1 新控制器只写 Procmanager.php | PL-01 §3.2 ① 14.1；Q4 | PASS |  |
| J2.s74 | 7.4 伪代码函数名 = publishWBList | PL-01 F-16 / §四 4.3 建议名 | PASS |  |
| J2.i2.neg | 正文不再有旧写法「ACL 已登记（['2','8']）」（反向哨兵） | 01 §4.2 ③；核准 I2 | PASS |  |
| J2.i2.rows | 第 9 节每个「101 已有」的行都写「ACL 登记为 ['2','8']，要改为 8m」（共 10 行） | 01 §4.2 ③；核准 I2 | PASS |  |
| J2.i2.role | 「101 已有」各行的角色列 = 8m | 01 §4.2 ③ | PASS |  |
| J2.i2.32 | 3.2 ACL 行的处理里有「procManager … 改为 8m」 | 01 §4.2 ③；核准 I2 | PASS |  |
| J2.i1.row | addProcToBW 行现状：101 只收进程列表，按日志 ID 入参还没有 | PL-01 F-16；核准 I1 | PASS |  |
| J2.i1.82 | 8.2「**后端只接收日志 ID**」原句仍在，且 8.2 除接口行外与改前逐字相同（反向回归） | 核准 I1「8.2 正文不改」 | **FAIL** |  |
| J2.i1.101 | 101 副本 addProcToBW 的入参是 proclist（进程列表），没有日志 ID 入参 | PL-01 F-16「addProcToBW（按进程列表）」 | PASS |  |
| J3 | 正文 3304/3305 = 0（反向哨兵） | PL-01 §六 TK-1 | PASS |  |
| J3b | 改前 HEAD 含 3304/3305 的行数 = 7（计划 §3.2 ② 的前提） | PL-01 §3.2 ②「（7 行）」 | PASS |  |
| J3.use3303 | 第 9 节写明「名单操作沿用 3303」 | PL-01 Q6「名单操作沿用 101 现用的 3303」 | PASS |  |
| J3.table | 第 9 节功能码表只剩 6001、3303 两行 | PL-01 §3.2 ②「删掉 3304、3305 的分工」 | PASS |  |
| J3.name | 3303 名称格含「名称待定」，去掉括注后仍是改前的「进程管控-策略」 | 用户答复「暂不定，作为待问项交后端」；核准 B1/S3 | PASS |  |
| J3.3303scope | 3303 行覆盖名单的新建/编辑/删除/发布/应用到组/名单内进程增删/批量加入 | PL-01 Q6；F-17 | PASS |  |
| J3.f17 | 第 9 节保留补登记：operlog.js 模块数组 ['6001','3303']、名称表、Export.php 导出名称表、operlog.html | PL-01 §3.2 ②「保留并改写「operlog.js、Export.php 补登记」的要求（F-17）」 | PASS |  |
| J3.f17_141 | 14.1 operlog.js、Export.php 两条都改为「加 3303」 | PL-01 §3.2 ②；F-17 | PASS |  |
| J3.101.createWBList | 101 createWBList 记 3303 | PL-01 F-17「名单的创建、编辑、删除、添加名单进程都记 3303」 | PASS |  |
| J3.101.editWBList | 101 editWBList 记 3303 | PL-01 F-17「名单的创建、编辑、删除、添加名单进程都记 3303」 | PASS |  |
| J3.101.delWBList | 101 delWBList 记 3303 | PL-01 F-17「名单的创建、编辑、删除、添加名单进程都记 3303」 | PASS |  |
| J3.101.addProcToWBList | 101 addProcToWBList 记 3303 | PL-01 F-17「名单的创建、编辑、删除、添加名单进程都记 3303」 | PASS |  |
| J3.101.addProcToBW | 101 addProcToBW 记 3303 | PL-01 F-17「名单的创建、编辑、删除、添加名单进程都记 3303」 | PASS |  |
| J3.101.addWByWhere | 101 addWByWhere 记 3303 | PL-01 F-17「名单的创建、编辑、删除、添加名单进程都记 3303」 | PASS |  |
| J3.101exp | 101 Export.php:1135 是 '6001'=>'进程管控-概览'（文档写「101 的 Export.php:1135」） | PL-01 F-17（计划写 :1133，按 101 副本实测） | PASS |  |
| J3.101opl | 101 operlog.js:234 只有 6001（文档写「101 上也一样」） | PL-01 F-17 | PASS |  |
| J4b | 改前 HEAD 含「二次认证」的行数 = 16（计划 §3.2 ③ 的前提） | PL-01 §3.2 ③「16 处「二次认证」逐处判断」 | PASS |  |
| J4.L163@64 | 第 163 行（2.3）「二次认证」名单相关：表达不做 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.L163@70 | 第 163 行（2.3）「checkToken」名单相关：表达不做 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.L528@193 | 第 528 行（6.3）「二次认证」进程策略/现有代码：属已知非名单上下文 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.L551@195 | 第 551 行（6.4）「二次认证」进程策略/现有代码：属已知非名单上下文 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.L674@2 | 第 674 行（7.5）「二次认证」名单相关：表达不做 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.L685@99 | 第 685 行（7.5）「二次认证」名单相关：表达不做 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.L924@65 | 第 924 行（8.3）「二次认证」进程策略/现有代码：属已知非名单上下文 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.L1021@4 | 第 1021 行（9）「二次认证」名单相关：表达不做 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.L1021@12 | 第 1021 行（9）「checkToken」名单相关：表达不做 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.L1021@96 | 第 1021 行（9）「checkToken」名单相关：表达不做 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.L1021@168 | 第 1021 行（9）「二次认证」进程策略/现有代码：属已知非名单上下文 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.L1314@32 | 第 1314 行（13）「checkToken」进程策略/现有代码：属已知非名单上下文 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.L1314@44 | 第 1314 行（13）「二次认证」进程策略/现有代码：属已知非名单上下文 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.L1314@92 | 第 1314 行（13）「二次认证」进程策略/现有代码：属已知非名单上下文 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.L1316@56 | 第 1316 行（13）「二次认证」进程策略/现有代码：属已知非名单上下文 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.L1316@128 | 第 1316 行（13）「二次认证」名单相关：表达不做 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.L1316@166 | 第 1316 行（13）「二次认证」名单相关：表达不做 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.L1350@133 | 第 1350 行（14.1）「二次认证」名单相关：表达不做 | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.neg.需二次认证 | 正文不再出现「需二次认证」（反向哨兵） | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.neg.showAuthModal | 正文不再出现「showAuthModal」（反向哨兵） | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.neg.提交前弹二次认证 | 正文不再出现「提交前弹二次认证」（反向哨兵） | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.neg.二次认证 → | 正文不再出现「二次认证 →」（反向哨兵） | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.neg.名单照这个惯例 | 正文不再出现「名单照这个惯例」（反向哨兵） | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.neg.照 `strategy/index.js:660-675` 的 `setGroup` 分支 | 正文不再出现「照 `strategy/index.js:660-675` 的 `setGroup` 分支」（反向哨兵） | PL-01 §3.2 ③；Q1 | PASS |  |
| J4.7.4 | 7.4 无二次认证 / checkToken 步骤（反向哨兵） | PL-01 §3.2 ③（发布、删除不做） | PASS |  |
| J4.7.6 | 7.6 无二次认证 / checkToken 步骤（反向哨兵） | PL-01 §3.2 ③（发布、删除不做） | PASS |  |
| J4.9rule | 第 9 节总规则点名「新建、编辑、删除、发布、应用到组」都不做 | PL-01 Q1「名单的新建、编辑、删除、发布、应用到组都不做」 | PASS |  |
| J4.keep | 6.3 / 8.3 进程策略仍「自带二次认证」（回归） | PL-01 Q1 只定名单；01 6.3、8.3 | PASS |  |
| J5.pos | 9.1 存在且位于第 9 节内（## 9 与 ## 10 之间） | PL-01 §3.2 ④ | PASS |  |
| J5.title | 9.1 标题 =「名单接口约定（前端 mock 依据）」 | PL-01 §3.2 ④ | PASS |  |
| J5.same | 9.1 正文与 PL-01 §四 一致（允许的改写之外零差异） | PL-01 §3.2 ④「= 本计划 §四」 | PASS |  |
| J5.acl | 9.1 末句：角色写 8m，并注明 101 现有登记 ['2','8']（用户口径） | 主 Agent 转达用户答复「按设计写 8m，注明 101 现状」；01 §4.2 ③ | PASS |  |
| J5.intro | 9.1 开头说明：9.1.6 末句角色写 8m，与 PL-01 §四 4.6 不同 | 核准 S2；01 §4.2 ③ | PASS |  |
| J5.four | 9.1 点到 4 个被拦截地址 getWBList / publishWBList / getWBListUsedGroupId / setWBListGroups | PL-01 §四 4.1～4.5 | PASS |  |
| J6.added | 12.1 恰好新增 2 行（F-6 一行 + F-17 一行），原有各行逐字不变 | PL-01 R-4；§3.2 ⑤；主 Agent 08:19 内审第 1 轮核准 B1 | PASS |  |
| J6.f17 | F-17 那一行：审计日志页筛不出 3303、要补登记（operlog.js / Export.php），3303 名称待定 | PL-01 R-4、F-17；用户答复「暂不定，作为待问项交后端」 | PASS |  |
| J6.f17.i1 | F-17 那一行带上「101 的 addProcToBW 只收进程列表、没有按日志 ID 的入参」 | PL-01 F-16「addProcToBW（按进程列表）」；主 Agent 08:19 核准 I1 | PASS |  |
| J6.three | 新增项含三处分歧：STATUS 存名单类型 / 名单用 PROCM 产品号 / 名称可重名 | PL-01 §3.2 ⑤；F-6 ①②③ | PASS |  |
| J6.nochange | 新增项写明「设计正文暂不改」 | PL-01 §3.2 ⑤「设计正文暂不改」 | PASS |  |
| J6.count | 12.1 标题项数 = 表格行数 | 文档自洽（12.1 标题计数） | PASS |  |
| J6.keep.5.2 | 5.2 与改前逐字相同（F-6 分歧不改正文） | PL-01 §3.2 ⑤「设计正文暂不改」 | PASS |  |
| J6.keep.7.1 | 7.1 与改前逐字相同（F-6 分歧不改正文） | PL-01 §3.2 ⑤「设计正文暂不改」 | PASS |  |
| J6.keep.8.5 | 8.5 与改前逐字相同（F-6 分歧不改正文） | PL-01 §3.2 ⑤「设计正文暂不改」 | **FAIL** |  |
| J6.keep.K3 | K3 行与改前逐字相同 | PL-01 §3.2 ⑤「设计正文暂不改」 | PASS |  |
| J6.keep.K4 | K4 行与改前逐字相同 | PL-01 §3.2 ⑤「设计正文暂不改」 | PASS |  |
| J6.keep.C5 | C5 行与改前逐字相同 | PL-01 §3.2 ⑤「设计正文暂不改」 | PASS |  |
| J7.one | 版本记录新增 1 条，原有各条不变 | PL-01 §3.2 ⑥「版本记录加一条」 | **FAIL** | 2 |
| J7.cover | 新增条覆盖接口名、3303、二次认证、9.1、12.1 新项 | PL-01 §3.2 ①～⑤ | PASS |  |
| J7.cover2 | 新增条同步提到 P22、P23、3303 名称待定、8m | 主 Agent 08:19 内审第 1 轮核准（B1/S3、I2、版本记录同步） | PASS |  |
| J7.claim.2.1 | 版本记录声称同步的 2.1 确有改动 | 01 版本记录 10-21 补充条（自洽） | PASS |  |
| J7.claim.3.2 | 版本记录声称同步的 3.2 确有改动 | 01 版本记录 10-21 补充条（自洽） | PASS |  |
| J7.claim.4.2 | 版本记录声称同步的 4.2 确有改动 | 01 版本记录 10-21 补充条（自洽） | PASS |  |
| J7.claim.5.3 | 版本记录声称同步的 5.3 确有改动 | 01 版本记录 10-21 补充条（自洽） | PASS |  |
| J7.claim.7.4 | 版本记录声称同步的 7.4 确有改动 | 01 版本记录 10-21 补充条（自洽） | PASS |  |
| J7.claim.7.5 | 版本记录声称同步的 7.5 确有改动 | 01 版本记录 10-21 补充条（自洽） | PASS |  |
| J7.claim.8.2 | 版本记录声称同步的 8.2 确有改动 | 01 版本记录 10-21 补充条（自洽） | PASS |  |
| J7.claim.8.4 | 版本记录声称同步的 8.4 确有改动 | 01 版本记录 10-21 补充条（自洽） | PASS |  |
| J7.claim.9 | 版本记录声称同步的 9 确有改动 | 01 版本记录 10-21 补充条（自洽） | PASS |  |
| J7.claim.11.1 | 版本记录声称同步的 11.1 确有改动 | 01 版本记录 10-21 补充条（自洽） | PASS |  |
| J7.claim.13 | 版本记录声称同步的 13 确有改动 | 01 版本记录 10-21 补充条（自洽） | PASS |  |
| J7.claim.14.1 | 版本记录声称同步的 14.1 确有改动 | 01 版本记录 10-21 补充条（自洽） | PASS |  |
| J7.claim.2.3 | 版本记录声称同步的 2.3 确有改动 | 01 版本记录 10-21 补充条（自洽） | PASS |  |
| J7.claim.7.6 | 版本记录声称同步的 7.6 确有改动 | 01 版本记录 10-21 补充条（自洽） | PASS |  |
| J7.claim.12.1 | 版本记录声称同步的 12.1 确有改动 | 01 版本记录 10-21 补充条（自洽） | PASS |  |
| J7.claim.0 | 版本记录声称同步的 0 确有改动 | 01 版本记录 10-21 补充条（自洽） | PASS |  |
| J8.scope | 改动只落在条款覆盖表列出的章节（+ 第 0 节，I3） | TASK_SPEC 落到本 TK 的设计条款；主 Agent 08:19 内审第 1 轮核准 I3 | **FAIL** | ['12.2', '5.8', '8.5', '8.6', '8.8'] |
| J8.s0 | 第 0 节只新增一句（指向 P22/P23、找后端开发），其他行逐字不变 | 主 Agent 08:19 内审第 1 轮核准 I3 | PASS |  |
| J8.s13 | 第 13 节只改了第 19 条 | TASK_SPEC「§13(第 19 条)」 | PASS |  |
| J9.changelog | .claude/scripts/gen-index.py changelog --check 退出码 0 | PL-01 §六 TK-1「生成器、检查脚本通过」 | PASS |  |
| J9.insights | .claude/scripts/gen-index.py insights --check 退出码 0 | PL-01 §六 TK-1「生成器、检查脚本通过」 | PASS |  |
| J9.status | .claude/skills/update-current-status/scripts/check_current_status.py CurrentStatus.md 退出码 0 | PL-01 §六 TK-1「生成器、检查脚本通过」 | PASS |  |

## 正文每一处「二次认证 / checkToken」逐处判定

| 行 | 章节 | 判定 | 结论 | 原文（截断） |
|---|---|---|---|---|
| 163 | 2.3 | 名单相关 | OK | … 用户名判断（ACL `8m`）、level 10 的 `jsonGroup`、二次认证 `checkToken`（只用于进程策略，沿用策略中心自带的；名单不做，第 9… |
| 163 | 2.3 | 名单相关 | OK | …（ACL `8m`）、level 10 的 `jsonGroup`、二次认证 `checkToken`（只用于进程策略，沿用策略中心自带的；名单不做，第 9 节） \| ACL 登记… |
| 528 | 6.3 | 进程策略/现有代码 | OK | …sCore.editPolicy`（`core.js:1865-1901`，自带二次认证），直接沿用。注意口径：X 是这条策略关联的组数，Y 是**直接分配**到终端的… |
| 551 | 6.4 | 进程策略/现有代码 | OK | …**已有**的同类项，子组缓存里原来没有 PROCM 项时什么都不更新；后端不做二次认证 \| 加 4.2 第 ④ 道门；PROCM 改为调公共的「重建组缓存」函数（7.… |
| 674 | 7.5 | 名单相关 | OK | …- 二次认证：不做（项目负责人 10-21 定：名单的新建、编辑、删除、发布、应用到组都不做… |
| 685 | 7.5 | 名单相关 | OK | …ager/setWBListGroups`（101 还没有，建议名，9.1；不做二次认证） \|… |
| 924 | 8.3 | 进程策略/现有代码 | OK | …骨架已实现），确认后调 `Policycenter/editPolicy`（自带二次认证）。demo 把按钮写成「保存并下发到当前组（含子组）」、旁边写「立即下发到某组… |
| 1021 | 9 | 名单相关 | OK | …- **二次认证**（`checkToken`，提交前再输一次口令）：**名单的接口都不做**（… |
| 1021 | 9 | 名单相关 | OK | …- **二次认证**（`checkToken`，提交前再输一次口令）：**名单的接口都不做**（项目负责人 10-21 定）… |
| 1021 | 9 | 名单相关 | OK | …-21 定）。名单的新建、编辑、删除、发布、应用到组都不弹口令框，后端也不调 `checkToken`；名单进程的添加、移除、恢复和批量加入也不认证。进程策略不受影响：在策略中心、… |
| 1021 | 9 | 进程策略/现有代码 | OK | …认证。进程策略不受影响：在策略中心、概览→策略页签改进程策略，仍走策略中心自带的二次认证（6.3、8.3）；… |
| 1314 | 13 | 进程策略/现有代码 | OK | …\| 17 \| `Group/pOpenClose` 后端没有 `checkToken` 二次认证 \| `controllers/Group.php:239-303`… |
| 1314 | 13 | 进程策略/现有代码 | OK | … \| `Group/pOpenClose` 后端没有 `checkToken` 二次认证 \| `controllers/Group.php:239-303` \| 改继承… |
| 1314 | 13 | 进程策略/现有代码 | OK | …controllers/Group.php:239-303` \| 改继承开关不用二次认证 \| 4.2 第 ④ 道门只加了主账号校验；是否补认证，知会策略中心 \|… |
| 1316 | 13 | 进程策略/现有代码 | OK | …」的 `saveRange` 分支直接调 `editUsedObject`，不弹二次认证；`setGroup` 分支会弹 \| `strategy/index.js:12… |
| 1316 | 13 | 名单相关 | OK | …/index.js:1234-1238`（对比 `:660-675`） \| 绕过二次认证 \| 知会策略中心（名单的 `setWBListGroups` 不做二次认证，第… |
| 1316 | 13 | 名单相关 | OK | …绕过二次认证 \| 知会策略中心（名单的 `setWBListGroups` 不做二次认证，第 9 节，和这条无关） \|… |
| 1350 | 14.1 | 名单相关 | OK | …ycenter/getUsedGroupId`）和名单进程的移除、恢复；名单不做二次认证，第 9 节）；新 model（名单、采集、日志查询、库文件生成）。名单产品号写… |

## 附加记录

- 改前 18 行 Procbwlist 所在章节：14.1、2.1、4.2、5.3、7.5、8.2、8.4、9
- 101 只读副本 `Procmanager.php` 的 Action（共 15 个）：addProcToBW、addProcToWBList、addWByWhere、createWBList、delWBList、editWBList、getBWName、getClientsOverview、getProcLogList、getSysDefaultW、getWBList、procEpList、procManager、procWBList、showWBList
- 实际有改动的章节：0、11.1、12.1、12.2、13、14.1、2.1、2.3、3.2、4.2、5.3、5.8、7.4、7.5、7.6、8.2、8.4、8.5、8.6、8.8、9、9.1、版本记录
- `python3 .claude/scripts/gen-index.py changelog --check` → 退出码 0：[校验] changelog/INDEX.md 与文件现状一致
- `python3 .claude/scripts/gen-index.py insights --check` → 退出码 0：[校验] insights/INDEX.md 与文件现状一致
- `python3 .claude/skills/update-current-status/scripts/check_current_status.py CurrentStatus.md` → 退出码 0：FILE=/Users/nick/Workspace/soc-process-ctrl/CurrentStatus.md / LINES=71 / BYTES=11182 / SHA256=a9b0e2bd911a48b6162adc0eecc0cc315861702d9d3c8ed061881356acb40448 / RESULT=PASS
