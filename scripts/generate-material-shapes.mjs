/** Regenerate the checked-in Material contours with the official AndroidX JVM library.
 * Requires Java 21+ (including the jdk.compiler module), unzip, and network access.
 * All downloads are version-pinned and SHA-256 verified. No runtime dependency is added.
 */
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'sidekick-material-'));
const inputs = [
  ['shapes.aar', 'https://dl.google.com/dl/android/maven2/androidx/graphics/graphics-shapes-android/1.1.0/graphics-shapes-android-1.1.0.aar', '1c959206c3c917f261897b33c2fe9d8263686475091a497ce08f0210a0ff0eec'],
  ['kotlin.jar', 'https://repo.maven.apache.org/maven2/org/jetbrains/kotlin/kotlin-stdlib/2.1.20/kotlin-stdlib-2.1.20.jar', '1bcc74e8ce84e2c25eaafde10f1248349cce3062b6e36978cbeec610db1e930a'],
  ['collection.jar', 'https://dl.google.com/dl/android/maven2/androidx/collection/collection-jvm/1.5.0/collection-jvm-1.5.0.jar', '70b35924e4babcdffa37d0e575ee039c56a2d97123342624c48b603233704341'],
  ['MaterialShapes.kt', 'https://raw.githubusercontent.com/androidx/androidx/9a589fa61f8661e0cbef9123dcc98d3c1f655fc7/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/MaterialShapes.kt', '08c29828003344914ee0d6783f213b37caae650175cd004ba321eaf3a7d6e434'],
];
try {
  await Promise.all(inputs.map(async ([file, url, hash]) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error(`Checksum mismatch: ${file}`);
    await writeFile(join(temporary, file), bytes);
  }));
  execFileSync('unzip', ['-o', join(temporary, 'shapes.aar'), 'classes.jar', '-d', temporary], { stdio: 'ignore' });
  const classpath = ['classes.jar', 'kotlin.jar', 'collection.jar'].map(file => join(temporary, file)).join(delimiter);
  const json = execFileSync('java', ['-cp', classpath, join(root, 'scripts/MaterialShapesGenerator.java')], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  const cubics = JSON.parse(json);
  const shapesFile = await readFile(join(root, 'src/core/shapes.ts'), 'utf8');
  const names = JSON.parse(shapesFile.match(/MATERIAL_SHAPE_NAMES = Object\.freeze\((\[[^\n]+\]) as const\)/)[1]);
  if (names.length !== 35 || names.some(name => !Array.isArray(cubics[name]))) throw new Error('Incomplete official catalog.');
  const body = names.map(name => `  ${name}: [\n${cubics[name].map(c => `    [${c.join(',')}],`).join('\n')}\n  ],`).join('\n');
  const target = join(root, 'src/core/material-shapes.ts');
  const before = await readFile(target, 'utf8');
  const after = before.replace(/(export const MATERIAL_SHAPE_CUBICS:[^\n]+\n)[\s\S]*?(\n\}\);)/, `$1${body}$2`);
  if (before === after) console.log('Material contours are reproducible and up to date.');
  else { await writeFile(target, after); console.log('Regenerated all 35 official Material contours.'); }
} finally { await rm(temporary, { recursive: true, force: true }); }
