#!/bin/bash
# 101 scp 辅助：用法 scp101.sh 源 目标（远端写 R:路径 的简写）；凭据运行时从 CLAUDE.local.md 读
. "$(dirname "$0")/env101.sh"
export SSHPASS="$SOC101_SSH_PASSWORD"
a=(); for x in "$@"; do a+=("${x/#R:/$SOC101_SSH_USER@$SOC101_HOST:}"); done
exec sshpass -e scp -o ConnectTimeout=15 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR "${a[@]}"
