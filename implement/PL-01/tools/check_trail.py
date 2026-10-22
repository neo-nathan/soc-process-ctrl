#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
留痕检查器（PL-01 implement-plan 主 Agent 自用，放持久工作目录，不入库）
10-21 20:3x 本机重启清空 /private/tmp 后，按会话记录重建（功能与重启前最终版一致，工作目录改为
/Users/nick/Workspace/soc-process-ctrl-work/）。

用途：核对主 Agent 写进 changelog 等留痕文件里的事实是否属实。
断言写在一个 JSON 文件里（每条一个对象），类型有 5 种 + 2 个固定检查：

  CLAIM  : 跑 cmd，输出（去掉首尾空白后）必须与 expect **整行相等**；并且 trail（默认 = expect）必须原样出现在留痕文件里
  ARITH  : 跑 cmd 得到一个整数，必须等于 expect；并且 trail 文本必须原样出现在留痕文件里
  STAGE  : 同 CLAIM，用于「某步已完成 / 文件在位 / 已上传」这类阶段声明
  LINEREF: file 里存在一行包含 contains（内容锚定）；给了 line 时还要求第 line 行包含它；trail 文本必须出现在留痕文件里
  ANCHOR : quote 必须逐字出现在 source 文件里，也必须逐字出现在留痕文件里（标称逐字的引文）
  断言可带 "needs": "ssh"：环境变量 SKIP_SSH=1 时跳过（不算通过，结尾单独报数量）

  固定检查（不用写断言）：
  SEG    : 每个「## 追加…TK-n 静态审查 第 k 次」段必须含「受审文件」「人工必查项」；
           同一个 TK 的**最后一次**静态审查段，段末最后一个非空行必须逐字是「静态审查未处置: 0」
           （中间轮次可以是非 0：那表示发回返工，下一次再审）
  TIME   : 所有「## 追加(YYYY-MM-DD HH:mm TZ)」标题时间必须非递减，且不晚于当前时刻（防心算 / 手写时间）

用法：
  check_trail.py <断言.json> <留痕文件>            # 跑全部断言，任一 FAIL 退出码 1
  check_trail.py <断言.json> <留痕文件> --mutate   # 自证：把每条断言的期望值改坏，要求全部变 FAIL（能红）
  check_trail.py --fresh <留痕文件>                # 只查留痕文件 mtime 是否早于最近一次全部通过的时刻
运行全部通过后在 <工作目录>/PL-01/checked-<留痕文件名> 写时间戳（机械前置第 3 条：之后再改留痕文件就要重跑）。
"""
import datetime
import json
import os
import re
import subprocess
import sys
import time


def run(cmd):
    """跑 shell 命令（命令都是主 Agent 自己写在断言文件里的固定命令），返回去掉首尾空白的标准输出"""
    p = subprocess.run(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return p.stdout.decode('utf-8', 'replace').strip()


def in_trail(trail_text, s):
    """s 必须原样出现在留痕文件里；空串一律判失败（空串永远是子串，会让断言白过）"""
    return bool(s) and s in trail_text


def check_one(a, trail_text):
    """检查一条断言，返回 (是否通过, 说明)"""
    t = a['type']
    if t in ('CLAIM', 'STAGE'):
        out = run(a['cmd'])
        # 整行相等比较，不用子串（防 Driver 匹配 DriverXX 这类前缀漏洞）
        ok_val = out == a['expect'].strip()
        ok_tr = in_trail(trail_text, a.get('trail', a['expect']))
        return ok_val and ok_tr, 'out=%r expect=%r trail_hit=%s' % (out[:200], a['expect'][:200], ok_tr)
    if t == 'ARITH':
        out = run(a['cmd'])
        try:
            ok_val = int(out) == int(a['expect'])
        except ValueError:
            ok_val = False
        ok_tr = in_trail(trail_text, a['trail'])
        return ok_val and ok_tr, 'out=%r expect=%r trail_hit=%s' % (out, a['expect'], ok_tr)
    if t == 'LINEREF':
        path = a['file']
        if not os.path.exists(path):
            return False, 'file missing: %s' % path
        lines = open(path, encoding='utf-8', errors='replace').read().split('\n')
        hit = [i + 1 for i, l in enumerate(lines) if a['contains'] in l]
        ok = len(hit) > 0
        if a.get('line'):
            ok = ok and (a['line'] in hit)
        ok_tr = in_trail(trail_text, a.get('trail', ''))
        return ok and ok_tr, 'hits=%s line=%s trail_hit=%s' % (hit[:10], a.get('line'), ok_tr)
    if t == 'ANCHOR':
        if not os.path.exists(a['source']):
            return False, 'source missing: %s' % a['source']
        src = open(a['source'], encoding='utf-8', errors='replace').read()
        ok_src = a['quote'] in src
        ok_tr = in_trail(trail_text, a['quote'])
        return ok_src and ok_tr, 'in_source=%s in_trail=%s' % (ok_src, ok_tr)
    return False, 'unknown type %s' % t


def check_segments(trail_text):
    """SEG：静态审查段格式检查，返回 [(段标题, 是否通过, 说明)]"""
    segs = []
    parts = re.split(r'(?m)^(## .*)$', trail_text)   # 按二级标题切段
    for i in range(1, len(parts), 2):
        title = parts[i]
        body = parts[i + 1] if i + 1 < len(parts) else ''
        if '静态审查' in title and re.search(r'第 *\d+ *次', title):
            m = re.search(r'TK-\d+', title)
            segs.append((m.group(0) if m else '?', title, body))
    # 每个 TK 最后一次静态审查段的下标
    last = {}
    for idx, (tk, _, _) in enumerate(segs):
        last[tk] = idx
    res = []
    for idx, (tk, title, body) in enumerate(segs):
        nonempty = [l for l in body.split('\n') if l.strip()]
        tail = nonempty[-1].strip() if nonempty else ''
        ok = ('受审文件' in body) and ('人工必查项' in body) and tail.startswith('静态审查未处置: ')
        if last[tk] == idx:
            ok = ok and tail == '静态审查未处置: 0'   # 该 TK 最近一次必须清零
        res.append((title, ok, 'last=%r' % tail))
    return res


def check_times(trail_text):
    """TIME：所有「## 追加(YYYY-MM-DD HH:mm TZ)」标题时间必须非递减，且不晚于当前时刻（防心算 / 手写时间）"""
    ts = re.findall(r'(?m)^## 追加\((\d{4}-\d{2}-\d{2} \d{2}:\d{2}) [A-Z]+\)', trail_text)
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    bad = []
    for i, t in enumerate(ts):
        if t > now:
            bad.append('晚于当前 %s: %s' % (now, t))
        if i > 0 and t < ts[i - 1]:
            bad.append('比上一段早: %s < %s' % (t, ts[i - 1]))
    return len(bad) == 0, 'n=%d %s' % (len(ts), '; '.join(bad))


