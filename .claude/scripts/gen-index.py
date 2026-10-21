#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""通用索引生成器:给 changelog/ 与 insights/ 各自生成一份 INDEX.md。

为什么要有这个脚本
  索引靠人手同步必然漂移、必然漏条(insights/ 早期就是这么吃亏的)。
  所以索引里的每一条、每个数字都从文件实际内容机械提取,写字的人不参与。
  (本脚本移植自 soc-cascade-syslog 项目,2026-10-21。)
  两个目录的文件长得一样(时间戳文件名 + name/description 头部),就用同一个脚本管,
  只靠 KINDS 里的预设区分差异,不复制两份脚本。

用法(在仓库任意位置跑都行,脚本按自己所在位置定位仓库根):
    python3 .claude/scripts/gen-index.py changelog            # 打印到 stdout,自己比对
    python3 .claude/scripts/gen-index.py changelog --write    # 覆盖 changelog/INDEX.md
    python3 .claude/scripts/gen-index.py changelog --check    # 只比对:索引过期就退出码 1
    python3 .claude/scripts/gen-index.py insights  --write    # insights 同理
    加 --allow-shrink:条目数比上一版少时的显式放行(见「收缩哨兵」)

硬规则(不满足就退出码非 0,并且 --write 拒绝写入):
  1. 每个文件必须有 frontmatter 的 name 和 description;
  2. description 不超过 DESC_MAX 字(按字符数,中文一字一算)——
     索引会被 Agent 每次开机读,写长了挤占上下文;细节放正文和二级标题;
  3. 文件名必须符合 CLAUDE.md「时间戳命名规则」:前缀-YYYYMMDD-HHmm-主题.md
     (本项目从一开始就是四位 HHmm,不兼容旧项目的两位序号);
  4. 收缩哨兵:条目为 0 或比上一版少,视为文件被误删,拒绝写入;
  5. (仅 insights)memory 正文点名引用的 insight 文件必须存在,否则算断链。

