/** Generate the social card with the production renderer, native EGL/GLES3, and bundled Geist.
 * Run: node scripts/generate-og-image.mjs
 * Optional: SIDEKICK_RENDERER_ROOT=/absolute/worktree to render another source revision.
 * Requires Node dependencies, cc, libEGL/libGLES, Python Pillow and fontTools.
 * No browser, image generation, network requests, or runtime rendering dependencies.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { transpileProfileSource } from './profile-source-build.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = path.resolve(process.env.SIDEKICK_RENDERER_ROOT || root);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sidekick-og-'));
const SIZE = 4096;
function recordGL() {
  let serial=0,vao=null,arrayBuffer=null,defaultIndex=null;
  const buffers=new Map(),uniforms=new Map(),draws=[],shaders=[];
  const gl={VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,LINK_STATUS:35714,ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,DYNAMIC_DRAW:35048,STATIC_DRAW:35044,FLOAT:5126,TRIANGLES:4,UNSIGNED_SHORT:5123,DEPTH_TEST:2929,CULL_FACE:2884,BACK:1029,COLOR_BUFFER_BIT:16384,DEPTH_BUFFER_BIT:256};
  const object=()=>({id:++serial});
  Object.assign(gl,{
    createShader:type=>{const o={...object(),type};shaders.push(o);return o;},shaderSource:(s,source)=>s.source=source,
    compileShader(){},getShaderParameter:()=>true,getShaderInfoLog:()=>'',createProgram:object,attachShader(){},linkProgram(){},deleteShader(){},getProgramParameter:()=>true,getProgramInfoLog:()=>'',getUniformLocation:(_p,name)=>({name}),
    createVertexArray:()=>({...object(),attributes:new Map()}),createBuffer:object,
    bindVertexArray:v=>vao=v,bindBuffer:(target,b)=>{if(target===gl.ARRAY_BUFFER)arrayBuffer=b;else if(vao)vao.index=b;else defaultIndex=b;},
    bufferData:(target,data)=>{const b=target===gl.ARRAY_BUFFER?arrayBuffer:(vao?.index??defaultIndex);buffers.set(b,Buffer.from(data.buffer,data.byteOffset,data.byteLength).slice());},
    bufferSubData:(target,offset,data)=>{const b=target===gl.ARRAY_BUFFER?arrayBuffer:(vao?.index??defaultIndex);Buffer.from(data.buffer,data.byteOffset,data.byteLength).copy(buffers.get(b),offset);},
    enableVertexAttribArray(){},vertexAttribPointer:(loc,size,type,normalized,stride,offset)=>vao.attributes.set(loc,{buffer:arrayBuffer,size,type,normalized,stride,offset}),vertexAttrib3f(){},
    uniformMatrix4fv:(loc,_transpose,values)=>uniforms.set(loc.name,{kind:16,values:Array.from(values)}),
    uniform1f:(loc,value)=>uniforms.set(loc.name,{kind:1,values:[value]}),
    uniform1i:(loc,value)=>uniforms.set(loc.name,{kind:0,values:[value]}),
    uniform2f:(loc,...values)=>uniforms.set(loc.name,{kind:2,values}),uniform3f:(loc,...values)=>uniforms.set(loc.name,{kind:3,values}),uniform4f:(loc,...values)=>uniforms.set(loc.name,{kind:4,values}),
    viewport(){},clear(){draws.length=0;},clearColor(){},enable(){},disable(){},blendFunc(){},cullFace(){},useProgram(){},isContextLost:()=>false,
    drawElements:(_mode,count,_type,offset=0)=>draws.push({uniforms:structuredClone(uniforms),vertices:buffers.get(vao.attributes.get(0).buffer).slice(),directions:buffers.get(vao.attributes.get(2)?.buffer)?.slice(),indices:buffers.get(vao.index).subarray(offset,offset+count*2).slice()}),
    deleteBuffer(){},deleteVertexArray(){},deleteProgram(){}
  });
  return {gl,draws,shaders};
}

function serialize(draws) {
  const out=[Buffer.from(new Uint32Array([draws.length]).buffer)];
  for(const draw of draws){
    out.push(Buffer.from(new Uint32Array([draw.vertices.length/24,draw.indices.length/2,draw.uniforms.size,draw.directions?1:0]).buffer),draw.vertices,...(draw.directions?[draw.directions]:[]),draw.indices);
    for(const[name,{kind,values}]of draw.uniforms){const label=Buffer.alloc(64);label.write(name);const data=new Float32Array(16);data.set(values);out.push(label,Buffer.from(new Uint32Array([kind]).buffer),Buffer.from(data.buffer));}
  }
  return Buffer.concat(out);
}
try {
  const compiled = path.join(temp, 'compiled');
  await transpileProfileSource(path.join(sourceRoot, 'src'), compiled);
  const { AvatarRenderer } = await import(pathToFileURL(path.join(compiled, 'renderer/webgl.js')));
  const { createAccessory, createDesign } = await import(pathToFileURL(path.join(compiled, 'core/design.js')));
  const { initialPose } = await import(pathToFileURL(path.join(compiled, 'core/motion.js')));
  const native = path.join(temp, 'native-preview-renderer');
  execFileSync(process.env.CC || 'cc', [path.join(root, 'scripts/native-preview-renderer.c'), '-O2', '-ldl', '-o', native], { stdio: 'inherit' });
  const captured = recordGL();
  const renderer = new AvatarRenderer({ width: SIZE, height: SIZE, getContext: () => captured.gl });
  const design = createDesign({
    body: { shape: 'ghostish', color: '#FFCC37' },
    eyes: { left: { weights: { smile: 1, blink: 0 } }, right: { weights: { smile: 1, blink: 0 } } },
    accessories: ['glasses', 'beret', 'bowTie'].map(preset => createAccessory(preset)),
  });
  const pose = initialPose();
  pose.eyes.left.smile = pose.eyes.right.smile = 1;
  renderer.render(design, { pose, activity: 'still', time: 0, delta: 0, reduced: true, style: 'flat', bodyOrientation: { yaw: 0, pitch: 0, roll: 0 } });
  assert.ok(captured.draws.length > 1, 'Expected production body and accessory draws');
  for (const [stage, type] of [['vertex', captured.gl.VERTEX_SHADER], ['fragment', captured.gl.FRAGMENT_SHADER]]) {
    fs.writeFileSync(path.join(temp, stage + '.glsl'), captured.shaders.find(shader => shader.type === type).source);
  }
  const binary = path.join(temp, 'avatar.bin'), pam = path.join(temp, 'avatar.pam');
  fs.writeFileSync(binary, serialize(captured.draws));
  execFileSync(native, [path.join(temp, 'vertex.glsl'), path.join(temp, 'fragment.glsl'), binary, pam], {
    stdio: 'inherit', env: { ...process.env, SIDEKICK_SIZE: String(SIZE), MESA_SHADER_CACHE_DIR: path.join(temp, 'mesa-cache') },
  });
  renderer.dispose();
  const output = path.join(root, 'public');
  fs.mkdirSync(output, { recursive: true });
  const font = path.join(root, 'node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2');
  execFileSync(process.env.PYTHON || 'python', ['-c', String.raw`
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops
# Reuse Node's built-in Brotli decoder rather than require an extra Python module.
import subprocess, types
sys.modules['brotli'] = types.SimpleNamespace(decompress=lambda data: subprocess.run(
    ['node', '-e', "process.stdout.write(require('node:zlib').brotliDecompressSync(require('node:fs').readFileSync(0)))"],
    input=data, check=True, capture_output=True).stdout)
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
pam, font_path, temporary, output = sys.argv[1:]
# Convert the repository's exact Geist font to an intermediate static TTF.
font = instantiateVariableFont(TTFont(font_path), {"wght": 650}, inplace=True)
font.flavor = None
font_file = str(Path(temporary) / 'Geist-Semibold.ttf')
font.save(font_file)
# Native EGL output is straight-alpha RGBA; preserve its antialiasing during resize.
raw = Path(pam).read_bytes()
header, pixels = raw.split(b'ENDHDR\n', 1)
size = int(header.split(b'WIDTH ')[1].splitlines()[0])
avatar = Image.frombytes('RGBA', (size, size), pixels)
bounds = avatar.getchannel('A').getbbox()
assert bounds is not None
avatar = avatar.crop(bounds)
ratio = min(390 * 3 / avatar.width, 438 * 3 / avatar.height)
avatar = avatar.resize((round(avatar.width * ratio), round(avatar.height * ratio)), Image.Resampling.LANCZOS)
# Composite at 3x so both typography and native silhouette have clean coverage.
scale = 3
card = Image.new('RGB', (1200 * scale, 630 * scale), '#ffffff')
x = 91 * scale + (390 * scale - avatar.width) // 2
y = (630 * scale - avatar.height) // 2
card.paste(avatar, (x, y), avatar)
draw = ImageDraw.Draw(card)
typeface = ImageFont.truetype(font_file, 132 * scale)
box = draw.textbbox((0, 0), 'Sidekick', font=typeface)
x = 536 * scale
y = (630 * scale - (box[3] - box[1])) // 2 - box[1]
draw.text((x, y), 'Sidekick', font=typeface, fill='#24242c')
assert x + box[2] <= 1160 * scale, str(box)
# Keep the social canvas unchanged; center the complete artwork at 44% of its original size.
art_bounds = ImageChops.difference(card, Image.new('RGB', card.size, '#ffffff')).getbbox()
assert art_bounds is not None
art = card.crop(art_bounds)
art = art.resize((round(art.width * .44), round(art.height * .44)), Image.Resampling.LANCZOS)
card = Image.new('RGB', (1200 * scale, 630 * scale), '#ffffff')
card.paste(art, ((card.width - art.width) // 2, (card.height - art.height) // 2))
# The published og-sidekick.png is the owner's selected image. Never regenerate it here.
avatar.thumbnail((780, 876), Image.Resampling.LANCZOS)
avatar.save(Path(output) / 'og-avatar.png', optimize=True)
print('Generated public/og-avatar.png; selected social image preserved unchanged')
`, pam, font, temp, output], { stdio: 'inherit' });
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
