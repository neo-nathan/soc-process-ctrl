# PL-01 TK-4 本地自测用的静态服务（只在自测目录用，不进 SOC 源码、不进本仓库）
# - GET：按本目录提供文件（public -> SOC 工作副本 public，ref101 -> 101 只读副本 public）
# - POST /Procmanager/procManager、/Procmanager/getProcLogList：给 101 版进程管理页、日志页的表格返回假数据
#   （这两页的表格用 bootstrapTable 的 url 选项直接发 $.ajax，不经过 RsCore.ajax，所以要服务端回）
# 用法：python3 serve.py 8781
import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))

PROC_ROWS = [
    {"PROCPATH": "/usr/sbin/sshd", "FILEHASH": "aa11", "ALGO": 0, "SYSTYPE": "linux:lcserver",
     "CLIENTCOUNT": 1, "WCOUNT": 0, "BCOUNT": 0},
    {"PROCPATH": "/usr/bin/python3", "FILEHASH": "bb22", "ALGO": 0, "SYSTYPE": "linux:lcserver",
     "CLIENTCOUNT": 2, "WCOUNT": 1, "BCOUNT": 0},
]
LOG_ROWS = [
    {"ID": 1, "TIME": "2026-10-21 10:00:00", "PROCPATH": "/usr/bin/nc", "FILEHASH": "cc33", "ALGO": 0,
     "SYSTYPE": "linux:lcserver", "COMPUTERNAME": "srv1", "IP": "10.0.0.1", "SGUID": "S1",
     "ACTIONREASON": 2, "PROCACTION": 0},
]

COUNTS = {}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length:
            self.rfile.read(length)
        path = self.path.split("?")[0]
        COUNTS[path] = COUNTS.get(path, 0) + 1
        if path == "/Procmanager/procManager":
            body = {"r": {"code": 0, "action": 0, "msg": ""}, "data": {"rows": PROC_ROWS, "total": len(PROC_ROWS)}}
        elif path == "/Procmanager/getProcLogList":
            body = {"r": {"code": 0, "action": 0, "msg": ""},
                    "data": {"rows": LOG_ROWS, "total": len(LOG_ROWS), "blocked": 0, "alerted": 1}}
        else:
            body = {"r": {"code": 9, "action": 0, "msg": "fake server: no " + path}, "data": ""}
        raw = json.dumps(body).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8781
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
