import test from 'node:test';
import assert from 'node:assert/strict';
import { shapes, parseShape, MAX_SHAPE_DEPTH, MAX_SHAPE_NODES, MATERIAL_SHAPE_NAMES, MATERIAL_SHAPE_LABELS } from '../dist/src/core/shapes.js';
import { createDesign } from '../dist/src/core/design.js';
import { bodyPoint, bodyNormal, sampleSurface, BODY_SIZE, contourSurfacePoint, deformBodyPoint } from '../dist/src/core/surface.js';
import { shapeContour, contourSignedDistance, contourBoundaryPoints, CONTOUR_MAPPING_TOLERANCE } from '../dist/src/core/contours.js';
import { buildMorph } from '../dist/src/core/morph.js';
import { resolveShapeProfile } from '../dist/src/core/shape-profiles.js';
import { cross, dot, normalize } from '../dist/src/core/math.js';
import { MATERIAL_SHAPE_CUBICS, MATERIAL_CONTOUR_TOLERANCE, materialOutline, materialPlanarPoint } from '../dist/src/core/material-shapes.js';
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, a + ' != ' + b);
const vectorNear = (a, b, tolerance) => a.forEach((v, i) => near(v, b[i], tolerance));
const bodyFor = shape => createDesign({ body: { shape } }).body;
const segmentDistance = (p, a, b) => { const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy); };
const boundaryDistance = (p, outline) => Math.min(...outline.map((a,i)=>segmentDistance(p,a,outline[(i+1)%outline.length])));

// Legacy recipes are private migration/geometry helpers, not the public body API.
test('shape builders create explicit, serializable and isolated recipes', () => {
  assert.deepEqual(shapes.ellipse(), { kind: 'ellipse' });
  assert.deepEqual(shapes.roundedPolygon(5), { kind: 'rounded-polygon', sides: 5, rounding: 0.25, rotation: Math.PI / 2 });
  assert.deepEqual(shapes.preset('orb'), { kind: 'preset', name: 'orb' });
  const input = shapes.roundedPolygon(5, { rounding: 0.3, rotation: 0 });
  const output = shapes.morph(input, 'droplet', 0.6);
  input.sides = 8;
  assert.equal(output.from.sides, 5);
  assert.deepEqual(parseShape(JSON.parse(JSON.stringify(output))), output);
  const copy = parseShape(output); copy.from.rounding = 1;
  assert.equal(output.from.rounding, 0.3);
});

test('shape parser and builders reject unsupported structure and invalid numbers', () => {
  const polygon = shapes.roundedPolygon(4);
  const invalid = [undefined, null, 1, [], 'triangle', { kind: 'path', d: 'M0 0' }, { kind: 'ellipse', extra: 1 },
    { kind: 'preset', name: 'triangle' }, { ...polygon, sides: 2 }, { ...polygon, sides: 13 }, { ...polygon, sides: 3.5 },
    { ...polygon, rounding: -0.01 }, { ...polygon, rounding: 1.01 }, { ...polygon, rounding: NaN },
    { ...polygon, rotation: Infinity }, { ...polygon, rotation: Math.PI + 0.01 },
    { kind: 'rounded-polygon', sides: 4 }, { kind: 'morph', from: 'orb', to: 'orb', progress: -0.1 },
    { kind: 'morph', from: 'orb', to: 'orb', progress: 1.1 }, { kind: 'morph', from: 'orb', to: 'orb', progress: NaN },
    Object.assign(Object.create({ inherited: true }), { kind: 'ellipse' }),
    JSON.parse('{"kind":"ellipse","__proto__":{"polluted":true}}'),
  ];
  for (const input of invalid) assert.throws(() => parseShape(input));
  assert.throws(() => shapes.preset({ kind: 'ellipse' }));
  assert.throws(() => shapes.preset('triangle'));
  assert.throws(() => shapes.roundedPolygon(4, { rounding: null }));
  assert.throws(() => shapes.roundedPolygon(4, { rotation: null }));
  assert.throws(() => shapes.roundedPolygon(4, { radius: 0.2 }));
  assert.throws(() => shapes.roundedPolygon(4, null));
  assert.throws(() => parseShape({ kind: 'ellipse', [Symbol('hidden')]: 1 }));
  assert.equal({}.polluted, undefined);
});

