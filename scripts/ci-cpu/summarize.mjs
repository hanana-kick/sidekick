import {cycleVerdict} from './plan.mjs';
import {readFile,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
const dir=resolve(process.argv[2]??'');if(!process.argv[2])throw Error('Supply one case artifact directory');
const summary=JSON.parse(await readFile(dir+'/result.json','utf8'));
const report={configuration:summary.configuration,complete:summary.complete,validCycles:summary.validCycles,invalidCycles:summary.invalidCycles,unattemptedCycles:summary.unattemptedCycles,efficacyEligible:summary.configuration.plan==='full'&&summary.complete,gpuMeasured:false,cycles:[],limitations:['Owned-process polling rejects observed churn, but cannot prove absence of a task born and reaped entirely between polls.','CPU boundary spans frame snapshots; CPU/draw alignment is approximate.','rendererWallMs is elapsed renderer time, not CPU time.','No hardware GPU utilization or continuous size threshold is measured.']};
const percentile=(xs,p)=>{const a=[...xs].sort((a,b)=>a-b);return a[Math.max(0,Math.ceil(a.length*p)-1)]??null;};
for(const attempt of summary.attempted){
 if(!attempt.valid){report.cycles.push({cycle:attempt.cycle,valid:false,errors:attempt.errors,workloadIssues:attempt.workloadIssues});continue;}
 const r=JSON.parse(await readFile(`${dir}/cycle-${attempt.cycle}/result.json`,'utf8'));
 const rechecked=cycleVerdict(r,attempt.exit??{code:0});if(!rechecked.valid){report.complete=false;report.cycles.push({cycle:attempt.cycle,valid:false,reason:'raw-result-revalidation-failed',workloadIssues:rechecked.workloadIssues});continue;}
 const record={cycle:attempt.cycle,valid:true,variants:{}};
 for(const variant of ['baseline','candidate']){
  const w=r.windows.filter(x=>x.variant===variant),sum=fn=>w.reduce((a,x)=>a+fn(x),0),cpuMs=sum(x=>x.cpu.cpuMs),frames=sum(x=>x.frames),wallMs=sum(x=>x.cpu.wallMs),gaps=w.flatMap(x=>x.after.gaps);
  record.variants[variant]={cpuMs,frames,wallMs,cpuMsPerDraw:cpuMs/frames,cpuPercent:100*cpuMs/wallMs,drawsPerSecond:1000*frames/wallMs,rendererWallMs:sum(x=>x.rendererWallMs),frameGapP95Ms:percentile(gaps,.95),frameGapP99Ms:percentile(gaps,.99),backing:w[0].before.backing,fixture:w[0].before.fixture};
 }
 record.pairedDrawRateMismatchPercent=100*(record.variants.candidate.drawsPerSecond/record.variants.baseline.drawsPerSecond-1);
 record.savingPercent=100*(1-record.variants.candidate.cpuMsPerDraw/record.variants.baseline.cpuMsPerDraw);report.cycles.push(record);
}
report.efficacyEligible=report.configuration.plan==='full'&&report.complete&&report.cycles.length===3&&report.cycles.every(x=>x.valid);
if(report.efficacyEligible){const values=report.cycles.map(x=>x.savingPercent),mean=values.reduce((a,b)=>a+b,0)/values.length;report.pairedSavings={meanPercent:mean,minPercent:Math.min(...values),maxPercent:Math.max(...values),sampleSdPercent:Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/(values.length-1))};}
await writeFile(dir+'/analysis.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
