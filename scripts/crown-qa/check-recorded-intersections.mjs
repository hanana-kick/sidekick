import fs from 'node:fs';
import {triangles,intersections} from '../../tests/helpers/geometry/intersections.mjs';
const file=process.argv[2];
if(!file)throw new Error('Usage: node scripts/crown-qa/check-recorded-intersections.mjs /absolute/shape-quarter-geometry.json');
const g=JSON.parse(fs.readFileSync(file));
function transformed(d,indices=d.indices){const m=d.uniforms.model.values,v=d.vertices,out=new Float64Array(v.length);for(let i=0;i<v.length;i+=6)for(let k=0;k<3;k++)out[i+k]=m[k]*v[i]+m[k+4]*v[i+1]+m[k+8]*v[i+2]+m[k+12];return {vertices:out,indices};}
const body=transformed(g.draws[0]),crown=transformed(g.draws[1],[...g.draws[1].indices,...g.draws[2].indices]);
const result=intersections(triangles(crown),triangles(body),{maxSamples:100});
const output={shape:g.shape,view:g.view,camera:g.camera,bodyVertexCount:body.vertices.length/6,bodyTriangleCount:body.indices.length/3,crownVertexCount:crown.vertices.length/6,crownTriangleCount:crown.indices.length/3,method:'Recorded production vertex/index buffers transformed by each exact recorded model matrix before independent triangle intersection test. No reconstructed fixture geometry or fitted mount defaults used.',...result};
fs.writeFileSync(file.replace('-geometry.json','-recorded-intersections.json'),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));
