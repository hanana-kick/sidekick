import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
export const pluginSdkPackageName = '@hanana-kick/sidekick-plugin-sdk';

// Copy only declarations reachable from the author-facing entry. The two trees
// preserve NodeNext's distinction between ESM and CommonJS declaration modules.
function copyDeclarations(libraryDirectory, outputDirectory) {
  const pending = ['plugin-sdk.d.ts'];
  const declarations = new Map();
  while (pending.length) {
    const name = pending.pop();
    if (declarations.has(name)) continue;
    const source = readFileSync(join(libraryDirectory, name), 'utf8');
    const info = ts.preProcessFile(source, true, true);
    if (info.referencedFiles.length || info.typeReferenceDirectives.length) {
      throw new Error(`Plugin SDK declarations must be self-contained: ${name}`);
    }
    for (const dependency of info.importedFiles) {
      if (!dependency.fileName.startsWith('.') || !dependency.fileName.endsWith('.js')) {
        throw new Error(`Unsupported plugin SDK type dependency in ${name}: ${dependency.fileName}`);
      }
      const target = relative(libraryDirectory, resolve(libraryDirectory, dirname(name), dependency.fileName.replace(/\.js$/, '.d.ts')));
      if (target.startsWith('..') || isAbsolute(target)) throw new Error(`Plugin SDK type dependency escapes the library: ${target}`);
      pending.push(target);
    }
    declarations.set(name, { source, imports: info.importedFiles });
  }
  for (const [name, { source, imports }] of declarations) {
    const esm = join(outputDirectory, 'types/esm', name);
    mkdirSync(dirname(esm), { recursive: true });
    writeFileSync(esm, source);
    let commonjs = source;
    for (const dependency of [...imports].sort((a, b) => b.pos - a.pos)) {
      // preProcessFile positions start at the opening quote, not its contents.
      const start = dependency.pos + 1;
      if (source.slice(start, start + dependency.fileName.length) !== dependency.fileName) {
        throw new Error(`Cannot rewrite plugin SDK declaration import in ${name}`);
      }
      commonjs = commonjs.slice(0, start) + dependency.fileName.replace(/\.js$/, '.cjs') + commonjs.slice(start + dependency.fileName.length);
    }
    const cjs = join(outputDirectory, 'types/cjs', name.replace(/\.d\.ts$/, '.d.cts'));
    mkdirSync(dirname(cjs), { recursive: true });
    writeFileSync(cjs, commonjs);
  }
  return [...declarations.keys()].sort();
}

/** Build an offline-installable author SDK, independent of the avatar runtime. */
export async function buildPluginSdk({ libraryDirectory = resolve(root, 'dist/library'), outputDirectory = resolve(root, 'dist/plugin-sdk') } = {}) {
  libraryDirectory = resolve(libraryDirectory);
  outputDirectory = resolve(outputDirectory);
  rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(outputDirectory, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const license = readFileSync(join(root, 'LICENSE'), 'utf8');
  const notice = readFileSync(join(root, 'third_party/material-shapes/NOTICE'), 'utf8');
  const banner = `/*! Sidekick Plugin SDK ${manifest.version} | See LICENSE and third_party/material-shapes.\n${license}\n${notice}\n*/`;
  for (const [format, filename] of [['esm', 'index.js'], ['cjs', 'index.cjs']]) {
    const bundle = await rolldown({
      // Module-region comments must be relative to the library, not the checkout
      // or the temporary directory used by build-library --check.
      cwd: libraryDirectory,
      input: join(libraryDirectory, 'plugin-sdk.js'),
      platform: 'neutral',
      preserveEntrySignatures: 'strict',
      onwarn(warning, warn) {
        if (warning.code === 'UNRESOLVED_IMPORT') throw new Error(warning.message);
        warn(warning);
      },
    });
    try {
      const result = await bundle.write({ format, file: join(outputDirectory, filename), codeSplitting: false, sourcemap: false, banner });
      for (const chunk of result.output) {
        if (chunk.type !== 'chunk') continue;
        if (chunk.imports.length || chunk.dynamicImports.length) throw new Error('Plugin SDK must not require runtime dependencies.');
        for (const [id, module] of Object.entries(chunk.modules)) {
          if (module.renderedLength && /(?:\/node_modules\/react(?:-dom)?\/|\/(?:renderer|element|runtime)\/)/.test(id.replaceAll('\\', '/'))) {
            throw new Error(`Runtime code leaked into the plugin SDK: ${id}`);
          }
        }
      }
    } finally { await bundle.close(); }
  }
  const declarations = copyDeclarations(libraryDirectory, outputDirectory);
  const sdkManifest = {
    name: pluginSdkPackageName,
    version: manifest.version,
    description: 'Pure, typed authoring helpers for Sidekick accessory plugins. Install from the release ZIP; the avatar runtime is separate.',
    type: 'module',
    private: true,
    license: manifest.license,
    repository: { type: 'git', url: 'https://github.com/hanana-kick/sidekick.git' },
    main: './index.cjs',
    module: './index.js',
    types: './types/esm/plugin-sdk.d.ts',
    exports: {
      '.': {
        import: { types: './types/esm/plugin-sdk.d.ts', default: './index.js' },
        require: { types: './types/cjs/plugin-sdk.d.cts', default: './index.cjs' },
      },
      './package.json': './package.json',
    },
    sideEffects: false,
    files: ['index.js', 'index.cjs', 'types', 'LICENSE', 'third_party', 'README.md', 'examples', 'release.json'],
  };
  writeFileSync(join(outputDirectory, 'package.json'), JSON.stringify(sdkManifest, null, 2) + '\n');
  cpSync(join(root, 'LICENSE'), join(outputDirectory, 'LICENSE'));
  cpSync(join(root, 'third_party/material-shapes'), join(outputDirectory, 'third_party/material-shapes'), { recursive: true });
  cpSync(join(root, 'docs/plugin-sdk.md'), join(outputDirectory, 'README.md'));
  cpSync(join(root, 'examples/plugin-sdk'), join(outputDirectory, 'examples'), { recursive: true });
  return { name: pluginSdkPackageName, version: manifest.version, declarations };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildPluginSdk();
