#!/bin/zsh
# 依次跑名单页相关的 node 测试，输出每个的退出码和最后两行
cd /Users/nick/Workspace/soc-process-ctrl/implement
for t in PL-03/tests/tk1.adapter.test.js PL-03/tests/tk2.mock.test.js PL-04/tests/pl04.unit.test.js releaseWBList/tests/list-publish.test.js releaseWBList/tests/mock.test.js PL-01/tests/TK-3/tk3.accept.js PL-01/tests/TK-3/es5check.js PL-01/tests/TK-5/bjtoday.test.js PL-01/tests/TK-5/copy-check.accept.js PL-02/TK-1/executor/bwlistModal.selftest.js; do
  out=$(cd $(dirname $t) && node $(basename $t) 2>&1); rc=$?
  echo "== $t rc=$rc :: $(echo "$out" | tail -2 | tr '\n' ' ' | cut -c1-220)"
done
