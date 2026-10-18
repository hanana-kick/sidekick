/** Bounded crown activity visibility sample with chronological warm-up. No PNGs retained.
 * SOURCE=/path OUT=/path node --import tsx scripts/crown-qa/activity-grid.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import readline from 'node:readline';
import zlib from 'node:zlib';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {recordGL} from './recorder.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const source=path.resolve(process.env.SOURCE??here+'/../..'),out=path.resolve(process.env.OUT??here+'/output-activities');
const size=Number(process.env.SIZE??192),zoom=Number(process.env.ZOOM??1.5);
assert(Number.isInteger(size)&&size>=64&&size<=1024);
fs.mkdirSync(out,{recursive:true});
function hashes(){const r={};function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else r[path.relative(source,p)]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}}walk(source+'/src');return r;}
const before=hashes();
const load=p=>import(pathToFileURL(source+'/src/'+p+'.ts'));
const {AvatarRenderer}=await load('renderer/webgl'),{createDesign,createAccessory,MATERIAL_SHAPE_NAMES}=await load('core/design'),{initialPose}=await load('core/motion');
const selectedCases=process.env.CASES_FILE?JSON.parse(fs.readFileSync(process.env.CASES_FILE,'utf8')):null;
const shapes=process.env.SHAPES?.split(',')??(selectedCases?[...new Set(selectedCases.map(c=>c.shape))]:MATERIAL_SHAPE_NAMES);
const views=[{yaw:0,pitch:-30,roll:0,zoom},{yaw:45,pitch:15,roll:0,zoom}];
const activities=['still','idle','thinking','listening','speaking','celebrating'];
const warmupFps=60,duration=6,sampleInterval=.5,totalFrames=duration*warmupFps,sampleEvery=sampleInterval*warmupFps,samplesPerSequence=totalFrames/sampleEvery+1;
const cap=recordGL(),init=new AvatarRenderer({width:size,height:size,getContext:()=>cap.gl});
fs.writeFileSync(out+'/vertex.glsl',cap.shaders.find(s=>s.type===cap.gl.VERTEX_SHADER).source);init.dispose();
fs.writeFileSync(out+'/fragment.glsl',`#version 300 es\nprecision highp float;uniform vec3 color;out vec4 outColor;void main(){float z=floor(gl_FragCoord.z*65535.0+0.5);outColor=vec4(color.r,floor(z/256.0)/255.0,mod(z,256.0)/255.0,1.0);}`);
execFileSync(process.env.CC??'cc',['-O2',here+'/native-grid.c','-ldl','-o',out+'/native-grid']);
const native=spawn(out+'/native-grid',[out+'/vertex.glsl',out+'/fragment.glsl'],{env:{...process.env,LP_NUM_THREADS:process.env.LP_NUM_THREADS??'2',SIDEKICK_SIZE:String(size),MESA_SHADER_CACHE_DIR:out+'/mesa-cache'},stdio:['pipe','pipe','pipe']});
let pending=null,failure=null;
native.stderr.on('data',b=>fs.appendFileSync(out+'/native.log',b));
readline.createInterface({input:native.stdout}).on('line',line=>{if(line==='done'){pending?.resolve();pending=null;}else console.error(line);});
native.on('error',e=>{failure=e;pending?.reject(e);pending=null;});
const exit=new Promise((resolve,reject)=>native.on('exit',c=>{if(c!==0){failure=Error('Native exit '+c);pending?.reject(failure);pending=null;reject(failure);}else resolve();}));exit.catch(()=>{});
function binary(draws){const b=[Buffer.from(new Uint32Array([draws.length]).buffer)];for(const d of draws){const uniforms=new Map([...d.uniforms].filter(([k])=>['model','projection','faceScale'].includes(k)));uniforms.set('color',{kind:3,values:[d.id/255,0,0]});b.push(Buffer.from(new Uint32Array([d.vertices.length/24,d.indices.length/2,uniforms.size,Number(!!d.directions)]).buffer),d.vertices);if(d.directions)b.push(d.directions);b.push(d.indices);for(const[name,u]of uniforms){const label=Buffer.alloc(64);label.write(name);const f=new Float32Array(16);f.set(u.values);b.push(label,Buffer.from(new Uint32Array([u.kind]).buffer),Buffer.from(f.buffer));}}return Buffer.concat(b);}
async function render(draws,mode){if(failure)throw failure;fs.writeFileSync(out+'/frame.bin',binary(draws));await new Promise((resolve,reject)=>{pending={resolve,reject};native.stdin.write(out+'/frame.bin '+mode+' '+out+'/frame.pam\n');});const b=fs.readFileSync(out+'/frame.pam');const p=Buffer.from(b.subarray(b.indexOf('ENDHDR\n')+7));assert.equal(p.length,size*size*4);return p;}
function metrics(a,b,c){const r={bodyPixels:0,bandPixels:0,pointsPixels:0,crownVisiblePixels:0,crownOnlyPixels:0,bodyOccludedCrownPixels:0,cullMissingCrownPixels:0,cullIdMismatchPixels:0,cullCrownDepthMismatchPixels:0,bodyCrownDepthTiePixels:0};for(let i=0;i<a.length;i+=4){const ai=a[i+3]?a[i]:0,bi=b[i+3]?b[i]:0,ci=c[i+3]?c[i]:0,da=a[i+1]*256+a[i+2],db=b[i+1]*256+b[i+2],dc=c[i+1]*256+c[i+2];if(ai===1)r.bodyPixels++;if(ai===2)r.bandPixels++;if(ai===3)r.pointsPixels++;if(ai>=2)r.crownVisiblePixels++;if(ci>=2){r.crownOnlyPixels++;if(ai===1&&da<=dc)r.bodyOccludedCrownPixels++;if(ai===1&&Math.abs(da-dc)<=2)r.bodyCrownDepthTiePixels++;}if(bi>=2&&ai<2)r.cullMissingCrownPixels++;if(ai!==bi)r.cullIdMismatchPixels++;if(ai===bi&&ai>=2&&Math.abs(da-db)>2)r.cullCrownDepthMismatchPixels++;}return r;}
const file=fs.createWriteStream(out+'/views.jsonl.gz'),gzip=zlib.createGzip();gzip.pipe(file);
const closed=new Promise((resolve,reject)=>{file.on('finish',resolve);file.on('error',reject);gzip.on('error',reject);});
const sequenceKey=c=>`${c.shape}/${c.activity}/${c.camera.yaw}/${c.camera.pitch}`;
const selectedSequences=new Map();for(const c of selectedCases??[]){const k=sequenceKey(c);selectedSequences.set(k,Math.max(selectedSequences.get(k)??0,c.frame));}
const total={views:0,expectedViews:selectedCases?selectedCases.length:shapes.length*activities.length*views.length*samplesPerSequence,matrixType:selectedCases?'targeted chronological activity cases':'bounded activity matrix',shapes:shapes.length,activities,viewpoints:views,warmupFps,duration,sampleInterval,samplesPerSequence,nativePasses:0,warmupRenderCalls:0,expectedWarmupRenderCalls:selectedCases?[...selectedSequences.values()].reduce((sum,frame)=>sum+frame+1,0):shapes.length*activities.length*views.length*(totalFrames+1),viewsWithZeroVisibleCrown:0,viewsWithZeroCrownOnlyMask:0,viewsWithCullingMissingPixels:0,viewsWithCullingIdDifference:0,viewsWithCrownDepthDifference:0,viewsWithBodyCrownDepthTies:0,source,size,zoom,perSequence:[],largestCullingDifferences:[],largestSampleMaskChanges:[]};
const keys=new Set();let stopReason=null;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopReason=signal;});
function maskChange(a,b){let xor=0,union=0;for(let i=0;i<a.length;i+=4){const ai=a[i+3]&&a[i]>=2,bi=b[i+3]&&b[i]>=2;if(ai||bi)union++;if(Boolean(ai)!==Boolean(bi))xor++;}return {sampleCrownMaskXor:xor,sampleCrownMaskUnion:union,sampleCrownMaskXorFraction:union?xor/union:0};}
try{
for(const shape of shapes){if(stopReason)break;assert(MATERIAL_SHAPE_NAMES.includes(shape));
for(const activity of activities){if(stopReason)break;
for(const camera of views){if(stopReason)break;
const sequenceTargets=selectedCases?.filter(c=>c.shape===shape&&c.activity===activity&&c.camera.yaw===camera.yaw&&c.camera.pitch===camera.pitch);
if(selectedCases&&!sequenceTargets.length)continue;
const lastFrame=selectedCases?Math.max(...sequenceTargets.map(c=>c.frame)):totalFrames;
const targetFrames=selectedCases?new Set(sequenceTargets.map(c=>c.frame)):null;
const captured=recordGL(),renderer=new AvatarRenderer({width:size,height:size,getContext:()=>captured.gl}),design=createDesign({body:{shape},accessories:[createAccessory('crown')]});
const summary={shape,activity,camera,views:0,warmupRenderCalls:0,zeroVisibleViews:0,cullingMissingViews:0,cullingIdDifferenceViews:0,crownDepthDifferenceViews:0,bodyDepthTieViews:0,minVisibleCrownPixels:Infinity,maxVisibleCrownPixels:0,maxCullingMissingPixels:0,maxCullingIdDifferencePixels:0,maxSampleCrownMaskXorFraction:0};
let previous=null;
for(let frame=0;frame<=lastFrame;frame++){
if(stopReason)break;
const time=frame/warmupFps,delta=frame===0?0:1/warmupFps;
renderer.render(design,{pose:initialPose(),eyeMotion:{left:false,right:false},activity,time,delta,reduced:false,style:'flat',bodyOrientation:{yaw:camera.yaw,pitch:camera.pitch,roll:camera.roll},zoom:camera.zoom??1});
total.warmupRenderCalls++;summary.warmupRenderCalls++;
if(targetFrames?!targetFrames.has(frame):frame%sampleEvery!==0)continue;
assert.equal(captured.draws.length,3,'Crown must record body, band, points draws');
const draws=captured.draws.map((d,i)=>({...d,id:i+1}));
const a=await render(draws,0),b=await render(draws,1),c=await render(draws.slice(1),0),m=metrics(a,b,c);
const key=`${shape}/${activity}/${camera.yaw}/${camera.pitch}/${frame}`;assert(!keys.has(key));keys.add(key);
const row={shape,activity,camera,frame,time,delta,reduced:false,...m,...previous?maskChange(a,previous):{}};previous=a;
if(process.env.DETAIL_PIXELS==='1'){row.cullingAnomalyPixels=[];for(let i=0;i<a.length;i+=4){const ai=a[i+3]?a[i]:0,bi=b[i+3]?b[i]:0,ad=a[i+1]*256+a[i+2],bd=b[i+1]*256+b[i+2];if((ai!==bi||(ai>=2&&Math.abs(ad-bd)>2))&&row.cullingAnomalyPixels.length<32)row.cullingAnomalyPixels.push({x:(i/4)%size,y:Math.floor(i/4/size),productionId:ai,unculledId:bi,productionDepth:ad,unculledDepth:bd});}}
gzip.write(JSON.stringify(row)+'\n');total.views++;total.nativePasses+=3;summary.views++;
if(m.crownVisiblePixels===0){total.viewsWithZeroVisibleCrown++;summary.zeroVisibleViews++;}
if(m.crownOnlyPixels===0)total.viewsWithZeroCrownOnlyMask++;
if(m.cullMissingCrownPixels){total.viewsWithCullingMissingPixels++;summary.cullingMissingViews++;}
if(m.cullIdMismatchPixels){total.viewsWithCullingIdDifference++;summary.cullingIdDifferenceViews++;}
if(m.cullCrownDepthMismatchPixels){total.viewsWithCrownDepthDifference++;summary.crownDepthDifferenceViews++;}
if(m.bodyCrownDepthTiePixels){total.viewsWithBodyCrownDepthTies++;summary.bodyDepthTieViews++;}
summary.minVisibleCrownPixels=Math.min(summary.minVisibleCrownPixels,m.crownVisiblePixels);summary.maxVisibleCrownPixels=Math.max(summary.maxVisibleCrownPixels,m.crownVisiblePixels);summary.maxCullingMissingPixels=Math.max(summary.maxCullingMissingPixels,m.cullMissingCrownPixels);summary.maxCullingIdDifferencePixels=Math.max(summary.maxCullingIdDifferencePixels,m.cullIdMismatchPixels);summary.maxSampleCrownMaskXorFraction=Math.max(summary.maxSampleCrownMaskXorFraction,row.sampleCrownMaskXorFraction??0);
if(m.cullMissingCrownPixels||m.cullIdMismatchPixels||m.cullCrownDepthMismatchPixels){total.largestCullingDifferences.push(row);total.largestCullingDifferences.sort((a,b)=>b.cullMissingCrownPixels-a.cullMissingCrownPixels||b.cullIdMismatchPixels-a.cullIdMismatchPixels||b.cullCrownDepthMismatchPixels-a.cullCrownDepthMismatchPixels);total.largestCullingDifferences.length=Math.min(total.largestCullingDifferences.length,30);}
if(row.sampleCrownMaskXorFraction){total.largestSampleMaskChanges.push(row);total.largestSampleMaskChanges.sort((a,b)=>b.sampleCrownMaskXorFraction-a.sampleCrownMaskXorFraction);total.largestSampleMaskChanges.length=Math.min(total.largestSampleMaskChanges.length,30);}
}
renderer.dispose();total.perSequence.push(summary);
}
}
console.log(JSON.stringify({shape,completedSequences:total.perSequence.length,views:total.views,warmupRenderCalls:total.warmupRenderCalls}));
}
native.stdin.end();await exit;gzip.end();await closed;
if(!stopReason){assert.equal(total.views,total.expectedViews);assert.equal(total.warmupRenderCalls,total.expectedWarmupRenderCalls);}assert.deepEqual(hashes(),before,'Source changed during diagnostic scan');
fs.writeFileSync(out+'/summary.json',JSON.stringify({...total,uniqueKeys:keys.size,complete:total.views===total.expectedViews,stopReason,interpretation:'Bounded activity samples only: 35 shapes, six public activities (including still), 13 timestamps from 0 through 6 seconds every 0.5 seconds, two explicit viewpoints. Each independent activity/view sequence starts from a fresh renderer, advances chronologically at 60fps and retains state between selected timestamps. Only selected timestamps receive native visibility/culling passes. Sample mask changes span 0.5 seconds and cannot establish per-frame continuity or distinguish ordinary motion from jumps. IDs: 1 body, 2 crown band, 3 crown points/shell. This does not claim dense animation validation or all continuous camera/time combinations.'},null,2)+'\n');
fs.writeFileSync(out+'/provenance.json',JSON.stringify({source,date:new Date().toISOString(),size,zoom,shapes,activities,views,selectedCases,warmupFps,duration,sampleInterval,sampleFrames:Array.from({length:samplesPerSequence},(_,i)=>i*sampleEvery),sampleTimestamps:Array.from({length:samplesPerSequence},(_,i)=>i*sampleInterval),firstFrameDelta:0,subsequentDelta:1/warmupFps,reduced:false,sourceFiles:before,ids:{1:'body',2:'crown band',3:'crown points and shell'},passes:['production culling','culling disabled','crown only production culling']},null,2)+'\n');
for(const f of ['frame.bin','frame.pam'])fs.unlinkSync(out+'/'+f);console.log(stopReason?'Stopped with partial coverage':'Completed',total.views,'samples',total.nativePasses,'native passes',total.warmupRenderCalls,'chronological renderer calls');
}catch(e){native.kill();gzip.destroy();file.destroy();throw e;}
