import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Execute production GLSL scalar expressions; only translate declaration syntax.
const renderer = readFileSync(new URL('../src/renderer/webgl-shaders.ts', import.meta.url), 'utf8');
const shader = renderer.slice(renderer.indexOf('float curveDistance('), renderer.indexOf('\nvoid main() {', renderer.indexOf('float curveDistance(')));
const translated = shader.replace(/float\s+(\w+)\s*\(/g, 'function $1(').replace(/\b(?:float|vec2|vec4)\s+(\w+)(?=\s*[,\)])/g, '$1').replace(/\b(?:float|int|vec2|vec4)\s+/g, 'let ');
const vec2 = (x, y) => ({ x, y });
const capsuleDistance = (p, size) => {
  const radius = Math.min(size.x, size.y) / 2, qx = Math.abs(p.x) - size.x / 2 + radius, qy = Math.abs(p.y) - size.y / 2 + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
};
const compile = new Function('eyeSize', 'capsuleDistance', 'length', 'vec2', 'min', 'max', 'abs', 'clamp', 'mix', `${translated}\nreturn {curveDistance, eyeDistance};`);
const functions = (width = .16, height = .34) => compile(vec2(width, height), capsuleDistance, p => Math.hypot(p.x, p.y), vec2, Math.min, Math.max, Math.abs, (x, lo, hi) => Math.min(hi, Math.max(lo, x)), (a, b, t) => a + (b - a) * t);
// Shader packing: radius, reserved, smile thickness, blink thickness.
const defaults = { x: .75, y: 0, z: .22, w: .16 };
const dimensions = [[.16,.34],[.04,.45],[.24,.08],[.384,.048],[.024,.72]];
const targetsList = [defaults, {x:.25,y:0,z:.5,w:.25}, {x:1.25,y:0,z:.1,w:.05}];
const close = (a, b, tolerance = 1e-12, label = '') => assert.ok(Math.abs(a-b) <= tolerance, `${label}: ${a} != ${b} (±${tolerance})`);
const offset = (p, n, amount) => vec2(p.x+n.x*amount,p.y+n.y*amount);
const arcPoint = (halfSpan, bend, angle) => {
  // Stable circle sagitta parameterization without subtracting a large radius.
  const theta = Math.atan(bend)*2, t = theta*angle;
  const x = halfSpan * Math.sin(t) / Math.sin(theta);
  const y = halfSpan * bend - halfSpan * (1+bend*bend) / (2*bend) * 2*Math.sin(t/2)**2;
  return vec2(x,y);
};
const polylineDistance = (p, h, bend, segments=4096) => {
  let best=Infinity,a=arcPoint(h,bend,-1);
  for(let i=1;i<=segments;i++){
    const b=arcPoint(h,bend,-1+2*i/segments), dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
    best=Math.min(best,Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy));a=b;
  }
  return best;
};

test('exact circular arc distance matches an independent polyline including near-straight limits',()=>{
  const {curveDistance}=functions();
  for(const h of [.001,.12,.48])for(const bend of [1e-8,.001,.2,.6,1])for(const x of [0,.25,.9,1.3])for(const y of [-.3,0,.4,1.2]){
    const p=vec2(x*h,y*h), expected=polylineDistance(p,h,bend);
    close(curveDistance(p,h,bend),expected,h*3e-7,'circular arc distance');
    close(curveDistance(vec2(-p.x,p.y),h,bend),curveDistance(p,h,bend),1e-14,'symmetry');
  }
  for(const x of [-.3,0,.05,.3])for(const y of [-.2,0,.2]){
    close(curveDistance(vec2(x,y),.12,0),Math.hypot(Math.max(Math.abs(x)-.12,0),y));
    close(curveDistance(vec2(x,y),.12,1e-12),curveDistance(vec2(x,y),.12,0),1e-12,'stable line limit');
  }
});

test('every full smile has exactly circular centerline, height=radius, independent of neutral aspect ratio',()=>{
  for(const [width,height] of dimensions)for(const targets of targetsList){
    const {eyeDistance}=functions(width,height),R=width*targets.x,r=Math.min(width,height)*targets.z/2;
    for(let i=0;i<=32;i++){
      const theta=Math.PI*i/32,p=vec2(R*Math.cos(theta),R*Math.sin(theta));
      close(eyeDistance(p,1,1,targets),-r,1e-12,'all centerline points lie on the same circle');
    }
    close(eyeDistance(vec2(R+r,0),1,1,targets),0);
    close(eyeDistance(vec2(-R-r,0),1,1,targets),0);
    close(eyeDistance(vec2(0,R+r),1,1,targets),0);
    // Legacy arch/reserved packing must not distort the circular endpoint.
    close(eyeDistance(vec2(R*.6,R*.8),1,1,{...targets,y:100}),-r);
  }
});

