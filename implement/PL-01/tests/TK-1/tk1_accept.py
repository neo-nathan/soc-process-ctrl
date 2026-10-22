# -*- coding: utf-8 -*-
"""
PL-01 TK-1「更新设计文档」计划级验收（Tester 独立编写，不看 Executor 自测脚本）。

受验对象：architecture/01-进程管控设计文档.md（工作区版本，只读）
对照：改前版本 HEAD-01.md（= git HEAD，开工时版本）
期望值来源：只认基线原文——
  PL-01 §六 TK-1 完成判据（逐字）：
    「grep 复核：Procbwlist 0 处残留（版本记录里的历史说明除外）；F-16 里的每个设计名都已替换；
      3304 / 3305 只在版本记录里出现；名单相关的「二次认证」全部改完；生成器、检查脚本通过」
  PL-01 §3.2 01 那一行 ①～⑥；PL-01 F-16、F-17、F-6、§四、Q1/Q4/Q6、R-4
  以及主 Agent 转达的用户口径（9.1 末句 8m + 注明 101 现状；F-17 不进 12.1；
  「procManager 前端没调用，删除」两处都删；版本记录 = 文首「## 版本记录」+「附录 B」）。

用法：python3 -I tk1_accept.py <仓库根> <HEAD-01.md> <101-ref 根> <PL-01 计划路径> <结果输出 md>
每条断言打印 PASS / FAIL，结尾汇总；有 FAIL 时退出码 1。
"""
import sys, re, difflib, subprocess, os

REPO, HEAD_PATH, R, PLAN_PATH, OUT = sys.argv[1:6]
# 第 6 个参数（可选）：替换受验文档路径，只用于自检时的「改坏输入看断言会不会红」
DOC_PATH = sys.argv[6] if len(sys.argv) > 6 else os.path.join(REPO, 'architecture', '01-进程管控设计文档.md')

def read_lines(p):
    with open(p, encoding='utf-8') as f:
        return f.read().split('\n')

NEW = read_lines(DOC_PATH)       # 改后（受验）
OLD = read_lines(HEAD_PATH)      # 改前（HEAD）
PLAN = read_lines(PLAN_PATH)

results = []   # (编号, 名称, 依据, ok, 详情)
report = []    # 写进结果文件的附加说明

def check(cid, name, basis, ok, detail=''):
    results.append((cid, name, basis, bool(ok), detail))
    print(('PASS' if ok else 'FAIL') + '  ' + cid + '  ' + name + ('' if ok else '\n      -> ' + detail))

# ---------------------------------------------------------------
# 工具：给每一行标上所属章节（最内层 ## / ### 标题的编号）
#   「## 版本记录」→ '版本记录'；「## 附录 B」→ '附录B'；文首（第一个 ## 之前）→ '文首'
#   「## 9. 后端接口清单」→ '9'；「### 9.1 名单接口约定」→ '9.1'
# 依据：TASK_SPEC 口径「版本记录 = 文首「## 版本记录」一节和「附录 B：版本历史」」
# ---------------------------------------------------------------
def section_map(lines):
    sec = []
    cur2, cur3 = '文首', None
    for ln in lines:
        m2 = re.match(r'^## (.+)$', ln)
        m3 = re.match(r'^### (\d+(?:\.\d+)*)\b', ln)
        if m2:
            t = m2.group(1).strip()
            if t.startswith('版本记录'):
                cur2 = '版本记录'
            elif t.startswith('附录 B'):
                cur2 = '附录B'
            elif t.startswith('附录 A'):
                cur2 = '附录A'
            else:
                mm = re.match(r'(\d+)\.', t)
                cur2 = mm.group(1) if mm else t
            cur3 = None
        elif m3:
            cur3 = m3.group(1)
        sec.append(cur3 if cur3 else cur2)
    return sec

SEC_NEW = section_map(NEW)
SEC_OLD = section_map(OLD)
HIST = ('版本记录', '附录B')   # 版本记录区（判据里「版本记录里的历史说明除外」）

def body_lines(lines, secs):
    """正文 = 除版本记录区以外的所有行，返回 [(行号, 行)]"""
    return [(i + 1, l) for i, l in enumerate(lines) if secs[i] not in HIST]

BODY_NEW = body_lines(NEW, SEC_NEW)

def sec_text(lines, secs, key, include_children=False):
    out = []
    for i, l in enumerate(lines):
        s = secs[i]
        if s == key or (include_children and s.startswith(key + '.')):
            out.append(l)
    return '\n'.join(out)

def word_re(name):
    # 标识符整词匹配：前后都不能是字母数字下划线（避免 addList 命中 addListProc 之外的误报由下面单独列出）
    return re.compile(r'(?<![A-Za-z0-9_])' + re.escape(name) + r'(?![A-Za-z0-9_])')

# =====================================================================
# 判据 1：Procbwlist 0 处残留（版本记录里的历史说明除外）
# 依据 PL-01 §六 TK-1：「`Procbwlist` 0 处残留（版本记录里的历史说明除外）」
# 反向哨兵：正文里出现一次即 FAIL
# =====================================================================
hits = [(n, l[:80]) for n, l in BODY_NEW if 'Procbwlist' in l]
check('J1', '正文 Procbwlist 残留 = 0（反向哨兵）', 'PL-01 §六 TK-1', len(hits) == 0, str(hits))
# 改前事实核对：计划 §3.2 ① 说「Procbwlist/*（18 行）」——用来确认计划对改前的描述，便于发现漏改
old_pb = [i + 1 for i, l in enumerate(OLD) if 'Procbwlist' in l]
check('J1b', '改前 HEAD 含 Procbwlist 的行数 = 18（计划 §3.2 ① 的前提）', 'PL-01 §3.2 ①「Procbwlist/*（18 行）」',
      len(old_pb) == 18, 'HEAD 行号 ' + str(old_pb))
# 这 18 行在改后都已不在正文中以 Procbwlist 出现（被 J1 覆盖）；此外它们原来所在的章节必须属于 §3.2 ① 点名的章节
allowed_pb_secs = {'2.1', '7.5', '8.2', '8.4', '9', '14.1', '4.2', '5.3', '7.4', '13', '11.1'}
pb_secs = sorted(set(SEC_OLD[n - 1] for n in old_pb))
report.append('- 改前 18 行 Procbwlist 所在章节：' + '、'.join(pb_secs))

