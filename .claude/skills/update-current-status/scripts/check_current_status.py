#!/usr/bin/env python3
"""检查 CurrentStatus.md 的结构、体量、最近摘要节形态和本地链接。"""

from __future__ import print_function

import argparse
import hashlib
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote


REQUIRED_H2 = [
    "当前结论",
    "阶段与文档状态",
    "当前进行中",
    "阻塞项与待确认事项",
    "下一步",
    "最近 3 个自然日摘要",
    "当前权威入口",
    "仓库现场",
]

HISTORY_MARKERS = ("历史审查轨迹", "已由上方取代", "仅供回溯")


def git_output(cwd, *cmd):
    """在 cwd 下跑一条 git 命令，返回 (状态, 值) 四态之一：

      ("ok",      stdout)   git 正常回答
      ("nogit",   None)     git 没装或无法执行 —— 这台机器根本没有 worktree 概念
      ("outside", None)     git 在，但这里不是 git 仓库 —— 合法场景
      ("failed",  原因)     git 在却答不上来（拒答、超时）—— 异常，上层必须 fail-closed

    **必须四态而不是「成功/失败」二态**：把"不在仓库"和"git 拒绝回答"混成同一个失败值，
    上层就只能一律放行，于是 dubious ownership、权限受限、仓库损坏等情况会让闸门
    无声消失——真的处在并行工作区却判 PASS。这类静默失效比报错危险得多。

    环境处理：
      - 清掉 GIT_DIR 等变量，否则外部导出的值会让 git 回答另一个仓库的情况；
      - 固定 LC_ALL=C，保证下面对 stderr 的匹配不受语言环境影响；
      - 给 timeout，否则网络文件系统或被杀软拦住的 git 会把本脚本一起挂死；
      - stdin 置空，防止 git 在异常情况下等待输入。
    """
    env = dict(os.environ)
    for key in ("GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE"):
        env.pop(key, None)
    env["LC_ALL"] = "C"
    try:
        result = subprocess.run(
            ("git",) + cmd,
            cwd=str(cwd),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.DEVNULL,
            env=env,
            timeout=5,
        )
    except subprocess.TimeoutExpired:
        # git 在，只是没能在时限内回答（慢速网络文件系统、被杀软拦截等）。
        # 这属于"答不上来"而不是"没有 git"，必须 fail-closed，不能当成主工作区放行。
        return ("failed", "git 命令超时（5 秒）")
    except (OSError, ValueError):
        # git 不存在或不可执行：这台机器上没有 worktree 可言，放行。
        return ("nogit", None)
    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", "replace").strip()
        # 只有「向上找遍父目录都没有仓库」这种形态才算合法放行（LC_ALL=C 下措辞固定）：
        #   fatal: not a git repository (or any of the parent directories): .git
        # 注意不能只匹配 "not a git repository"——被 `worktree prune` 掉的残留工作区
        # 报的是 "not a git repository: <主仓库>/.git/worktrees/<名>"（带冒号+路径），
        # 那是异常而非"不在仓库"，混进来会让残留并行区被静默放行。
        if "not a git repository (or any" in stderr.lower():
            return ("outside", None)
        return ("failed", stderr)
    return ("ok", result.stdout.decode("utf-8", "replace").strip())


