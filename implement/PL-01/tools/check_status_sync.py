#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
状态页同主题一致性检查器（PL-01 implement-plan 主 Agent 自用，放 scratchpad，不入库）

为什么有它：TK-2 内审第 1 轮 S6、第 2 轮 S2、TK-3 内审第 1 轮 I1，三次都是同一个毛病——
CurrentStatus.md 只改了「当前进行中」，同一主题的「阶段表 PL-01 行」「下一步第 1 条」「仓库现场」还停在旧状态。
check_trail.py 是逐条核对单个事实的，抓不到「一处改了、另外几处没跟」，所以单独写这个。

进度从哪来（机械推出，不靠主 Agent 自报）：
  N = scratchpad/PL-01/pass-snapshot/ 下最大的 TK-n 编号（某 TK 内审 PASS 才会存通过快照）
  ⇒ TK-0～TK-N 已完成，当前在做的是 TK-(N+1)

检查 5 项（任一不过退出码 1）：
  A 阶段表 PL-01 行：TK-0～TK-N 每个都出现在一个写着「PASS」或「已完成」的分句里
  B 阶段表 PL-01 行：TK-0～TK-N 不许出现在写着「内审中」的分句里
  C 下一步第 1 条：按「→」切开，TK-0～TK-N 不许再出现（已完成的不该还排在下一步里；写明「返工」的段放行）；且必须提到 TK-(N+1)
  D 仓库现场：实时 git status（本仓库）和 svn status（SOC 源码）里每个改动文件的文件名都要出现
    （本仓库文件所在目录以 `dir/` 形式写在仓库现场里也算列出，收尾时为 implement/PL-01/ 加的放宽）
  E 「当前进行中」PL-01 那条必须提到 TK-(N+1)
  R 「重开」：TK-k 的通过快照里有 SOC 源码文件（public/ 下）和当前工作副本 md5 不同 ⇒ TK-k 视为重开；
    重开的 TK 免去 A、B，改为要求阶段表 PL-01 行有一个分句同时写着 TK-k 和「重开」（TK-3 内审第 4 轮 I2、TK-2 第 3 轮 I2 后加）
  I 「当前进行中」PL-01 那条与阶段表 PL-01 行：同一条里不许同时出现「在改 / 正在改 / 返工中」和「已交回」（TK-2 内审第 4 轮 I2 后加）
  F 「当前进行中」「阻塞项」「下一步」里用反引号写的工作目录子目录（如 `pre-upload-baseline/`），在 <工作目录>/PL-01/ 下必须存在；
    不存在时，所在分句必须写明「丢失 / 不存在 / 重采 / 清空」之一（防止已丢的东西还写成「已采完」）
  G 101 SSH 实测能连时，这三节里不许再有「等 101 SSH / 要等 SSH / SSH 不通 / SSH 恢复后」这类说法（写明「已恢复」的分句除外）
  M 「当前进行中」PL-01 那条里写成「`文件名` `md5前8位…`」的 SOC 文件指纹，必须等于本地工作副本当前 md5 的前 8 位
    （TK-5 内审第 2 轮 I1 后加：状态页写着 list.html bbec7810…，实际已换成 ed7c0bc4…，接手的人会拿旧值当上传比对基线）
（F、G 是 TK-3 内审第 3 轮 I1 后加的：状态页「同一段里新旧事实并存」第 4 次复发）

用法：
  check_status_sync.py <CurrentStatus.md 路径>
  check_status_sync.py <CurrentStatus.md 路径> --n <整数>   # 手动指定 N（自证能红时用）
"""
import os
import re
import subprocess
import sys

SP = '/Users/nick/Workspace/soc-process-ctrl-work'
REPO = '/Users/nick/Workspace/soc-process-ctrl'
SOC = '/Users/nick/Workspace/ESMCenterST'


def run(cmd, cwd):
    """跑命令返回标准输出（字符串）"""
    p = subprocess.run(cmd, shell=True, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return p.stdout.decode('utf-8', 'replace')


def passed_n():
    """通过快照目录里最大的 TK 编号；一个都没有返回 0（TK-0 是主 Agent 亲做的开工准备，视为已完成）"""
    d = os.path.join(SP, 'PL-01', 'pass-snapshot')
    ns = [int(m.group(1)) for x in os.listdir(d) for m in [re.match(r'TK-(\d+)$', x)] if m]
    return max(ns) if ns else 0


def has_tk(text, k):
    """text 里有没有 TK-k（后面不能紧跟数字，免得 TK-1 匹配到 TK-12）"""
    return re.search(r'TK-%d(?!\d)' % k, text) is not None


def clauses(text):
    """按中文分号、逗号、句号切分句"""
    return [c for c in re.split(r'[；，。]', text) if c.strip()]


def section(lines, title):
    """取「## title」到下一个「## 」之间的行"""
    out, on = [], False
    for l in lines:
        if l.startswith('## '):
            on = (l.strip() == '## ' + title)
            continue
        if on:
            out.append(l)
    return out