INDEX.md 是全量生成物,禁止手工编辑——改了下次生成就没了。
说明文字改各 skill 的 assets/INDEX.head.tmpl,条目内容改各文件的 frontmatter。
"""
import collections
import datetime
import glob
import os
import re
import sys

# ---------- 路径:按脚本位置推仓库根,不依赖当前目录 ----------
HERE = os.path.dirname(os.path.abspath(__file__))          # .claude/scripts
ROOT = os.path.dirname(os.path.dirname(HERE))              # 仓库根
# Claude Code 的 memory 目录名 = 仓库绝对路径把 / 换成 -(机械推导,换机器不用改脚本)
MEM_DIR = os.path.expanduser(
    os.path.join('~/.claude/projects', ROOT.replace('/', '-'), 'memory')
)

DESC_MAX = 150        # description 字数上限
RECENT_DAYS = 3       # changelog 「最近 N 个自然日」区块的 N
BODY_MARK = '<!-- gen-index: body-start -->'   # 全量区块起点标记,收缩哨兵按它计数

# ---------- 两种预设:只在这里区分 changelog 与 insights ----------
KINDS = {
    'changelog': dict(
        dir='changelog',
        prefix='log-',
        # 文件名正则:log-YYYYMMDD-HHmm-主题.md
        name_re=r'^log-(\d{8})-(\d{4})-.+\.md$',
        tmpl='.claude/skills/update-changelog/assets/INDEX.head.tmpl',
        recent=True,      # 顶部输出「最近 3 个自然日」区块
        headings=True,    # 每条附带正文二级标题列表(多轮追加也能看见)
        memmap=False,     # 不做 memory 映射
    ),
    'insights': dict(
        dir='insights',
        prefix='insight-',
        # 文件名正则:insight-YYYYMMDD-HHmm-主题.md
        name_re=r'^insight-(\d{8})-(\d{4})-.+\.md$',
        tmpl='.claude/skills/update-insights/assets/INDEX.head.tmpl',
        recent=False,
        headings=False,
        memmap=True,      # 输出「↳ memory:」映射,恢复 memory 时用
    ),
}


def read_meta(cfg, errors):
    """扫目录下所有条目文件,抽 frontmatter 的 name / description,并做硬规则检查。

    返回列表,每项 = dict(path=文件名, day='YYYYMMDD', name, desc, headings=[二级标题])。
    检查不通过的问题追加进 errors,由调用方决定退出码。
    """
    rows = []
    pattern = os.path.join(ROOT, cfg['dir'], cfg['prefix'] + '*.md')
    for full in sorted(glob.glob(pattern)):
        path = os.path.basename(full)
        m = re.match(cfg['name_re'], path)
        if not m:
            errors.append(f'文件名不符合时间戳命名规则: {path}')
            continue
        text = open(full, encoding='utf-8').read()
        name = desc = ''
        if text.startswith('---'):
            end = text.find('\n---', 3)
            fm = text[3:end] if end > 0 else ''
            mm = re.search(r'^name:\s*(.+)$', fm, re.M)
            if mm:
                name = mm.group(1).strip()
            # description 允许折行:取到下一个顶格 key 或 frontmatter 结尾,再压成一行
            mm = re.search(r'^description:\s*(.+?)(?=\n[a-z_]+:|\Z)', fm, re.M | re.S)
            if mm:
                desc = ' '.join(mm.group(1).split())
        if not name or not desc:
            errors.append(f'frontmatter 缺 name 或 description: {path}')
        if len(desc) > DESC_MAX:
            errors.append(f'description 超过 {DESC_MAX} 字(实际 {len(desc)}): {path}')
        # 二级标题:去掉 "## " 前缀,只取正文里的(frontmatter 里不会有)
        heads = [h.strip() for h in re.findall(r'^## +(.+?)\s*$', text, re.M)]
        rows.append(dict(path=path, day=m.group(1), name=name or path,
                         desc=desc, headings=heads))
    return rows


# memory 正文里「像 insight 文件名」的片段:遇到空白、引号、括号、斜杠或中文标点就截断。
# 用贪婪匹配,保证 `移植CLAUDE.md体检清单.md` 这种名字中间带 .md 的不会被截短。
MEM_REF_RE = re.compile(r'insight-\d{8}-\d{4}-[^\s`\'"()\[\]/、,，。;；:：（）「」《》]+\.md')


def read_mem_map(known):
    """扫 memory 文件正文,建「insight 完整文件名 -> {memory 文件}」映射,并找出悬空引用。

    known = insights/ 下实际存在的 insight 文件名集合。
    - 映射按「完整文件名」做子串匹配,不只按 日期-时分 前缀:同一分钟可能建出两条
      insight(2026-10-21 移植时就出现过),只按前缀会把两条互相串到对方的 memory 上。
    - 悬空引用 = memory 里写了、但 insights/ 里不存在的 insight 文件名(由 MEM_REF_RE 找)。
    返回 (mapping, dangling);dangling 每项 = (文件名, {memory 文件})。

    注意:memory 里写不写引用是可选的,所以「没映射」只代表没写引用,
    不代表这条教训没沉淀进 memory。INDEX 头部对此有说明。
    """
    mapping = collections.defaultdict(set)
    dangling = collections.defaultdict(set)
    if not os.path.isdir(MEM_DIR):
        print(f'[提示] memory 目录不存在,映射列留空: {MEM_DIR}', file=sys.stderr)
        return mapping, []
    for path in glob.glob(os.path.join(MEM_DIR, '*.md')):
        base = os.path.basename(path)
        if base == 'MEMORY.md':
            continue
        text = open(path, encoding='utf-8').read()
        for name in known:                       # 正向:已存在的 insight 是否被点名
            if name in text:
                mapping[name].add(base[:-3])
        for hit in MEM_REF_RE.findall(text):     # 反向:点名了但文件不存在
            # hit 里包含某个已存在文件名,说明是正常引用(或被截长),不算悬空
            if not any(name in hit for name in known):
                dangling[hit].add(base[:-3])
    return mapping, sorted(dangling.items())


def entry_lines(row, cfg, mem_map):
    """一条索引条目的 markdown 行;返回 (行列表, 是否已关联 memory)。

    行与行之间用行尾反斜杠做 markdown 硬换行——不用「行尾两个空格」那种写法,
    否则 git diff --check 会把它当尾随空白报出来。
    """
    lines = [f"- **[{row['name']}]({row['path']})**", f"  {row['desc']}"]
    linked = False
    if cfg['headings'] and row['headings']:
        lines.append('  ↳ 段落: ' + ' · '.join(row['headings']))
    if cfg['memmap']:
        # 键 = 完整文件名,与 read_mem_map 一致
        mems = sorted(mem_map.get(row['path'], []))
        if mems:
            linked = True
            lines.append('  ↳ memory: ' + ' · '.join(f'`{x}`' for x in mems))
    # 除最后一行外都补反斜杠;最后一行不补,否则会把下一条也粘上
    return [l + ' \\' for l in lines[:-1]] + [lines[-1]], linked


def build_recent(rows, cfg, mem_map, today):
    """「最近 N 个自然日」区块:按文件名日期取今天与前 N-1 天,新在上、旧在下。

    Agent 开机只读这一段就能知道最近改了什么,不用翻全量。
    """
    allowed = [today - datetime.timedelta(days=i) for i in range(RECENT_DAYS)]
    allowed_str = [d.strftime('%Y%m%d') for d in allowed]
    out = [f"> 窗口:{allowed[-1].isoformat()} ~ {allowed[0].isoformat()}"
           f"(按本机日期 {today.isoformat()} 计算;重跑生成器即刷新)。新在上、旧在下。"]
    picked = [r for r in rows if r['day'] in allowed_str]
    if not picked:
        out.append('- (窗口内没有 changelog)')
    for day in allowed_str:                      # 从今天往前
        todays = [r for r in picked if r['day'] == day]
        if not todays:
            continue
        out.append(f"\n### {day[:4]}-{day[4:6]}-{day[6:]}\n")
        for row in sorted(todays, key=lambda r: r['path'], reverse=True):
            lines, _ = entry_lines(row, cfg, mem_map)
            out.extend(lines)
    return '\n'.join(out)


def build_body(rows, cfg, mem_map):
    """全量区块:按自然月分组、组内按时间升序;返回(正文文本, 已关联 memory 条数)。"""
    out, cur_ym, linked = [BODY_MARK], None, 0
    for row in rows:
        ym = row['day'][:6]
        if ym != cur_ym:
            cur_ym = ym
            out.append(f'\n### {ym[:4]}-{ym[4:6]}\n')
        lines, is_linked = entry_lines(row, cfg, mem_map)
        out.extend(lines)
        linked += int(is_linked)
    return '\n'.join(out), linked


def count_prev_entries(index_path):
    """上一版索引里全量区块的条目数(收缩哨兵用)。

    只数 BODY_MARK 之后的部分,否则 changelog 索引顶部「最近 3 天」区块会把同一条数两次。
    旧版 insights 索引没有标记,就整文件数——旧版本来也只有全量区块。
    """
    if not os.path.exists(index_path):
        return 0
    text = open(index_path, encoding='utf-8').read()
    if BODY_MARK in text:
        text = text[text.find(BODY_MARK):]
    return len(re.findall(r'^- \*\*\[', text, re.M))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = set(a for a in sys.argv[1:] if a.startswith('--'))
    if len(args) != 1 or args[0] not in KINDS:
        print(f"用法: gen-index.py <{'|'.join(KINDS)}> [--write|--check] [--allow-shrink]",
              file=sys.stderr)
        return 2
    kind = args[0]
    cfg = KINDS[kind]
    index_path = os.path.join(ROOT, cfg['dir'], 'INDEX.md')
    tmpl_path = os.path.join(ROOT, cfg['tmpl'])

    errors = []
    rows = read_meta(cfg, errors)
    mem_map, dangling = (read_mem_map(set(r['path'] for r in rows))
                         if cfg['memmap'] else ({}, []))
    today = datetime.datetime.now().astimezone().date()   # 本机系统时区的今天

    # 头部每次都从模板重新注入 —— 不从旧 INDEX.md 里捞。
    # 原因:占位符是一次性的,若沿用旧文件的头部,统计数字会永远停在第一次生成时的值。
    if not os.path.exists(tmpl_path):
        print(f'[错误] 找不到头部模板 {cfg["tmpl"]},无法生成', file=sys.stderr)
        return 2
    head = open(tmpl_path, encoding='utf-8').read()
    if '@@BODY@@' not in head:
        print('[错误] 模板里缺 @@BODY@@ 占位符,无法定位全量区块', file=sys.stderr)
        return 2
    if cfg['recent'] and '@@RECENT@@' not in head:
        print('[错误] 模板里缺 @@RECENT@@ 占位符,无法放「最近 3 天」区块', file=sys.stderr)
        return 2

    body, linked = build_body(rows, cfg, mem_map)
    new = head.replace('@@BODY@@', body)   # 模板末尾自带换行,这里不再加
    if cfg['recent']:
        new = new.replace('@@RECENT@@', build_recent(rows, cfg, mem_map, today))

    # 断链实算:只扫全量区块,避开头部里 `(文件名.md)` 这类模板示例。
    # 诚实说明:条目和链接同源(都来自 glob),这个断言当前恒真;留着是兜住将来
    # 有人改生成逻辑(比如从旧索引继承条目)时引入的真断链。真正防误删的是收缩哨兵。
    targets = sorted(set(re.findall(r'\]\(([^)]*\.md)\)', body)))
    broken = [t for t in targets if not os.path.isfile(os.path.join(ROOT, cfg['dir'], t))]
    # 反向断链:memory 正文里点名引用、但 insights/ 里已不存在的 insight 文件
    # (update-insights 自检第 7 步「反向」靠这里兜底,否则只能靠人眼)
    for name, mems in dangling:
        broken.append('{} (memory {} 引用,文件不存在)'.format(name, '、'.join(sorted(mems))))

    total = len(rows)
    stats = {
        '@@TOTAL@@': total,
        '@@LINKED@@': linked,
        '@@UNLINKED@@': total - linked,
        '@@MEMCOUNT@@': len([p for p in glob.glob(os.path.join(MEM_DIR, '*.md'))
                             if os.path.basename(p) != 'MEMORY.md']),
        '@@BROKEN@@': len(broken),
        '@@TODAY@@': today.isoformat(),
        '@@DESC_MAX@@': DESC_MAX,
        # memory 目录按仓库路径机械推导(见顶部 MEM_DIR),模板里不写死本机路径
        '@@MEMDIR@@': MEM_DIR.replace(os.path.expanduser('~'), '~'),
    }
    for k, v in stats.items():
        new = new.replace(k, str(v))

    # ---------- 硬规则汇总:任一不过就不写 ----------
    for e in errors:
        print(f'[不通过] {e}', file=sys.stderr)
    for t in broken:
        print(f'[断链] {t}', file=sys.stderr)
    prev = count_prev_entries(index_path)
    if total == 0:
        print(f'[拒绝] 一条 {kind} 文件都没扫到 —— 目录空或跑错地方', file=sys.stderr)
        errors.append('zero')
    elif total < prev and '--allow-shrink' not in flags:
        print(f'[拒绝] 条目从 {prev} 掉到 {total},疑似文件被误删。'
              f'确认是有意删除请加 --allow-shrink 重跑。', file=sys.stderr)
        errors.append('shrink')
    if errors or broken:
        print(f'[校验] 未通过,{index_path} 未写入', file=sys.stderr)
        return 1

    # ---------- 输出 ----------
    if '--check' in flags:
        old = open(index_path, encoding='utf-8').read() if os.path.exists(index_path) else ''
        if old == new:
            print(f'[校验] {cfg["dir"]}/INDEX.md 与文件现状一致', file=sys.stderr)
            return 0
        print(f'[过期] {cfg["dir"]}/INDEX.md 与文件现状不一致,请加 --write 重新生成',
              file=sys.stderr)
        return 1
    if '--write' in flags:
        with open(index_path, 'w', encoding='utf-8') as fh:
            fh.write(new)
        print(f'已写入 {index_path}', file=sys.stderr)
    else:
        sys.stdout.write(new)

    print(f'[校验] 条目={total} 正文链接={len(targets)} 断链={len(broken)} '
          f'已关联memory={linked}', file=sys.stderr)
    # 判据:全量区块链接数必须等于条目数,且零断链
    return 0 if (len(targets) == total and not broken) else 1


if __name__ == '__main__':
    sys.exit(main())
