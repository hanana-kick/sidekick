import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {childOutcome} from './lifecycle.mjs';
import {fixedPlan,cycleVerdict,executeFixedCycles} from './plan.mjs';
const config=fixedPlan({plan:process.env.BENCH_PLAN,backend:process.env.BENCH_BACKEND,size:process.env.BENCH_SIZE});
const dir=`artifacts/ci-cpu/${config.plan}/${config.backend}-${config.size}`;await mkdir(dir,{recursive:true});
const save=summary=>writeFile(`${dir}/result.json`,JSON.stringify(summary,null,2));
const summary=await executeFixedCycles(config,async cycle=>{
 const exit=await childOutcome(spawn,[process.execPath,['scripts/ci-cpu/run.mjs']],{stdio:'inherit',env:{...process.env,BENCH_CYCLE:String(cycle)}});
 let result;try{result=JSON.parse(await readFile(`${dir}/cycle-${cycle}/result.json`,'utf8'));}catch(error){result={errors:[{stage:'missing-artifact',message:error.message}],windows:[]};}
 return {...cycleVerdict(result,exit),exit,errors:result.errors,cleanupErrors:result.cleanupErrors??[],windows:result.windows.length};
},save);
if(!summary.complete)process.exitCode=1;