# =====================================================================
# 判据 2：F-16 里的每个设计名都已替换
# 依据 PL-01 F-16（整行）：
#  「getProcList → procManager；getProcReportTerminals → procEpList；getProcInLists → procWBList；
#    Procbwlist/getLists → getWBList；getSimpleLists → getBWName；addList / editList / delList →
#    createWBList / editWBList / delWBList；getListProcs → showWBList；addListProc → addProcToWBList；
#    addProcsToLists → addProcToBW（按进程列表）+ addWByWhere（按查询条件）…
#    101 还没有：publishList、getListUsedGroupId、setListGroups、removeListProc、restoreListProc」
#  影响列：「没有的前 3 个按 §四 建议名，后 2 个属于名单进程页，标「待后端定名」」
# =====================================================================
OLD_NAMES = ['getProcList', 'getProcReportTerminals', 'getProcInLists', 'getLists', 'getSimpleLists',
             'addList', 'editList', 'delList', 'getListProcs', 'addListProc', 'addProcsToLists',
             'publishList', 'getListUsedGroupId', 'setListGroups', 'removeListProc', 'restoreListProc']
for nm in OLD_NAMES:
    rx = word_re(nm)
    h = [(n, l[:70]) for n, l in BODY_NEW if rx.search(l)]
    check('J2.' + nm, '正文旧设计名 ' + nm + ' 残留 = 0（反向哨兵）', 'PL-01 F-16', len(h) == 0, str(h))
# 旧控制器文件名也不应残留（14.1 原写「新控制器 Procmanager.php、Procbwlist.php」）——被 J1 覆盖，这里单列便于定位
check('J2.file', '正文无 Procbwlist.php', 'PL-01 §3.2 ①（14.1）', not any('Procbwlist.php' in l for _, l in BODY_NEW))

# 新名字必须在第 9 节接口表里出现（F-16 目标名 + §四 建议名）
sec9 = sec_text(NEW, SEC_NEW, '9')
NEW_NAMES_101 = ['procManager', 'procEpList', 'procWBList', 'getWBList', 'getBWName', 'createWBList',
                 'editWBList', 'delWBList', 'showWBList', 'addProcToWBList', 'addProcToBW', 'addWByWhere']
SUGGEST = ['publishWBList', 'getWBListUsedGroupId', 'setWBListGroups']   # 依据 PL-01 §四 4.3～4.5 标题里的建议名
for nm in NEW_NAMES_101 + SUGGEST:
    check('J2.in9.' + nm, '第 9 节接口表含 ' + nm, 'PL-01 F-16 / §四', word_re(nm).search(sec9) is not None)
# 名单进程的移除、恢复：标「待后端定名」
check('J2.tbd', '第 9 节对移除、恢复标「待后端定名」/「待后端定」', 'PL-01 F-16 影响列「后 2 个…标「待后端定名」」',
      ('待后端定名' in sec9) and re.search(r'移除、恢复[^\n]*待后端定', sec9) is not None)

# 新名字在 101 只读副本里的真实性：「101 已有」的 12 个必须是 101 控制器里的 Action，且 ACL 登记角色 ['2','8']；
# 3 个建议名在 101 上必须**不存在**（否则就不该叫「101 还没有」）
ctl = open(os.path.join(R, 'esmCenter/controllers/Procmanager.php'), encoding='utf-8', errors='replace').read()
acl = open(os.path.join(R, 'esmCenter/conf/acl-login.php.conf'), encoding='utf-8', errors='replace').read()
actions = set(re.findall(r'function\s+(\w+)Action\s*\(', ctl))
report.append('- 101 只读副本 `Procmanager.php` 的 Action（共 %d 个）：%s' % (len(actions), '、'.join(sorted(actions))))
check('J2.101count', '101 控制器 Action 总数 = 15', 'PL-01 F-16「读 101 controllers/Procmanager.php 全部 15 个 Action」', len(actions) == 15, str(sorted(actions)))
for nm in NEW_NAMES_101:
    m = re.search(r"'Procmanager/" + nm + r"'\s*=>\s*\[\s*'login'\s*=>\s*\[[^\]]*?'roles'\s*=>\s*\[([^\]]*)\]", acl, re.S)
    roles = re.findall(r"'(\d+)'", m.group(1)) if m else None
    # 【返工轮】这条只核 101 副本里的事实（Action 存在、ACL 角色 = 2,8），不依赖文档措辞；
    #  文档措辞已按 I2 改为「ACL 登记为 ['2','8']，要改为 8m」，措辞由下面 J2.i2.* 单独检查
    check('J2.101.' + nm, nm + ' 是 101 Action 且 101 ACL 角色 = [2,8]（文档现状列据此写「ACL 登记为 [2,8]，要改为 8m」）',
          'PL-01 F-4 / F-16；01 第 9 节表格', nm in actions and roles == ['2', '8'], 'action=%s roles=%s' % (nm in actions, roles))
for nm in SUGGEST:
    check('J2.101no.' + nm, nm + ' 在 101 上不存在（建议名）', 'PL-01 F-16「101 还没有」', nm not in actions)

# 对照关系没张冠李戴：改前接口表里旧名那一行的「用途」，要原样出现在改后对应新名那一行（去掉「；需二次认证」）
# 依据：F-16 是「改名」对照，用途不变
def table_rows(lines, secs, key):
    return [l for i, l in enumerate(lines) if secs[i] == key and l.startswith('| `')]
old9 = table_rows(OLD, SEC_OLD, '9')
new9 = table_rows(NEW, SEC_NEW, '9')
def row_of(rows, name):
    rx = word_re(name)
    for r in rows:
        first = r.split('|')[1]
        if rx.search(first):
            return r
    return None
