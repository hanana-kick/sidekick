import {LocalRenderBridge,WorkerRenderBridge} from '../../.ci-runtime/baseline/src/runtime/render-bridge.ts';
import {AtomicSurfaceBridge} from '../../.ci-runtime/candidate/experiments/atomic-surface/bridge.ts';
import {createDesign,createAccessory} from '../../.ci-runtime/baseline/src/core/design.ts';
import {initialPose} from '../../.ci-runtime/baseline/src/core/motion.ts';
let bridge,canvas,latest,error,request=0,waiting=new Map(),generation=0,gaps=[],lastFrameTime=0;
const state=(size,dpr)=>({design:createDesign({body:{shape:'circle'},accessories:[createAccessory('beret')]}),pose:initialPose(),zoom:1,bodyOrientation:{yaw:0,pitch:0,roll:0},activity:'still',paused:true,reduced:false,active:true,time:0,gaze:[0,0],trackingMode:'off',width:size,height:size,dpr});
const timeout=async(p)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('bridge request timeout')),12000)})]);}finally{clearTimeout(timer);}};
window.bench={
 async setup({variant,backend,size,dpr}){this.dispose();error=null;canvas=document.createElement('canvas');canvas.style.width=canvas.style.height=size+'px';document.body.append(canvas);let resolve,reject;const ready=new Promise((a,b)=>{resolve=a;reject=b});const callbacks={ready:s=>{latest=s;resolve();},event:e=>{if(e.snapshot){if(e.snapshot.frames!==latest?.frames){const now=performance.now();if(lastFrameTime)gaps.push(now-lastFrameTime);lastFrameTime=now;}latest=e.snapshot;}if(e.request&&waiting.has(e.request)){waiting.get(e.request)(e);waiting.delete(e.request);}if(e.kind==='error')error=e.message;},failed:e=>{error=e.message;reject(e)}};
 bridge=variant==='atomic'?new AtomicSurfaceBridge(canvas,++generation,callbacks,backend==='worker'):backend==='worker'?new WorkerRenderBridge(canvas,++generation,callbacks,()=>new Worker(new URL('./baseline-worker.js',import.meta.url),{type:'module'})):new LocalRenderBridge(canvas,++generation,callbacks);
 bridge.start(state(size,dpr));await timeout(ready);bridge.send({kind:'resume-presentation'});return this.snapshot();},
 async capture(){const image=bridge.capture?bridge.capture():await timeout(new Promise(resolve=>{const id=++request;waiting.set(id,e=>resolve(e.image));bridge.send({kind:'capture',request:id})}));return {width:image.width,height:image.height,pixels:Array.from(image.pixels)};},
 async visibleCapture(){const s=bridge.presentationStats?.surface,fullW=s?.fullWidth??latest.width,fullH=s?.fullHeight??latest.height;const out=document.createElement('canvas');out.width=fullW;out.height=fullH;const ctx=out.getContext('2d');ctx.drawImage(canvas,s?.x??0,s?fullH-s.y-s.height:0,s?.width??fullW,s?.height??fullH);return{width:fullW,height:fullH,pixels:Array.from(ctx.getImageData(0,0,fullW,fullH).data)};},
 resume(){bridge.send({kind:'state',state:{activity:'idle',paused:false}});},
 resetGaps(){gaps=[];lastFrameTime=0;},
 snapshot(){if(error)throw Error(error);return {snapshot:structuredClone(latest),presentation:bridge.presentationStats?structuredClone(bridge.presentationStats):null,backing:{width:canvas.width,height:canvas.height},gaps:[...gaps]};},
 dispose(){bridge?.dispose();canvas?.remove();bridge=null;canvas=null;waiting.clear();gaps=[];lastFrameTime=0;}
};