def mutate(a):
    """把断言的期望值改坏（用于自证能红）"""
    b = dict(a)
    t = a['type']
    if t in ('CLAIM', 'STAGE'):
        b['expect'] = a['expect'] + 'X'
        b['trail'] = a.get('trail', a['expect'])  # trail 保持原样，只改期望值
    elif t == 'ARITH':
        b['expect'] = str(int(a['expect']) + 1)
    elif t == 'LINEREF':
        b['contains'] = a['contains'] + '\u0000不可能出现'
    elif t == 'ANCHOR':
        b['quote'] = a['quote'] + '加字'
    return b


def stamp_path(trail_path):
    """通过时间戳文件的位置：<工作目录>/PL-01/checked-<留痕文件名>（不放仓库里，免得多出未纳管文件）"""
    base = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'PL-01')
    return os.path.join(base, 'checked-' + os.path.basename(trail_path))


def fresh(trail_path):
    """机械前置第 3 条：留痕文件最后修改时刻必须早于检查器最近一次通过的时刻"""
    sp = stamp_path(trail_path)
    if not os.path.exists(sp):
        print('FRESH=FAIL 还没有通过记录')
        return 1
    t_ok = float(open(sp).read())
    t_mod = os.path.getmtime(trail_path)
    ok = t_mod < t_ok
    print('FRESH=%s trail_mtime=%.0f checked_at=%.0f' % ('PASS' if ok else 'FAIL', t_mod, t_ok))
    return 0 if ok else 1


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    asserts = json.load(open(sys.argv[1], encoding='utf-8'))
    trail_path = sys.argv[2]
    trail_text = open(trail_path, encoding='utf-8').read()
    mut = '--mutate' in sys.argv
    fails = 0
    skip_ssh = os.environ.get('SKIP_SSH') == '1'
    skipped = 0
    for a in asserts:
        if skip_ssh and a.get('needs') == 'ssh':
            # 101 SSH 不通时显式跳过：不算通过，结尾单独报数量
            print('SKIP(ssh 不通) %s %s' % (a['type'], a.get('id', '')))
            skipped += 1
            continue
        aa = mutate(a) if mut else a
        ok, msg = check_one(aa, trail_text)
        tag = a['type'] + ' ' + a.get('id', '')
        if mut:
            # 自证模式：改坏后必须 FAIL
            print('%s %s -> %s' % ('RED-OK ' if not ok else 'NOT-RED', tag, msg))
            if ok:
                fails += 1
        else:
            print('%s %s %s' % ('PASS' if ok else 'FAIL', tag, msg))
            if not ok:
                fails += 1
    if not mut:
        ok_t, msg_t = check_times(trail_text)
        print('%s TIME %s' % ('PASS' if ok_t else 'FAIL', msg_t))
        if not ok_t:
            fails += 1
        for title, ok, msg in check_segments(trail_text):
            print('%s SEG %s %s' % ('PASS' if ok else 'FAIL', title, msg))
            if not ok:
                fails += 1
    print('RESULT=%s fails=%d total=%d skipped_ssh=%d' % ('PASS' if fails == 0 else 'FAIL', fails, len(asserts), skipped))
    if not mut and fails == 0:
        open(stamp_path(trail_path), 'w').write(str(time.time()))
    sys.exit(0 if fails == 0 else 1)


if __name__ == '__main__':
    # check_trail.py --fresh <留痕文件>：只做 mtime 新鲜度检查
    if len(sys.argv) == 3 and sys.argv[1] == '--fresh':
        sys.exit(fresh(sys.argv[2]))
    main()
