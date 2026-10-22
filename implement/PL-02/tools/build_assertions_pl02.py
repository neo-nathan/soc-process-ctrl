#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 PL-02 留痕断言表（<工作目录>/PL-02/trail-assertions.json），给 check_trail.py 用。
每条断言核对 changelog 里写下的一个事实：md5、行数、计划原文引文、101 上的现状。
随 loop 推进往 A 列表里追加断言，改完重跑本脚本 + check_trail.py（含 --mutate 自证能红）。
用法：python3 build_assertions_pl02.py
"""
import json

WK = '/Users/nick/Workspace/soc-process-ctrl-work'
S = WK + '/PL-02'
T = WK + '/tools'
REPO = '/Users/nick/Workspace/soc-process-ctrl/'
SRC = '/Users/nick/Workspace/ESMCenterST/'
PLAN = REPO + 'plans/PL-02-名单页创建编辑弹窗独立实施计划.md'
WEB = '/opt/BDFZ/ESM/data/web/public/esm/'

A = []


def claim(i, cmd, expect, trail=None, needs=None, typ='CLAIM'):
    """命令输出必须整行等于 expect，且 trail（默认 expect）原样出现在 changelog 里"""
    d = {'type': typ, 'id': i, 'cmd': cmd, 'expect': expect}
    if trail is not None:
        d['trail'] = trail
    if needs:
        d['needs'] = needs
    A.append(d)


def arith(i, cmd, expect, trail):
    """命令输出的整数必须等于 expect，且 trail 原样出现在 changelog 里"""
    A.append({'type': 'ARITH', 'id': i, 'cmd': cmd, 'expect': str(expect), 'trail': trail})


def anchor(i, source, quote):
    """标称逐字的引文：quote 必须逐字出现在 source 和 changelog 里"""
    A.append({'type': 'ANCHOR', 'id': i, 'source': source, 'quote': quote})


# ---- TK-0：101 基线 md5（要 ssh）----
for name, md5 in [('view/processManage.js', 'a2b0eb109e241e94902535e6a52852b0'),
                  ('view/processManage/list.js', '00efacebf191e2a9b51c9e37c0f08f6d'),
                  ('view/processManage/list.html', 'ed7c0bc49ce4279c4f2aa32202bd4fb9'),
                  ('css/processManageList.css', '20cbd1160963477f8737f55a7193afcd')]:
    # 101 备份目录里的副本必须是这个 md5（备份不会再被改，比现网文件稳定）
    base = name.split('/')[-1]
    claim('bak-' + base, T + "/s101.sh 'md5sum /tmp/procm-pl02-bak-20261022173555/%s' | cut -d' ' -f1" % base,
          md5, needs='ssh')
    # 开工对照基准副本也必须是这个 md5
    claim('startcopy-' + base, "md5 -q %s/start-copy/public/esm/%s" % (S, name), md5)

# ---- TK-0：本地其他 md5 ----
claim('svn-Index', 'md5 -q ' + SRC + 'esmCenter/controllers/Index.php', '5b5e6807a736c384ecdbdc56f73848ea')
claim('svn-index2', 'md5 -q ' + SRC + 'esmCenter/views/esm/Manage/index2.php', 'afd277f54009729276170ea353c70dfd')
claim('svn-mock', 'md5 -q ' + SRC + 'public/esm/view/processManage/bwlistMock.js', '8ac7ae5d9f39e0ed8f0878289a941115')
claim('colleague-md5', 'md5 -q ' + S + '/colleague-baseline/processManage.js', '58064f62b0c900d7b1b9e4cf0ef9c08f')
arith('colleague-lines', 'wc -l < ' + S + '/colleague-baseline/processManage.js', 56, '56 行，已复制到工作目录')
claim('ref-layout', 'md5 -q ' + S + '/101-ref/layout.html', '7f5ccd7ba36d4c7ea36dfbf1c09ec9c1')
claim('ref-core', 'md5 -q ' + S + '/101-ref/core.js', '61b3ff987ef80589e52492c77fff7e76')
claim('ref-ctl', 'md5 -q ' + S + '/101-ref/Procmanager.php', 'da86bf47f018b7a4dba5446030dd883f')
claim('svn-status-lines', 'wc -l < ' + S + '/start-svn-status.txt | tr -d " "', '7', trail='`svn status` 7 行')
# 开工时 101 上没有 bwlistModal.js：TK-1 已上传，改为核 TK-1 第 1 次上传后的 101 md5（要 ssh）
for name, md5 in [('list.js', 'ddfe927d9230088ad5ef68dbd0090c78'), ('list.html', 'd34d7edc6b83975d408b7b1401ef7b94'),
                  ('bwlistModal.js', 'bd40efd44a7a42d7c4005e62c447c151')]:
    claim('up1-101-' + name, T + "/s101.sh 'md5sum %sview/processManage/%s' | cut -d' ' -f1" % (WEB, name),
          md5, needs='ssh', typ='STAGE')
    claim('up1-local-' + name, 'md5 -q ' + SRC + 'public/esm/view/processManage/' + name, md5)
claim('selftest', 'node ' + S + '/TK-1/executor/bwlistModal.selftest.js 2>&1 | tail -1', '77/77 全绿', trail='自测 77/77')

# ---- 基线清单行数 ----
for path, n in [('plans/PL-02-名单页创建编辑弹窗独立实施计划.md', 142), ('plans/PL-01-黑白名单列表页前端实施计划.md', 233),
                ('architecture/01-进程管控设计文档.md', 1518), ('demo/白名单列表.html', 1076),
                ('demo/黑名单列表.html', 1076), ('CLAUDE.md', 87)]:
    arith('lines-' + path.split('/')[-1], 'wc -l < "%s%s"' % (REPO, path), n, '`%s` (%d)' % (path, n))

# ---- 计划原文引文（条款覆盖表里标「原文」的）----
anchor('tk0-done', PLAN, '「基线 md5、备份路径、两边现场写进 changelog」'.strip('「」'))
anchor('tk1-done', PLAN, '按「上传规则」上传后：S-1～S-5、S-7 通过；`grep -nE "layoutPage|addNewList|require\\(\'processManage\'\\)" list.js bwlistModal.js` 为 0 处（注释里说明历史的除外；不用 `listModal` 做关键字，它会命中新文件名 `bwlistModal`）')
anchor('tk2-done', PLAN, '本地 md5 = `58064f62…`；101 = `58064f62…`，或按 R-1 已是同事自己部署的版本（不含 `listModal`）；S-6 通过')
anchor('tk3-done', PLAN, '§七 全部通过（S-6 里 PL-01 F-8 ① 复现按 Q2 记「已知、交同事」）')
anchor('tk4-done', PLAN, '自检问题全部回答；无遗留红项')
anchor('tk1-tester', PLAN, 'TK-1 的 Tester 写 §七 全部用例（S-6 等 TK-2 做完才跑）')
anchor('tk2-way', PLAN, '主 Agent 亲做（文件来自基线原样复制，不是写代码）')
anchor('d-85', REPO + 'architecture/01-进程管控设计文档.md', '名称：必填，最长 100 字符')
anchor('d-88-14', REPO + 'architecture/01-进程管控设计文档.md', '统一叫「描述」')


# ---- 内审第 1 轮之后补的断言（检查器随 finding 生长）----
# I4：计划自己定义的 F-n / R-n / Qn 编号必须都在 changelog 出现（覆盖表或修订段），漏的个数 = 0
claim('cov-ids-missing', 'python3 %s/cov_ids_missing.py "%s" "%s"' % (T, PLAN, REPO + 'changelog/log-20261022-0535-实施PL-02.md'),
      '0', trail='断言 `cov-ids-missing` = 0')
# I2 / 第 2 轮 S1：状态页最后修改时间不得早于 changelog 最新的 Task / 整体审段（只核一句话挡不住恢复点过时）
claim('status-fresh', 'python3 %s/status_fresh.py "%s" "%s"' % (T, REPO + 'changelog/log-20261022-0535-实施PL-02.md', REPO + 'CurrentStatus.md'),
      'OK', trail='断言应比较状态页修改时间与最新 Task 段时间', typ='STAGE')
anchor('d-82-skip', REPO + 'architecture/01-进程管控设计文档.md', '「加白」跳过「拦截且原因为在黑名单」的；「加黑」跳过「原因为在黑名单」的。')
anchor('s6-orig', PLAN, '日志页「加入名单 → 新建名单」能建成名单')
anchor('f5-note', PLAN, 'TK-1 全部换掉，注释同步')

# ---- TK-2 / TK-3 ----
claim('tk2-101-pm', T + "/s101.sh 'md5sum %sview/processManage.js' | cut -d' ' -f1" % WEB, '58064f62b0c900d7b1b9e4cf0ef9c08f', needs='ssh', typ='STAGE')
# 收尾后用户决定 svn revert：本地 = svn 原版 r71897（101 仍是同事版，见 tk2-101-pm）
claim('tk2-local-pm', 'md5 -q ' + SRC + 'public/esm/view/processManage.js', '62fc1ba5cc78b31548f5ae3f9706cf4d')
claim('tk2-nolistmodal', 'grep -c listModal ' + SRC + 'public/esm/view/processManage.js', '0', trail='`listModal` 0 处')
claim('tk3-policy-same', 'diff -q %s/TK-3/db-before-policy-rows.txt %s/TK-3/db-after-policy-rows.txt >/dev/null && echo SAME' % (S, S), 'SAME', trail='两份逐行指纹 diff 无差异')
claim('tk3-ctl', T + "/s101.sh 'md5sum /opt/BDFZ/ESM/data/web/esmCenter/controllers/Procmanager.php' | cut -d' ' -f1", 'da86bf47f018b7a4dba5446030dd883f', needs='ssh', typ='STAGE')
claim('pass-snap-listjs', 'md5 -q %s/pass-snapshot/TK-1/public/esm/view/processManage/list.js' % S, 'ddfe927d9230088ad5ef68dbd0090c78')

json.dump(A, open(S + '/trail-assertions.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('assertions=%d -> %s/trail-assertions.json' % (len(A), S))
