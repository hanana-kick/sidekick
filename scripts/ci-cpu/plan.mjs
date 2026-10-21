import {cycleWorkloadIssues} from './workload.mjs';
export function fixedPlan({plan,backend,size}){
 if(!['pilot','full'].includes(plan)||!['main','worker'].includes(backend)||![115,640].includes(Number(size)))throw Error('Unapproved plan/backend/size');
 if(plan==='pilot'&&Number(size)!==640)throw Error('Pilot uses640 only');
 return {plan,backend,size:Number(size),graphics:'canvas',cycles:plan==='pilot'?1:3,sequence:['baseline','candidate','candidate','baseline'],warmupMs:10000,windowMs:30000};
}
export function cycleVerdict(result,exit){
 const windows=result.windows??[];
 const workloadIssues=cycleWorkloadIssues(windows);
 const fatal=(windows.length===4&&workloadIssues.length>0)||(result.errors??[]).some(e=>!(['ownership-warmup','idle-counters'].includes(e.stage)||e.code==='CPU_CONTINUITY'));
 const valid=workloadIssues.length===0&&exit.code===0&&!exit.spawnError&&(result.errors??[]).length===0&&(result.cleanupErrors??[]).length===0&&windows.length===4&&windows.every((w,i)=>w.cpu?.valid&&w.frames>0&&w.variant===['baseline','candidate','candidate','baseline'][i]);
 return {valid,fatal,workloadIssues,reason:valid?'complete':fatal?'invariant-or-setup-failure':'incomplete-counter-cycle'};
}
export async function executeFixedCycles(config,run,save){
 const summary={configuration:config,requiredValidCycles:config.cycles,attempted:[],complete:false,noReplacementCycles:true};
 for(let cycle=0;cycle<config.cycles;cycle++){
  const outcome=await run(cycle);summary.attempted.push({cycle,...outcome});await save(summary);
  if(outcome.fatal){summary.stoppedForInvariantFailure=true;break;}
 }
 summary.validCycles=summary.attempted.filter(x=>x.valid).length;
 summary.invalidCycles=summary.attempted.filter(x=>!x.valid).length;
 summary.unattemptedCycles=config.cycles-summary.attempted.length;
 summary.complete=summary.validCycles===config.cycles;await save(summary);return summary;
}
