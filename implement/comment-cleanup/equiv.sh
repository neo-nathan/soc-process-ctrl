#!/bin/bash
# 等价校验：把 orig/ 下的改前备份和 SOC 源码里的现版本逐个比较（去掉注释后比代码）。
# 用法：bash equiv.sh [SOC 源码 public/esm 目录]，默认 /Users/nick/Workspace/ESMCenterST/public/esm
# 全部 SAME 时退出码 0；有任一 DIFF 或文件缺失时退出码 1。
# 注意：orig/ 是注释精简前的版本，以后改了代码（不只是注释），这里报 DIFF 是正常的。
HERE="$(cd "$(dirname "$0")" && pwd)"
ESM="${1:-/Users/nick/Workspace/ESMCenterST/public/esm}"
FILES="view/processManage/list.js view/processManage/bwlistAdapter.js view/processManage/bwlistMock.js
view/processManage/bwlistModal.js view/processManage/bwlistProc.js view/processManage/bwlistUsedGroup.js
view/processManage/bwlistProc.html view/processManage/list.html css/processManageList.css"
rc=0
for f in $FILES; do
    if ! node "$HERE/strip-equiv.js" "$HERE/orig/$f" "$ESM/$f"; then
        rc=1
    fi
done
exit $rc