def changed_files(repo_text=''):
    """实时两边工作区的改动文件名（只取文件名，用来在仓库现场里找）
    本仓库里某个改动文件所在目录（含任一上级目录，写成 `dir/` 形式）已在仓库现场里出现时，视为已列出
    （收尾时 implement/PL-01/ 有几十个证据文件，逐个列进状态页没有意义；收尾阶段加的放宽）"""
    names = []
    for l in run('git -c core.quotepath=false status --short -uall', REPO).splitlines():
        if l.strip():
            path = l[3:].strip().strip('"')
            parts = path.split('/')[:-1]
            if any('/'.join(parts[:k]) + '/' in repo_text for k in range(1, len(parts) + 1)):
                continue
            names.append(os.path.basename(path))
    for l in run('LC_ALL=en_US.UTF-8 svn status --non-interactive', SOC).splitlines():
        if l.strip():
            names.append(os.path.basename(l[8:].strip()))
    return names


def ssh_ok():
    """101 SSH 能不能连（只 echo，不改 101 上任何东西）"""
    out = run('bash ' + SP + '/tools/s101.sh "echo SSH_OK" 2>&1 | tail -1', REPO).strip()
    return out == 'SSH_OK'


def sentences(text):
    """按中文句号、分号、换行切分句"""
    return [x for x in re.split(r'[。；\n]', text) if x.strip()]


