// Run after npm run build:all. No rendering or network access is needed.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MATERIAL_SHAPE_NAMES } from '../../dist/src/core/design.js';
import { shapeContour } from '../../dist/src/core/contours.js';
import { resolveShapeProfile } from '../../dist/src/core/shape-profiles.js';
import { ShapeTimeline } from '../../dist/src/core/shape-motion.js';
import { bodyGeometry } from '../../dist/src/renderer/body-geometry.js';
import { beretGeometry } from '../../dist/src/renderer/beret-geometry.js';
import { triangles, intersections, sub, cross, dot } from '../../tests/helpers/geometry/intersections.mjs';
const root = new URL('../../', import.meta.url);
const output = process.argv[2] || 'beret-geometry-audit.json';
const rotations = [[0,0,0], [.1,0,0], [-.1,0,0], [0,.1,0], [0,-.1,0], [0,0,.1], [0,0,-.1]];
// Samples include the previously failing simultaneous-axis turn neighborhoods.
for (const t of [.6,1.65,2.02,3.6,4.822,6]) rotations.push([Math.sin(t*2)*.1,Math.sin(t*1.3)*.1,Math.sin(t*.7)*.1]);
const rows = [];
function check(metadata, contour, profile, rotation = [0,0,0]) {
  const mesh = beretGeometry({shape:metadata.shape}, {preset:'beret',rotation}, 1, contour, profile, rotation);
  const ts = triangles(mesh), self = intersections(ts), body = intersections(ts, triangles(bodyGeometry(contour), [.59,.59,profile.depth*.5]));
  let degenerate = 0, normalOpposed = 0, signedVolume = 0;
  const edges = new Map();
  for (const t of ts) {
    signedVolume += dot(t.p[0], cross(t.p[1],t.p[2])) / 6;
    const normal = cross(sub(t.p[1],t.p[0]),sub(t.p[2],t.p[0]));
    if (Math.hypot(...normal) < 1e-10) degenerate++;
    const shading = [0,1,2].map(k => t.ids.reduce((s,id) => s + mesh.vertices[id*6+3+k],0));
    if (dot(normal,shading) < -1e-10) normalOpposed++;
    for (let i=0;i<3;i++) {
      const a=t.ids[i], b=t.ids[(i+1)%3], key=`${Math.min(a,b)}:${Math.max(a,b)}`, e=edges.get(key)||[0,0];
      e[0]++; e[1]+=a<b?1:-1; edges.set(key,e);
    }
  }
  const badEdges=[...edges.values()].filter(([n,b])=>n!==2||b!==0).length;
  const row={...metadata,rotation,selfCrossings:self.count,bodyCrossings:body.count,degenerate,normalOpposed,badEdges,signedVolume,euler:mesh.vertices.length/6-edges.size+ts.length};
  row.pass = !row.selfCrossings && !row.bodyCrossings && !degenerate && !normalOpposed && !badEdges && signedVolume>0 && row.euler===2;
  if (!row.pass) row.samples={self:self.samples,body:body.samples};
  rows.push(row); console.log(metadata.shape, metadata.kind, row.pass?'PASS':'FAIL');
}
for (const shape of MATERIAL_SHAPE_NAMES) {
  const contour=shapeContour({kind:'material',name:shape}), profile=resolveShapeProfile(shape);
  for (const rotation of rotations) check({kind:'catalog-rotation',shape},contour,profile,rotation);
}
for (const [from,to,next] of [['flower','triangle','square'],['heart','boom','pixelTriangle'],['clover8Leaf','heart','circle']]) {
  const timeline=new ShapeTimeline(from); timeline.to(to,{duration:1000,easing:'linear'}); let target=to;
  for (let frame=0;frame<=120;frame++) {
    if(frame===36) { target=next; timeline.to(next,{duration:1000,easing:'linear'}); }
    if(frame) timeline.advance(1000/60);
    check({kind:'interrupted-morph',shape:target,from,to,next,frame},timeline.contour,timeline.profile);
  }
}
for (const [from,to,next] of [
  ['heart','pixelTriangle'], ['pixelTriangle','flower'], ['flower','boom'],
  ['boom','cookie6Sided'], ['cookie6Sided','softBurst'], ['softBurst','heart'],
  ['heart','pixelTriangle','flower'], ['boom','cookie6Sided','softBurst'],
  ['flower','heart','pixelTriangle'], ['flower','triangle','square'],
  ['heart','boom','pixelTriangle'], ['clover8Leaf','heart','circle'],
]) {
  const timeline=new ShapeTimeline(from); timeline.to(to,{duration:1000,easing:'linear'});
  if (next) { timeline.advance(400); timeline.to(next,{duration:1000,easing:'linear'}); }
  for (let step=0;step<=10;step++) {
    if (step) timeline.advance(100);
    check({kind:'broader-morph',shape:next??to,from,to,next,progress:step/10},timeline.contour,timeline.profile);
  }
}
const sourceFiles=['src/renderer/worn-beret.ts','src/renderer/beret-geometry.ts','src/core/shape-profiles.ts','src/core/shape-motion.ts','src/renderer/body-geometry.ts'];
const provenance=Object.fromEntries(sourceFiles.flatMap(p => [p, 'dist/'+p.replace(/\.ts$/,'.js')]).map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex')]));
fs.writeFileSync(output,JSON.stringify({created:new Date().toISOString(),source:fileURLToPath(root),provenance,method:'Triangle interior and positive-area coplanar intersections, with seam-only contact excluded. No concealed-body-crossing exemptions. Geometry tests do not prove visual quality or continuous-time correctness.',states:rows.length,failures:rows.filter(r=>!r.pass).length,rows},null,2));
if(rows.some(r=>!r.pass))process.exitCode=1;
