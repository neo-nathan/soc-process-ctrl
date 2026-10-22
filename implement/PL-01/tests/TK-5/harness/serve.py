# PL-01 TK-5 本地自测用的静态服务（只在自测目录用，不进 SOC 源码、不进本仓库）
# GET：按本目录提供文件（public -> SOC 工作副本 public，ref101 -> 101 只读副本 public）；不缓存。
# 名单页、分组树的请求都走假 RsCore.ajax（fakecore.js），不发到这里。
# 用法：python3 serve.py 8795
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8795
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