test('composition is bounded and cyclic graphs cannot recurse indefinitely', () => {
  let deep = shapes.ellipse();
  for (let i = 0; i < MAX_SHAPE_DEPTH; i++) deep = shapes.morph(deep, 'orb', 0.5);
  assert.deepEqual(parseShape(deep), deep);
  assert.throws(() => shapes.morph(deep, 'orb', 0.5), RangeError);
  const cycle = { kind: 'morph', from: 'orb', to: 'orb', progress: 0.5 }; cycle.from = cycle;
  assert.throws(() => parseShape(cycle), RangeError);
  const balanced = depth => depth ? { kind: 'morph', from: balanced(depth - 1), to: balanced(depth - 1), progress: 0.5 } : shapes.ellipse();
  assert.ok(MAX_SHAPE_NODES >= 2 ** (MAX_SHAPE_DEPTH + 1) - 1);
  assert.deepEqual(parseShape(balanced(MAX_SHAPE_DEPTH)), balanced(MAX_SHAPE_DEPTH));
  assert.throws(() => parseShape(balanced(MAX_SHAPE_DEPTH + 1)), RangeError);
});


test('all 35 official names have distinct catalog descriptors and labels', () => {
  assert.deepEqual([...MATERIAL_SHAPE_NAMES], ['circle', 'square', 'slanted', 'arch', 'fan', 'arrow', 'semiCircle', 'oval', 'pill', 'triangle', 'diamond', 'clamShell', 'pentagon', 'gem', 'verySunny', 'sunny', 'cookie4Sided', 'cookie6Sided', 'cookie7Sided', 'cookie9Sided', 'cookie12Sided', 'ghostish', 'clover4Leaf', 'clover8Leaf', 'burst', 'softBurst', 'boom', 'softBoom', 'flower', 'puffy', 'puffyDiamond', 'pixelCircle', 'pixelTriangle', 'bun', 'heart']);
  assert.equal(new Set(MATERIAL_SHAPE_NAMES).size,35);
  for(const name of MATERIAL_SHAPE_NAMES){assert.deepEqual(shapes.material(name),{kind:'material',name});assert.equal(typeof MATERIAL_SHAPE_LABELS[name],'string');assert.equal(bodyFor(name).shape,name);}
  assert.throws(()=>shapes.material('unknown'));
});

test('official cubic contours retain normalization, aspect, and bounded tessellation error', () => {
  const signatures = new Set();
  for (const name of MATERIAL_SHAPE_NAMES) {
    const outline = materialOutline(name);
    assert.ok(outline.length >= 3, name);
    assert.ok(outline.flat().every(n => Number.isFinite(n) && Math.abs(n) <= 1.000001), name);
    for (const c of MATERIAL_SHAPE_CUBICS[name]) for (const t of [0, 0.17, 0.5, 0.83, 1]) {
      const u = 1 - t;
      const p = [2 * (u ** 3 * c[0] + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t ** 3 * c[6]) - 1,
        1 - 2 * (u ** 3 * c[1] + 3 * u * u * t * c[3] + 3 * u * t * t * c[5] + t ** 3 * c[7])];
      assert.ok(boundaryDistance(p, outline) <= MATERIAL_CONTOUR_TOLERANCE * 1.02, `${name}: outline differs from official cubic`);
    }
    const signature = Array.from({ length: 96 }, (_, i) => materialPlanarPoint(name, Math.cos(i / 96 * Math.PI * 2), Math.sin(i / 96 * Math.PI * 2)).map(n => n.toFixed(4))).flat().join(',');
    assert.ok(!signatures.has(signature), `${name}: duplicate silhouette`); signatures.add(signature);
  }
  // Official normalization scales both axes together rather than stretching to a square.
  const semi = materialOutline('semiCircle');
  near(Math.max(...semi.map(p => p[0])) - Math.min(...semi.map(p => p[0])), 2, 1e-5);
  near(Math.max(...semi.map(p => p[1])) - Math.min(...semi.map(p => p[1])), 1.25, 1e-5);
});


test('catalog retains concave stars, scallops, notches and sharp pixel profiles',()=>{
  for(const name of ['verySunny','cookie4Sided','clover4Leaf','clover8Leaf','burst','softBurst','boom','softBoom','flower','puffy','puffyDiamond','pixelCircle','pixelTriangle','bun','heart']){
    const points=materialOutline(name);
    assert.ok(points.some((b,i)=>{const a=points[(i+points.length-1)%points.length],c=points[(i+1)%points.length];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]) < -1e-8;}),name);
  }
  const boom=materialOutline('boom').map(p=>Math.hypot(...p));assert.ok(Math.min(...boom)<.45&&Math.max(...boom)>.95);
  const pixel=materialOutline('pixelCircle');assert.ok(pixel.filter((p,i)=>{const q=pixel[(i+1)%pixel.length];return Math.abs(p[0]-q[0])<1e-5||Math.abs(p[1]-q[1])<1e-5;}).length>=pixel.length-2);
  assert.ok(bodyPoint(bodyFor('heart'),[0,1,0])[1]<.6*BODY_SIZE[1]/2);
});

test('runtime simplification remains below its geometric error budget and preserves origin',()=>{
  for(const name of MATERIAL_SHAPE_NAMES){const contour=shapeContour(shapes.material(name)),outline=contourBoundaryPoints(contour);assert.ok(contourSignedDistance(contour,0,0)>.4);for(const p of contour.points)assert.ok(boundaryDistance(p,outline)<=CONTOUR_MAPPING_TOLERANCE*1.001,name);}
});

