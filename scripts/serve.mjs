import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { copyFileSync, watch } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function createAppServer() {
  const root = resolve('dist');
  const mime = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json' };
  return createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return;
      }
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
      const file = resolve(root, pathname === '/' ? 'playground/index.html' : `.${pathname}`);
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
  let compiler;
  const watchers = [];
  if (process.argv.includes('--watch')) {
    compiler = spawn(process.execPath, ['node_modules/typescript/bin/tsc', '--watch'], { stdio: 'inherit' });
    for (const file of ['index.html', 'style.css']) {
      watchers.push(watch(`playground/${file}`, () => copyFileSync(`playground/${file}`, `dist/playground/${file}`)));
    }
  }
  const stop = () => { compiler?.kill(); watchers.forEach(w => w.close()); server.close(() => process.exit()); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
