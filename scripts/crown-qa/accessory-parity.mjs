import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { recordGL } from './recorder.mjs';
const baseline=path.resolve(process.env.BASELINE),source=path.resolve(process.env.SOURCE??'.');
const load=async root=>({...(await import(pathToFileURL(root+'/src/core/design.ts'))),...(await import(pathToFileURL(root+'/src/core/motion.ts'))),...(await import(pathToFileURL(root+'/src/renderer/webgl.ts')))});
const [a,b]=await Promise.all([load(baseline),load(source)]);
// Baselines may predate the breaking API rename; this is a historical comparison input, not a runtime alias.
const records=[a,b].map((lib,index)=>{const capture=recordGL();return{lib,legacyInput:fs.existsSync([baseline,source][index]+'/src/core/camera.ts'),capture,renderer:new lib.AvatarRenderer({width:384,height:384,getContext:()=>capture.gl})};});
let cases=0;
for(const shape of a.MATERIAL_SHAPE_NAMES)for(const preset of a.ACCESSORY_PRESETS.filter(p=>p!=='crown'))for(const activity of ['idle','celebrating']){
 for(const {lib,legacyInput,capture,renderer} of records){capture.draws.length=0;const accessory=lib.createAccessory(preset, preset==='earring'||preset==='starEarring'?{slot:'leftEar'}:undefined);const design=lib.createDesign({body:{shape},accessories:[accessory]});renderer.render(design,{pose:lib.initialPose(),eyeMotion:{left:false,right:false},activity,time:2,delta:0,reduced:false,style:'flat',...(legacyInput?{camera:{yaw:35,pitch:-25,roll:0}}:{bodyOrientation:{yaw:35,pitch:-25,roll:0}})});}
 const [left,right]=records.map(r=>r.capture.draws);assert.equal(left.length,right.length,shape+'/'+preset);
 for(let i=0;i<left.length;i++){assert.deepEqual(left[i].vertices,right[i].vertices,shape+'/'+preset+' vertex bytes');assert.deepEqual(left[i].indices,right[i].indices,shape+'/'+preset+' index bytes');assert.deepEqual(left[i].uniforms,right[i].uniforms,shape+'/'+preset+' shader uniforms');}cases++;
}
for(const r of records)r.renderer.dispose();
const result={baseline,source,cases,shapes:35,presets:11,activities:2,result:'All non-crown production geometry, indices and uniforms byte-identical.'};if(process.env.OUT)fs.writeFileSync(process.env.OUT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
