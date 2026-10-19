/** Developer-only catalog asset generation: production draw commands, native EGL/GLES3.
 * Run after `npm run build:all`: node scripts/generate-accessory-previews.mjs
 * Requires a C compiler plus system libEGL/libGLES; no browser or runtime dependency. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { AvatarRenderer } from '../dist/src/renderer/webgl.js';
import { ACCESSORY_PRESETS, createAccessory, createDesign } from '../dist/src/core/design.js';
import { initialPose } from '../dist/src/core/motion.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sidekick-previews-'));
const output = path.join(root, 'public/accessory-previews'); fs.mkdirSync(output,{recursive:true});
const SIZE = 768, OUTPUT_SIZE = 192;
function recordGL() {
  let serial=0,vao=null,arrayBuffer=null,defaultIndex=null;
  const buffers=new Map(),uniforms=new Map(),draws=[],shaders=[];
  const gl={VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,LINK_STATUS:35714,ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,DYNAMIC_DRAW:35048,STATIC_DRAW:35044,FLOAT:5126,TRIANGLES:4,UNSIGNED_SHORT:5123,DEPTH_TEST:2929,CULL_FACE:2884,BACK:1029,COLOR_BUFFER_BIT:16384,DEPTH_BUFFER_BIT:256};
  const object=()=>({id:++serial});
  Object.assign(gl,{
    createShader:type=>{const o={...object(),type};shaders.push(o);return o;},shaderSource:(s,source)=>s.source=source,
    compileShader(){},getShaderParameter:()=>true,getShaderInfoLog:()=>'',createProgram:object,attachShader(){},linkProgram(){},deleteShader(){},getProgramParameter:()=>true,getProgramInfoLog:()=>'',getUniformLocation:(_p,name)=>({name}),
    createVertexArray:()=>({...object(),attributes:new Map()}),createBuffer:object,
    bindVertexArray:v=>vao=v,bindBuffer:(target,b)=>{if(target===gl.ARRAY_BUFFER)arrayBuffer=b;else if(vao)vao.index=b;else defaultIndex=b;},
    bufferData:(target,data)=>{const b=target===gl.ARRAY_BUFFER?arrayBuffer:(vao?.index??defaultIndex);buffers.set(b,Buffer.from(data.buffer,data.byteOffset,data.byteLength).slice());},
    bufferSubData:(target,offset,data)=>{const b=target===gl.ARRAY_BUFFER?arrayBuffer:(vao?.index??defaultIndex);Buffer.from(data.buffer,data.byteOffset,data.byteLength).copy(buffers.get(b),offset);},
    enableVertexAttribArray(){},vertexAttribPointer:(loc,size,type,normalized,stride,offset)=>vao.attributes.set(loc,{buffer:arrayBuffer,size,type,normalized,stride,offset}),vertexAttrib3f(){},
    uniformMatrix4fv:(loc,_transpose,values)=>uniforms.set(loc.name,{kind:16,values:Array.from(values)}),
    uniform1f:(loc,value)=>uniforms.set(loc.name,{kind:1,values:[value]}),
    uniform1i:(loc,value)=>uniforms.set(loc.name,{kind:0,values:[value]}),
    uniform2f:(loc,...values)=>uniforms.set(loc.name,{kind:2,values}),uniform3f:(loc,...values)=>uniforms.set(loc.name,{kind:3,values}),uniform4f:(loc,...values)=>uniforms.set(loc.name,{kind:4,values}),
    viewport(){},clear(){draws.length=0;},clearColor(){},enable(){},disable(){},blendFunc(){},cullFace(){},useProgram(){},isContextLost:()=>false,
    drawElements:(_mode,count,_type,offset=0)=>draws.push({uniforms:structuredClone(uniforms),vertices:buffers.get(vao.attributes.get(0).buffer).slice(),directions:buffers.get(vao.attributes.get(2)?.buffer)?.slice(),indices:buffers.get(vao.index).subarray(offset,offset+count*2).slice()}),
    deleteBuffer(){},deleteVertexArray(){},deleteProgram(){}
  });
  return {gl,draws,shaders};
}

function serialize(draws) {
  const out=[Buffer.from(new Uint32Array([draws.length]).buffer)];
  for(const draw of draws){
    out.push(Buffer.from(new Uint32Array([draw.vertices.length/24,draw.indices.length/2,draw.uniforms.size,0]).buffer),draw.vertices,draw.indices);
    for(const[name,{kind,values}]of draw.uniforms){const label=Buffer.alloc(64);label.write(name);const data=new Float32Array(16);data.set(values);out.push(label,Buffer.from(new Uint32Array([kind]).buffer),Buffer.from(data.buffer));}
  }
  return Buffer.concat(out);
}
function png(pixels) {
  const width=OUTPUT_SIZE, scale=SIZE/width, raw=Buffer.alloc((width*4+1)*width);
  // Area-average supersampled coverage, preserving unpremultiplied edge colors.
  for(let y=0;y<width;y++)for(let x=0;x<width;x++){
    let alpha=0;const colors=[0,0,0];
    for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const q=((y*scale+dy)*SIZE+x*scale+dx)*4,a=pixels[q+3];alpha+=a;for(let k=0;k<3;k++)colors[k]+=pixels[q+k]*a;}
    const at=y*(width*4+1)+1+x*4;for(let k=0;k<3;k++)raw[at+k]=alpha?Math.round(colors[k]/alpha):0;raw[at+3]=Math.round(alpha/(scale*scale));
  }
  const crc32=buffer=>{let crc=0xffffffff;for(const b of buffer){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
  const chunk=(type,data)=>{const tag=Buffer.from(type),crc=Buffer.alloc(4),length=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([tag,data])));return Buffer.concat([length,tag,data,crc]);};
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(width,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
try {
  const native=path.join(temp,'native-preview-renderer');
  execFileSync(process.env.CC??'cc',[path.join(root,'scripts/native-preview-renderer.c'),'-O2','-ldl','-o',native],{stdio:'inherit'});
  const captured=recordGL(),renderer=new AvatarRenderer({width:SIZE,height:SIZE,getContext:()=>captured.gl});
  for(const[stage,type]of[['vertex',captured.gl.VERTEX_SHADER],['fragment',captured.gl.FRAGMENT_SHADER]])fs.writeFileSync(path.join(temp,stage+'.glsl'),captured.shaders.find(s=>s.type===type).source);
  const views={beret:[18,18],halo:[8,25],crown:[18,18],glasses:[8,4],sunglasses:[8,4],moustache:[8,4],goatee:[8,4],bowTie:[10,7],scarf:[8,6],necklace:[0,6],earring:[8,0],starEarring:[8,0]};
  const items=[];
  for(const preset of ACCESSORY_PRESETS){
    const accessory=preset==='earring'||preset==='starEarring'?createAccessory(preset,{slot:'rightEar'}):createAccessory(preset);
    const [yaw,pitch]=views[preset];
    renderer.render(createDesign({accessories:[accessory]}),{pose:initialPose(),activity:'still',time:0,delta:0,reduced:true,style:'flat',bodyOrientation:{yaw,pitch,roll:0}});
    const draws=captured.draws.filter(draw=>draw.uniforms.get('eyesOn')?.values[0]===0);assert.ok(draws.length);
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const draw of draws){const model=draw.uniforms.get('model').values,v=new Float32Array(draw.vertices.buffer,draw.vertices.byteOffset,draw.vertices.length/4);for(let i=0;i<v.length;i+=6){const x=model[0]*v[i]+model[4]*v[i+1]+model[8]*v[i+2]+model[12],y=model[1]*v[i]+model[5]*v[i+1]+model[9]*v[i+2]+model[13];minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
    const span=Math.max(maxX-minX,maxY-minY)*1.25,cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    const projection=[2/span,0,0,0,0,2/span,0,0,0,0,-.1,0,-2*cx/span,-2*cy/span,0,1];
    for(const draw of draws)draw.uniforms.set('projection',{kind:16,values:projection});
    const binary=path.join(temp,preset+'.bin'),pam=path.join(temp,preset+'.pam');fs.writeFileSync(binary,serialize(draws));
    execFileSync(native,[path.join(temp,'vertex.glsl'),path.join(temp,'fragment.glsl'),binary,pam],{stdio:'pipe',env:{...process.env,SIDEKICK_SIZE:String(SIZE),MESA_SHADER_CACHE_DIR:path.join(temp,'mesa-cache')}});
    const bytes=fs.readFileSync(pam),pixels=bytes.subarray(bytes.indexOf('ENDHDR\n')+7);assert.equal(pixels.length,SIZE*SIZE*4);
    fs.writeFileSync(path.join(output,preset+'.png'),png(pixels));
    items.push({preset,color:accessory.color,view:{yaw,pitch},filename:preset+'.png'});console.log(preset);
  }
  renderer.dispose();
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({size:OUTPUT_SIZE,background:'transparent',method:'Unmodified production AvatarRenderer accessory meshes and shaders, isolated and reframed, replayed with native EGL/GLES3 depth testing and back-face culling. 4x supersampled coverage. Static assets require no preview WebGL contexts.',items},null,2)+'\n');
} finally { fs.rmSync(temp,{recursive:true,force:true}); }
