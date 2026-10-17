import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Offline QA only: preserve real ES-module imports via Blob URLs, without network
// requests or changing managed-browser policies. Normal CI uses the HTTP server.
export async function loadOfflineFixture(page) {
  const html = (await readFile('dist/playground/index.html', 'utf8')).replace(/<script[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');
  const css = await readFile('dist/playground/style.css', 'utf8');
  const files = await readdir('dist', { recursive: true });
  const modules = {};
  for (const file of files.filter(file => file.endsWith('.js'))) modules[file] = await readFile(resolve('dist', file), 'utf8');
  await page.setContent(html);
  await page.addStyleTag({ content: css });
  await page.evaluate(async modules => {
    const urls = new Map();
    function moduleUrl(path) {
      if (urls.has(path)) return urls.get(path);
      const source = modules[path];
      if (!source) throw new Error(`Missing test fixture module: ${path}`);
      const rewritten = source.replace(/((?:from\s*|import\s*)['"])(\.[^'"]+)(['"])/g, (_, prefix, specifier, suffix) => {
        const dependency = new URL(specifier, `https://fixture.invalid/${path}`).pathname.slice(1);
        return prefix + moduleUrl(dependency) + suffix;
      }).replace(/\/\/# sourceMappingURL=.*/g, '');
      const url = URL.createObjectURL(new Blob([rewritten], { type: 'text/javascript' }));
      urls.set(path, url); return url;
    }
    await import(moduleUrl('playground/app.js'));
    window.fixtureAPI = await import(moduleUrl('src/index.js'));
  }, modules);
}
