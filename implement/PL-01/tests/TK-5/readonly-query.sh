#!/bin/bash
# 用法: q.sh "SELECT ..."  —— 只读查询 101 RS_ESM_LOG（凭据运行时从 CLAUDE.local.md 读）
. /Users/nick/Workspace/soc-process-ctrl-work/tools/env101.sh
SQL="$1"
# 拒绝多语句（内审 I1，沿用 TK-4 内审 S5 的要求）：
#   mysql 从标准输入读语句时，会把分号后面的语句也执行，「SELECT 1; DELETE …」只看开头会混过去。
#   本项目的只读查询都用不到分号，所以只要含「;」一律拒绝，不区分是不是写在字符串里。
case "$SQL" in *';'*) echo "拒绝：语句里不允许出现分号（防止一次执行多条语句）"; exit 3;; esac
# 同理再挡两种不用分号也能接第二条语句的写法（本项目查询同样用不到）：
#   ① 反斜杠：mysql 客户端把「\g」「\G」当语句结束符，「\!」能执行本机命令；
#   ② 换行 / 回车：客户端的 delimiter 等命令要写在行首，单行语句就没有这个口子。
case "$SQL" in *'\'*) echo "拒绝：语句里不允许出现反斜杠（\\g、\\! 等客户端命令）"; exit 3;; esac
case "$SQL" in *$'\n'*|*$'\r'*) echo "拒绝：语句必须写成一行（不允许换行）"; exit 3;; esac
# 只放行只读语句：开头必须是 SELECT / SHOW / DESC
case "$(echo "$SQL" | tr a-z A-Z | sed 's/^ *//')" in SELECT*|SHOW*|DESC*) ;; *) echo "只允许只读语句"; exit 2;; esac
export SSHPASS="$SOC101_SSH_PASSWORD"
printf '%s' "$SQL" | sshpass -e ssh -o ConnectTimeout=15 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR "$SOC101_SSH_USER@$SOC101_HOST" \
 "MYSQL_PWD='$SOC101_MYSQL_PASSWORD' $SOC101_MYSQL_BIN --socket=$SOC101_MYSQL_SOCKET -u$SOC101_MYSQL_USER --default-character-set=utf8 RS_ESM_LOG -t"