MAP = {'getProcList': 'procManager', 'getProcReportTerminals': 'procEpList', 'getProcInLists': 'procWBList',
       'getLists': 'getWBList', 'getSimpleLists': 'getBWName', 'addList': 'createWBList',
       'publishList': 'publishWBList', 'getListUsedGroupId': 'getWBListUsedGroupId',
       'setListGroups': 'setWBListGroups', 'getListProcs': 'showWBList', 'addListProc': 'addProcToWBList'}
for o, n in MAP.items():
    ro, rn = row_of(old9, o), row_of(new9, n)
    if ro is None or rn is None:
        check('J2.map.' + o, '接口表 ' + o + ' → ' + n + ' 用途一致', 'PL-01 F-16', False, 'old=%s new=%s' % (ro, rn))
        continue
    use_o = re.sub(r'；需二次认证', '', ro.split('|')[2].strip())
    use_n = rn.split('|')[2].strip()
    check('J2.map.' + o, '接口表 ' + o + ' → ' + n + ' 用途一致（「' + use_o[:24] + '」）', 'PL-01 F-16',
          use_n.startswith(use_o.split('（')[0]), 'old=%s | new=%s' % (use_o, use_n))
# addProcsToLists 一分为二：addProcToBW（按规则键、日志 ID）+ addWByWhere（按条件）
r1, r2 = row_of(new9, 'addProcToBW'), row_of(new9, 'addWByWhere')
check('J2.map.split', 'addProcsToLists 拆成 addProcToBW（规则键/日志 ID）+ addWByWhere（按条件）',
      'PL-01 F-16「addProcToBW（按进程列表）+ addWByWhere（按查询条件）」',
      bool(r1 and r2 and '批量加入' in r1 and '按条件' in r2), 'addProcToBW=%s | addWByWhere=%s' % (r1, r2))

# 「procManager 前端没调用，删除」两处都删（3.2 ACL 行的半句 + 第 9 节那一行）
# 依据 PL-01 §3.2 ①「删掉「procManager 前端没调用，删除」那行」+ 主 Agent 口径「两处都删」
h = [(n, l[:80]) for n, l in BODY_NEW if '前端没调用' in l]
check('J2.del', '正文「前端没调用」= 0（反向哨兵，3.2 与第 9 节两处）', 'PL-01 §3.2 ①；F-16', len(h) == 0, str(h))
row_pm = row_of(new9, 'procManager')
check('J2.pmrow', '第 9 节 procManager 行是「进程管理聚合列表」且不是「删除」', 'PL-01 F-16「101 上它就是进程管理列表」',
      bool(row_pm) and '进程管理聚合列表' in row_pm and '删除' not in row_pm, str(row_pm))

# §3.2 ① 点名章节的正向检查
s21 = sec_text(NEW, SEC_NEW, '2.1')
check('J2.s21', '2.1 组件图：Procmanager 包含名单，不再有独立名单控制器', 'PL-01 §3.2 ① 2.1；Q4「统一放 Procmanager/*」',
      re.search(r'Procmanager（[^）]*名单', s21) is not None and 'Procbwlist' not in s21)
s82 = sec_text(NEW, SEC_NEW, '8.2')
check('J2.s82', '8.2 接口行含 Procmanager/addProcToBW', 'PL-01 §3.2 ① 8.2；F-16', 'Procmanager/addProcToBW' in s82)
s84 = sec_text(NEW, SEC_NEW, '8.4')
m84 = [l for l in s84.split('\n') if l.startswith('- 接口：')]
check('J2.s84', '8.4 接口行 = procManager、procEpList、procWBList、addProcToBW、addWByWhere', 'PL-01 §3.2 ① 8.4；F-16',
      len(m84) == 1 and all(word_re(x).search(m84[0]) for x in ['procManager', 'procEpList', 'procWBList', 'addProcToBW', 'addWByWhere']), str(m84))
s75 = sec_text(NEW, SEC_NEW, '7.5')
check('J2.s75', '7.5 分组树 url = Procmanager/getWBListUsedGroupId，提交 = Procmanager/setWBListGroups', 'PL-01 §3.2 ① 7.5；§四 4.4/4.5',
      "url:'Procmanager/getWBListUsedGroupId'" in s75 and 'Procmanager/setWBListGroups' in s75)
s141 = sec_text(NEW, SEC_NEW, '14.1')
check('J2.s141', '14.1 新控制器只写 Procmanager.php', 'PL-01 §3.2 ① 14.1；Q4', 'Procmanager.php' in s141 and 'Procbwlist' not in s141)
s74 = sec_text(NEW, SEC_NEW, '7.4')
check('J2.s74', '7.4 伪代码函数名 = publishWBList', 'PL-01 F-16 / §四 4.3 建议名', 'publishWBList(pid)' in s74)

# ---------- 【返工轮新增】I2：名单 / 进程管理接口一律 8m，101 现状要标「要改为 8m」 ----------
# 依据 01 §4.2 ③「进程管理、名单的所有接口（含只读）、日志加白加黑登记 "8m"」+ 主 Agent 08:19 内审第 1 轮核准 I2
OLD_ACL_PHRASE = "ACL 已登记（`['2','8']`）"
h = [(n, l[:60]) for n, l in BODY_NEW if OLD_ACL_PHRASE in l]
check('J2.i2.neg', '正文不再有旧写法「ACL 已登记（[\'2\',\'8\']）」（反向哨兵）', '01 §4.2 ③；核准 I2', len(h) == 0, str(h))
have101 = [r for r in new9 if '101 已有' in r]
bad = [r[:50] for r in have101 if "ACL 登记为 `['2','8']`，要改为 8m" not in r]
check('J2.i2.rows', '第 9 节每个「101 已有」的行都写「ACL 登记为 [\'2\',\'8\']，要改为 8m」（共 %d 行）' % len(have101), '01 §4.2 ③；核准 I2',
      len(have101) >= 10 and not bad, str(bad))
# 这些行的「角色」列必须是 8m（不能被改成 2, 8）
badrole = [r[:50] for r in have101 if r.split('|')[3].strip() != '8m']
check('J2.i2.role', '「101 已有」各行的角色列 = 8m', '01 §4.2 ③', not badrole, str(badrole))
s32 = sec_text(NEW, SEC_NEW, '3.2')
acl32 = [l for l in s32.split('\n') if l.startswith('| `esmCenter/conf/acl-login.php.conf')]
check('J2.i2.32', '3.2 ACL 行的处理里有「procManager … 改为 8m」', '01 §4.2 ③；核准 I2',
      len(acl32) == 1 and re.search(r'`procManager`[^|]*改为 8m', acl32[0].split('|')[3]) is not None, str(acl32))