def worktree_state(cwd):
    """判断 cwd 处于哪种 git 环境，返回 (状态, 详情)。

      ("main",    None)          主工作区，或压根不在 git 仓库/没装 git ⇒ 不拦
      ("linked",  (名, 分支))     git worktree add 出来的并行工作区 ⇒ 拦
      ("unknown", 原因)          git 在，但判据问不出来 ⇒ fail-closed，也拦

    判据：git-dir 与 git-common-dir 是否指向同一个 .git。
    主工作区两者相同；linked worktree 的 git-dir 是 <主仓库>/.git/worktrees/<名字>。

    只用 `--git-dir` / `--git-common-dir`（git 2.5+ 即有），**不用 `--path-format`**
    （git 2.31+ 才有）。原因：git rev-parse 对不认识的选项不报错，而是原样打印且
    返回 0——老 git 上会把 "--path-format=absolute" 当成路径的一部分回显，
    结果非空、退出码为 0，一路蒙混过关，最后把主工作区误判成并行区。
    改用相对输出各自按 cwd 做 realpath 再比较，并对输出形态做校验。
    """
    # 先探一次「这里到底是不是 git 工作区」，用四态区分合法放行与异常。
    status, inside = git_output(cwd, "rev-parse", "--is-inside-work-tree")
    if status in ("nogit", "outside"):
        # 没装 git，或这里根本不是 git 仓库：没有 worktree 概念，放行。
        return ("main", None)
    if status == "failed":
        # git 在，却拒绝回答最基本的问题（dubious ownership、权限、仓库损坏等）。
        # 此时无法证明"不在并行工作区"，必须 fail-closed。
        return ("unknown", "git 无法回答 --is-inside-work-tree: {}".format(inside))
    if inside != "true":
        # 裸仓库或 .git 内部；状态页不该在这种地方，不归本闸门管。
        return ("main", None)

    # 到这里 git 已证明自己能正常回答。此后再答不上来就是异常，必须 fail-closed。
    st_git_dir, git_dir = git_output(cwd, "rev-parse", "--git-dir")
    st_common, common_dir = git_output(cwd, "rev-parse", "--git-common-dir")
    if st_git_dir != "ok" or st_common != "ok" or not git_dir or not common_dir:
        return ("unknown", "git 无法回答 --git-dir / --git-common-dir")
    # 形态校验：正常回答是单行路径。多行说明 git 回显了它不认识的选项。
    if "\n" in git_dir or "\n" in common_dir:
        return ("unknown", "git 输出不是单行路径，疑似版本过老回显了未知选项")

    resolved_git_dir = os.path.realpath(os.path.join(str(cwd), git_dir))
    resolved_common = os.path.realpath(os.path.join(str(cwd), common_dir))
    if not os.path.isdir(resolved_git_dir) or not os.path.isdir(resolved_common):
        return ("unknown", "git 给出的路径不存在: {} / {}".format(git_dir, common_dir))

    if resolved_git_dir == resolved_common:
        return ("main", None)

    st_branch, branch = git_output(cwd, "rev-parse", "--abbrev-ref", "HEAD")
    return (
        "linked",
        (
            os.path.basename(resolved_git_dir),
            branch if st_branch == "ok" and branch else "(未知分支)",
        ),
    )


