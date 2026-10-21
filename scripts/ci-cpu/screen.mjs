import {childOutcome} from './lifecycle.mjs';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const order=process.env.BENCH_ORDER,backend=process.env.BENCH_BACKEND;
if(!['forward','reverse'].includes(order)||!['main','worker'].includes(backend)||process.env.BENCH_GRAPHICS!=='canvas')throw Error('Screening is restricted to the approved Canvas matrix');
const sizes=order==='forward'?[320,480,640,1024]:[1024,640,480,320];
const dir=`artifacts/ci-cpu/screening-${order}/${backend}-canvas`;await mkdir(dir,{recursive:true});
const summary={purpose:'Exploratory boundary screening, NOT deployment eligibility',order,backend,sizes,freshBrowserPerSize:true,retries:0,results:[]};
for(const size of sizes){const code=await childOutcome(spawn,[process.execPath,['scripts/ci-cpu/run.mjs']],{stdio:'inherit',env:{...process.env,BENCH_PLAN:'screening',BENCH_SIZE:String(size)}});let result;try{result=JSON.parse(await readFile(`${dir}/${size}/result.json`,'utf8'));}catch(error){result={errors:[{message:error.message}],windows:[]};}const valid=code.code===0&&result.errors.length===0&&result.windows.length===4&&result.windows.every(w=>w.cpu.valid);summary.results.push({size,...code,valid,errors:result.errors,cleanupErrors:result.cleanupErrors??[],windows:result.windows.length});await writeFile(`${dir}/result.json`,JSON.stringify(summary,null,2));if(!valid)process.exitCode=1;}
