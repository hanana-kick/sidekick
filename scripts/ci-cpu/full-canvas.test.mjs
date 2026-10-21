import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {adaptBridge,adaptWorker,rendererModule} from './adapters.mjs';
import {fixedPlan,cycleVerdict,executeFixedCycles} from './plan.mjs';
const read=p=>readFile(p,'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
test('frozen baseline, candidate patch and build inputs match manifest',async()=>{
 const m=JSON.parse(await read('scripts/ci-cpu/manifest.json'));
 assert.equal(m.baselineCommit,'6cbd651f7e3e8db7a7fbbeabbbda4a893e374d4e');assert.equal(m.candidateCommit,'aa42a3d41311ba70087a23d6ae2143cd5359c2e5');
 for(const [p,h]of Object.entries({...m.baselineFiles,...m.buildInputs}))assert.equal(hash(await readFile(p)),h,p);
 assert.equal(hash(await readFile('scripts/ci-cpu/candidate.patch')),m.patchSha256);
 const paths=execFileSync('git',['apply','--numstat','scripts/ci-cpu/candidate.patch'],{encoding:'utf8'}).trim().split('\n').map(x=>x.split('\t')[2]);assert.deepEqual(paths.sort(),[...m.patchPaths].sort());
});
test('mirrored adapters preserve ordinary worker bridge and full canvas transfer',async()=>{
 const source=await read('src/runtime/render-bridge.ts'),adapted=adaptBridge(source);
 assert.equal(adapted.slice(adapted.indexOf('export class WorkerRenderBridge')),source.slice(source.indexOf('export class WorkerRenderBridge')));
 assert.match(adapted,/new FixtureRenderer\(this.canvas, \{renderer:'canvas2d'\}\)/);
 const worker=adaptWorker(await read('src/runtime/render-worker.ts'));
 assert.match(worker,/new FixtureRenderer\(data.canvas, \{renderer:'canvas2d'\}\)/);
 assert.doesNotMatch(worker,/ImageBitmap|transferToImageBitmap|AtomicSurface/);
 assert.match(rendererModule('baseline'),/AvatarRenderer/);assert.match(rendererModule('candidate'),/FullPresentationRenderer/);
 assert.throws(()=>adaptBridge('changed'));assert.throws(()=>adaptWorker('changed'));
});
test('page uses full presentation with no atomic/cropped display path',async()=>{
 const s=await read('scripts/ci-cpu/page.mjs');assert.match(s,/ctx.drawImage\(canvas,0,0\)/);assert.doesNotMatch(s,/AtomicSurface|presentationStats|surface\.x|surface\.y/);
 assert.match(s,/width:canvas.width,height:canvas.height/);
 const run=await read('scripts/ci-cpu/run.mjs');assert.match(run,/chromiumSandbox:true/);assert.doesNotMatch(run,/--no-sandbox/);assert.match(run,/Presentation backing must remain full sized/);
});
test('fixed plans exclude historical sizes and non-Canvas paths',()=>{
 assert.equal(fixedPlan({plan:'full',backend:'main',size:115}).cycles,3);
 assert.equal(fixedPlan({plan:'pilot',backend:'worker',size:640}).cycles,1);
 for(const bad of [{plan:'pilot',backend:'main',size:115},{plan:'full',backend:'main',size:160},{plan:'full',backend:'gpu',size:640}])assert.throws(()=>fixedPlan(bad));
});
const good=()=>({errors:[],cleanupErrors:[],windows:['baseline','candidate','candidate','baseline'].map(variant=>{const point={snapshot:{running:true,graphics:'canvas2d',width:384,height:384,drawCalls:3},fixture:{variant,rendererClass:variant==='candidate'?'FullPresentationRenderer':'AvatarRenderer'},css:{width:'640px',height:'640px'},backend:'main',transferred:false,backing:{width:384,height:384}};return{variant,backend:'main',size:640,dpr:1,cpu:{valid:true,wallMs:30000},frames:900,before:structuredClone(point),after:structuredClone(point)};})});
test('one bad window invalidates the whole cycle; cleanup failure also excludes it',()=>{
 const r=good();assert.equal(cycleVerdict(r,{code:0}).valid,true);r.windows[2].cpu.valid=false;assert.equal(cycleVerdict(r,{code:0}).valid,false);
 assert.equal(cycleVerdict({...good(),cleanupErrors:[{step:'browser'}]},{code:0}).valid,false);
 assert.equal(cycleVerdict({...good(),windows:good().windows.slice(0,3)},{code:0}).valid,false);
});
test('three predeclared cycles run once, invalid cases never replaced',async()=>{
 const calls=[];const result=await executeFixedCycles({cycles:3},async i=>{calls.push(i);return {valid:i!==1,fatal:false};},async()=>{});
 assert.deepEqual(calls,[0,1,2]);assert.equal(result.validCycles,2);assert.equal(result.invalidCycles,1);assert.equal(result.complete,false);
});
test('parity/setup failure stops without automatic retries',async()=>{
 const calls=[];const result=await executeFixedCycles({cycles:3},async i=>{calls.push(i);return {valid:false,fatal:true};},async()=>{});
 assert.deepEqual(calls,[0]);assert.equal(result.unattemptedCycles,2);assert.equal(result.complete,false);
});
test('workflow has fixed Canvas pilot/full matrices, no retries or privilege paths',async()=>{
 const s=await read('.github/workflows/animation-qa.yml');assert.match(s,/backend: \[main, worker\]/);assert.match(s,/\[115,640\]/);assert.match(s,/\|\| '\[640\]'/);assert.match(s,/timeout-minutes: 25/);assert.doesNotMatch(s,/sudo|cgroup|retry|workflow_run|push:/);
});
test('measurement failures are fatal unless explicitly CPU continuity',()=>{
 assert.equal(cycleVerdict({...good(),errors:[{stage:'measurement',message:'wrong renderer'}]},{code:1}).fatal,true);
 assert.equal(cycleVerdict({...good(),errors:[{stage:'measurement',code:'CPU_CONTINUITY'}]},{code:1}).fatal,false);
});

test('900,100,100,900 is invalid despite complete CPU counters',()=>{const r=good();[900,100,100,900].forEach((n,i)=>r.windows[i].frames=n);const v=cycleVerdict(r,{code:0});assert.equal(v.valid,false);assert.ok(v.workloadIssues.some(x=>x.reason==='paired-successful-draw-rate-mismatch'));});
test('within broad cadence but more than2percent paired work difference is invalid',()=>{const r=good();r.windows[1].frames=r.windows[2].frames=875;assert.equal(cycleVerdict(r,{code:0}).valid,false);});
test('small bounded cadence jitter is accepted, paused or changed draw work is not',()=>{const r=good();r.windows[1].frames=899;r.windows[2].frames=901;assert.equal(cycleVerdict(r,{code:0}).valid,true);r.windows[2].after.snapshot.running=false;assert.equal(cycleVerdict(r,{code:0}).valid,false);const x=good();x.windows[2].after.snapshot.drawCalls=2;assert.equal(cycleVerdict(x,{code:0}).valid,false);});

test('timed renderer class and CSS are required, not just a ready-frame claim',()=>{const r=good();r.windows[1].after.fixture.rendererClass='AvatarRenderer';assert.equal(cycleVerdict(r,{code:0}).valid,false);const x=good();x.windows[2].after.css.width='320px';assert.equal(cycleVerdict(x,{code:0}).valid,false);});
test('summary independently rejects falsely marked valid900/100 cycles',async()=>{
 const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const dir=await mkdtemp(join(tmpdir(),'full-canvas-summary-'));
 try{const summary={configuration:{plan:'full'},complete:true,validCycles:3,invalidCycles:0,unattemptedCycles:0,attempted:[]};for(let i=0;i<3;i++){const r=good();[900,100,100,900].forEach((n,j)=>r.windows[j].frames=n);await mkdir(dir+'/cycle-'+i);await writeFile(dir+'/cycle-'+i+'/result.json',JSON.stringify(r));summary.attempted.push({cycle:i,valid:true,exit:{code:0}});}await writeFile(dir+'/result.json',JSON.stringify(summary));execFileSync(process.execPath,['scripts/ci-cpu/summarize.mjs',dir]);const out=JSON.parse(await read(dir+'/analysis.json'));assert.equal(out.efficacyEligible,false);assert.equal(out.complete,false);assert.equal(out.pairedSavings,undefined);}finally{await rm(dir,{recursive:true,force:true});}
});