test('catalog surface rays and attachments share the continuously rounded solid',()=>{
  for(const name of MATERIAL_SHAPE_NAMES){
    const body=bodyFor(name),contour=shapeContour(shapes.material(name));
    for(const d of [[1,0,0],[0,1,0],[0,0,1],normalize([.2,.3,.9]),normalize([-.4,.2,.7]),normalize([.5,-.4,.8])]){
      const p=bodyPoint(body,d),n=bodyNormal(body,d);assert.ok([...p,...n].every(Number.isFinite),name);near(Math.hypot(...n),1);
      const size=[BODY_SIZE[0],BODY_SIZE[1],resolveShapeProfile(name).depth];
      const canonical=p.map((v,i)=>v/(size[i]/2));
      assert.ok(Math.abs(canonical[2])<=1+1e-10);
      const distance=contourSignedDistance(contour,canonical[0],canonical[1]);assert.ok(distance>=-1e-9);
      vectorNear(p,deformBodyPoint(body,contourSurfacePoint(contour,canonical[0],canonical[1],canonical[2]>=0)),1e-7);
      if(Math.abs(canonical[2])<1e-12){near(distance,0,1e-9);near(n[2],0);}
      else assert.ok(n[2]*canonical[2]>0);
    }
    for(const region of ['face','crown','left','right']){
      const a=sampleSurface(body,{region,uv:[.2,-.15],offset:0}),b=sampleSurface(body,{region,uv:[.2,-.15],offset:.03});
      vectorNear(b.position,a.position.map((v,i)=>v+a.normal[i]*.03));near(dot(a.tangent,a.normal),0);near(dot(a.bitangent,a.normal),0);near(dot(cross(a.tangent,a.bitangent),a.normal),1);
    }
  }
});

test('catalog morph endpoints and idle geometry agree exactly in all three dimensions',()=>{
  const body=bodyFor('heart');
  for(const name of MATERIAL_SHAPE_NAMES){const from=shapeContour(shapes.material(name)),to=shapeContour(shapes.material('heart')),plan=buildMorph(from,to);for(const direction of [[1,0,0],[0,0,1],normalize([1,-1,1])]){assert.deepEqual(bodyPoint(body,direction,1,plan.sample(0),resolveShapeProfile(name)),bodyPoint(bodyFor(name),direction));assert.deepEqual(bodyPoint(body,direction,1,plan.sample(1),resolveShapeProfile('heart')),bodyPoint(body,direction));}}
});

test('accelerated signed distances match brute force, including pixel-edge and vertex signs',()=>{
  let seed=31;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const brute=(points,x,y)=>{
    let contained=false,minimum=Infinity;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[j],b=points[i];minimum=Math.min(minimum,segmentDistance([x,y],a,b));
      if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])contained=!contained;
    }
    return minimum*(contained?1:-1);
  };
  for(let i=0;i<MATERIAL_SHAPE_NAMES.length;i++){
    const contour=i%2?buildMorph(shapes.material(MATERIAL_SHAPE_NAMES[i]),shapes.material(MATERIAL_SHAPE_NAMES[(i+17)%35])).sample(.37):shapeContour(shapes.material(MATERIAL_SHAPE_NAMES[i]));
    const points=contourBoundaryPoints(contour);
    for(let j=0;j<150;j++){const x=random()*3-1.5,y=random()*3-1.5;near(contourSignedDistance(contour,x,y),brute(points,x,y),1e-12);}
  }
  for(const name of ['pixelCircle','pixelTriangle']){
    const contour=shapeContour(shapes.material(name)),points=contourBoundaryPoints(contour);
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],middle=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      near(contourSignedDistance(contour,...a),0,1e-12);near(contourSignedDistance(contour,...middle),0,1e-12);
      const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),normal=[-dy/length,dx/length];
      for(const side of [-1,1]){const x=middle[0]+normal[0]*side*1e-8,y=middle[1]+normal[1]*side*1e-8;near(contourSignedDistance(contour,x,y),brute(points,x,y),1e-12);}
    }
  }
});

test('exact crown axes and nearby pixel-notch attachment frames stay finite',()=>{
  for(const name of MATERIAL_SHAPE_NAMES)for(const region of ['face','crown','left','right'])for(const uv of [[0,0],[.001,-.001],[.84,.84]]){
    const frame=sampleSurface(bodyFor(name),{region,uv,offset:.02});
    assert.ok([...frame.position,...frame.normal,...frame.tangent,...frame.bitangent].every(Number.isFinite),name+'/'+region);
    near(Math.hypot(...frame.normal),1);near(Math.hypot(...frame.tangent),1);near(Math.hypot(...frame.bitangent),1);
  }
});