# ---------- 【返工轮新增】I1：addProcToBW 现状写明 101 只收进程列表、按日志 ID 入参还没有；8.2 不改 ----------
# 依据 PL-01 F-16「addProcsToLists → addProcToBW（按进程列表）+ addWByWhere（按查询条件）」+ 核准 I1
rbw = row_of(new9, 'addProcToBW') or ''
check('J2.i1.row', 'addProcToBW 行现状：101 只收进程列表，按日志 ID 入参还没有', 'PL-01 F-16；核准 I1',
      '只收进程列表' in rbw.split('|')[4] and '日志 ID' in rbw.split('|')[4] and '还没有' in rbw.split('|')[4] if rbw.count('|') >= 5 else False, rbw)
check('J2.i1.82', '8.2「**后端只接收日志 ID**」原句仍在，且 8.2 除接口行外与改前逐字相同（反向回归）', '核准 I1「8.2 正文不改」',
      '**后端只接收日志 ID**' in s82 and
      [l for l in s82.split('\n') if not l.startswith('- 接口：')] == [l for l in sec_text(OLD, SEC_OLD, '8.2').split('\n') if not l.startswith('- 接口：')])
mbw = re.search(r'function\s+addProcToBWAction\s*\(.*?(?=\n\s*(?:public|private|protected)\s+function|\Z)', ctl, re.S)
pre = ctl[max(0, ctl.find('function addProcToBWAction') - 1500):ctl.find('function addProcToBWAction')]
check('J2.i1.101', '101 副本 addProcToBW 的入参是 proclist（进程列表），没有日志 ID 入参', 'PL-01 F-16「addProcToBW（按进程列表）」',
      bool(mbw) and 'proclist' in (pre + mbw.group(0)) and not re.search(r'logid|logids|日志\s*ID', pre[pre.rfind('/**'):] + mbw.group(0), re.I))

# =====================================================================
# 判据 3：3304 / 3305 只在版本记录里出现；名单操作沿用 3303；保留并改写补登记要求（F-17）
# 依据 PL-01 §六 TK-1「3304 / 3305 只在版本记录里出现」；§3.2 ②；Q6；F-17
# =====================================================================
h = [(n, l[:80]) for n, l in BODY_NEW if re.search(r'330[45]', l)]
check('J3', '正文 3304/3305 = 0（反向哨兵）', 'PL-01 §六 TK-1', len(h) == 0, str(h))
old_34 = [i + 1 for i, l in enumerate(OLD) if re.search(r'330[45]', l)]
check('J3b', '改前 HEAD 含 3304/3305 的行数 = 7（计划 §3.2 ② 的前提）', 'PL-01 §3.2 ②「（7 行）」', len(old_34) == 7, str(old_34))
check('J3.use3303', '第 9 节写明「名单操作沿用 3303」', 'PL-01 Q6「名单操作沿用 101 现用的 3303」', '名单操作沿用 3303' in sec9)
fc_rows = [l for l in sec9.split('\n') if re.match(r'^\| \d{4} \|', l)]
check('J3.table', '第 9 节功能码表只剩 6001、3303 两行', 'PL-01 §3.2 ②「删掉 3304、3305 的分工」',
      [l.split('|')[1].strip() for l in fc_rows] == ['6001', '3303'], str([l[:20] for l in fc_rows]))
r3303 = [l for l in fc_rows if l.startswith('| 3303')]
# 【返工轮新增】B1/S3：3303 的名称格要能看出「名称待定」，且不得出现新定的名称
#   判法：名称格去掉「（名称待定…）」括注后，必须逐字等于改前的「进程管控-策略」（即没有新起名字）
#   依据：用户答复「暂不定，作为待问项交后端」；主 Agent 08:19 核准 B1/S3
o3303 = [l for l in sec_text(OLD, SEC_OLD, '9').split('\n') if l.startswith('| 3303')]
name_new = r3303[0].split('|')[2].strip() if r3303 else ''
name_old = o3303[0].split('|')[2].strip() if o3303 else None
check('J3.name', '3303 名称格含「名称待定」，去掉括注后仍是改前的「%s」' % name_old, '用户答复「暂不定，作为待问项交后端」；核准 B1/S3',
      '名称待定' in name_new and re.sub(r'（名称待定[^）]*）', '', name_new) == name_old, name_new)
check('J3.3303scope', '3303 行覆盖名单的新建/编辑/删除/发布/应用到组/名单内进程增删/批量加入', 'PL-01 Q6；F-17',
      bool(r3303) and all(k in r3303[0] for k in ['新建', '编辑', '删除', '发布', '应用到组', '批量加入']), str(r3303))
# F-17：保留并改写「operlog.js、Export.php 补登记」要求
check('J3.f17', '第 9 节保留补登记：operlog.js 模块数组 [\'6001\',\'3303\']、名称表、Export.php 导出名称表、operlog.html',
      'PL-01 §3.2 ②「保留并改写「operlog.js、Export.php 补登记」的要求（F-17）」',
      "['6001','3303']" in sec9 and 'Export.php' in sec9 and 'operlog.html' in sec9 and '补登记 3303' in sec9)
check('J3.f17_141', '14.1 operlog.js、Export.php 两条都改为「加 3303」', 'PL-01 §3.2 ②；F-17',
      re.search(r'operlog\.js:234、310[^\n]*加 3303（第 9 节）', s141) is not None and re.search(r'Export\.php:1091[^\n]*加 3303（第 9 节）', s141) is not None)
