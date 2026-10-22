#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 PL-01 留痕断言表（trail-assertions.json）。
10-21 20:3x 本机重启清空 /private/tmp，原来逐条追加的 98 条断言丢失；改为用本脚本按当前事实重建，
以后再丢可以一键再生成。新增断言时改这里，不再手工往 JSON 里追加。

断言含义见 check_trail.py 文件头。每条 CLAIM / STAGE 的 expect（或 trail）都必须原样出现在 changelog 里，
所以这里只放 changelog 已经写过的事实。
用法：build_assertions.py  → 写 <工作目录>/PL-01/trail-assertions.json
"""
import json
import os

WK = '/Users/nick/Workspace/soc-process-ctrl-work'
S = WK + '/PL-01'
REPO = '/Users/nick/Workspace/soc-process-ctrl/'
SOC = '/Users/nick/Workspace/ESMCenterST/'
H = WK + '/tools/http101md5.sh '     # 经网页只读取 101 静态文件的 md5
SSH = WK + '/tools/s101.sh '
A = []


def claim(i, cmd, expect, trail=None, typ='CLAIM', needs=None):
    """加一条 CLAIM / STAGE：命令输出整行等于 expect，且 trail（默认 expect）出现在 changelog 里"""
    a = {'type': typ, 'id': i, 'cmd': cmd, 'expect': expect}
    if trail:
        a['trail'] = trail
    if needs:
        a['needs'] = needs
    A.append(a)


def anchor(i, source, quote):
    """加一条 ANCHOR：quote 逐字出现在 source 和 changelog 里"""
    A.append({'type': 'ANCHOR', 'id': i, 'source': source, 'quote': quote})


def arith(i, cmd, expect, trail):
    A.append({'type': 'ARITH', 'id': i, 'cmd': cmd, 'expect': str(expect), 'trail': trail})


# ---- 本地 SOC 工作副本当前版本（11:56 静态审查第 5 次记录的 md5）----
claim('cur-list.html', 'md5 -q ' + SOC + 'public/esm/view/processManage/list.html', 'ed7c0bc49ce4279c4f2aa32202bd4fb9')   # 10-22 02:50 TK-5 内审第 1 轮 B1 只补注释
claim('cur-list.js', 'md5 -q ' + SOC + 'public/esm/view/processManage/list.js', '00efacebf191e2a9b51c9e37c0f08f6d')   # 10-22 04:21 整体审 I1 整改
claim('cur-processManage.js', 'md5 -q ' + SOC + 'public/esm/view/processManage.js', 'a2b0eb109e241e94902535e6a52852b0')
# 02:15～02:25 曾临时切 fake 测试版 dab5ad4d…（TK-5 补测），已切回
claim('cur-bwlistMock', 'md5 -q ' + SOC + 'public/esm/view/processManage/bwlistMock.js', '8ac7ae5d9f39e0ed8f0878289a941115')
claim('cur-css', 'md5 -q ' + SOC + 'public/esm/css/processManageList.css', '20cbd1160963477f8737f55a7193afcd')
# ---- 范围外 ①②③（开工 md5、通过快照、拉取基线）----
claim('oos1-Index.php', 'md5 -q ' + SOC + 'esmCenter/controllers/Index.php', '5b5e6807a736c384ecdbdc56f73848ea')
claim('oos1-index2.php', 'md5 -q ' + SOC + 'esmCenter/views/esm/Manage/index2.php', 'afd277f54009729276170ea353c70dfd')
# bwlistMock.js 21:51 起因时间筛选改口径重新进 TK-2 返工，不再是范围外 ②
# processManage.js 23:27 起由 TK-4 改，不再是范围外 ③
claim('snap-TK-1', 'md5 -q "' + S + '/pass-snapshot/TK-1/architecture/01-进程管控设计文档.md"', 'cbc10a63ce1747e401b658482a51f725')
claim('snap-TK-2', 'md5 -q ' + S + '/pass-snapshot/TK-2/public/esm/view/processManage/bwlistMock.js', '8ac7ae5d9f39e0ed8f0878289a941115')
claim('snap-TK-2-prev3', 'md5 -q ' + S + '/pass-snapshot/TK-2.prev-0056-c1c25da4/public/esm/view/processManage/bwlistMock.js', 'c1c25da4271a8377605f655902370836')
claim('snap-TK-2-prev2', 'md5 -q ' + S + '/pass-snapshot/TK-2.prev-2254-18f7665b/public/esm/view/processManage/bwlistMock.js', '18f7665b8c87bbd002c86b958ffc8e75')
claim('snap-TK-2-prev', 'md5 -q ' + S + '/pass-snapshot/TK-2.prev-0947-ab4d76f2/public/esm/view/processManage/bwlistMock.js', 'ab4d76f29a6eaa9589e001f87165fdfe')
# ---- 10:53 上传版（= TK-3 返工前副本）----
claim('r3b-list.html', 'md5 -q ' + S + '/TK-3/executor/round3-before/list.html', '7339a79bb0c81f893cec43d7ba382be4')
claim('r3b-list.js', 'md5 -q ' + S + '/TK-3/executor/round3-before/list.js', '3c773129cf3a0f961883cc37cf4c63f9')
claim('r3b-css', 'md5 -q ' + S + '/TK-3/executor/round3-before/processManageList.css', '0ee8f58edf8abdf790c3b5aa8ca2fa6c')
# ---- 101 上当前文件（网页只读；上传新版后要改这里）----
claim('101-list.html', H + 'public/esm/view/processManage/list.html', 'ed7c0bc49ce4279c4f2aa32202bd4fb9', typ='STAGE')
claim('101-list.js', H + 'public/esm/view/processManage/list.js', '00efacebf191e2a9b51c9e37c0f08f6d', typ='STAGE')
claim('101-css', H + 'public/esm/css/processManageList.css', '20cbd1160963477f8737f55a7193afcd', typ='STAGE')
claim('101-bwlistMock', H + 'public/esm/view/processManage/bwlistMock.js', '8ac7ae5d9f39e0ed8f0878289a941115', typ='STAGE')
claim('101-processManage.js', H + 'public/esm/view/processManage.js', 'a2b0eb109e241e94902535e6a52852b0', typ='STAGE')
claim('101-layout', 'md5 -q ' + S + '/101-ref/public/esm/view/layout.html', '7f5ccd7ba36d4c7ea36dfbf1c09ec9c1', typ='STAGE')
# ---- 101 备份目录（拉取基线来源，要 SSH）----
claim('bak-dir', SSH + "'find /tmp/procm-bwlist-bak-20261021-0529 -type f | wc -l | tr -d \" \"'", '4',
      trail='/tmp/procm-bwlist-bak-20261021-0529/', typ='STAGE', needs='ssh')
for n, m in [('public/esm/view/layout.html', '10dd689294cdb8a68601571cfef50136'),
             ('public/esm/view/processManage.js', '58064f62b0c900d7b1b9e4cf0ef9c08f'),
             ('public/esm/view/processManage/list.html', 'a21d99ec347f618387a8a00e2cf01ae5'),
             ('public/esm/view/processManage/list.js', 'bd5684e870e780a4c01917d195501994')]:
    claim('pull-' + os.path.basename(n), 'md5 -q ' + S + '/pull-baseline/' + n, m)   # 拉取基线（21:10 从 101 备份取回）
# ---- 标称逐字的引文（裁决依据）----
anchor('B2-req', REPO + 'requirements/requirements-raw.md', '删除一律可点（红色）。')
anchor('B2-demo', REPO + 'demo/白名单列表.html', '/* 删除按钮：红色图标和文字 */')
anchor('B1-demo', REPO + 'demo/白名单列表.html', '「进程管控」可点（回到进程管控概览）')
anchor('B1-01', REPO + 'architecture/01-进程管控设计文档.md',
       '子菜单跳转也不带 `?g=&copen=` 参数，概览 `overview.js:25、72` 拿不到参数就是空白页')
anchor('B1-index', S + '/101-ref/public/esm/js/index.js',
       "obj['g'] = (GlobaluserInfo && GlobaluserInfo.gValue) ? GlobaluserInfo.gValue : 1;")
anchor('B2-css', S + '/101-ref/public/esm/css/assetbehaotherstra.css', 'color: rgba(237, 84, 82, 1);')
anchor('I1-basis', REPO + 'CLAUDE.md', '同一主题必须替换 / 移动 / 删除旧状态，不得追加第二份过程记录。')
anchor('S1-basis', REPO + 'plans/PL-01-黑白名单列表页前端实施计划.md', '失败时调 `error`，两种情况都要调 `complete`')
anchor('auth-0807', REPO + 'changelog/log-20261021-0530-实施PL-01.md',
       '从现在开始由主 Agent 进行判断和裁决 无需等用户拍板 直到当前计划完成')
anchor('plan-ctime-new', REPO + 'plans/PL-01-黑白名单列表页前端实施计划.md', '时间范围快捷项（按创建时间筛，照 demo）：本周（本周一 ~ 今天）/ 本月（本月 1 日 ~ 今天）/ 上月（上月 1 日 ~ 上月最后一天）')
anchor('01-ctime-new', REPO + 'architecture/01-进程管控设计文档.md', '时间范围快捷项（按创建时间筛，照 demo）：本周（本周一 ~ 今天）/ 本月（本月 1 日 ~ 今天）/ 上月（上月 1 日 ~ 上月最后一天）')
anchor('demo-range', REPO + 'demo/白名单列表.html', '本周 = 本周一 ~ 今天；本月 = 本月 1 日 ~ 今天；上月 = 上月 1 日 ~ 上月最后一天')
# ---- 工作目录与工具在位 ----
claim('r4b-bwlistMock', 'md5 -q ' + S + '/TK-2/executor/round4-before/bwlistMock.js', 'ab4d76f29a6eaa9589e001f87165fdfe')
for n, m in [('public/esm/view/processManage/list.html', '52a48464f3984ce10e6fed4d2fecc340'),
             ('public/esm/view/processManage/list.js', 'f1683a536ebe4cd6ab96425cb9f1e2d7'),
             ('public/esm/css/processManageList.css', '7600fd94248da87168ef02c098026c7e')]:
    claim('snap-TK-3-' + os.path.basename(n), 'md5 -q ' + S + '/pass-snapshot/TK-3/' + n, m)   # TK-3 22:24 PASS
anchor('B1-01-28', REPO + 'architecture/01-进程管控设计文档.md', '后端把这三个值转成 `getDateRanges` 的 1 / 2 / 3 即可')
anchor('B1-01-904', REPO + 'architecture/01-进程管控设计文档.md', '返回 `start`～`end` 左闭右开')
anchor('B1-plan-41', REPO + 'plans/PL-01-黑白名单列表页前端实施计划.md', '后端完成后改成 `false`，页面直接走真接口，业务代码不改')
anchor('I1-85', REPO + 'architecture/01-进程管控设计文档.md', '### 8.5 白名单 / 黑名单列表（仅主账号）')
for n, m in [('public/esm/view/processManage.js', 'a2b0eb109e241e94902535e6a52852b0'),
             ('public/esm/view/processManage/list.js', 'bc1b4dabf62de32b30539875c2ca042c')]:
    claim('snap-TK-4-' + os.path.basename(n), 'md5 -q ' + S + '/pass-snapshot/TK-4/' + n, m)   # TK-4 10-22 00:25 PASS
claim('guard-tool', 'test -x ' + WK + '/tools/cs_guard.sh && echo yes', 'yes', trail='tools/cs_guard.sh', typ='STAGE')
anchor('S5-common', S + '/101-ref/esmCenter/library/Common.php', "date_default_timezone_set('Asia/Shanghai');")
anchor('S5-index', S + '/101-ref/index.php', 'date_default_timezone_set("Asia/Shanghai");')
claim('tool-status-sync', 'test -f ' + WK + '/tools/check_status_sync.py && echo yes', 'yes',
      trail='check_status_sync.py', typ='STAGE')

for n, m in [('public/esm/view/processManage/list.js', '00efacebf191e2a9b51c9e37c0f08f6d'),   # 04:35 整体审 I1 整改后更新
             ('public/esm/view/processManage/list.html', 'ed7c0bc49ce4279c4f2aa32202bd4fb9'),
             ('public/esm/css/processManageList.css', '20cbd1160963477f8737f55a7193afcd')]:
    claim('snap-TK-5-' + os.path.basename(n), 'md5 -q ' + S + '/pass-snapshot/TK-5/' + n, m)   # TK-5 10-22 03:12 PASS
claim('snap-TK-5-prev-list.js', 'md5 -q ' + S + '/pass-snapshot/TK-5.prev-0312-86172076/public/esm/view/processManage/list.js', '8617207681fc73f7887c504d8751f4c9')
# 状态页同步检查每次都跑（TK-5 整改内审 I1：状态页两次没跟上上传，M 项在册却没人跑它）
claim('status-sync-run', 'python3 ' + WK + '/tools/check_status_sync.py ' + REPO + 'CurrentStatus.md | grep -c "^STATUS_SYNC=PASS"', '1',
      trail='check_status_sync.py', typ='STAGE')
claim('status-sync-M', 'grep -c "M 当前进行中写的文件指纹是本地当前值" ' + WK + '/tools/check_status_sync.py', '1',
      trail='M 项', typ='STAGE')

os.makedirs(S, exist_ok=True)
json.dump(A, open(S + '/trail-assertions.json', 'w'), ensure_ascii=False, indent=1)
print('断言 %d 条 → %s' % (len(A), S + '/trail-assertions.json'))
