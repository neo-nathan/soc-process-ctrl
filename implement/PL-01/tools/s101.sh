#!/bin/bash
# 101 ssh 辅助：用法 s101.sh '远程命令'；凭据运行时从 CLAUDE.local.md 读
. "$(dirname "$0")/env101.sh"
export SSHPASS="$SOC101_SSH_PASSWORD"
exec sshpass -e ssh -o ConnectTimeout=15 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR "$SOC101_SSH_USER@$SOC101_HOST" "$@"