# 101 事实核对：文档说 101 上名单的创建/编辑/删除/添加名单进程（含批量、按条件）都记 3303
for act in ['createWBList', 'editWBList', 'delWBList', 'addProcToWBList', 'addProcToBW', 'addWByWhere']:
    m = re.search(r'function\s+' + act + r'Action\s*\(.*?(?=\n\s*(?:public|private|protected)\s+function|\Z)', ctl, re.S)
    check('J3.101.' + act, '101 ' + act + ' 记 3303', 'PL-01 F-17「名单的创建、编辑、删除、添加名单进程都记 3303」',
          bool(m) and 'add_oplog' in m.group(0) and '3303' in m.group(0))
exp = open(os.path.join(R, 'esmCenter/controllers/Export.php'), encoding='utf-8', errors='replace').read().split('\n')
ln1135 = exp[1134] if len(exp) > 1134 else ''
check('J3.101exp', "101 Export.php:1135 是 '6001'=>'进程管控-概览'（文档写「101 的 Export.php:1135」）", 'PL-01 F-17（计划写 :1133，按 101 副本实测）',
      "'6001'" in ln1135, repr(ln1135.strip()))
opl = open(os.path.join(R, 'public/esm/view/settings/operlog.js'), encoding='utf-8', errors='replace').read().split('\n')
check('J3.101opl', "101 operlog.js:234 只有 6001（文档写「101 上也一样」）", 'PL-01 F-17', "['6001']" in opl[233], repr(opl[233].strip()))

# =====================================================================
# 判据 4：名单相关的「二次认证」全部改完
# 依据 PL-01 §六 TK-1「名单相关的「二次认证」全部改完」；§3.2 ③「名单的新建、编辑、删除、发布、应用到组都不做
#      （16 处「二次认证」逐处判断）」；Q1「二次认证 不做」
# 判法：正文每一处含「二次认证」或 checkToken 的行：
#   - 名单相关（行内有 名单 / WBList）→ 必须同时含「不做 / 不认证 / 不弹 / 无关」之一；
#   - 非名单（进程策略 / 现有代码事实）→ 必须落在已知上下文（RsCore.editPolicy、Policycenter/editPolicy、pOpenClose），
#     未知上下文一律 FAIL 交人工判断，防止漏网。
# =====================================================================
old_auth_lines = [i + 1 for i, l in enumerate(OLD) if '二次认证' in l]
check('J4b', '改前 HEAD 含「二次认证」的行数 = 16（计划 §3.2 ③ 的前提）', 'PL-01 §3.2 ③「16 处「二次认证」逐处判断」',
      len(old_auth_lines) == 16, str(old_auth_lines))
NEG = re.compile(r'不做|不认证|不弹|无关')
LIST = re.compile(r'名单|WBList')
# 非名单的已知上下文：进程策略走策略中心（RsCore.editPolicy / Policycenter/editPolicy），
# 现有代码事实（pOpenClose 没有认证、策略中心 saveRange 分支调 editUsedObject 绕过认证，第 13 节第 17、19 条）
KNOWN_NONLIST = ['RsCore.editPolicy', 'Policycenter/editPolicy', 'pOpenClose', 'editUsedObject']
auth_tab = []
# 按「每一处出现」判，不按整行判：取出现位置前后各 40 个字作为语境窗口
#   窗口里提到名单 → 名单相关 → 窗口里必须有「不做 / 不认证 / 不弹 / 无关」
#   窗口里没提名单 → 非名单 → 这一行必须属于已知非名单上下文，否则 FAIL 交人工
for n, l in BODY_NEW:
    for m in re.finditer(r'二次认证|checkToken', l):
        win = l[max(0, m.start() - 40): m.end() + 40]
        sec = SEC_NEW[n - 1]
        if LIST.search(win):
            ok = NEG.search(win) is not None
            kind = '名单相关'
        else:
            # 语境窗口里明说是「进程策略」也算已知非名单上下文（Q1 只管名单，进程策略仍走策略中心认证）
            ok = any(k in l for k in KNOWN_NONLIST) or ('进程策略' in win)
            kind = '进程策略/现有代码'
        auth_tab.append((n, sec, kind, ok, '…' + win + '…'))
        check('J4.L%d@%d' % (n, m.start()), '第 %d 行（%s）「%s」%s：%s' % (n, sec, m.group(0), kind, '表达不做' if kind == '名单相关' else '属已知非名单上下文'),
              'PL-01 §3.2 ③；Q1', ok, win)
# 反向哨兵：改前要求名单做二次认证的原话，正文一律不得再出现
for pat in ['需二次认证', 'showAuthModal', '提交前弹二次认证', '二次认证 →', '名单照这个惯例', '照 `strategy/index.js:660-675` 的 `setGroup` 分支']:
    h = [(n, l[:60]) for n, l in BODY_NEW if pat in l]
    check('J4.neg.' + pat, '正文不再出现「' + pat + '」（反向哨兵）', 'PL-01 §3.2 ③；Q1', len(h) == 0, str(h))
# 7.4 发布、7.6 删除两节不得再有任何认证步骤
for k in ['7.4', '7.6']:
    t = sec_text(NEW, SEC_NEW, k)
    check('J4.' + k, k + ' 无二次认证 / checkToken 步骤（反向哨兵）', 'PL-01 §3.2 ③（发布、删除不做）',
          '二次认证' not in t and 'checkToken' not in t)
# 第 9 节总规则必须点名五个动作都不做
r9 = [l for l in sec9.split('\n') if '二次认证' in l and '不做' in l]
check('J4.9rule', '第 9 节总规则点名「新建、编辑、删除、发布、应用到组」都不做', 'PL-01 Q1「名单的新建、编辑、删除、发布、应用到组都不做」',
      bool(r9) and all(k in r9[0] for k in ['新建', '编辑', '删除', '发布', '应用到组']), str([x[:80] for x in r9]))
# 进程策略仍走策略中心自带二次认证（没有被「顺手」一起删掉）——依据 Q1 只管名单
check('J4.keep', '6.3 / 8.3 进程策略仍「自带二次认证」（回归）', 'PL-01 Q1 只定名单；01 6.3、8.3',
      '自带二次认证' in sec_text(NEW, SEC_NEW, '6.3') and '自带二次认证' in sec_text(NEW, SEC_NEW, '8.3'))

