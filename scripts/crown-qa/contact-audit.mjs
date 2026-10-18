/** Sample actual inner-bottom rim distance to the production body triangles.
 * This measures contact, not aesthetics or physical dynamic stability.
 * SOURCE=/frozen/source OUT=/report.json node --import tsx scripts/crown-qa/contact-audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const source=path.resolve(process.env.SOURCE??'.');
const load=name=>import(pathToFileURL(source+'/src/'+name+'.ts'));
const { createDesign,createAccessory,MATERIAL_SHAPE_NAMES }=await load('core/design');
const { resolveDesign }=await load('core/resolved-design');
const { resolveShapeProfile }=await load('core/shape-profiles');
const { shapeContour }=await load('core/contours');
const { bodyGeometry }=await load('renderer/body-geometry');
const { beretGeometry }=await load('renderer/beret-geometry');
const files=['core/crown-profiles','core/shape-profiles','core/surface','renderer/beret-geometry','renderer/body-geometry'];
const hashes=()=>Object.fromEntries(files.map(p=>[p,createHash('sha256').update(fs.readFileSync(source+'/src/'+p+'.ts')).digest('hex')]));
const sourceHashes=hashes();
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],sub=(a,b)=>a.map((v,k)=>v-b[k]),sqr=a=>dot(a,a);
function pointTriangle(p,a,b,c){const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return sqr(ap);const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return sqr(bp);const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return sqr(ap.map((n,k)=>n-v*ab[k]));}const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return sqr(cp);const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return sqr(ap.map((n,k)=>n-w*ac[k]));}const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return sqr(bp.map((n,k)=>n-w*(c[k]-b[k])));}const denom=1/(va+vb+vc),v=vb*denom,w=vc*denom;return sqr(ap.map((n,k)=>n-v*ab[k]-w*ac[k]));}

const result=[];
for(const shape of MATERIAL_SHAPE_NAMES){
 const d=resolveDesign(createDesign({body:{shape},accessories:[createAccessory('crown')]})),profile=resolveShapeProfile(shape),contour=shapeContour({kind:'material',name:shape}),surface=bodyGeometry(contour),body=[];
 for(let i=0;i<surface.vertices.length;i+=6)body.push([surface.vertices[i]*.59,surface.vertices[i+1]*.59,surface.vertices[i+2]*profile.depth*.5]);
 const mesh=beretGeometry(d.body,d.accessories[0],1,contour,profile),gaps=[],samples=[];
 for(let i=0;i<80;i++){
  const p=Array.from(mesh.vertices.slice(i*6,i*6+3));let best=Infinity,nearestTriangle=-1;
  for(let k=0;k<surface.indices.length;k+=3){const distance=pointTriangle(p,...[0,1,2].map(j=>body[surface.indices[k+j]]));if(distance<best){best=distance;nearestTriangle=k/3;}}
  gaps.push(Math.sqrt(best));samples.push({rimVertex:i,position:p,distance:Math.sqrt(best),nearestBodyTriangle:nearestTriangle});
 }
 const ordered=[...gaps].sort((a,b)=>a-b);result.push({shape,mean:gaps.reduce((a,b)=>a+b,0)/80,p90:ordered[71],maximum:ordered[79],minimum:ordered[0],near5mm:samples.filter(s=>s.distance<=.005),near15mm:samples.filter(s=>s.distance<=.015),samples});
 console.log(shape,result.at(-1).mean.toFixed(4),result.at(-1).near5mm.length+' near-rim samples');
}
fs.writeFileSync(process.env.OUT??'/workspace/shared/crown-refit/contact-audit.json',JSON.stringify({source,sourceHashes,method:'80 uniformly indexed inner-bottom rim vertices per shape; exact Euclidean distance to every actual body triangle in neutral pose. World-unit distances; body canonical width is 1.18. Not an aesthetic or stability certificate.',cases:result},null,2));

if(JSON.stringify(sourceHashes)!==JSON.stringify(hashes()))throw Error('Source changed during audit');
