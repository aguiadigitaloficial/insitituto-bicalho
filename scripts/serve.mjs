import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { existsSync } from 'node:fs';
const clientRoot=fileURLToPath(new URL('../dist/client/',import.meta.url));
// This utility serves built static pages only; npm run preview also runs SSR.
const root = resolve(existsSync(clientRoot)?clientRoot:fileURLToPath(new URL('../dist/', import.meta.url)));
const redirects = JSON.parse(await readFile(new URL('../redirects.json', import.meta.url), 'utf8'));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.webp':'image/webp', '.avif':'image/avif', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.xml':'application/xml', '.txt':'text/plain' };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const key = url.pathname.replace(/\/$/, '');
    if (redirects[key]) { res.writeHead(301, { Location: redirects[key] + url.search }); res.end(); return; }
    let path = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    let status = 200;
    try { if ((await stat(path)).isDirectory()) { if (!url.pathname.endsWith('/')) {res.writeHead(301,{Location:url.pathname+'/'+url.search});res.end();return;} path = resolve(path, 'index.html'); } await stat(path); } catch { path = resolve(root, '404.html'); status = 404; }
    let body = await readFile(path);
    const gzip = /\b(html|css|js|xml|txt)$/.test(extname(path)) && req.headers['accept-encoding']?.includes('gzip');
    if (gzip) body = gzipSync(body);
    res.writeHead(status, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Content-Length': body.length, 'X-Robots-Tag':'noindex, follow', 'Cache-Control':'no-cache', ...(gzip ? { 'Content-Encoding':'gzip', Vary:'Accept-Encoding' } : {}) });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(500); res.end('Erro ao carregar a página'); }
}).listen(Number(process.env.PORT || 4321), '127.0.0.1', () => console.log(`Preview ready: http://127.0.0.1:${process.env.PORT || 4321}`));