# =====================================================================
# §3.2 ④：第 9 节新增「名单接口约定（前端 mock 依据）」小节 = 本计划 §四
# 判法：9.1 必须在 ## 9 与 ## 10 之间；正文与 §四 逐行比对，只允许下列有原文依据的改写：
#   a「设计 X」→「X」（设计文档自引用）；b「（F-11）」换成设计内引用；c 文件路径补 public/ 前缀；
#   d 末句 ACL 角色按用户口径「按设计写 8m，注明 101 现状」；e 表头「设计依据」→「依据」；
#   f 标题层级 / 编号 / 加粗格式；g 小节开头加一句说明。
# 其他任何差异都 FAIL 并列出，交主 Agent 判。
# =====================================================================
idx9 = next(i for i, l in enumerate(NEW) if l.startswith('## 9.'))
idx91 = next((i for i, l in enumerate(NEW) if l.startswith('### 9.1 ')), None)
idx10 = next(i for i, l in enumerate(NEW) if l.startswith('## 10.'))
check('J5.pos', '9.1 存在且位于第 9 节内（## 9 与 ## 10 之间）', 'PL-01 §3.2 ④',
      idx91 is not None and idx9 < idx91 < idx10, 'idx9=%s idx91=%s idx10=%s' % (idx9, idx91, idx10))
check('J5.title', '9.1 标题 =「名单接口约定（前端 mock 依据）」', 'PL-01 §3.2 ④', idx91 is not None and NEW[idx91].strip() == '### 9.1 名单接口约定（前端 mock 依据）', NEW[idx91] if idx91 else '')
p4s = next(i for i, l in enumerate(PLAN) if l.startswith('## 四、'))
p4e = next(i for i, l in enumerate(PLAN) if l.startswith('## 五、'))
plan4 = PLAN[p4s + 1:p4e]
doc91 = NEW[idx91 + 1:idx10] if idx91 is not None else []

def norm(lines, is_doc):
    out = []
    for l in lines:
        s = l.strip()
        if not s or s == '---':
            continue
        if is_doc and s.startswith('名单列表页前端先用 mock'):
            continue                                  # g 小节开头的说明句
        s = re.sub(r'^### 4\.\d+ ', '', s)            # f 计划的小标题
        s = re.sub(r'^\*\*9\.1\.\d+ (.*)\*\*$', r'\1', s)   # f 文档的加粗小标题
        s = s.replace('**入参**（', '入参（').replace('**出参**：', '出参：')   # f 加粗
        s = s.replace('照设计 ', '照 ')                  # a 「照设计 8.8」→「照 8.8」
        s = re.sub(r'设计 (\d)', r'\1', s)              # a 「设计 7.2」→「7.2」
        s = s.replace('设计依据', '依据')               # e 表头
        s = s.replace('`public/esm/dep/table/', '`esm/dep/table/')   # c 路径前缀
        # b 计划内部编号 F-11 → 设计内引用（7.5，并点名 strategy/tree.js）；两边都归一成 REF
        s = s.replace('（分组树组件固定这样发，F-11）', '（分组树组件固定这样发，REF）')
        s = s.replace('（分组树组件 `strategy/tree.js` 固定这样发，7.5）', '（分组树组件固定这样发，REF）')
        if s.startswith('新增的 3 个接口需要后端补 ACL 登记'):
            s = 'ACL-LAST-SENTENCE'                     # d 用户口径，单独检查
        out.append(s)
    return out

np4, nd = norm(plan4, False), norm(doc91, True)
diff = [d for d in difflib.unified_diff(np4, nd, 'PL-01 §四', '01 §9.1', lineterm='', n=0) if not d.startswith('@@')]
diff_body = [d for d in diff if not d.startswith('---') and not d.startswith('+++')]
check('J5.same', '9.1 正文与 PL-01 §四 一致（允许的改写之外零差异）', 'PL-01 §3.2 ④「= 本计划 §四」', len(diff_body) == 0, '\n        '.join(diff_body))
last = [l for l in doc91 if l.startswith('新增的 3 个接口需要后端补 ACL 登记')]
check('J5.acl', '9.1 末句：角色写 8m，并注明 101 现有登记 [\'2\',\'8\']（用户口径）', '主 Agent 转达用户答复「按设计写 8m，注明 101 现状」；01 §4.2 ③',
      len(last) == 1 and '8m' in last[0] and "['2','8']" in last[0] and 'mock 在发请求前就拦下了' in last[0], str(last))
# 【返工轮新增】S2：9.1 开头说明句写明 9.1.6 末句 ACL 角色按本文写 8m、与 PL-01 §四 4.6 不同。
#   J5.same 的归一化本来就把「名单列表页前端先用 mock」开头的说明句当作事先列出的允许改写 g 跳过，不受影响；
#   这里单独卡住说明句的内容。依据：主 Agent 08:19 核准 S2
intro = [l for l in doc91 if l.startswith('名单列表页前端先用 mock')]
check('J5.intro', '9.1 开头说明：9.1.6 末句角色写 8m，与 PL-01 §四 4.6 不同', '核准 S2；01 §4.2 ③',
      len(intro) == 1 and all(k in intro[0] for k in ['9.1.6', '8m', '4.6']), str(intro))
# 4 个拦截地址都在 9.1 里点到名（§四 4.1「只拦截下面 4 个地址」）
t91 = '\n'.join(doc91)
check('J5.four', '9.1 点到 4 个被拦截地址 getWBList / publishWBList / getWBListUsedGroupId / setWBListGroups', 'PL-01 §四 4.1～4.5',
      all('Procmanager/' + x in t91 for x in ['getWBList', 'publishWBList', 'getWBListUsedGroupId', 'setWBListGroups']))

