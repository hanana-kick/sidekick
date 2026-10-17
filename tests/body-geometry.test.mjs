import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesign, MATERIAL_SHAPE_NAMES } from '../dist/src/core/design.js';
import { bodyGeometry, BODY_VOLUME_MAX_POINTS } from '../dist/src/renderer/body-geometry.js';
import { bodyPoint, bodyNormal, contourSurfacePoint, deformBodyPoint } from '../dist/src/core/surface.js';
import { shapeContour, contourBoundaryPoints, contourSignedDistance } from '../dist/src/core/contours.js';
import { contourVolumeHeight } from '../dist/src/core/body-volume.js';
import { buildMorph } from '../dist/src/core/morph.js';
import { transform, normalize } from '../dist/src/core/math.js';
import { viewPoint } from '../dist/src/renderer/eye-projection.js';
const contour=name=>shapeContour({kind:'material',name});
function checkMesh(contour){const c=contour;const g=bodyGeometry(c),count=g.vertices.length/6,edges=new Map(),weld=new Map(),welded=[];let frontArea=0;
  for(let i=0;i<count;i++){const key=Array.from(g.vertices.slice(i*6,i*6+3)).join(',');if(!weld.has(key))weld.set(key,weld.size);welded.push(weld.get(key));}
  assert.ok(count<65536);assert.ok(count<=BODY_VOLUME_MAX_POINTS*2);assert.ok(g.vertices.every(Number.isFinite));assert.ok(g.indices.every(i=>i<count));
  for(let i=0;i<g.indices.length;i+=3){const ids=Array.from(g.indices.slice(i,i+3)),[a,b,c]=ids.map(j=>Array.from(g.vertices.slice(j*6,j*6+3)));
    const area=((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;
    if(i%6===0){assert.ok(area>0);frontArea+=area;assert.ok(contourSignedDistance(contour,(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3)>=-1e-7);assert.ok([a,b,c].every(p=>p[2]>=0));}
    else{assert.ok(area<0);assert.ok([a,b,c].every(p=>p[2]<=0));}
    for(let k=0;k<3;k++){const a=welded[ids[k]],b=welded[ids[(k+1)%3]],key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)||0)+1);}
  }
  for(const n of edges.values())assert.equal(n,2,'closed manifold mesh');
  const ps=contourBoundaryPoints(c),area=ps.reduce((s,p,i)=>{const q=ps[(i+1)%ps.length];return s+(p[0]*q[1]-p[1]*q[0])/2;},0);
  assert.ok(Math.abs(frontArea-area)<1e-6,'cap area matches contour');
}

test('all catalog volumes are closed, finite, correctly wound and preserve exact silhouette area',()=>{for(const name of MATERIAL_SHAPE_NAMES){checkMesh(contour(name));}});
test('intermediate concave meshes remain closed and cover only their current contour',()=>{for(const[from,to]of[['puffy','pixelTriangle'],['softBoom','heart'],['circle','clover8Leaf']]){const m=buildMorph(contour(from),contour(to));for(const p of[.01,.1,.25,.5,.75,.9,.99]){checkMesh(m.sample(p));}}});
test('static and transition endpoints use identical 3D fields and meshes',()=>{for(const[from,to]of[['puffy','pixelTriangle'],['square','heart'],['boom','circle']]){const a=contour(from),b=contour(to),m=buildMorph(a,b);assert.strictEqual(m.sample(0),a);assert.strictEqual(m.sample(1),b);assert.strictEqual(bodyGeometry(m.sample(0)),bodyGeometry(a));assert.strictEqual(bodyGeometry(m.sample(1)),bodyGeometry(b));for(const[name,c]of[[from,a],[to,b]]){const body=createDesign({body:{shape:name}}).body;for(const d of[[.2,.3,.8],[-.6,.3,.2],[0,1,0]])assert.deepEqual(bodyPoint(body,d),bodyPoint(body,d,1,c));}}});
test('continuous dome depth and attachment positions survive prior triangulation flips',()=>{for(const[from,to,at]of[['pixelTriangle','square',.30333],['softBoom','pixelTriangle',.07333],['puffy','circle',.08333]]){const m=buildMorph(contour(from),contour(to)),a=m.sample(at-1e-5),b=m.sample(at+1e-5);for(const[x,y]of[[0,0],[.2,.3],[-.3,.1]])assert.ok(Math.abs(contourSurfacePoint(a,x,y)[2]-contourSurfacePoint(b,x,y)[2])<.001);const body=createDesign({body:{shape:to}}).body;for(const d of[[0,.7,.7],[.6,.1,.8],[0,1,0]]){const p=bodyPoint(body,d,1,a),q=bodyPoint(body,d,1,b);assert.ok(Math.hypot(...p.map((v,i)=>v-q[i]))<.005);}}});
test('matrix squash matches shared surface deformation and normals',()=>{for(const shape of['square','puffy','verySunny']){const body=createDesign({body:{shape}}).body;for(const squash of[.88,1,1.12]){const stretch=1/Math.sqrt(squash),matrix=transform([0,0,0],[0,0,0],[stretch,squash,stretch]);for(const d of[[.2,.3,.8],[-.5,.6,.2],[.3,-.7,-.2]]){const p=bodyPoint(body,d,squash),q=viewPoint(matrix,bodyPoint(body,d));p.forEach((v,i)=>assert.ok(Math.abs(v-q[i])<1e-7));const n=bodyNormal(body,d),scaled=normalize([n[0]/stretch,n[1]/squash,n[2]/stretch]),direct=bodyNormal(body,d,squash);scaled.forEach((v,i)=>assert.ok(Math.abs(v-direct[i])<1e-5));}const p=[.1,.2,.3],q=deformBodyPoint(body,p,squash),r=viewPoint(matrix,deformBodyPoint(body,p));q.forEach((v,i)=>assert.ok(Math.abs(v-r[i])<1e-7));}}});


test('volume has a continuously changing dome and one exact zero-height equator', () => {
  for (const name of MATERIAL_SHAPE_NAMES) {
    const c = contour(name), g = bodyGeometry(c);
    assert.equal(contourVolumeHeight(c, 0, 0), 1);
    const positive = new Set();
    for (let i = 0; i < g.vertices.length; i += 6) {
      const [x, y, z] = g.vertices.slice(i, i + 3);
      if (z > .001) positive.add(Math.round(z * 100));
      if (z !== 0) assert.ok(Math.abs(Math.abs(z) - contourVolumeHeight(c, x, y)) < 1e-5);
      else assert.ok(Math.abs(contourSignedDistance(c, x, y)) < 1e-6, `${name}: rim left silhouette`);
    }
    assert.ok(positive.size > 30, `${name}: a bevel slab is not a volume`);
  }
});

test('interrupted morphs begin at the exact visible rounded mesh and remain closed', () => {
  for (const [from, to, final] of [['softBoom', 'pixelTriangle', 'boom'], ['puffy', 'heart', 'circle']]) {
    const first = buildMorph(contour(from), contour(to)), visible = first.sample(.413);
    const displayed = bodyGeometry(visible), retarget = buildMorph(visible, contour(final));
    assert.strictEqual(retarget.sample(0), visible);
    assert.strictEqual(bodyGeometry(retarget.sample(0)), displayed);
    for (const amount of [.001, .25, .5, .75, .999]) checkMesh(retarget.sample(amount));
  }
});
