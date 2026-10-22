#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
覆盖表漏编号检查（PL-02 内审第 1 轮 I4 之后补的断言）：
从计划里自己定义的表格行（行首「| F-n |」「| R-n |」「| Qn |」）取出全部编号，
逐个检查它在留痕文件里出现过（F-1 不会被 F-10 冒充：后面不能紧跟数字），输出漏掉的个数和名单。
用法：cov_ids_missing.py <计划.md> <留痕.md>
"""
import re
import sys

plan = open(sys.argv[1], encoding='utf-8').read()
trail = open(sys.argv[2], encoding='utf-8').read()
ids = re.findall(r'(?m)^\| \**((?:F|R)-\d+|Q\d+)\**\s*\|', plan)
missing = [i for i in ids if not re.search(re.escape(i) + r'(?!\d)', trail)]
print(len(missing))
if missing:
    sys.stderr.write('missing: %s\n' % ' '.join(missing))