# =====================================================================
# §3.2 ⑤：12.1 新增 F-6 三处分歧；设计正文暂不改
# 依据 PL-01 §3.2 ⑤「12.1 新增待对齐项：F-6 的三处分歧（STATUS 存名单类型、名单用进程管控产品号、名称可重名），设计正文暂不改」
# =====================================================================
s121 = sec_text(NEW, SEC_NEW, '12.1')
o121 = sec_text(OLD, SEC_OLD, '12.1')
rows121 = [l for l in s121.split('\n') if re.match(r'^\| P\d+ \|', l)]
orows121 = [l for l in o121.split('\n') if re.match(r'^\| P\d+ \|', l)]
added = [l for l in rows121 if l not in orows121]
# 【返工轮改】原来是「恰好新增 1 行」，只依据 §3.2 ⑤。口径变更后改为「恰好新增 2 行」：
#   依据 PL-01 R-4 原句「| R-4 | 101 后端和设计不一致（F-6 三处）、审计日志页筛不出 3303（F-17） |
#        写进设计文档 12.1 待对齐，告诉后端同事；不在本计划改 |」+ §3.2 ⑤（不排他）
#   + 主 Agent 08:19 内审第 1 轮核准 B1（F-17 也进 12.1）。
#   一行是 F-6 三处分歧，一行是 F-17（审计日志页筛不出 3303 / 补登记 3303）；原有各行逐字不变。
F6 = [l for l in added if 'STATUS' in l and '重名' in l]
F17 = [l for l in added if '3303' in l and '筛不出' in l]
check('J6.added', '12.1 恰好新增 2 行（F-6 一行 + F-17 一行），原有各行逐字不变', 'PL-01 R-4；§3.2 ⑤；主 Agent 08:19 内审第 1 轮核准 B1',
      len(added) == 2 and len(F6) == 1 and len(F17) == 1 and F6 != F17 and all(l in rows121 for l in orows121),
      'added=%d F6=%d F17=%d' % (len(added), len(F6), len(F17)))
f17 = F17[0] if F17 else ''
check('J6.f17', 'F-17 那一行：审计日志页筛不出 3303、要补登记（operlog.js / Export.php），3303 名称待定', 'PL-01 R-4、F-17；用户答复「暂不定，作为待问项交后端」',
      all(k in f17 for k in ['审计日志页', '3303', 'operlog.js', 'Export.php']) and '名称待定' in f17, f17[:200])
check('J6.f17.i1', 'F-17 那一行带上「101 的 addProcToBW 只收进程列表、没有按日志 ID 的入参」', 'PL-01 F-16「addProcToBW（按进程列表）」；主 Agent 08:19 核准 I1',
      'addProcToBW' in f17 and '进程列表' in f17 and '日志 ID' in f17, f17[:300])
a = F6[0] if F6 else ''
check('J6.three', '新增项含三处分歧：STATUS 存名单类型 / 名单用 PROCM 产品号 / 名称可重名', 'PL-01 §3.2 ⑤；F-6 ①②③',
      ('STATUS' in a and '名单类型' in a) and ('PRODUCTID' in a and ('PROCM' in a or '2DA19BD4' in a)) and ('重名' in a and 'test666' in a), a[:200])
check('J6.nochange', '新增项写明「设计正文暂不改」', 'PL-01 §3.2 ⑤「设计正文暂不改」', '设计正文暂不改' in a)
mcount = re.search(r'### 12\.1 待对齐（(\d+) 项', '\n'.join(NEW))
check('J6.count', '12.1 标题项数 = 表格行数', '文档自洽（12.1 标题计数）', bool(mcount) and int(mcount.group(1)) == len(rows121),
      'title=%s rows=%d' % (mcount.group(1) if mcount else None, len(rows121)))
# 反向回归：「设计正文暂不改」→ F-6 涉及的正文条款逐字不变：K3、K4、5.2、7.1、8.5、C5
def grab(lines, secs, key):
    return sec_text(lines, secs, key)
for key in ['5.2', '7.1', '8.5']:
    check('J6.keep.' + key, key + ' 与改前逐字相同（F-6 分歧不改正文）', 'PL-01 §3.2 ⑤「设计正文暂不改」',
          grab(NEW, SEC_NEW, key) == grab(OLD, SEC_OLD, key))
for tag in ['| K3 |', '| K4 |', '| C5 |']:
    a1 = [l for l in NEW if l.startswith(tag)]
    a0 = [l for l in OLD if l.startswith(tag)]
    check('J6.keep.' + tag.strip('| '), tag.strip('| ') + ' 行与改前逐字相同', 'PL-01 §3.2 ⑤「设计正文暂不改」', a1 == a0 and len(a1) == 1)

# =====================================================================
# §3.2 ⑥：版本记录加一条
# =====================================================================
vr_new = [l for i, l in enumerate(NEW) if SEC_NEW[i] == '版本记录' and l.startswith('- ')]
vr_old = [l for i, l in enumerate(OLD) if SEC_OLD[i] == '版本记录' and l.startswith('- ')]
new_items = [l for l in vr_new if l not in vr_old]
check('J7.one', '版本记录新增 1 条，原有各条不变', 'PL-01 §3.2 ⑥「版本记录加一条」', len(new_items) == 1 and all(l in vr_new for l in vr_old), str(len(new_items)))
vi = new_items[0] if new_items else ''
check('J7.cover', '新增条覆盖接口名、3303、二次认证、9.1、12.1 新项', 'PL-01 §3.2 ①～⑤',
      all(k in vi for k in ['Procmanager', '3303', '二次认证', '9.1', '12.1']) and 'PL-01' in vi)
# 【返工轮新增】版本记录同步本轮核准改动：P23、3303 名称待定、8m（主 Agent 08:19 核准清单「版本记录第 27 行同步」）
check('J7.cover2', '新增条同步提到 P22、P23、3303 名称待定、8m', '主 Agent 08:19 内审第 1 轮核准（B1/S3、I2、版本记录同步）',
      all(k in vi for k in ['P22', 'P23', '名称待定', '8m']), vi[-300:])
# 版本记录自述「哪些章节同步」与实际 diff 一致（防止版本记录说改了、正文没改）
sm = difflib.SequenceMatcher(a=OLD, b=NEW, autojunk=False)
changed_secs = set()
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == 'equal':
        continue
    for i in range(i1, i2):
        changed_secs.add(SEC_OLD[i])
    for j in range(j1, j2):
        changed_secs.add(SEC_NEW[j])
