<!--  
1 RPW_ProcessAuditInfo  进程审计表
	procpath  进程文件路径
	pid 进程pid
	ppid 进程父pid
	cmd 进程命令行
	user运行进程用户
	md5 进程文件 md5
	ACTIONREASON  1  在黑名单   2 不在白名单  
	action 审计状态：告警（0）还是拦截（1）
	
2 RPW_PackageInfo  系统安装包采集表
	name   包名
	version 包版本
	maintainer 包来源
	uptime 包更新时间
	filecount 包内可执行文件计数
	type  包类型：1=deb，2=rpm
	
3 RPW_ExecFileInfo 系统可执行文件采集表  进程名？？？
	procpath  文件路径
	type
	size      文件大小
	inode     文件 inode
	changetime 文件最后变更时间
	hash       文件hash值
	algo       文件hash算法，0=md5,8=hash256
	package   文件所属包名
	action    文件变化动作，保留待定。
-->

-- ----------------------------
-- Table structure for RPW_PROCESSAUDITINFO
-- ----------------------------
DROP TABLE IF EXISTS `RPW_PROCESSAUDITINFO`;
CREATE TABLE `RPW_PROCESSAUDITINFO`  (
  `ID` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `EID` varchar(32) NOT NULL,
  `SGUID` varchar(36) NOT NULL,
  `TIME` datetime NOT NULL,
  `EVENTTYPE` int(11) NULL DEFAULT NULL,
  `EVENTLEVEL` int(11) NULL DEFAULT NULL,
  `EVENTSOURCE` varchar(50)  NULL DEFAULT NULL,
  `CATEGORY` int(11) NULL DEFAULT NULL,
  `USERNAME` varchar(64)  NULL DEFAULT NULL,
  `DESCRIPTION` varchar(255)  NULL DEFAULT NULL,
  `PID` int(11) NOT NULL,
  `PPID` int(11) NOT NULL,
  `CMD` varchar(500) NOT NULL,
  `PROCUSER` varchar(255) NULL DEFAULT NULL,
  `FILEHASH` varchar(64) NOT NULL,
  `ALGO` int(11) NOT NULL,
  `PROCPATH` varchar(500)  NOT NULL,
  `ACTIONREASON` int(11) NOT NULL,  
  `PROCACTION` int(11) NOT NULL,  
  `LOGEDATE` int(11) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=INNODB AUTO_INCREMENT=1 DEFAULT CHARSET=UTF8;


DROP TABLE IF EXISTS `RPW_PACKAGEINFO`;
CREATE TABLE `RPW_PACKAGEINFO`  (
  `ID` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `EID` varchar(32) NOT NULL,
  `SGUID` varchar(36) NOT NULL,
  `TIME` datetime NOT NULL,
  `EVENTTYPE` int(11) NULL DEFAULT NULL,
  `EVENTLEVEL` int(11) NULL DEFAULT NULL,
  `EVENTSOURCE` varchar(50)  NULL DEFAULT NULL,
  `CATEGORY` int(11) NULL DEFAULT NULL,
  `USERNAME` varchar(64)  NULL DEFAULT NULL,
  `DESCRIPTION` varchar(255)  NULL DEFAULT NULL,
  `PACKAGENAME` varchar(128)  NULL DEFAULT NULL,
  `PACKAGEVERSION` varchar(64)  NULL DEFAULT NULL,
  `MAINTAINER` varchar(200)  NULL DEFAULT NULL,
  `PACKAGEUPTIME` datetime NULL DEFAULT NULL,
  `FILECOUNT` int(11) NULL DEFAULT NULL,
  `PTYPE` int(11) NULL DEFAULT NULL, 
  `LOGEDATE` int(11) NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `uk_rpw_proc` (`SGUID`,`PACKAGENAME`)
) ENGINE=INNODB AUTO_INCREMENT=1 DEFAULT CHARSET=UTF8;

DROP TABLE IF EXISTS `RPW_EXECFILEINFO`;
CREATE TABLE `RPW_EXECFILEINFO`  (
  `ID` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `EID` varchar(32) NOT NULL,
  `SGUID` varchar(36) NOT NULL,
  `TIME` datetime NOT NULL,
  `EVENTTYPE` int(11) NULL DEFAULT NULL,
  `EVENTLEVEL` int(11) NULL DEFAULT NULL,
  `EVENTSOURCE` varchar(50)  NULL DEFAULT NULL,
  `CATEGORY` int(11) NULL DEFAULT NULL,
  `USERNAME` varchar(64)  NULL DEFAULT NULL,
  `DESCRIPTION` varchar(255)  NULL DEFAULT NULL,
  `EXECTYPE` int(11) NOT NULL, 
  `EXECSIZE` int(11) NOT NULL,  
  `INODE` bigint(20) NOT NULL,
  `FILECHANGETIME` datetime NULL DEFAULT NULL,
  `FILEHASH` varchar(64) NOT NULL,
  `ALGO` int(11) NOT NULL,
  `PROCPATH` varchar(500)  NOT NULL,
  `EXECPACKAGE` varchar(128)  NULL DEFAULT NULL,  
  `EXECACTION` int(11) NULL DEFAULT NULL, 
  `LOGEDATE` int(11) NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `uk_rpw_proc` (`SGUID`,`FILEHASH`,`ALGO`,`PROCPATH`)
) ENGINE=INNODB AUTO_INCREMENT=1 DEFAULT CHARSET=UTF8;

<!--
已发布：
待发布：未发布过的
待发布（变更)：变更已确认，变更内容待重新发布
有变更：发布过，但是有变更

