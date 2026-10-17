/** Isolated production-style JS for profiling; never runs a shared dist build. */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';

export async function transpileProfileSource(source, destination) {
  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, 'package.json'), '{"type":"module"}\n');
  async function visit(relative = '') {
    for (const entry of await readdir(join(source, relative), { withFileTypes: true })) {
      const path = join(relative, entry.name);
      if (entry.isDirectory()) { await mkdir(join(destination, path), { recursive: true }); await visit(path); }
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        const code = await readFile(join(source, path), 'utf8');
        const result = ts.transpileModule(code, { fileName: path, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, verbatimModuleSyntax: true } });
        await writeFile(join(destination, path.replace(/\.ts$/, '.js')), result.outputText);
      }
    }
  }
  await visit();
}
