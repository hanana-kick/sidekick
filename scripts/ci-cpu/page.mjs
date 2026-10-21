import * as Baseline from '../../.ci-runtime/baseline/src/runtime/fixture-render-bridge.ts';
import * as Candidate from '../../.ci-runtime/candidate/src/runtime/fixture-render-bridge.ts';
import {createDesign,createAccessory} from '../../.ci-runtime/baseline/src/core/design.ts';
import {initialPose} from '../../.ci-runtime/baseline/src/core/motion.ts';
let bridge,canvas,latest,error,fixture,request=0,waiting=new Map(),generation=0,gaps=[],lastFrameTime=0;
const state=(size,dpr,graphics)=>({renderer:graphics==='canvas'?'canvas2d':'auto',design:createDesign({body:{shape:'circle'},accessories:[createAccessory('beret')]}),pose:initialPose(),zoom:1,bodyOrientation:{yaw:0,pitch:0,roll:0},activity:'still',paused:true,reduced:false,active:true,time:0,gaze:[0,0],trackingMode:'off',width:size,height:size,dpr});
const timeout=async(p)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('bridge request timeout')),12000)})]);}finally{clearTimeout(timer);}};
window.bench={
 async setup({variant,backend,size,dpr,graphics}){this.dispose();error=null;canvas=document.createElement('canvas');canvas.style.width=canvas.style.height=size+'px';document.body.append(canvas);let resolve,reject;const ready=new Promise((a,b)=>{resolve=a;reject=b});const callbacks={ready:s=>{latest=s;fixture=s.fixture;resolve();},event:e=>{if(e.snapshot){if(e.snapshot.frames!==latest?.frames){const now=performance.now();if(lastFrameTime)gaps.push(now-lastFrameTime);lastFrameTime=now;}latest=e.snapshot;}if(e.request&&waiting.has(e.request)){waiting.get(e.request)(e);waiting.delete(e.request);}if(e.kind==='error')error=e.message;},failed:e=>{error=e.message;reject(e)}};
 const constructors=variant==='candidate'?Candidate:Baseline;
 bridge=backend==='worker'?new constructors.WorkerRenderBridge(canvas,++generation,callbacks,()=>new Worker(new URL(variant==='candidate'?'./candidate-worker.js':'./baseline-worker.js',import.meta.url),{type:'module'})):new constructors.LocalRenderBridge(canvas,++generation,callbacks);
 bridge.start(state(size,dpr,graphics));await timeout(ready);bridge.send({kind:'resume-presentation'});return this.snapshot();},
 async capture(){const image=bridge.capture?bridge.capture():await timeout(new Promise(resolve=>{const id=++request;waiting.set(id,e=>resolve(e.image));bridge.send({kind:'capture',request:id})}));return {width:image.width,height:image.height,pixels:image.pixels};},
 async visibleCapture(){const out=document.createElement('canvas');out.width=latest.width;out.height=latest.height;const ctx=out.getContext('2d');ctx.drawImage(canvas,0,0);return{width:out.width,height:out.height,pixels:ctx.getImageData(0,0,out.width,out.height).data};},
 resume(){bridge.send({kind:'state',state:{activity:'idle',paused:false}});},
 resetGaps(){gaps=[];lastFrameTime=0;},
 snapshot(){if(error)throw Error(error);return {snapshot:structuredClone(latest),fixture:structuredClone(fixture),backend:bridge.backend,transferred:bridge.transferred,css:{width:canvas.style.width,height:canvas.style.height},backing:{width:canvas.width,height:canvas.height},gaps:[...gaps]};},
 dispose(){bridge?.dispose();canvas?.remove();bridge=null;canvas=null;waiting.clear();gaps=[];lastFrameTime=0;}
};
