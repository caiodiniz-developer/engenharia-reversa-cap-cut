// Serve o build de produção (apps/web/dist) como o nginx faz: estático + fallback de SPA + proxy para a
// API (HTTP e WebSocket) + os MESMOS cabeçalhos de segurança de deploy/security-headers.conf.
// Usado pelos testes E2E de produção para provar que o build e a CSP funcionam juntos.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(process.env.DIST ?? path.join(here, '../dist'));
const port = Number(process.env.PORT ?? 5373);
const apiPort = Number(process.env.API_PORT ?? 3201);

const headers = {};
for (const line of readFileSync(path.resolve(here, '../../../deploy/security-headers.conf'), 'utf8').split('\n')) {
  const m = /^add_header\s+(\S+)\s+"(.*)"\s+always;/.exec(line.trim());
  if (m) headers[m[1]] = m[2];
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.map': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    const up = http.request({ host: '127.0.0.1', port: apiPort, path: req.url, method: req.method, headers: { ...req.headers, host: req.headers.host } }, (r) => {
      try {
        res.writeHead(r.statusCode ?? 502, r.headers);
      } catch (e) {
        r.resume();
        return res.writeHead(502).end('invalid upstream response');
      }
      r.pipe(res);
    });
    up.on('error', () => (res.headersSent ? res.destroy() : res.writeHead(502).end('bad gateway')));
    req.pipe(up);
    return;
  }
  let file = path.join(dist, decodeURIComponent(url.pathname));
  if (!file.startsWith(dist)) return res.writeHead(403).end();
  const isAsset = url.pathname.startsWith('/assets/');
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (isAsset) return res.writeHead(404, headers).end('not found');
    file = path.join(dist, 'index.html'); // SPA
  }
  res.writeHead(200, {
    ...headers,
    'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
});

server.on('upgrade', (req, socket, head) => {
  if (!req.url?.startsWith('/ws')) return socket.destroy();
  const up = net.connect(apiPort, '127.0.0.1', () => {
    up.write(`${req.method} ${req.url} HTTP/1.1\r\n${Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`);
    if (head.length) up.write(head);
    socket.pipe(up).pipe(socket);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
});

server.listen(port, () => console.log(`dist em http://localhost:${port} (API ${apiPort})`));
