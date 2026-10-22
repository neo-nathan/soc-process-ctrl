#!/bin/bash
# 写 CurrentStatus.md 之前先跑：和主 Agent 上次写入后的副本比，有差异说明被别人（如用户的其他会话）改过，要先合并再写
# 写完之后：cp -p CurrentStatus.md <工作目录>/PL-01/CurrentStatus.last-written.md
G=/Users/nick/Workspace/soc-process-ctrl-work/PL-01/CurrentStatus.last-written.md
C=/Users/nick/Workspace/soc-process-ctrl/CurrentStatus.md
if diff -q "$G" "$C" >/dev/null; then echo "GUARD=PASS 状态页自上次写入后没被别人改过"; else echo "GUARD=CHANGED 状态页被别人改过，先看差异再合并："; diff "$G" "$C"; exit 1; fi
