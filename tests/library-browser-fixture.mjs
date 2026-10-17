import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { createPackageConsumer } from './package-fixture.mjs';

const packageName = '@hanana-kick/sidekick';
const repository = fileURLToPath(new URL('..', import.meta.url));
const css = `
  *{box-sizing:border-box}html{font:16px/1.5 system-ui,sans-serif;color:#23332d;background:#f5f6f2}
  body{margin:0;padding:56px 36px}main{max-width:900px;margin:auto}h1{font-size:38px;letter-spacing:-1.4px;margin:10px 0}
  .eyebrow{font-size:12px;letter-spacing:.13em;text-transform:uppercase;color:#557267}p{color:#65736b;margin:0 0 28px}
  .grid{display:flex;gap:24px;align-items:stretch;flex-wrap:wrap}.card{background:#fff;border:1px solid #dce3d8;border-radius:20px;padding:28px;min-width:280px}
  .canvas{background:repeating-conic-gradient(#e9eee7 0% 25%,#f8faf6 0% 50%) 50%/24px 24px;border-radius:12px;display:flex;align-items:center;justify-content:center;min-height:280px}
  sidekick-avatar{width:240px;height:240px}.label{margin:20px 0 0;font-size:14px}pre{font:13px/1.7 ui-monospace,monospace;white-space:pre-wrap;color:#446456;margin:20px 0 0}
  #sandbox{position:absolute;top:900px;left:32px}.status{font-size:12px;color:#71806c;margin-top:32px}
`;
const shell = (title, body, entry) => `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}</style></head><body><main><div class="eyebrow">Sidekick · installed package</div><h1>${title}</h1>${body}<div class="status">Local package assets only · transparent WebGL rendering</div></main><div id="sandbox"></div><script type="module" src="${entry}"></script></body></html>`;

