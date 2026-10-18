import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';import {writeFileSync} from 'node:fs';import os from 'node:os';

const root=process.env.SIDEKICK_BENCH_ROOT ?? resolve(process.cwd(),'..');const output=process.env.SIDEKICK_BENCH_OUTPUT ?? fileURLToPath(new URL('.',import.meta.url));const result={cpu:os.cpus()[0].model,node:process.version,variants:{}};
const {countingCanvas,numericDelta}=await import(root+'/sidekick-fixed-accessories/tests/performance-fixture.mjs');
const stat=a=>{const s=[...a].sort((a,b)=>a-b);return {n:s.length,median:s[s.length>>1],p95:s[Math.floor(s.length*.95)],max:s.at(-1),mean:s.reduce((a,b)=>a+b,0)/s.length}};
const timed=fn=>{const t=performance.now();const x=fn();return [performance.now()-t,x]};
for(const variant of ['baseline','candidate']){
 const repo=root+(variant==='baseline'?'/sidekick-beret-baseline':'/sidekick-fixed-accessories');const m=Object.assign({},...await Promise.all(['core/design','core/resolved-design','core/motion','core/shape-motion','renderer/body-geometry','renderer/beret-geometry','renderer/webgl'].map(p=>import(repo+'/src/'+p+'.ts'))));
 const design=m.resolveDesign(m.createDesign({accessories:[m.createAccessory('beret')]})),a=design.accessories[0];const out={steady:[],morph:{from:'heart',to:'flower',frames:[]},counts:[]};result.variants[variant]=out;
 // Prewarm JIT on square using a separate snapshot identity.
 for(let i=0;i<3;i++){const t=new m.ShapeTimeline('square'),c=structuredClone(t.contour);m.bodyGeometry(c);m.beretGeometry(design.body,a,1,c,t.profile);}
 for(const shape of ['square','heart','flower']){
  const t=new m.ShapeTimeline(shape),body={...design.body,shape};const [bodyMs]=timed(()=>m.bodyGeometry(t.contour));const [firstFitMs,mesh]=timed(()=>m.beretGeometry(body,a,1,t.contour,t.profile));
  // Warm entire measured breathing interval twice, including numeric depth keys.
  for(let pass=0;pass<2;pass++)for(let f=0;f<180;f++)m.beretGeometry(body,a,m.activityFrame('idle',f/60).squash,t.contour,t.profile);
  const raw=[];for(let f=0;f<180;f++)raw.push(timed(()=>m.beretGeometry(body,a,m.activityFrame('idle',f/60).squash,t.contour,t.profile))[0]);
  out.steady.push({shape,bodyMs,firstFitMs,vertexBytes:mesh.vertices.byteLength,indexBytes:mesh.indices.byteLength,vertices:mesh.vertices.length/6,triangles:mesh.indices.length/3,timing:stat(raw),rawMs:raw});
 }
 for(const shape of ['square','heart','flower']){
  const f=countingCanvas(),r=new m.AvatarRenderer(f.canvas),design=m.createDesign({body:{shape},accessories:[m.createAccessory('beret')]}),frame={pose:m.initialPose(),time:0,delta:0,activity:'idle',reduced:false,style:'flat',...new m.ShapeTimeline(shape).snapshot};
  r.render(design,frame);const before=f.snapshot();for(let i=1;i<=60;i++){frame.time=i/60;frame.delta=1000/60;r.render(design,frame);}const after=f.snapshot();const stats=r.stats;r.dispose();out.counts.push({shape,sixtyFrames:numericDelta(after,before),stats,afterDispose:f.snapshot()});
 }
 console.log(variant,JSON.stringify({steady:out.steady.map(({rawMs,...x})=>x),morph:Object.fromEntries(Object.entries(out.morph).filter(([k])=>k!=='frames')),counts:out.counts}));
}
writeFileSync(output+'/cached-cold-counts.json',JSON.stringify(result,null,2));
