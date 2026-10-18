import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import os from 'node:os';
const base=process.env.SIDEKICK_BENCH_ROOT ?? resolve(process.cwd(),'..');
const output=process.env.SIDEKICK_BENCH_OUTPUT ?? fileURLToPath(new URL('.',import.meta.url));
const variant=process.argv[2];
const repo=variant==='baseline'?process.env.BASELINE_SOURCE:process.env.CANDIDATE_SOURCE;
const mod=async p=>import(repo+'/src/'+p+'.ts');
const {createDesign,createAccessory,MATERIAL_SHAPE_NAMES}=await mod('core/design');
const {resolveDesign}=await mod('core/resolved-design');
const {activityFrame}=await mod('core/motion');
const {ShapeTimeline}=await mod('core/shape-motion');
const {shapeContour}=await mod('core/contours');
const {resolveShapeProfile}=await mod('core/shape-profiles');
const {bodyGeometry}=await mod('renderer/body-geometry');
const {beretGeometry}=await mod('renderer/beret-geometry');
const design=resolveDesign(createDesign({accessories:[createAccessory('beret')]}));
const accessory=design.accessories[0];
const stat=a=>{const b=[...a].sort((a,b)=>a-b);return {n:b.length,median:b[Math.floor(b.length*.5)],p95:b[Math.min(b.length-1,Math.floor(b.length*.95))],max:b.at(-1),mean:b.reduce((a,b)=>a+b,0)/b.length}};
const time=fn=>{const t=performance.now(); const result=fn();return [performance.now()-t,result]};
const results={variant,node:process.version,cpu:os.cpus()[0].model,cpus:os.cpus().length,method:'Source imports via tsx. Timings milliseconds. Separate body build from accessory fit, runtime activityFrame at 60Hz. Single process per variant. Warm JIT, same source code unchanged.',static:[],morph:[]};
// Warm code on an independent contour identity, without warming the catalog fit cache.
for(let i=0;i<5;i++){const contour=structuredClone(shapeContour({kind:'material',name:'square'}));bodyGeometry(contour);beretGeometry(design.body,accessory,1,contour,resolveShapeProfile('square'));}
const paths=[['flower','triangle','square'],['heart','boom','pixelTriangle'],['clover8Leaf','heart','circle']];
for(const [from,to,next] of paths){
 const row={from,to,next,frames:[]};
 for(let repeat=0;repeat<2;repeat++){
  const timeline=new ShapeTimeline(from);let target=to;
  const [setupMs]=time(()=>timeline.to(to,{duration:1000,easing:'linear'}));
  row.setupMs=setupMs;
  for(let frame=0;frame<=120;frame++){
   let retargetMs=0;
   if(frame===36){retargetMs=time(()=>timeline.to(next,{duration:1000,easing:'linear'}))[0];target=next;}
   const active=timeline.active;
   const [advanceMs]=time(()=>{if(frame)timeline.advance(1000/60)});
   const [bodyMs]=time(()=>bodyGeometry(timeline.contour));
   const squash=activityFrame('idle',frame/60).squash;
   const [beretMs]=time(()=>beretGeometry({...design.body,shape:target},accessory,squash,timeline.contour,timeline.profile));
   if(repeat===1)row.frames.push({frame,active,retargetMs,advanceMs,bodyMs,beretMs,totalMs:retargetMs+advanceMs+bodyMs+beretMs});
  }
 }
 row.active={};row.settled={};
 for(const key of ['advanceMs','bodyMs','beretMs','totalMs']){
  row[key]=stat(row.frames.map(f=>f[key]));
  row.active[key]=stat(row.frames.filter(f=>f.active&&f.frame>0).map(f=>f[key]));
  row.settled[key]=stat(row.frames.filter(f=>!f.active).map(f=>f[key]));
 }
 results.morph.push(row);console.log(variant,from+'→'+to+'→'+next,'ACTIVE MORPH',JSON.stringify(row.active));
}
writeFileSync(output+'/abba-'+process.argv[3]+'-'+variant+'.json',JSON.stringify(results,null,2));
console.log('DONE',variant);
