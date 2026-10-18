export function recordGL() {
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
    uniform1i:(loc,value)=>uniforms.set(loc.name,{kind:0,values:[value]}),
    uniform2f:(loc,...values)=>uniforms.set(loc.name,{kind:2,values}),uniform3f:(loc,...values)=>uniforms.set(loc.name,{kind:3,values}),uniform4f:(loc,...values)=>uniforms.set(loc.name,{kind:4,values}),
    viewport(){},clear(){draws.length=0;},clearColor(){},enable(){},cullFace(){},useProgram(){},isContextLost:()=>false,
    drawElements:(_mode,count,_type,offset=0)=>draws.push({uniforms:structuredClone(uniforms),vertices:buffers.get(vao.attributes.get(0).buffer).slice(),directions:buffers.get(vao.attributes.get(2)?.buffer)?.slice(),indices:buffers.get(vao.index).subarray(offset,offset+count*2).slice()}),
    deleteBuffer(){},deleteVertexArray(){},deleteProgram(){}
  });
  return {gl,draws,shaders};
}
