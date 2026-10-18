import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=d=>fs.readFileSync(`${d}/views.jsonl`,'utf8').trim().split('\n').map(s=>JSON.parse(s));
const baseline=read(process.argv[2]??'baseline-flicker');
const candidate=read(process.argv[3]??'candidate-flicker');
const oldSoft=read(process.argv[4]??'baseline-softburst-idle');
const newSoft=read(process.argv[5]??'candidate-softburst-idle');
const select=(rows,shape,frame)=>rows.filter(r=>r.shape===shape&&r.frame===frame);
const pairs=[];
for(const b of select(baseline,'cookie6Sided',426)){
 const c=select(candidate,'cookie6Sided',426).find(c=>JSON.stringify(c.camera)===JSON.stringify(b.camera));assert.ok(c,'matching camera required');
 assert.ok(b.garmentXorFraction>.5,'known baseline jump must be detected');
 assert.ok(c.garmentXorFraction<.10,'candidate must not jump at the known frame');
 assert.ok(c.meshMaxVertexStep<.005,'candidate local geometry must stay continuous');
 pairs.push({shape:b.shape,frame:426,camera:b.camera,baselineMaskXor:b.garmentXorFraction,candidateMaskXor:c.garmentXorFraction,candidateMeshStep:c.meshMaxVertexStep});
}
assert.equal(pairs.length,3,'all three Cookie views required');
for(const b of select(oldSoft,'softBurst',88)){
 const c=select(newSoft,'softBurst',88).find(c=>JSON.stringify(c.camera)===JSON.stringify(b.camera));assert.ok(c);
 assert.ok(b.meshMaxVertexStep>.09,'known baseline local cuff jump must be detected');
 assert.ok(c.meshMaxVertexStep<.005,'candidate must remove local cuff jump');
 pairs.push({shape:b.shape,frame:88,camera:b.camera,baselineMeshStep:b.meshMaxVertexStep,candidateMeshStep:c.meshMaxVertexStep});
}
assert.equal(pairs.length,6);
const result={passed:true,scope:'Only the exact Cookie6Sided idle425→426 and SoftBurst idle87→88 animation regressions, not global accessory aesthetic acceptance.',thresholds:{knownCookieBaselineMaskXorMinimum:.5,candidateCookieMaskXorMaximum:.1,knownSoftBurstBaselineVertexStepMinimum:.09,candidateVertexStepMaximum:.005},pairs};
fs.writeFileSync('exact-repro-comparison.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
