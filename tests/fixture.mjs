import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

// Optional, network-free test origin for the production build. This is only a
// fixture for already-authorized browser tests; it is never a browser-policy bypass.
export async function loadOfflineFixture(page) {
  const root = resolve('dist');
  const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.woff2': 'font/woff2' };
  await page.route('http://sidekick.test/**', async route => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    if (pathname === '/favicon.ico') { await route.fulfill({ status: 204, body: '' }); return; }
    const file = resolve(root, pathname === '/' ? 'index.html' : '.' + pathname);
    if (!file.startsWith(root + sep)) { await route.fulfill({ status: 403, body: '' }); return; }
    try { await route.fulfill({ status: 200, contentType: mime[extname(file)] ?? 'application/octet-stream', body: await readFile(file) }); }
    catch { await route.fulfill({ status: 404, body: 'Not found' }); }
  });
  await page.goto('http://sidekick.test/');
}
