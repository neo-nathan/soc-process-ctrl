# 阶段 3.1 用：把指定目录作为静态站点（不缓存），给 Executor 自测壳用。用法：python3 serve-dir.py <目录> <端口>
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
ROOT, PORT = sys.argv[1], int(sys.argv[2])
class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, *a):
        pass
ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
