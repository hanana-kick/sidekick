import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile,cp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {adaptBridge,adaptWorker,rendererModule} from './adapters.mjs';
const manifest=JSON.parse(await readFile('scripts/ci-cpu/manifest.json','utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const [path,hash] of Object.entries({...manifest.baselineFiles,...manifest.buildInputs}))if(sha(await readFile(path))!==hash)throw Error('Baseline source mismatch: '+path);
await rm('.ci-runtime',{recursive:true,force:true});
for(const variant of ['baseline','candidate']){await mkdir('.ci-runtime/'+variant,{recursive:true});await cp('src',`.ci-runtime/${variant}/src`,{recursive:true});await cp('tsconfig.json',`.ci-runtime/${variant}/tsconfig.json`);}
const patch=await readFile('scripts/ci-cpu/candidate.patch');if(sha(patch)!==manifest.patchSha256)throw Error('Patch digest mismatch');
execFileSync('git',['apply','--directory=.ci-runtime/candidate','scripts/ci-cpu/candidate.patch']);
for(const [path,hash] of Object.entries(manifest.candidateFiles))if(sha(await readFile('.ci-runtime/candidate/'+path))!==hash)throw Error('Candidate mismatch: '+path);
const adapterProvenance={};
for(const variant of ['baseline','candidate']){
 const dir=`.ci-runtime/${variant}/src/runtime`;
 for(const [name,adapt] of [['render-bridge',adaptBridge],['render-worker',adaptWorker]]){
  const original=await readFile(`${dir}/${name}.ts`,'utf8'),adapted=adapt(original);
  await writeFile(`${dir}/fixture-${name}.ts`,adapted);
  adapterProvenance[`${variant}/${name}`]={sourceSha256:sha(original),fixtureSha256:sha(adapted)};
 }
 await writeFile(`${dir}/fixture-renderer.ts`,rendererModule(variant));
}
await mkdir('artifacts/ci-cpu/site',{recursive:true});
await build({entryPoints:{main:'scripts/ci-cpu/page.mjs','candidate-worker':'.ci-runtime/candidate/src/runtime/fixture-render-worker.ts','baseline-worker':'.ci-runtime/baseline/src/runtime/fixture-render-worker.ts'},bundle:true,format:'esm',outdir:'artifacts/ci-cpu/site',target:'es2022'});
await writeFile('artifacts/ci-cpu/adapter-provenance.json',JSON.stringify(adapterProvenance,null,2));
await writeFile('artifacts/ci-cpu/site/index.html','<!doctype html><meta charset="utf-8"><title>Full canvas owned CPU experiment</title><style>body{margin:0;background:#ddd}canvas{display:block}</style><script type="module" src="./main.js"></script>');
