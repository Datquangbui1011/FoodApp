#!/usr/bin/env python3
"""
Persistent EasyOCR HTTP server — keeps the model loaded in RAM between requests.
Listens on localhost:5001. Node.js calls this instead of spawning a subprocess.
"""
import os
import sys
import warnings
import json

warnings.filterwarnings('ignore', message='.*pin_memory.*')
os.makedirs(os.path.expanduser('~/.EasyOCR/model'), exist_ok=True)

from http.server import BaseHTTPRequestHandler, HTTPServer

reader = None

def get_reader():
    global reader
    if reader is None:
        import easyocr
        print('[OCR server] Loading EasyOCR model...', flush=True)
        reader = easyocr.Reader(['en'], gpu=False, verbose=False)
        print('[OCR server] Model loaded.', flush=True)
    return reader

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # silence request logs

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        try:
            paths = json.loads(body)
        except Exception:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'[]')
            return

        all_text = []
        seen = set()
        r = get_reader()
        for p in paths:
            try:
                lines = r.readtext(p, detail=0, paragraph=False)
                for line in lines:
                    line = line.strip()
                    if line and line.lower() not in seen:
                        seen.add(line.lower())
                        all_text.append(line)
            except Exception as e:
                sys.stderr.write(f'Frame OCR error ({p}): {e}\n')

        result = json.dumps(all_text).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(result)))
        self.end_headers()
        self.wfile.write(result)

    def do_GET(self):
        # Health check
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'ok')

if __name__ == '__main__':
    port = 5001
    server = HTTPServer(('localhost', port), Handler)
    print(f'[OCR server] Listening on port {port}', flush=True)
    # Pre-load model at startup so first request is fast
    get_reader()
    server.serve_forever()
