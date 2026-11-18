// A root served as GitHub Pages serves the game, for tools/bench.mjs: HTTP/2 over TLS (a self-signed certificate,
// made once with openssl and trusted by its key's SPKI hash), text types gzipped at level 6, Cache-Control
// max-age=600, a weak ETag and 304 to a request that names it (If-None-Match). Text is served with LF line endings
// whatever the checkout has (Pages serves what git holds), so a working tree with CRLF sends the bytes a commit would.
//   const site = await serve(root, { tls, coi, routes, html });
//   site.origin; site.log (every request: name, status, bytes); site.maxAge = 0; await site.close();
// `routes` answers paths of the bench's own (a fixture, a page of its own) before the root is looked in; `html`
// rewrites index.html as it is served (a script put in before the game's); `coi` adds the headers that make the
// page cross-origin isolated (fine-grained performance.now()).
import http2 from 'node:http2';
import http from 'node:http';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.gz': 'application/octet-stream' };
const TEXT = /\.(html|js|mjs|css|json|webmanifest|svg)$/;

// The certificate, in `dir`: made with openssl the first time (on PATH, or Git for Windows' own).
export function certificate(dir) {
  const cert = path.join(dir, 'cert.pem'), key = path.join(dir, 'key.pem');
  if (!existsSync(cert) || !existsSync(key)) {
    mkdirSync(dir, { recursive: true });
    const tries = ['openssl', 'C:/Program Files/Git/usr/bin/openssl.exe', 'C:/Program Files/Git/mingw64/bin/openssl.exe'];
    let made = false;
    for (const program of tries) {
      const r = spawnSync(program, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '3650', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
      if (r.status === 0 && existsSync(cert)) { made = true; break; }
    }
    if (!made) throw new Error(`no certificate in ${dir} and openssl could not make one: put a self-signed cert.pem and key.pem for 127.0.0.1 there`);
  }
  const pem = readFileSync(cert), spki = new crypto.X509Certificate(pem).publicKey.export({ type: 'spki', format: 'der' });
  return { cert: pem, key: readFileSync(key), spki: crypto.createHash('sha256').update(spki).digest('base64') };
}

export async function serve(rootIn, { tls = null, coi = false, routes = {}, html = null, maxAge = 600 } = {}) {
  const root = path.resolve(rootIn), site = { log: [], maxAge, origin: null };
  const bodies = new Map(), zipped = new Map();
  const etagOf = body => `W/"${body.length.toString(16)}-${zlib.crc32(body).toString(16)}"`;
  const plain = async (file, ext) => {
    let entry = bodies.get(file);
    if (!entry) {
      let body = await readFile(file);
      if (TEXT.test(ext)) body = Buffer.from(body.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
      if (html && ext === '.html' && path.basename(file) === 'index.html') body = Buffer.from(html(body.toString('utf8')), 'utf8');
      bodies.set(file, entry = { body, etag: etagOf(body) });
    }
    return entry;
  };
  const handle = async (method, url, headers, respond) => {
    let name;
    try { name = decodeURIComponent(new URL(url, 'https://x').pathname); } catch { return respond(400, {}, Buffer.alloc(0)); }
    if (name.endsWith('/')) name += 'index.html';
    const extra = coi ? { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp', 'cross-origin-resource-policy': 'same-origin' } : {};
    if (routes[name]) {
      const r = await routes[name]();
      site.log.push({ t: Date.now(), name, status: 200, bytes: r.body.length, own: true });
      return respond(200, { 'content-type': r.type ?? 'application/octet-stream', 'cache-control': 'no-store', ...extra }, r.body);
    }
    const file = path.join(root, name);
    if (!file.startsWith(root + path.sep) || name.split('/').some(part => part.startsWith('.'))) { site.log.push({ t: Date.now(), name, status: 404 }); return respond(404, extra, Buffer.alloc(0)); }
    const ext = path.extname(file).toLowerCase();
    let entry;
    try { entry = await plain(file, ext); } catch { site.log.push({ t: Date.now(), name, status: 404 }); return respond(404, extra, Buffer.alloc(0)); }
    const h = { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': `max-age=${site.maxAge}`, etag: entry.etag, 'last-modified': 'Wed, 18 Nov 2026 03:41:02 GMT', vary: 'Accept-Encoding', ...extra };
    if (headers['if-none-match'] === entry.etag) { site.log.push({ t: Date.now(), name, status: 304, bytes: 0 }); return respond(304, h, Buffer.alloc(0)); }
    let body = entry.body;
    if (TEXT.test(ext) && /gzip/.test(headers['accept-encoding'] ?? '')) {
      if (!zipped.has(file)) zipped.set(file, zlib.gzipSync(body, { level: 6 }));
      body = zipped.get(file); h['content-encoding'] = 'gzip';
    }
    site.log.push({ t: Date.now(), name, status: 200, bytes: body.length });
    respond(200, h, method === 'HEAD' ? Buffer.alloc(0) : body);
  };
  let server;
  if (tls) {
    server = http2.createSecureServer({ key: tls.key, cert: tls.cert, allowHTTP1: true });
    server.on('stream', (stream, headers) => {
      stream.on('error', () => {});
      handle(headers[':method'], headers[':path'], headers, (status, h, body) => {
        try {
          if (status === 304) { stream.respond({ ':status': 304, ...h }, { endStream: true }); return; }
          stream.respond({ ':status': status, ...h, 'content-length': body.length }); stream.end(body);
        } catch { /* the browser went */ }
      }).catch(() => { try { stream.respond({ ':status': 500 }, { endStream: true }); } catch { } });
    });
  } else {
    server = http.createServer((req, res) => handle(req.method, req.url, req.headers, (status, h, body) => { res.writeHead(status, { ...h, ...(status !== 304 && { 'content-length': body.length }) }); res.end(body); }));
  }
  const sockets = new Set();
  server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  server.on('secureConnection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  site.origin = `${tls ? 'https' : 'http'}://127.0.0.1:${server.address().port}`;
  site.close = () => new Promise(resolve => { for (const s of sockets) s.destroy(); server.close(() => resolve()); setTimeout(resolve, 2000); });
  return site;
}
