import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export function createAppServer(directory = 'dist') {
  const root = resolve(directory);
  const mime = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json', '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
  return createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return;
      }
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = resolve(root, pathname === '/' ? 'index.html' : pathname === '/playground/' ? 'playground/index.html' : `.${pathname}`);
      if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      if (!(await stat(file)).isFile()) { res.writeHead(404).end(); return; }
      const data = await readFile(file);
      res.writeHead(200, {
        'Content-Type': `${mime[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { res.writeHead(404).end('Not found'); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 5173);
  const host = process.env.HOST ?? '127.0.0.1';
  const server = createAppServer();
  server.on('error', error => { console.error(error.message); process.exit(1); });
  server.listen(port, host, () => console.log(`Sidekick Studio: http://${host}:${port}`));
  const stop = () => { server.close(() => process.exit()); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
