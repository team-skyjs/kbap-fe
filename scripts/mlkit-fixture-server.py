#!/usr/bin/env python3
"""P-610: serve only hash-locked public development fixtures; no directory browsing."""
import argparse
import hashlib
import ipaddress
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MANIFEST_SHA = '6f689125f75d1a42c49a206fc0a39c7da105c5a1568d77e7141921e62aa31eb1'


def assets(root):
    root = Path(root).resolve()
    manifest = (root / 'manifest.json').read_bytes()
    if hashlib.sha256(manifest).hexdigest() != MANIFEST_SHA:
        raise ValueError('Manifest hash mismatch')
    rows = json.loads(manifest)['samples']
    allowed = {'/manifest.json': (manifest, 'application/json')}
    for row in rows:
        path = (root / row['path']).resolve()
        if not path.is_relative_to(root) or path.suffix != '.jpg':
            raise ValueError('Invalid fixture path')
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != row['source_sha256']:
            raise ValueError('Fixture hash mismatch')
        allowed['/' + row['path']] = (data, 'image/jpeg')
    if len(allowed) != 33:
        raise ValueError('Expected exactly 32 images')
    return allowed


def handler(allowed):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            # Exact allowlist: query strings, traversal, labels, lock files and arbitrary paths all fail.
            entry = allowed.get(self.path)
            if entry is None:
                self.send_error(404)
                return
            data, mime = entry
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *_args):
            pass
    return Handler


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixtures', type=Path, required=True)
    parser.add_argument('--bind', default='127.0.0.1', help='Loopback or explicit RFC1918 LAN IPv4; never 0.0.0.0')
    args = parser.parse_args()
    address = ipaddress.IPv4Address(args.bind)
    networks = [ipaddress.ip_network(n) for n in ['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']]
    if not any(address in n for n in networks):
        parser.error('Bind must be a loopback or RFC1918 IPv4 address')
    server = ThreadingHTTPServer((args.bind, 8878), handler(assets(args.fixtures)))
    print(f'32 locked fixtures at http://{args.bind}:8878; stop after download with Ctrl-C', flush=True)
    server.serve_forever()
