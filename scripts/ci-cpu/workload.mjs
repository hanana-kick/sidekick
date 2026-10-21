// Predeclared real-time gates, not a hardware performance target. The runtime's
// unchanged idle policy is nominally30Hz; RAF quantization previously yields~31.5.
// A30s window permits29–33 successful draws/s, but matched variants must agree
// within2%. This allows bounded scheduling/boundary jitter, not a slower-work win.
export const WORKLOAD_BOUNDS=Object.freeze({minimumDrawsPerSecond:29,maximumDrawsPerSecond:33,maximumPairedRateDifference:.02,minimumWallMs:29000,maximumWallMs:31000});
export function windowWorkloadIssues(w){
 const issues=[],wall=w.cpu?.wallMs,frames=w.frames,rate=1000*frames/wall;
 if(!Number.isFinite(wall)||wall<WORKLOAD_BOUNDS.minimumWallMs||wall>WORKLOAD_BOUNDS.maximumWallMs)issues.push('measurement-wall-out-of-bounds');
 if(!Number.isInteger(frames)||frames<=0||!Number.isFinite(rate)||rate<WORKLOAD_BOUNDS.minimumDrawsPerSecond||rate>WORKLOAD_BOUNDS.maximumDrawsPerSecond)issues.push('successful-draw-cadence-out-of-bounds');
 for(const endpoint of ['before','after']){
  const s=w[endpoint];
  if(!s?.snapshot?.running)issues.push(endpoint+'-runtime-not-running');
  if(s?.snapshot?.graphics!=='canvas2d'||s?.fixture?.variant!==w.variant||s?.fixture?.rendererClass!==(w.variant==='candidate'?'FullPresentationRenderer':'AvatarRenderer')||s?.backend!==w.backend||!['main','worker'].includes(s?.backend)||s?.transferred!==(s?.backend==='worker'))issues.push(endpoint+'-runtime-identity-mismatch');
  if(s?.css?.width!==w.size+'px'||s?.css?.height!==w.size+'px')issues.push(endpoint+'-css-size-mismatch');
  if(!Number.isInteger(s?.backing?.width)||s.backing.width<=0||!Number.isInteger(s?.backing?.height)||s.backing.height<=0||s.backing.width!==s.snapshot.width||s.backing.height!==s.snapshot.height)issues.push(endpoint+'-full-backing-mismatch');
  if(!Number.isInteger(s?.snapshot?.drawCalls)||s.snapshot.drawCalls<=0)issues.push(endpoint+'-missing-draw-work');
 }
 if(w.before?.snapshot?.drawCalls!==w.after?.snapshot?.drawCalls)issues.push('draw-call-work-changed');
 if(w.before?.backend!==w.after?.backend||w.before?.backing?.width!==w.after?.backing?.width||w.before?.backing?.height!==w.after?.backing?.height)issues.push('runtime-path-or-size-changed');
 return issues;
}
export function cycleWorkloadIssues(windows){
 const issues=windows.flatMap((w,i)=>windowWorkloadIssues(w).map(reason=>({position:i,reason})));
 if(windows.length!==4)return [...issues,{reason:'incomplete-ABBA'}];
 const first=windows[0];
 for(const [position,w]of windows.entries())if(w.before?.snapshot?.drawCalls!==first.before?.snapshot?.drawCalls||w.before?.backend!==first.before?.backend||w.before?.backing?.width!==first.before?.backing?.width||w.before?.backing?.height!==first.before?.backing?.height||w.size!==first.size||w.dpr!==first.dpr)issues.push({position,reason:'ABBA-workload-or-path-mismatch'});
 const rates=['baseline','candidate'].map(v=>{const ws=windows.filter(w=>w.variant===v);return 1000*ws.reduce((n,w)=>n+w.frames,0)/ws.reduce((n,w)=>n+w.cpu.wallMs,0);});
 if(!rates.every(Number.isFinite)||Math.abs(rates[1]/rates[0]-1)>WORKLOAD_BOUNDS.maximumPairedRateDifference)issues.push({reason:'paired-successful-draw-rate-mismatch',rates});
 return issues;
}
