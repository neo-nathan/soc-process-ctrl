#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
状态页恢复点新鲜度检查（PL-02 TK-1 内审第 2 轮 S1 之后补的断言）：
changelog 里最新一个「## 追加(YYYY-MM-DD HH:mm TZ):Task …」或「…:整体审」段的时间，
不能晚于 CurrentStatus.md 的最后修改时间（到分钟）。也就是：每写一个 Task / 整体审段，都要随后覆盖一次状态页恢复点。
输出 OK 或 STALE（附两个时间）。用法：status_fresh.py <changelog.md> <CurrentStatus.md>
"""
import datetime
import os
import re
import sys

cl = open(sys.argv[1], encoding='utf-8').read()
ts = re.findall(r'(?m)^## 追加\((\d{4}-\d{2}-\d{2} \d{2}:\d{2}) [A-Z]+\):(?:Task |整体审)', cl)
if not ts:
    print('OK')   # 还没有 Task 段，不约束
    sys.exit(0)
last = max(ts)
mt = datetime.datetime.fromtimestamp(os.path.getmtime(sys.argv[2])).strftime('%Y-%m-%d %H:%M')
print('OK' if mt >= last else 'STALE last_task=%s status_mtime=%s' % (last, mt))
