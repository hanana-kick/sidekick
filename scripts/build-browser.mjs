import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Prebuilt distributions. React is external and its renderer stays lazy for SSR. */
export async function buildBrowser({ libraryDirectory = resolve(root, 'dist/library'), outputDirectory = resolve(root, 'dist/browser') } = {}) {
  rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(outputDirectory, { recursive: true });
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const notice = readFileSync(join(root, 'third_party/material-shapes/NOTICE'), 'utf8');
  const license = readFileSync(join(root, 'third_party/material-shapes/LICENSE'), 'utf8');
  const header = `/*! Sidekick ${version} | UNLICENSED; no license is granted for Sidekick itself.\n\nThird-party Material Shapes notices and Apache-2.0 license:\n${notice}\n${license}\n*/`;
  const common = { minify: true, comments: false, sourcemap: false, postBanner: header };
  // Resolve the worker beside the published script, never beside the HTML page.
  // Classic scripts must capture currentScript while their entry is evaluating.
  const workerURL = format => ({
    name: 'sidekick-published-worker-url',
    load(id) {
      if (resolve(id) !== resolve(libraryDirectory, 'runtime/create-worker.js')) return null;
      const source = format === 'iife' ? 'scriptURL' : 'import.meta.url';
      return `${format === 'iife' ? "const scriptURL = typeof document === 'undefined' ? undefined : document.currentScript?.src;" : ''}
        export function createRenderWorker() {
          const source = ${source};
          if (!source) throw new Error('Sidekick worker script URL is unavailable');
          const url = new URL('./sidekick.worker.js', source);
          const options = { type: 'module', name: 'sidekick-render' };
          if (url.origin === globalThis.location?.origin) return new Worker(url, options);
          // Worker entry URLs must be same-origin. A local Blob imports the CORS-enabled CDN module.
          const bootstrap = URL.createObjectURL(new Blob(['import ' + JSON.stringify(url.href) + ';'], { type: 'text/javascript' }));
          let worker;
          const release = () => URL.revokeObjectURL(bootstrap);
          try { worker = new Worker(bootstrap, options); } catch (error) { release(); throw error; }
          worker.addEventListener('message', release, { once: true });
          worker.addEventListener('error', release, { once: true });
          const terminate = worker.terminate.bind(worker);
          worker.terminate = () => { release(); terminate(); };
          return worker;
        }`;

    },
  });
  for (const [format, filename] of [['esm', 'sidekick.js'], ['iife', 'sidekick.iife.js']]) {
    const vanilla = await rolldown({ input: join(libraryDirectory, 'auto.js'), platform: 'browser', preserveEntrySignatures: 'strict', plugins: [workerURL(format)] });
    try { await vanilla.write({ ...common, format, ...(format === 'iife' ? { name: 'Sidekick' } : {}), file: join(outputDirectory, filename), codeSplitting: false }); }
    finally { await vanilla.close(); }
  }
  const react = await rolldown({
    input: join(libraryDirectory, 'react.js'), platform: 'browser', external: ['react'], preserveEntrySignatures: 'strict',
    plugins: [workerURL('esm')],
    onwarn(warning, warn) { if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning); },
  });
  try {
    await react.write({
      ...common, format: 'esm', dir: outputDirectory,
      entryFileNames: 'sidekick-react.js',
      chunkFileNames: chunk => chunk.name === 'render-engine' ? 'sidekick-fallback.js' : 'sidekick-element.js',
      postBanner: chunk => `${chunk.isEntry ? "'use client';\n" : ''}${header}`,
    });
  } finally { await react.close(); }
  const worker = await rolldown({ input: join(libraryDirectory, 'runtime/render-worker.js'), platform: 'browser' });
  try { await worker.write({ ...common, format: 'iife', file: join(outputDirectory, 'sidekick.worker.js'), codeSplitting: false }); }
  finally { await worker.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildBrowser();
