#!/bin/bash
# 只读查询 101 MySQL（RS_ESM_LOG）。用法：ro-query.sh "<SELECT 语句>"
# 凭据不写进本文件：运行前由调用方在环境变量里提供 SOC101_*（取自 soc-process-ctrl/CLAUDE.local.md「101 数据服务」）
# 安全闸：只允许以 SELECT 开头的单条语句，拒绝分号后再跟语句、拒绝写操作关键字
set -e
SQL="$1"
# 去掉首尾空白后必须以 SELECT 开头（不分大小写）
TRIM=$(echo "$SQL" | sed -e 's/^[[:space:]]*//')
case "$(echo "$TRIM" | cut -c1-6 | tr 'a-z' 'A-Z')" in
  SELECT) ;;
  *) echo "拒绝：只允许 SELECT" >&2; exit 2;;
esac
# 拒绝写操作关键字（整词匹配）
if echo "$SQL" | grep -qiE '\b(insert|update|delete|drop|alter|create|truncate|replace|grant|set)\b'; then
  echo "拒绝：含写操作关键字" >&2; exit 2
fi
# 通过 ssh 在 101 本机执行；SQL 经 stdin 传过去，避免 shell 转义问题
printf '%s;\n' "$SQL" | sshpass -p "$SOC101_SSH_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
  "$SOC101_SSH_USER@$SOC101_HOST" \
  "MYSQL_PWD='$SOC101_MYSQL_PASSWORD' $SOC101_MYSQL_BIN --socket=$SOC101_MYSQL_SOCKET -u$SOC101_MYSQL_USER --default-character-set=utf8 -t RS_ESM_LOG"
