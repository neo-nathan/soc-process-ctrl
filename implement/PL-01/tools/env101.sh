#!/bin/bash
# 从本仓库 CLAUDE.local.md 读出 101 访问参数（只取 export SOC101_ / SYSLOG45_ 开头的行），不把密码写进任何文件
eval "$(grep -E "^export (SOC101_|SYSLOG45_)" /Users/nick/Workspace/soc-process-ctrl/CLAUDE.local.md)"
