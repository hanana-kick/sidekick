// Explore rigid translations/rotations at unchanged uniform size. No geometry edits.
import fs from 'node:fs';
import { createDesign,createAccessory,MATERIAL_SHAPE_NAMES } from '../../src/core/design.ts';
import { resolveDesign } from '../../src/core/resolved-design.ts';
import { resolveShapeProfile } from '../../src/core/shape-profiles.ts';
import { shapeContour } from '../../src/core/contours.ts';
import { sampleAccessorySurface } from '../../src/core/surface.ts';
import { bodyGeometry } from '../../src/renderer/body-geometry.ts';
import { beretGeometry } from '../../src/renderer/beret-geometry.ts';
const result=[];
for(const shape of MATERIAL_SHAPE_NAMES.filter(name=>!process.env.SHAPES||process.env.SHAPES.split(',').includes(name))){
 const d=resolveDesign(createDesign({body:{shape},accessories:[createAccessory('crown')]})),crown=d.accessories[0],profile=resolveShapeProfile(shape),contour=shapeContour({kind:'material',name:shape}),base=profile.accessories.crown;
 const surface=bodyGeometry(contour),points=[];for(let i=0;i<surface.vertices.length;i+=6)points.push([surface.vertices[i]*.59,surface.vertices[i+1]*.59,surface.vertices[i+2]*profile.depth*.5]);
 function evaluate(dx,dt){const mount={...base,anchor:{...base.anchor,uv:[base.anchor.uv[0]+dx,base.anchor.uv[1]]},rotation:[0,base.rotation[1]+dt,0]},p={...profile,accessories:{...profile.accessories,crown:mount}},mesh=beretGeometry(d.body,crown,1,contour,p),frame=sampleAccessorySurface(d.body,crown,1,contour,p),s=mount.scale;
 let depth=0,top=null;for(const v of points){const q=v.map((n,k)=>n-frame.position[k]),x=q.reduce((sum,n,k)=>sum+n*frame.tangent[k],0),z=q.reduce((sum,n,k)=>sum+n*frame.bitangent[k],0);if((x/(.231*s))**2+(z/(.172*s))**2>1)continue;const h=q.reduce((sum,n,k)=>sum+n*frame.normal[k],0)-(mesh.seating-.030)*s-.001;if(h>depth){depth=h;top=v;}}
 return {dx,tilt:mount.rotation[1]*180/Math.PI,scale:s,depth,depthRatio:depth/s,seat:mesh.seating,top,score:Math.min(depth/s,.18)-Math.abs(dx)*.025-Math.abs(dt)*.006};}
 const initial=evaluate(0,0);let best=initial;
 if(process.env.SEARCH !== '0') for(let xi=-3;xi<=3;xi++)for(let ti=-4;ti<=4;ti++){const candidate=evaluate(xi*.06,ti*5*Math.PI/180);if(candidate.score>best.score)best=candidate;}
 result.push({shape,initial,best,gain:best.depth-initial.depth});console.log(shape,initial.depth.toFixed(4),'→',best.depth.toFixed(4),'dx',best.dx,'tilt',best.tilt.toFixed(1));
}
fs.writeFileSync(process.env.OUT??'/workspace/shared/crown-fit-qa/deeper-fit-search.json',JSON.stringify(result,null,2));
