#!/bin/bash
# PL-01 阶段 3.1 主 Agent 基线实跑：全部 node / python 脚本、语法与 ES5 检查（不碰 101 页面）
# 用法：bash run-node.sh > node-run.log 2>&1
W=/Users/nick/Workspace/soc-process-ctrl-work/PL-01
SOC=/Users/nick/Workspace/ESMCenterST/public/esm
REPO=/Users/nick/Workspace/soc-process-ctrl
step() { echo; echo "##### $*"; }
step "0 被测文件 md5"
md5 $SOC/view/processManage/list.js $SOC/view/processManage/list.html $SOC/css/processManageList.css $SOC/view/processManage/bwlistMock.js $SOC/view/processManage.js "$REPO/architecture/01-进程管控设计文档.md"
step "1 node --check 三个 JS"
for f in $SOC/view/processManage/list.js $SOC/view/processManage/bwlistMock.js $SOC/view/processManage.js; do node --check $f && echo "CHECK_OK $f"; done
step "2 ES5 解析（acorn ecmaVersion 5）"
for f in $SOC/view/processManage/list.js $SOC/view/processManage/bwlistMock.js $SOC/view/processManage.js; do node $W/TK-3/executor/es5check.js $f; done
step "3 TK-1 设计文档验收"
python3 -I $W/TK-1/tester/tk1_accept.py $REPO $W/HEAD-01.md $W/101-ref "$REPO/plans/PL-01-黑白名单列表页前端实施计划.md" $W/overall/tk1-result.md | tail -8; echo "exit=${PIPESTATUS[0]}"
step "4 TK-2 Executor 自测"
(cd $W/TK-2/executor && node bwlistMock.selftest.js | tail -4; echo "exit=${PIPESTATUS[0]}")
step "5 TK-2 Tester 验收（三时区）"
(cd $W/TK-2/tester && bash run-tz.sh)
step "6 TK-3 Tester 验收"
(cd $W/TK-3/tester && node tk3.accept.js | tail -3; echo "exit=${PIPESTATUS[0]}"; node tk3.accept.js --mutate | tail -2)
step "7 TK-5 Tester 文案比对"
(cd $W/TK-5/tester && node copy-check.accept.js | tail -1; echo "exit=${PIPESTATUS[0]}"; node copy-check.accept.js --mutate | tail -1)
