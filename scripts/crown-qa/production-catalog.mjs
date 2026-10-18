/** Replay actual AvatarRenderer crown draws with unchanged production shaders.
 * SOURCE=/path/to/project OUT=/path/to/output node --import tsx scripts/crown-qa/production-catalog.mjs
 * Requires cc and system Mesa EGL/GLES3. No browser or image-generation service.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import readline from 'node:readline';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { recordGL } from './recorder.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=path.resolve(process.env.SOURCE??path.join(here,'../..'));
const out=path.resolve(process.env.OUT??path.join(here,'output'));
const size=Number(process.env.SIZE??512);
assert(Number.isInteger(size)&&size>=64&&size<=2048, 'SIZE must be an integer from 64 to 2048');
fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function sourceHashes(){const result={};function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else result[path.relative(source,file)]=hash(fs.readFileSync(file));}}walk(source+'/src');return result;}
const initialHashes=sourceHashes();
const load=p=>import(pathToFileURL(source+'/src/'+p+'.ts'));
const { AvatarRenderer }=await load('renderer/webgl');
const { createDesign,createAccessory,MATERIAL_SHAPE_NAMES }=await load('core/design');
const { initialPose }=await load('core/motion');
const shapes=process.env.SHAPES?.split(',')??MATERIAL_SHAPE_NAMES;
for(const shape of shapes)assert(MATERIAL_SHAPE_NAMES.includes(shape),`Unknown shape ${shape}`);
const views=process.env.VIEWS?JSON.parse(process.env.VIEWS):[['front',0,0],['quarter',45,15],['underside',0,-45]];
const zoom=Number(process.env.ZOOM??1.5);
const captured=recordGL();
const dummy=new AvatarRenderer({width:size,height:size,getContext:()=>captured.gl});
for(const [stage,type] of [['vertex',35633],['fragment',35632]])fs.writeFileSync(out+'/'+stage+'.glsl',captured.shaders.find(s=>s.type===type).source);
dummy.dispose();
const binaryPath=out+'/native-grid';
execFileSync(process.env.CC??'cc',['-O2',here+'/native-grid.c','-ldl','-o',binaryPath]);
const native=spawn(binaryPath,[out+'/vertex.glsl',out+'/fragment.glsl'],{env:{...process.env,LP_NUM_THREADS:process.env.LP_NUM_THREADS??'2',SIDEKICK_SIZE:String(size),MESA_SHADER_CACHE_DIR:out+'/mesa-cache'},stdio:['pipe','pipe','pipe']});
let pending=null,failure=null;
native.stderr.on('data',b=>fs.appendFileSync(out+'/native.log',b));
readline.createInterface({input:native.stdout}).on('line',line=>{if(line==='done'){pending?.resolve();pending=null;}else console.error(line);});
native.on('error',error=>{failure=error;pending?.reject(error);pending=null;});
const exited=new Promise((resolve,reject)=>native.on('exit',code=>{if(code!==0){failure=Error('Native renderer exited '+code);pending?.reject(failure);pending=null;reject(failure);}else resolve();}));
// Attach a handler now so a startup failure cannot produce an unhandled rejection.
exited.catch(()=>{});
function binary(draws){const buffers=[Buffer.from(new Uint32Array([draws.length]).buffer)];for(const draw of draws){buffers.push(Buffer.from(new Uint32Array([draw.vertices.length/24,draw.indices.length/2,draw.uniforms.size,Number(!!draw.directions)]).buffer),draw.vertices);if(draw.directions)buffers.push(draw.directions);buffers.push(draw.indices);for(const [name,u] of draw.uniforms){const label=Buffer.alloc(64);label.write(name);const values=new Float32Array(16);values.set(u.values);buffers.push(label,Buffer.from(new Uint32Array([u.kind]).buffer),Buffer.from(values.buffer));}}return Buffer.concat(buffers);}
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function png(pixels){const chunk=(tag,data)=>{const type=Buffer.from(tag),payload=Buffer.concat([type,data]),header=Buffer.alloc(4),tail=Buffer.alloc(4);let crc=0xffffffff;for(const n of payload)crc=crcTable[(crc^n)&255]^(crc>>>8);header.writeUInt32BE(data.length);tail.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([header,payload,tail]);};const head=Buffer.alloc(13);head.writeUInt32BE(size);head.writeUInt32BE(size,4);head[8]=8;head[9]=6;const rows=Buffer.alloc(size*(size*4+1));for(let y=0;y<size;y++)pixels.copy(rows,y*(size*4+1)+1,y*size*4,(y+1)*size*4);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
async function saveNative(draws,filename){if(failure)throw failure;fs.writeFileSync(out+'/frame.bin',binary(draws));await new Promise((resolve,reject)=>{pending={resolve,reject};native.stdin.write(out+'/frame.bin 0 '+out+'/frame.pam\n');});const pam=fs.readFileSync(out+'/frame.pam');const pixels=Buffer.from(pam.subarray(pam.indexOf('ENDHDR\n')+7));assert.equal(pixels.length,size*size*4);let visible=0;for(let i=0;i<pixels.length;i+=4){const alpha=pixels[i+3]/255;if(alpha)visible++;for(let c=0;c<3;c++)pixels[i+c]=Math.round(pixels[i+c]*alpha+245*(1-alpha));pixels[i+3]=255;}assert(visible>0,`${filename} is blank`);fs.writeFileSync(out+'/'+filename,png(pixels));return {file:filename,sha256:hash(fs.readFileSync(out+'/'+filename)),visiblePixels:visible};}
const cases=[];
try{for(const shape of shapes)for(const [view,yaw,pitch] of views){const cap=recordGL(),renderer=new AvatarRenderer({width:size,height:size,getContext:()=>cap.gl});try{const accessory=createAccessory('crown'),design=createDesign({body:{shape},accessories:[accessory]}),camera={yaw,pitch,roll:0,zoom};renderer.render(design,{pose:initialPose(),eyeMotion:{left:false,right:false},activity:'still',time:0,delta:0,reduced:true,style:'flat',view:[0,0],camera});assert(cap.draws.length>=2,'Expected body and crown draws');const result=await saveNative(cap.draws,shape+'-'+view+'.png');const entry={shape,view,camera,bodyColor:design.body.color,crownColor:accessory.color,drawCount:cap.draws.length,...result};if(process.env.CAPTURE_LAYERS==='1'){entry.bodyOnly=await saveNative(cap.draws.slice(0,1),shape+'-'+view+'-body-only.png');entry.crownOnly=await saveNative(cap.draws.slice(1),shape+'-'+view+'-crown-only.png');}if(process.env.CAPTURE_GEOMETRY==='1')fs.writeFileSync(out+'/'+shape+'-'+view+'-geometry.json',JSON.stringify({shape,view,camera,draws:cap.draws.map(d=>({uniforms:Object.fromEntries(d.uniforms),vertices:[...new Float32Array(d.vertices.buffer,d.vertices.byteOffset,d.vertices.length/4)],indices:[...new Uint16Array(d.indices.buffer,d.indices.byteOffset,d.indices.length/2)]}))}));cases.push(entry);console.log(shape,view);}finally{renderer.dispose();}}
native.stdin.end();await exited;assert.deepEqual(sourceHashes(),initialHashes,'Source changed during render; discard this output');assert.equal(cases.length,shapes.length*views.length);
fs.writeFileSync(out+'/provenance.json',JSON.stringify({source,date:new Date().toISOString(),size,shapes,views,zoom,accessory:'crown',shaderMode:'Unchanged production vertex and fragment shaders',rendering:'Native Mesa GLES3. Fresh AvatarRenderer for each shape/view. Still t=0, delta=0, reduced motion, flat style. Default production body, eye and crown colors. Depth testing and back-face culling enabled. Transparent pixels composited on #f5f5f5. No diagnostic recoloring, image generation, or mesh overrides.',sourceFiles:initialHashes,shaderHashes:{vertex:hash(fs.readFileSync(out+'/vertex.glsl')),fragment:hash(fs.readFileSync(out+'/fragment.glsl'))},cases},null,2)+'\n');
for(const file of ['frame.bin','frame.pam'])fs.unlinkSync(out+'/'+file);
console.log(`Rendered ${cases.length} production crown cases to ${out}`);
}catch(error){native.kill();throw error;}
