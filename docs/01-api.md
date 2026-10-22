# 进程管控 php 接口


## 黑白名单

Procmanager/getWBList 参数： policytype 黑白名单2,3，eptype： 1windows ,2 linux    timeRange：1,2,3本周，本月，上月，begintime，endtime，status：1 空白名单 / 2 待发布 / 3 有变更 / 4 已发布  objrange：1 有应用范围 / 0 没有任何应用范围   procstatus：0 已确认 / 1 添加 / 2 移除

Procmanager/editWBList  编辑黑白名单： 参数pid，pname，description

Procmanager/delWBList 删除黑白名单，参数：pid，policytype

Procmanager/showWBList  黑白名单进程，pid，policytype

Procmanager/addProcToWBList  添加进程到黑白名单里面，参数：pid， policytype，propath，filehash，algo