# 进程策略结构

## 白名单策略体
<root>
<procaudit>
<lib>
<type>1</type>
<name></name>
<dpath></dpath>
<md5></md5>
<version></version>
</lib>
</procaudit>
</root>

lib：白名单库
type：类型。取值：1/2，1=白名单库，2=黑名单库
name：库文件名称。字符串    ****** 注意是库文件名称，而不是 zip后的名称
dpath：库文件下载相对路径。字符串
md5：库文件的md5，压缩后的。字符串
version：库文件的版本。


## 进程策略体
<root>
<procaudit>
<enable>1</enable>
<auditmode>1</auditmode>
<notify></notify>
<uptimer></uptimer>
</procaudit>
</root>

enable: 总开关。取值 1/0, 1=开启，0=关闭
auditmode: 管控模式。取值 1/2/3，1=采集，2=审计，3=拦截
notify：通知用户，弹框。取值：1/0，1=通知，0=不通知
uptimer：告警间隔。单位：秒