test('semicircle stroke has uniform perpendicular thickness and round endpoints',()=>{
  for(const [width,height] of dimensions)for(const targets of targetsList){
    const {eyeDistance}=functions(width,height),R=width*targets.x,r=Math.min(width,height)*targets.z/2;
    for(const theta of [.02,.2,.5,Math.PI/2,2.6,Math.PI-.02]){
      const normal=vec2(Math.cos(theta),Math.sin(theta)),p=vec2(R*normal.x,R*normal.y);
      for(const sign of [-1,1])for(const fraction of [.75,1,1.25]){
        // At the legal R=r minimum, an inward offset larger than R crosses the
        // origin; only the stroke's actual inner boundary is meaningful there.
        if(sign<0 && fraction*r>R)continue;
        close(eyeDistance(offset(p,normal,sign*fraction*r),1,1,targets),(fraction-1)*r,1e-12,'normal distance');
      }
    }
    for(const sign of [-1,1])for(const theta of [-Math.PI,-Math.PI*.75,-Math.PI*.5,-Math.PI*.25,0]){
      const end=vec2(sign*R,0),normal=vec2(Math.cos(theta),Math.sin(theta));
      close(eyeDistance(offset(end,normal,r),1,1,targets),0,1e-12,'round cap boundary');
    }
  }
});

test('neutral and full blink remain exact capsules at every smile weight',()=>{
  for(const [width,height] of dimensions)for(const targets of targetsList){
    const {eyeDistance}=functions(width,height),closed=Math.min(width,height)*targets.w;
    for(const x of [-.4,-.08,0,.08,.4])for(const y of [-.3,-.01,0,.01,.3]){
      const p=vec2(x,y);
      close(eyeDistance(p,1,0,targets),capsuleDistance(p,vec2(width,height)));
      for(const smile of [0,.001,.25,.5,.999,1])close(eyeDistance(p,0,smile,targets),capsuleDistance(p,vec2(width,closed)),1e-12,'smile-independent thin blink');
    }
  }
});

test('all smile/blink mixtures and vertical-horizontal spine collapse are continuous',()=>{
  const epsilon=1e-8;
  for(const [width,height] of dimensions)for(const targets of targetsList){
    const {eyeDistance}=functions(width,height),unit=Math.min(width,height),smileWidth=2*width*targets.x+unit*targets.z;
    const circleSmile=(height-width)/(height-unit*targets.z+smileWidth-width);
    for(const x of [-.3,0,.05,.3])for(const y of [-.2,0,.08,.3]){
      const p=vec2(x,y);
      for(const smile of [0,.1,.5,.9,1,circleSmile].filter(v=>v>=0&&v<=1))for(const open of [0,.1,.5,1]){
        close(eyeDistance(p,open,Math.max(0,smile-epsilon),targets),eyeDistance(p,open,Math.min(1,smile+epsilon),targets),1e-7,'smile continuity');
        close(eyeDistance(p,Math.max(0,open-epsilon),smile,targets),eyeDistance(p,Math.min(1,open+epsilon),smile,targets),1e-7,'blink continuity');
      }
    }
  }
});

test('complete reachable circular-arc envelope fits stable weight-independent bounds',()=>{
  for(const [width,height] of dimensions)for(const targets of targetsList){
    const {eyeDistance}=functions(width,height),unit=Math.min(width,height),extent=width*targets.x+unit*targets.z/2;
    const halfWidth=Math.max(width/2,extent),bottom=-Math.max(height,unit*targets.z,unit*targets.w)/2,top=Math.max(height/2,extent,unit*targets.w/2);
    for(const smile of [0,.1,.35,.5,.75,1])for(const open of [0,.1,.35,.5,.75,1])for(let i=0;i<=16;i++){
      const x=-halfWidth+2*halfWidth*i/16,y=bottom+(top-bottom)*i/16;
      for(const p of [vec2(-halfWidth,y),vec2(halfWidth,y),vec2(x,bottom),vec2(x,top)])assert.ok(eyeDistance(p,open,smile,targets)>=-1e-10,'ink stays in the fitted envelope');
    }
  }
});

test('Canvas2D eye distance agrees with the production GLSL scalar expressions', async () => {
  const { softwareEyeDistance } = await import('../src/renderer/software-rasterizer.ts');
  for (const [width,height] of dimensions) for (const targets of targetsList) {
    const shader = functions(width,height), packed = [targets.x,targets.y,targets.z,targets.w];
    for (const open of [0,.2,.5,1]) for (const happy of [0,.2,.5,1]) for (const x of [-.4,-.1,0,.08,.3]) for (const y of [-.4,-.02,0,.06,.3]) {
      close(softwareEyeDistance(x,y,open,happy,[width,height],packed),shader.eyeDistance(vec2(x,y),open,happy,targets),1e-12,'software eye distance');
    }
  }
});