def section(text, heading):
    pattern = re.compile(
        r"^## " + re.escape(heading) + r"\s*$\n(.*?)(?=^## |\Z)", re.M | re.S
    )
    match = pattern.search(text)
    return match.group(1) if match else ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("path", nargs="?", default="CurrentStatus.md")
    parser.add_argument("--soft-lines", type=int, default=150)
    parser.add_argument("--soft-bytes", type=int, default=15 * 1024)
    parser.add_argument("--hard-lines", type=int, default=200)
    parser.add_argument("--hard-bytes", type=int, default=20 * 1024)
    parser.add_argument(
        "--allow-worktree",
        action="store_true",
        help="允许在并行工作区(git worktree)里更新状态页；"
             "仅限用户明确指令，默认禁止",
    )
    args = parser.parse_args()

    path = Path(args.path).resolve()
    if not path.is_file():
        print("RESULT=FAIL")
        print("ERROR: 文件不存在: {}".format(path))
        return 2

    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        print("RESULT=FAIL")
        print("ERROR: 不是合法 UTF-8: {}".format(exc))
        return 2

    errors = []
    warnings = []
    clear_reasons = []

    # 并行工作区闸门。状态页是"项目当前唯一事实"，不允许在
    # git worktree 拉出来的并行工作区里更新——两条线各写一份，合并冲突事小，
    # 产生两个互相矛盾的"当前"事大。判据机械(git-dir vs git-common-dir)，
    # 不依赖执行者自报"我不在并行区"。
    state, detail = worktree_state(path.parent)
    if state == "linked" and not args.allow_worktree:
        errors.append(
            "禁止在并行工作区更新状态页：worktree='{}'、分支='{}'。"
            "请回主工作区更新；"
            "确需就地更新须由用户明确指令后加 --allow-worktree".format(detail[0], detail[1])
        )
    elif state == "linked":
        warnings.append(
            "已用 --allow-worktree 跳过并行工作区闸门：worktree='{}'、分支='{}'".format(
                detail[0], detail[1]
            )
        )
    elif state == "unknown" and not args.allow_worktree:
        # fail-closed：判据问不出来时报错而不是放行。安全闸门宁可误拦，
        # 也不能在真的处于并行工作区时无声通过。
        errors.append(
            "并行工作区闸门无法判定（{}）：本脚本不能确认当前是否在并行工作区。"
            "请人工确认；确认在主工作区后可加 --allow-worktree 继续".format(detail)
        )
    elif state == "unknown":
        warnings.append("已用 --allow-worktree 跳过无法判定的并行工作区闸门（{}）".format(detail))

    lines = text.splitlines()
    h1 = [line for line in lines if line.startswith("# ")]
    h2 = [line[3:].strip() for line in lines if line.startswith("## ")]

    if len(h1) != 1:
        errors.append("一级标题必须且只能有 1 个，实际 {} 个".format(len(h1)))

    for heading in REQUIRED_H2:
        count = h2.count(heading)
        if count != 1:
            errors.append("二级标题 '{}' 必须且只能有 1 个，实际 {} 个".format(heading, count))

    present_required = [item for item in h2 if item in REQUIRED_H2]
    if present_required != REQUIRED_H2:
        errors.append("固定二级标题顺序不正确")

    duplicates = sorted({item for item in h2 if h2.count(item) > 1})
    if duplicates:
        clear_reasons.append("重复二级标题: {}".format(", ".join(duplicates)))

    line_count = len(lines)
    byte_count = len(raw)
    if line_count > args.hard_lines or byte_count > args.hard_bytes:
        clear_reasons.append(
            "超过硬上限: {} 行 / {} 字节".format(line_count, byte_count)
        )
    elif line_count > args.soft_lines or byte_count > args.soft_bytes:
        warnings.append("超过治理目标: {} 行 / {} 字节".format(line_count, byte_count))

    for marker in HISTORY_MARKERS:
        if marker in text:
            clear_reasons.append("出现历史标记: {}".format(marker))

    # 「最近 3 个自然日摘要」一节已改成一行指针:最近修改历史由 changelog/INDEX.md 生成器承担
    # (自带 3 天窗口),状态页不得再写按天流水。出现日期标题即 FAIL;没写指针也 FAIL。
    recent = section(text, "最近 3 个自然日摘要")
    if re.search(r"^### \d{4}-\d{2}-\d{2}\s*$", recent, re.M):
        errors.append("最近摘要节不得再写日期流水,只保留指向 changelog/INDEX.md 的指针")
    if "changelog/INDEX.md" not in recent:
        errors.append("最近摘要节缺少指向 changelog/INDEX.md 的指针")

    next_steps = section(text, "下一步")
    if "~~" in next_steps or "已完成" in next_steps or "已取消" in next_steps:
        clear_reasons.append("下一步含已完成、已取消或删除线事项")
    numbered_steps = len(re.findall(r"^\d+\. ", next_steps, re.M))
    if numbered_steps > 5:
        clear_reasons.append("下一步超过 5 项: {}".format(numbered_steps))

    active = section(text, "当前进行中")
    active_items = len(re.findall(r"^- ", active, re.M))
    if active_items > 3:
        clear_reasons.append("当前进行中超过 3 项: {}".format(active_items))

    # 「阶段与文档状态」表：每一项(第一列)只许出现一行
    gates = section(text, "阶段与文档状态")
    gate_names = []
    for line in gates.splitlines():
        if not line.startswith("|") or line.startswith("|---") or "| 项 |" in line:
            continue
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if cells and cells[0]:
            gate_names.append(cells[0])
    duplicate_gates = sorted({name for name in gate_names if gate_names.count(name) > 1})
    if duplicate_gates:
        clear_reasons.append("状态项重复: {}".format(", ".join(duplicate_gates)))

    # 时区标注兼容两代格式：旧 CST+8(历史留痕不追溯)与新系统时区缩写(EDT/EST 等,
    # date +%Z 输出,2~5 个大写字母);二选一必须存在,裸时间无标注仍然 FAIL。
    footer_update = re.findall(r"^最后更新：\d{4}-\d{2}-\d{2} \d{2}:\d{2} (?:CST\+8|[A-Z]{2,5})\s{0,2}$", text, re.M)
    footer_clear = re.findall(r"^最后精炼：\d{4}-\d{2}-\d{2} \d{2}:\d{2} (?:CST\+8|[A-Z]{2,5})\s{0,2}$", text, re.M)
    if len(footer_update) != 1:
        errors.append("必须且只能有 1 行合法的最后更新时间")
    if len(footer_clear) != 1:
        errors.append("必须且只能有 1 行合法的最后精炼时间")

    missing_links = []
    for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", text):
        target = unquote(target.strip().strip("<>"))
        if re.match(r"^(?:https?://|mailto:|#)", target):
            continue
        local = target.split("#", 1)[0]
        if local and not (path.parent / local).exists():
            missing_links.append(target)
    if missing_links:
        errors.append("失效本地链接: {}".format(", ".join(sorted(set(missing_links)))))

    digest = hashlib.sha256(raw).hexdigest()
    print("FILE={}".format(path))
    print("LINES={}".format(line_count))
    print("BYTES={}".format(byte_count))
    print("SHA256={}".format(digest))
    for item in warnings:
        print("WARN: {}".format(item))
    for item in clear_reasons:
        print("CLEAR: {}".format(item))
    for item in errors:
        print("ERROR: {}".format(item))

    if errors:
        print("RESULT=FAIL")
        return 2
    if clear_reasons:
        print("RESULT=CLEAR_REQUIRED")
        return 1
    print("RESULT=PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