report.append('- 实际有改动的章节：' + '、'.join(sorted(changed_secs)))
claimed = ['2.1', '3.2', '4.2', '5.3', '7.4', '7.5', '8.2', '8.4', '9', '11.1', '13', '14.1', '2.3', '7.6', '12.1', '0']
for c in claimed:
    check('J7.claim.' + c, '版本记录声称同步的 ' + c + ' 确有改动', '01 版本记录 10-21 补充条（自洽）', c in changed_secs)

# =====================================================================
# 范围守卫（回归）：改动只落在 TASK_SPEC「落到本 TK 的设计条款」里的章节
# 依据：TASK_SPEC「01 §2.1、§2.3、§3.2、§4.2、§5.3、§7.4、§7.5、§7.6、§8.2、§8.4、§9、§11.1、§12.1、§13(第 19 条)、§14.1、版本记录」
# =====================================================================
# 【返工轮改】加入第 '0' 节：主 Agent 08:19 内审第 1 轮核准 I3（12.1 新增 P22/P23 后，第 0 节按找谁汇总 12.1 的那句要连带同步）。
#   第 0 节只放行「新增一句」，由下面的 J8.s0 细粒度卡住。
ALLOWED = {'版本记录', '0', '2.1', '2.3', '3.2', '4.2', '5.3', '7.4', '7.5', '7.6', '8.2', '8.4', '9', '9.1', '11.1', '12.1', '13', '14.1'}
out_of_scope = sorted(changed_secs - ALLOWED)
check('J8.scope', '改动只落在条款覆盖表列出的章节（+ 第 0 节，I3）', 'TASK_SPEC 落到本 TK 的设计条款；主 Agent 08:19 内审第 1 轮核准 I3', not out_of_scope, str(out_of_scope))
# J8.s0：第 0 节与改前相比，行数相同、只有一行不同；那一行 = 改前原句中间插入一段（前后缀逐字保留，没删任何字），
#        插入的这段指向 P22、P23，找的是后端开发。依据：主 Agent 08:19 内审第 1 轮核准 I3
s0n = [l for i, l in enumerate(NEW) if SEC_NEW[i] == '0']
s0o = [l for i, l in enumerate(OLD) if SEC_OLD[i] == '0']
diffidx = [k for k in range(min(len(s0n), len(s0o))) if s0n[k] != s0o[k]]
ins = ''
ok0 = len(s0n) == len(s0o) and len(diffidx) == 1
if ok0:
    o_, n_ = s0o[diffidx[0]], s0n[diffidx[0]]
    p = 0
    while p < min(len(o_), len(n_)) and o_[p] == n_[p]:
        p += 1
    q = 0
    while q < min(len(o_), len(n_)) - p and o_[len(o_) - 1 - q] == n_[len(n_) - 1 - q]:
        q += 1
    removed = o_[p:len(o_) - q]
    ins = n_[p:len(n_) - q]
    ok0 = removed == '' and 'P22' in ins and 'P23' in ins and '后端开发' in ins
check('J8.s0', '第 0 节只新增一句（指向 P22/P23、找后端开发），其他行逐字不变', '主 Agent 08:19 内审第 1 轮核准 I3', ok0,
      'lens new=%d old=%d diffs=%s ins=%s' % (len(s0n), len(s0o), diffidx, ins[:120]))
# 第 13 节只允许动第 19 条
s13_changed = []
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == 'equal':
        continue
    for j in range(j1, j2):
        if SEC_NEW[j] == '13':
            s13_changed.append(NEW[j][:12])
    for i in range(i1, i2):
        if SEC_OLD[i] == '13':
            s13_changed.append(OLD[i][:12])
check('J8.s13', '第 13 节只改了第 19 条', 'TASK_SPEC「§13(第 19 条)」', all(x.startswith('| 19 |') for x in s13_changed), str(s13_changed))

# =====================================================================
# 判据 5：生成器、检查脚本通过（只读 --check 模式）
# 依据 PL-01 §六 TK-1「生成器、检查脚本通过」；ENTRY_CONTRACT 给的三条命令
# =====================================================================
CMDS = [['python3', '.claude/scripts/gen-index.py', 'changelog', '--check'],
        ['python3', '.claude/scripts/gen-index.py', 'insights', '--check'],
        ['python3', '.claude/skills/update-current-status/scripts/check_current_status.py', 'CurrentStatus.md']]
for c in CMDS:
    p = subprocess.run(c, cwd=REPO, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    txt = p.stdout.decode('utf-8', 'replace').strip()
    report.append('- `%s` → 退出码 %d：%s' % (' '.join(c), p.returncode, txt[-300:].replace('\n', ' / ')))
    check('J9.' + c[-2] if c[-1] == '--check' else 'J9.status', ' '.join(c[1:]) + ' 退出码 0', 'PL-01 §六 TK-1「生成器、检查脚本通过」', p.returncode == 0, txt[-300:])

# ---------------------------------------------------------------
# 汇总 + 写结果文件
# ---------------------------------------------------------------
n_ok = sum(1 for r in results if r[3])
n_bad = len(results) - n_ok
print('\n合计 %d 条：PASS %d，FAIL %d' % (len(results), n_ok, n_bad))
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('# PL-01 TK-1 验收结果\n\n合计 %d 条：PASS %d，FAIL %d\n\n' % (len(results), n_ok, n_bad))
    f.write('| 编号 | 断言 | 依据 | 结果 | 详情 |\n|---|---|---|---|---|\n')
    for cid, name, basis, ok, detail in results:
        f.write('| %s | %s | %s | %s | %s |\n' % (cid, name.replace('|', '\\|'), basis.replace('|', '\\|'), 'PASS' if ok else '**FAIL**',
                                                ('' if ok else detail).replace('|', '\\|').replace('\n', ' ')[:300]))
    f.write('\n## 正文每一处「二次认证 / checkToken」逐处判定\n\n| 行 | 章节 | 判定 | 结论 | 原文（截断） |\n|---|---|---|---|---|\n')
    for n, sec, kind, ok, l in auth_tab:
        f.write('| %d | %s | %s | %s | %s |\n' % (n, sec, kind, 'OK' if ok else '**不合格**', l.replace('|', '\\|')[:160]))
    f.write('\n## 附加记录\n\n' + '\n'.join(report) + '\n')
sys.exit(1 if n_bad else 0)
