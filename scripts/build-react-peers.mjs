import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import { esmExternalRequirePlugin } from 'rolldown/plugins';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));

/** Optional release/demo peers only; never part of the Sidekick npm package. */
export async function buildReactPeers(outputDirectory) {
  if (!outputDirectory) throw new Error('A release-only vendor output directory is required');
  await mkdir(outputDirectory, { recursive: true });
  const packages = ['react', 'react-dom', 'scheduler'];
  const versions = {};
  let notices = '';
  for (const name of packages) {
    const directory = dirname(require.resolve(name + '/package.json'));
    versions[name] = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')).version;
    const license = await readFile(join(directory, 'LICENSE'), 'utf8');
    await writeFile(join(outputDirectory, name + '-LICENSE.txt'), license);
    notices += `${name} ${versions[name]}\n${license}\n`;
  }
  await writeFile(join(outputDirectory, 'NOTICE.txt'), `Optional React demo dependencies, built from the installed official npm packages.\n\n${notices}`);
  // React's CJS entry needs an explicit ESM facade for both named imports and a
  // shared default instance. Derive exactly the production API, not dev-only act.
  const reactDirectory = dirname(require.resolve('react'));
  const reactExports = Object.keys(require(join(reactDirectory, 'cjs/react.production.js'))).sort();
  const entries = [
    { name: 'react', source: 'react', exports: reactExports, external: [] },
    { name: 'react-dom-client', source: 'react-dom/client', exports: ['createRoot', 'hydrateRoot', 'version'], external: ['react'] },
  ];
  for (const entry of entries) {
    const id = '\0sidekick-release-peer:' + entry.name;
    const bundle = await rolldown({
      input: id, cwd: root, platform: 'browser',
      transform: { define: { 'process.env.NODE_ENV': JSON.stringify('production') } },
      preserveEntrySignatures: 'strict',
      plugins: [esmExternalRequirePlugin({ external: entry.external }), {
        name: 'sidekick-release-peer',
        resolveId(source) { if (source === id) return id; },
        load(source) {
          if (source !== id) return;
          return `import peer from ${JSON.stringify(require.resolve(entry.source))};\nexport default peer;\n${entry.exports.map(name => `export const ${name} = peer.${name};`).join('\n')}`;
        },
      }],
    });
    try {
      await bundle.write({
        file: join(outputDirectory, entry.name + '.js'), format: 'esm', codeSplitting: false,
        minify: true, comments: false, sourcemap: false,
        postBanner: `/*! Optional Sidekick React demo peer.\n${notices}\n*/`,
      });
    } finally { await bundle.close(); }
  }
  return { directory: outputDirectory, versions, files: ['react.js', 'react-dom-client.js', ...packages.map(name => name + '-LICENSE.txt'), 'NOTICE.txt'] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/build-react-peers.mjs OUTPUT_VENDOR_DIRECTORY');
  console.log(await buildReactPeers(resolve(process.argv[2])));
}