def reopened(n):
    """重开的 TK：每个 SOC 源码文件（public/ 下）只和「最新一份包含它的通过快照」比，不同才算那个 TK 重开。
    后一个 TK 合法改了前一个 TK 的文件（如 TK-4 改 TK-3 的 list.js）时，等后一个 TK 通过、存了快照，
    前一个就不再被比；后一个还没通过时，这个差异属于进行中的 TK，不算前一个重开（TK-4 内审第 2 轮 S2 后改）。"""
    base = os.path.join(SP, 'PL-01', 'pass-snapshot')
    latest = {}   # 相对路径 -> (最新包含它的 TK 编号, 快照文件路径)
    for k in range(1, n + 1):
        d = os.path.join(base, 'TK-%d' % k)
        for root, _, files in os.walk(d):
            for f in files:
                rel = os.path.relpath(os.path.join(root, f), d)
                if rel.startswith('public' + os.sep):
                    latest[rel] = (k, os.path.join(root, f))
    # 进行中 TK 的产物清单（主 Agent 维护，每行一个 public/ 下的相对路径）：这些文件的差异归进行中的 TK
    cur = set()
    cp = os.path.join(SP, 'PL-01', 'current-actual.txt')
    if os.path.exists(cp):
        cur = set(l.strip() for l in open(cp, encoding='utf-8') if l.strip())
    out = set()
    for rel, (k, snap) in latest.items():
        if rel in cur:
            continue
        now = os.path.join(SOC, rel)
        if not os.path.exists(now) or open(now, 'rb').read() != open(snap, 'rb').read():
            out.add(k)
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    path = sys.argv[1]
    n = int(sys.argv[sys.argv.index('--n') + 1]) if '--n' in sys.argv else passed_n()
    lines = open(path, encoding='utf-8').read().split('\n')
    row = next((l for l in lines if l.startswith('| 黑白名单列表页前端（PL-01）')), '')
    cur = next((l for l in section(lines, '当前进行中') if '执行 PL-01' in l), '')
    nxt = next((l for l in section(lines, '下一步') if l.startswith('1.')), '')
    repo = '\n'.join(section(lines, '仓库现场'))
    res = []
    # 收尾后（阶段表 PL-01 行状态列为 PASS，「当前进行中」已移除 loop 项）：只查 A、D、F、G，
    # 循环期间才适用的 B、R、C、E、I、M 跳过（PL-01 收尾 04:5x 加）
    done = bool(re.match(r'\| 黑白名单列表页前端（PL-01） \| PASS \|', row))
    if done:
        print('LOOP_DONE 阶段表 PL-01 = PASS，跳过循环期专用的 B/R/C/E/I/M')
    # A：已完成的 TK 都要落在写着 PASS / 已完成 的分句里
    ro = reopened(n)
    miss = [k for k in range(0, n + 1) if k not in ro
            and not any(has_tk(c, k) and ('PASS' in c or '已完成' in c) for c in clauses(row))]
    res.append(('A 阶段表写明 TK-0～TK-%d 已完成' % n, not miss and bool(row), '缺 %s' % miss))
    # B：已完成的 TK 不许还在「内审中」的分句里
    bad = [k for k in range(0, n + 1) if k not in ro for c in clauses(row) if has_tk(c, k) and '内审中' in c]
    # R：重开的 TK 必须在阶段表里写明「重开」
    ro_missing = [k for k in sorted(ro) if not any(has_tk(c, k) and '重开' in c for c in clauses(row))]
    if not done:
        res.append(('B 阶段表没把已完成的 TK 写成内审中', not bad, '仍写内审中: %s' % bad))
    if not done:
        res.append(('R 重开的 TK 在阶段表写明重开 %s' % sorted(ro), not ro_missing, '没写重开: %s' % ro_missing))
    # C：下一步第 1 条不再列已完成的 TK，且提到当前 TK
    segs = nxt.split('→')
    # 已通过的 TK 因基线改口径等原因被重新打开时，下一步里写明「返工」的那一段放行
    # 重开的 TK（R 项判定）或写明「返工」的段放行
    stale = [k for k in range(0, n + 1) if k not in ro for s in segs if has_tk(s, k) and '返工' not in s]
    ok_c = bool(nxt) and not stale and has_tk(nxt, n + 1)
    if not done:
        res.append(('C 下一步从 TK-%d 开始' % (n + 1), ok_c, '已完成仍在列: %s；提到 TK-%d: %s' % (stale, n + 1, has_tk(nxt, n + 1))))
    # D：仓库现场列全实时改动文件
    lost = [f for f in changed_files(repo) if f not in repo]
    res.append(('D 仓库现场列全实时改动文件', not lost, '没列: %s' % lost))
    # E：当前进行中提到当前 TK
    if not done:
        res.append(('E 当前进行中提到 TK-%d' % (n + 1), has_tk(cur, n + 1), ''))
    # I：同一条里不许「还在改」和「已交回」并存
    clash = [name for name, txt in (('当前进行中', cur), ('阶段表', row))
             if re.search(r'在改|正在改|返工中', txt) and '已交回' in txt]
    if not done:
        res.append(('I 同一条里没有「在改」与「已交回」并存', not clash, '并存: %s' % clash))
    # F：提到的工作目录子目录必须存在，或写明已丢失 / 要重采
    three = '\n'.join(section(lines, '当前进行中') + section(lines, '阻塞项与待确认事项') + section(lines, '下一步'))
    stale_dirs = []
    for sent in sentences(three):
        for d in re.findall(r'`([A-Za-z0-9_.-]+/)`', sent):
            if os.path.isdir(os.path.join(REPO, d)):
                continue   # 仓库自己的目录（如 demo/），不归工作目录管
            if not os.path.isdir(os.path.join(SP, 'PL-01', d)) and not re.search(r'丢失|不存在|重采|清空', sent):
                stale_dirs.append(d + ' ← ' + sent.strip()[:40])
    res.append(('F 提到的工作目录子目录存在或写明丢失', not stale_dirs, '过时: %s' % stale_dirs))
    # G：SSH 能连时不许再写等 SSH
    stale_ssh = []
    if ssh_ok():
        for sent in sentences(three):
            if re.search(r'等 ?101 ?SSH|要等 ?SSH|SSH 不通|SSH 恢复后', sent) and '已恢复' not in sent:
                stale_ssh.append(sent.strip()[:50])
    res.append(('G SSH 已通时不再写等 SSH', not stale_ssh, '过时: %s' % stale_ssh))
    # M：当前进行中写的 SOC 文件指纹必须是本地当前值
    stale_md5 = []
    pairs = re.findall(r'`([A-Za-z0-9_.-]+\.(?:js|html|css|php))` `([0-9a-f]{8})…`', cur)
    pairs += [('css', m) for m in re.findall(r'\bcss `([0-9a-f]{8})…`', cur)]
    for fname, pre in pairs:
        # 本 loop 会写进状态页的 SOC 文件只有这几个，直接用固定路径（遍历整个 public/ 太慢）
        known = {'list.js': 'public/esm/view/processManage/list.js',
                 'list.html': 'public/esm/view/processManage/list.html',
                 'bwlistMock.js': 'public/esm/view/processManage/bwlistMock.js',
                 'processManage.js': 'public/esm/view/processManage.js',
                 'processManageList.css': 'public/esm/css/processManageList.css'}
        if fname == 'css':
            fname = 'processManageList.css'
        hits = [os.path.join(SOC, known[fname])] if fname in known else []
        if not hits:
            stale_md5.append('%s 找不到文件' % fname)
            continue
        now = run('md5 -q "%s"' % hits[0], SOC).strip()[:8]
        if now != pre:
            stale_md5.append('%s 写 %s 实际 %s' % (fname, pre, now))
    if not done:
        res.append(('M 当前进行中写的文件指纹是本地当前值', not stale_md5, '过时: %s' % stale_md5))
    fails = 0
    for name, ok, msg in res:
        print('%s %s %s' % ('PASS' if ok else 'FAIL', name, '' if ok else msg))
        fails += 0 if ok else 1
    print('STATUS_SYNC=%s N=%d fails=%d' % ('PASS' if fails == 0 else 'FAIL', n, fails))
    sys.exit(0 if fails == 0 else 1)


if __name__ == '__main__':
    main()
