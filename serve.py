"""Tiny static dev server that never caches (so edits show up on reload)."""
import http.server, socketserver, sys

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
with socketserver.TCPServer(('', port), H) as s:
    print('serving on', port)
    s.serve_forever()