/** A real tarball consumer: neither Studio nor a source alias can satisfy these imports. */
export async function createLibraryBrowserFixture() {
  const consumer = await createPackageConsumer({ react: true });
  const { directory, packagePath } = consumer;
  try {
    await writeFile(join(directory, 'vanilla.html'), shell('A companion in plain HTML', `<p>One element. No framework, application provider, or setup call.</p><div class="grid"><section class="card"><div class="canvas"><sidekick-avatar id="bare"></sidekick-avatar></div><div class="label">Default custom element</div><pre>&lt;sidekick-avatar&gt;&lt;/sidekick-avatar&gt;</pre></section><section class="card"><div class="canvas"><sidekick-avatar id="configured" shape="puffy" body-color="#8bba9c" eye-color="#27372f" head-accessory="beret" head-color="#385d4c" left-expression="smile" right-expression="smile" activity="still"></sidekick-avatar></div><div class="label">Configured with HTML attributes</div><pre>shape="puffy"\nbody-color="#8bba9c"\nhead-accessory="beret"</pre></section></div>`, './vanilla.mjs'));
    await writeFile(join(directory, 'vanilla.mjs'), `import * as api from '${packageName}'; window.libraryAPI = api; window.fixtureLoaded = true;`);

    await writeFile(join(directory, 'react.html'), shell('A companion in React', `<p>A typed component with native events and a direct element ref.</p><div id="root"></div>`, './react.mjs'));
    await writeFile(join(directory, 'react.mjs'), `
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SidekickAvatar } from '${packageName}/react';
const state = window.consumer = { element: null, events: [], refHistory: [], props: {
  id: 'react-avatar', shape: 'puffy', bodyColor: '#8bba9c', eyeColor: '#27372f',
  leftSmile: 0.25, rightBlink: 0.15, activity: 'still', paused: true,
  interaction: 'box', mouseTracking: true, camera: { yaw: 12, pitch: 5, roll: -4 },
  gazeX: 0.2, gazeY: -0.1, style: { width: 280, height: 280 },
  'aria-label': 'React companion', className: 'consumer-avatar', 'data-consumer': 'react',
} };
const callbacks = Object.fromEntries(['Ready', 'Error', 'DesignChange', 'CameraChange', 'MotionEnd', 'ShapeEnd', 'Activate'].map(name => [
  'on' + name, event => state.events.push({ name, type: event.type, detail: event.detail, native: event instanceof CustomEvent,
    ...(name === 'Ready' ? { configured: state.element ? { shape: state.element.design.body.shape, camera: state.element.camera, left: state.element.design.eyes.left.weights, right: state.element.design.eyes.right.weights } : null } : {}),
  }),
]));
const ref = element => { state.element = element; state.refHistory.push(element ? 'element' : 'null'); };
function App() { return React.createElement('section', { className: 'card' },
  React.createElement('div', { className: 'canvas' }, React.createElement(SidekickAvatar, { ...state.props, ...callbacks, ref })),
  React.createElement('div', { className: 'label' }, 'React StrictMode consumer'),
  React.createElement('pre', null, 'import { SidekickAvatar } from "@hanana-kick/sidekick/react";\\n<SidekickAvatar shape="puffy" ref={avatarRef} />'));
}
const root = createRoot(document.getElementById('root'));
const render = () => root.render(React.createElement(StrictMode, null, React.createElement(App)));
window.renderConsumer = patch => { state.props = { ...state.props, ...patch }; render(); };
window.unmountConsumer = () => root.render(null);
window.mountConsumer = render;
render();
window.fixtureLoaded = true;
`);

    // Generate the actual server markup with the installed /react export in a DOM-free process.
    await writeFile(join(directory, 'ssr.mjs'), `
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SidekickAvatar } from '${packageName}/react';
process.stdout.write(renderToString(React.createElement(SidekickAvatar, { id: 'hydrated-avatar', shape: 'heart', bodyColor: '#b7a5ce', activity: 'still', paused: true, 'aria-label': 'Hydrated companion' })));
`);
    const ssr = execFileSync(process.execPath, ['ssr.mjs'], { cwd: directory, encoding: 'utf8' });
    await writeFile(join(directory, 'hydration.html'), shell('A companion after hydration', `<p>Server-rendered HTML keeps its existing element and live imperative state.</p><div class="card"><div class="canvas" id="root">${ssr}</div></div>`, './hydration.mjs'));
    await writeFile(join(directory, 'hydration.mjs'), `
import React, { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { SidekickAvatar } from '${packageName}/react';
const element = document.getElementById('hydrated-avatar');
const state = window.hydration = { before: element, ref: null, events: [], errors: [] };
const props = { id: 'hydrated-avatar', shape: 'heart', bodyColor: '#b7a5ce', activity: 'still', paused: true, 'aria-label': 'Hydrated companion', ref: value => { state.ref = value; }, onReady: event => state.events.push({ type: event.type, configured: state.ref ? { shape: state.ref.design.body.shape, color: state.ref.design.body.color } : null }) };
const tree = () => React.createElement(StrictMode, null, React.createElement(SidekickAvatar, props));
const root = hydrateRoot(document.getElementById('root'), tree(), { onRecoverableError: error => state.errors.push(error.message) });
window.rerenderHydration = () => root.render(tree());
window.fixtureLoaded = true;
`);

    const output = join(directory, 'site');
    await build({
      configFile: false, root: directory, logLevel: 'warn',
      build: { outDir: output, emptyOutDir: true, target: 'es2022',
        // Development React intentionally exercises StrictMode effect/ref replay in Chromium.
        minify: false, rolldownOptions: { input: { vanilla: join(directory, 'vanilla.html'), react: join(directory, 'react.html'), hydration: join(directory, 'hydration.html') } },
      },
      define: { 'process.env.NODE_ENV': JSON.stringify('development') },
    });
    // Also exercise the unbundled, self-contained CDN artifact from the tarball itself.
    await writeFile(join(output, 'cdn.html'), shell('A companion from a script tag', `<p>Direct browser module from the installed package, without a bundler.</p><div class="card"><div class="canvas"><sidekick-avatar id="cdn-avatar"></sidekick-avatar></div></div>`, '/package/dist/library/auto.js'));
    const pagesOutput = join(directory, 'pages');
    execFileSync(process.execPath, [join(repository, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', pagesOutput, '--emptyOutDir'], { cwd: repository, env: { ...process.env, SIDEKICK_BASE: '/sidekick/' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const server = createFixtureServer(output, packagePath);
    const pagesServer = createFixtureServer(pagesOutput, packagePath, '/sidekick');
    await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen); });
    await new Promise((resolveListen, reject) => { pagesServer.once('error', reject); pagesServer.listen(0, '127.0.0.1', resolveListen); });
    return {
      directory, output, baseURL: 'http://127.0.0.1:' + server.address().port,
      pagesURL: 'http://127.0.0.1:' + pagesServer.address().port + '/sidekick/',
      async cleanup() { await Promise.all([new Promise(done => server.close(done)), new Promise(done => pagesServer.close(done))]); await consumer.cleanup(); },
    };
  } catch (error) { await consumer.cleanup(); throw error; }
}

function createFixtureServer(output, packagePath, base = '') {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json' };
  return createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
      let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
      if (base) {
        if (!pathname.startsWith(base + '/')) { res.writeHead(404).end('Wrong deployment base'); return; }
        pathname = pathname.slice(base.length);
      }
      if (pathname.endsWith('/')) pathname += 'index.html';
      const packageAsset = pathname.startsWith('/package/');
      const root = resolve(packageAsset ? packagePath : output);
      const file = resolve(root, '.' + (packageAsset ? pathname.slice('/package'.length) : pathname));
      if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      if (!(await stat(file)).isFile()) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch { res.writeHead(404).end('Not found'); }
  });
}