黑白名单表(作废)

ID		//自增长ID
类型	//1 白名单 2 黑名单
名称			//黑白名单名称
系统类型		//windows、linux/信创
描述			//描述
创建时间		//
staus			//已发布、待发布、待发布（变更)、有变更、空白名单怎么办？
logedate 		//记录变更时间

DROP TABLE IF EXISTS `RPW_BWLIST`;
CREATE TABLE `RPW_BWLIST`  (
  `ID` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `EID` varchar(32) NOT NULL,
  `LISTTYPE` TINYINT(1) NOT NULL,
  `LISTNAME` varchar(50) NOT NULL,
  `SYSTYPE` TINYINT(1) NOT NULL,
  `INFO` TEXT NULL DEFAULT NULL,
  `CREATETIME` datetime NOT NULL,
  `STATUS` TINYINT(1) NOT NULL,
  `LOGEDATE` int(11) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=INNODB AUTO_INCREMENT=1 DEFAULT CHARSET=UTF8;
-->

-- 白名单进程表
DROP TABLE IF EXISTS `RPW_WPROC`;
CREATE TABLE `RPW_WPROC`  (
  `ID` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `EID` varchar(32) NOT NULL,
  `BWID`  bigint(20) NOT NULL, //所属白名单ID
  `PROCName` varchar(20)  NOT NULL,  
  `PROCPATH` varchar(500)  NOT NULL,    
  `FILEHASH` varchar(64) NOT NULL,
  `ALGO` int(11) NOT NULL,
  `CREATETIME` datetime NOT NULL,
  `STATUS` INT  NOT NULL,				//0已确认 1添加 2移除 
  `LOGEDATE` int(11) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `index_id` (`BWID`)
) ENGINE=INNODB AUTO_INCREMENT=1 DEFAULT CHARSET=UTF8;

-- 黑名单进程表
DROP TABLE IF EXISTS `RPW_BPROC`;
CREATE TABLE `RPW_BPROC`  (
  `ID` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `EID` varchar(32) NOT NULL,
  `BWID`  bigint(20) NOT NULL, //所属白名单ID
  `PROCName` varchar(20)  NOT NULL,  
  `PROCPATH` varchar(500)  NOT NULL,    
  `FILEHASH` varchar(64) NOT NULL,
  `ALGO` int(11) NOT NULL,
  `CREATETIME` datetime NOT NULL,
  `STATUS` INT  NOT NULL,				//0已确认 1添加 2移除 
  `LOGEDATE` int(11) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `index_id` (`BWID`)
) ENGINE=INNODB AUTO_INCREMENT=1 DEFAULT CHARSET=UTF8;

<!--
POLICY 表添加字段
policytype  0 默认值 策略，  2 白名单，  3 黑名单
STATUS  状态值  针对黑白名单有效
-->


-- epstate
procaudit：0 关闭  1 学习  2 审计  3  拦截
proclib: 0 没有  1 白  2 黑
