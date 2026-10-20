import test from 'node:test';
import assert from 'node:assert/strict';
import { AvatarRenderer } from '../src/renderer/webgl.js';
import { createDesign, createAccessory, MATERIAL_SHAPE_NAMES } from '../src/core/design.js';
import { initialPose } from '../src/core/motion.js';
import { alphaBounds } from '../src/core/pixels.js';
import { RenderEngine } from '../src/runtime/render-engine.js';
import type { RuntimeState } from '../src/runtime/protocol.js';
function surface(webglThrows = false) {
  let image: {width:number;height:number;data:Uint8ClampedArray}|undefined, calls = 0;
  const contexts: string[] = [], listeners = new Map();
  const canvas = {
    width: 128, height: 128,
    getContext(type: string) {
      contexts.push(type);
      if (type === 'webgl2') { if (webglThrows) throw new Error('Disabled'); return null; }
      return { createImageData: (width:number,height:number) => ({width,height,data:new Uint8ClampedArray(width*height*4)}), putImageData: (value: typeof image) => {image = value; calls++;} };
    },
    addEventListener(type:string,listener:unknown) {listeners.set(type,listener);},
    removeEventListener(type:string) {listeners.delete(type);},
  } as unknown as HTMLCanvasElement;
  return {canvas, contexts, get image(){return image!;},get calls(){return calls;}, listeners};
}
const frame = () => ({pose:initialPose(),time:0,delta:0,activity:'still' as const,reduced:true,style:'flat' as const});
test('no WebGL2 and throwing context request render the configured first frame via Canvas2D', () => {
  for (const throws of [false,true]) {
    const fixture=surface(throws), renderer=new AvatarRenderer(fixture.canvas);
    renderer.resize(128,128,1);
    renderer.render(createDesign({body:{shape:'puffy',color:'#ff0000'}}),frame());
    assert.equal(renderer.graphics,'canvas2d'); assert.deepEqual(fixture.contexts,['webgl2','2d']);
    assert.equal(fixture.calls,1); assert.equal(renderer.stats.buffers,0);
    const bounds=alphaBounds({width:128,height:128,pixels:fixture.image.data}); assert.ok(bounds && bounds.width>50);
    assert.equal(fixture.image.data[3],0,'transparent exterior');
    assert.ok(fixture.image.data.some((v,i)=>i%4===0&&v===255),'authored color present');
    assert.equal(renderer.readPixels().length,128*128*4);
    renderer.dispose(); renderer.dispose();
  }
});
test('all35 shapes and catalog accessories use the shared geometry on CPU, including rotated views', () => {
  const fixture=surface(), renderer=new AvatarRenderer(fixture.canvas); renderer.resize(128,128,1);
  const accessories = ['beret','crown','halo','glasses','sunglasses','moustache','goatee','bowTie','scarf','necklace','earring','starEarring'] as const;
  for (const shape of MATERIAL_SHAPE_NAMES) {
    for (const preset of accessories) {
      renderer.render(createDesign({body:{shape},accessories:[createAccessory(preset, preset === 'earring' || preset === 'starEarring' ? {slot:'leftEar'} : {})]}),{...frame(),bodyOrientation:{yaw:30,pitch:12}});
      assert.ok(alphaBounds({width:128,height:128,pixels:fixture.image.data}),`${shape}/${preset}`);
      assert.ok(renderer.stats.drawCalls>=2,`${shape}/${preset} accessory drawn`);
    }
  }
  renderer.dispose();
});
test('CPU backing cap preserves display aspect and snapshots retain bottom-up orientation', () => {
  const fixture=surface(), renderer=new AvatarRenderer(fixture.canvas,{renderer:'canvas2d'});
  assert.deepEqual(fixture.contexts,['2d']);
  for (const [w,h,dpr] of [[128,128,2],[2000,500,2],[500,2000,1]]) {
    renderer.resize(w!,h!,dpr!); assert.ok(Math.max(fixture.canvas.width,fixture.canvas.height)<=384);
    assert.ok(Math.abs(fixture.canvas.width/fixture.canvas.height-w!/h!)<.01);
  }
  renderer.resize(128,128,1); renderer.render(createDesign({accessories:[createAccessory('halo')]}),frame());
  const read=renderer.readPixels(), stride=128*4;
  for (let y=0;y<128;y++) for(let x=0;x<128;x++) assert.equal(read[(127-y)*stride+x*4+3],fixture.image.data[y*stride+x*4+3]);
  renderer.dispose();
});
test('Canvas2D runtime pauses, snapshots and disposes without retaining frame scheduling', () => {
  const fixture=surface(), scheduled=new Map<number,unknown>();let id=0;
  const initial:RuntimeState={design:createDesign(),pose:initialPose(),activity:'still',bodyOrientation:{yaw:0,pitch:0,roll:0},zoom:1,paused:true,reduced:false,active:true,time:0,gaze:[0,0],trackingMode:'eyes',width:128,height:128,dpr:1};
  const engine=new RenderEngine(fixture.canvas,initial,()=>{}, {request(fn){scheduled.set(++id,fn);return id;},cancel(id){scheduled.delete(id);}});
  assert.equal(engine.snapshot.graphics,'canvas2d'); assert.equal(fixture.calls,1); assert.equal(scheduled.size,0);
  engine.dispose(); assert.equal(scheduled.size,0); assert.equal(fixture.listeners.size,0);
});
test('both eye centers use XY only and stay symmetric on a neutral front-facing body', () => {
  const fixture=surface(),renderer=new AvatarRenderer(fixture.canvas);
  renderer.resize(256,256,1); renderer.render(createDesign({body:{shape:'circle',color:'#ffffff'},eyes:{color:'#000000'}}),frame());
  const counts=[0,0], sums=[0,0];
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const p=(y*256+x)*4;
    if(fixture.image.data[p+3]===255&&fixture.image.data[p]===0){const side=x<128?0:1;counts[side]++;sums[side]+=x;}
  }
  assert.ok(counts[0]!>30&&counts[1]!>30,'both eyes visible');
  assert.ok(Math.abs(counts[0]!-counts[1]!)<8,'eyes have equal coverage');
  assert.ok(Math.abs(sums[0]!/counts[0]!+sums[1]!/counts[1]!-255)<2,'eyes symmetric around center');
  renderer.dispose();
});
