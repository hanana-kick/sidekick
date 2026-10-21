import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
export function parseStat(raw){const f=raw.slice(raw.lastIndexOf(')')+2).trim().split(/\s+/);const value={userTicks:Number(f[11]),systemTicks:Number(f[12]),startTicks:f[19]};if(!Number.isFinite(value.userTicks)||!Number.isFinite(value.systemTicks)||!/^\d+$/.test(value.startTicks??''))throw Error('Malformed process counters');return value;}
export class OwnedProcessSampler {
 constructor(rootPid,{read=path=>readFile(path,'utf8'),list=readdir,hz=Number(execFileSync('getconf',['CLK_TCK'],{encoding:'utf8'})),now=()=>performance.now()}={}){Object.assign(this,{rootPid,read,list,hz,now});this.known=new Map();this.issues=[];this.samples=[];}
 async sample(){const queue=[this.rootPid],seen=new Set(),processes=[];while(queue.length){const pid=queue.shift();if(seen.has(pid))continue;seen.add(pid);try{const stat=parseStat(await this.read(`/proc/${pid}/stat`));const prev=this.known.get(pid);if(prev&&prev.startTicks!==stat.startTicks)this.issues.push({kind:'pid-reused',pid});this.known.set(pid,stat);processes.push({pid,...stat});for(const tid of await this.list(`/proc/${pid}/task`)){const children=await this.read(`/proc/${pid}/task/${tid}/children`);for(const child of children.trim().split(/\s+/).filter(Boolean))queue.push(Number(child));}}catch(error){this.issues.push({kind:'counter-unavailable',pid,error:error.code??error.message});}}
 for(const pid of this.known.keys())if(!seen.has(pid))this.issues.push({kind:'descendant-disappeared',pid});
 const snapshot={monotonicMs:this.now(),processes};this.samples.push(snapshot);return snapshot;}
 async start(){this.known.clear();this.issues=[];this.samples=[];await this.sample();this.active=true;this.loop=(async()=>{while(this.active){await new Promise(r=>setTimeout(r,100));if(this.active)await this.sample();}})();}
 async stop(){this.active=false;await this.loop;await this.sample();return this.result();}
 result(){const first=this.samples[0],last=this.samples.at(-1);const initial=new Map(first.processes.map(p=>[p.pid,p]));const final=new Map(last.processes.map(p=>[p.pid,p]));const perProcess=[];for(const [pid,p] of final){const b=initial.get(pid);if(!b){this.issues.push({kind:'new-process-during-window',pid});continue;}if(p.startTicks!==b.startTicks)continue;perProcess.push({pid,startTicks:p.startTicks,userMs:(p.userTicks-b.userTicks)*1000/this.hz,systemMs:(p.systemTicks-b.systemTicks)*1000/this.hz});}
 const wallMs=last.monotonicMs-first.monotonicMs,userMs=perProcess.reduce((s,p)=>s+p.userMs,0),systemMs=perProcess.reduce((s,p)=>s+p.systemMs,0);return {valid:this.issues.length===0,issues:this.issues,ticksPerSecond:this.hz,wallMs,userMs,systemMs,cpuMs:userMs+systemMs,cpuPercent:100*(userMs+systemMs)/wallMs,perProcess,samples:this.samples};}
}

// This gate does not repair or include any CPU interval. It only waits before
// a fresh authoritative sampler starts; every failed probe remains recorded.
export class OwnershipStabilityGate {
 constructor({minimumMs=60000,stableMs=30000,maximumMs=120000}={}){Object.assign(this,{minimumMs,stableMs,maximumMs});this.started=null;this.since=null;this.signature=null;}
 observe(snapshot,issues=[]){const now=snapshot.monotonicMs;if(this.started===null)this.started=now;const signature=issues.length?null:snapshot.processes.map(p=>`${p.pid}:${p.startTicks}`).sort().join(',');if(signature===null||signature!==this.signature){this.signature=signature;this.since=signature===null?null:now;}const elapsed=now-this.started,stableFor=this.since===null?0:now-this.since;return {ready:signature!==null&&elapsed>=this.minimumMs&&stableFor>=this.stableMs,timedOut:elapsed>=this.maximumMs,elapsed,stableFor};}
}
