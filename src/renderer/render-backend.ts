import type { Mat4 } from '../core/math.js';
import type { Geometry } from './geometry.js';
import { vertexSource, fragmentSource } from './webgl-shaders.js';
import { SoftwareRasterizer } from './software-rasterizer.js';
import type { SoftwareEyes } from './software-rasterizer.js';

export interface Mesh { count: number; data: Geometry }
export interface RendererOptions { renderer?: 'auto' | 'canvas2d' }
/** The acquired WebGL canvas cannot be rebound to 2D; its owner must replace it. */
export class RendererInitializationError extends Error {
  constructor(cause: unknown) { super(cause instanceof Error ? cause.message : String(cause), { cause }); this.name = 'RendererInitializationError'; }
}
export interface RenderBackend {
  readonly kind: 'webgl2' | 'canvas2d';
  readonly gl?: WebGL2RenderingContext;
  readonly maxDimension: number;
  readonly lost: boolean;
  upload(data: Geometry): Mesh;
  update(mesh: Mesh, data: Geometry, indices: boolean, reuseVertices: boolean): void;
  deleteMesh(mesh: Mesh): void;
  begin(projection: Mat4): void;
  eyes(eyes?: SoftwareEyes): void;
  opacity(value: number): void;
  draw(mesh: Mesh, model: Mat4, color: string, count: number, indexOffset: number): void;
  end(): void;
  readPixels(): Uint8Array;
  dispose(): void;
  initializationError(cause: unknown): Error;
}
export function createBackend(canvas: HTMLCanvasElement | OffscreenCanvas, options: RendererOptions): RenderBackend {
  if (options.renderer !== 'canvas2d') {
    let gl: WebGL2RenderingContext | null;
    try { gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'low-power' }) as WebGL2RenderingContext | null; }
    catch { gl = null; }
    if (gl) {
      try { return new WebGLBackend(canvas, gl); }
      catch (error) { throw new RendererInitializationError(error); }
    }
  }
  return new CanvasBackend(canvas, options.renderer !== 'canvas2d');
}
type GPUMesh = { vao: WebGLVertexArrayObject; buffer: WebGLBuffer; index: WebGLBuffer; face?: WebGLBuffer; faceVertices?: Float32Array };
class WebGLBackend implements RenderBackend {
  readonly kind = 'webgl2' as const;
  readonly maxDimension = 2048;
  private program: WebGLProgram;
  private uniforms: Record<string, WebGLUniformLocation> = {};
  private meshes = new Map<Mesh, GPUMesh>();
  get lost(): boolean { return this.gl.isContextLost(); }
  constructor(private canvas: HTMLCanvasElement | OffscreenCanvas, readonly gl: WebGL2RenderingContext) {
    const compile = (type: number, source: string): WebGLShader => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('셰이더를 생성하지 못했습니다.');
      try {
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? '셰이더 컴파일 오류');
        return shader;
      } catch (error) { gl.deleteShader(shader); throw error; }
    };
    let vertex: WebGLShader | undefined, fragment: WebGLShader | undefined, program: WebGLProgram | null = null;
    try {
      vertex = compile(gl.VERTEX_SHADER, vertexSource); fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram();
      if (!program) throw new Error('WebGL 프로그램을 생성하지 못했습니다.');
      gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? '프로그램 연결 오류');
      this.program = program;
      for (const name of ['opacity','model','projection','color','eyesOn','eyeColor','eyeCenters','eyeSize','eyeStates','eyeLeftTargets','eyeRightTargets','faceScale']) {
        const location = gl.getUniformLocation(program, name); if (!location) throw new Error(`uniform ${name} 없음`); this.uniforms[name] = location;
      }
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.clearColor(0, 0, 0, 0);
    } catch (error) { if (program) gl.deleteProgram(program); throw error; }
    finally { if (vertex) gl.deleteShader(vertex); if (fragment) gl.deleteShader(fragment); }
  }
  upload(data: Geometry): Mesh {
    const gl = this.gl;
    let vao: WebGLVertexArrayObject | null = null, buffer: WebGLBuffer | null = null, index: WebGLBuffer | null = null, gpu: GPUMesh | undefined;
    try {
      vao = gl.createVertexArray(); buffer = gl.createBuffer(); index = gl.createBuffer();
      if (!vao || !buffer || !index) throw new Error('GPU 버퍼를 생성하지 못했습니다.');
      gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
      gpu = { vao, buffer, index }; this.faceChart(gpu, data); gl.bindVertexArray(null);
      const mesh = { count: data.indices.length, data }; this.meshes.set(mesh, gpu); return mesh;
    } catch (error) {
      gl.bindVertexArray(null); if (gpu?.face) gl.deleteBuffer(gpu.face); if (buffer) gl.deleteBuffer(buffer); if (index) gl.deleteBuffer(index); if (vao) gl.deleteVertexArray(vao); throw error;
    }
  }
  /** Bind neutral chart data only for skinned bodies; ordinary meshes reuse their vertex buffer. */
  private faceChart(gpu: GPUMesh, data: Geometry): void {
    const gl = this.gl;
    if (data.faceVertices) {
      if (!gpu.face) { const buffer = gl.createBuffer(); if (!buffer) throw new Error('GPU face chart buffer unavailable.'); gpu.face = buffer; }
      gl.bindBuffer(gl.ARRAY_BUFFER, gpu.face);
      if (gpu.faceVertices !== data.faceVertices) gl.bufferData(gl.ARRAY_BUFFER, data.faceVertices, gl.STATIC_DRAW);
    } else {
      if (gpu.face) { gl.deleteBuffer(gpu.face); gpu.face = undefined; }
      gl.bindBuffer(gl.ARRAY_BUFFER, gpu.buffer);
    }
    gpu.faceVertices = data.faceVertices;
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 24, 20);
  }
  update(mesh: Mesh, data: Geometry, indices: boolean, reuseVertices: boolean): void {
    const gpu = this.meshes.get(mesh)!, gl = this.gl;
    gl.bindVertexArray(gpu.vao); gl.bindBuffer(gl.ARRAY_BUFFER, gpu.buffer);
    if (reuseVertices) gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.vertices); else gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.DYNAMIC_DRAW);
    if (indices) { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gpu.index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW); }
    this.faceChart(gpu, data); gl.bindVertexArray(null);
  }
  begin(projection: Mat4): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program); gl.uniformMatrix4fv(this.uniforms.projection!, false, projection);
  }
  eyes(eyes?: SoftwareEyes): void {
    const gl = this.gl, u = this.uniforms; gl.uniform1i(u.eyesOn!, eyes ? 1 : 0); if (!eyes) return;
    gl.uniform3f(u.eyeColor!, eyes.color[0]!, eyes.color[1]!, eyes.color[2]!);
    gl.uniform4f(u.eyeCenters!, eyes.centers[0]!, eyes.centers[1]!, eyes.centers[2]!, eyes.centers[3]!);
    gl.uniform2f(u.eyeSize!, eyes.size[0]!, eyes.size[1]!); gl.uniform2f(u.faceScale!, eyes.faceScale[0]!, eyes.faceScale[1]!);
    for (const [key, values] of [['eyeStates', eyes.states], ['eyeLeftTargets', eyes.leftTargets], ['eyeRightTargets', eyes.rightTargets]] as const) gl.uniform4f(u[key]!, values[0]!, values[1]!, values[2]!, values[3]!);
  }
  opacity(value: number): void { const gl = this.gl; if (value < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); } else gl.disable(gl.BLEND); gl.uniform1f(this.uniforms.opacity!, value); }
  draw(mesh: Mesh, model: Mat4, hex: string, count: number, indexOffset: number): void {
    const gl = this.gl, value = parseInt(hex.slice(1), 16);
    gl.uniformMatrix4fv(this.uniforms.model!, false, model); gl.uniform3f(this.uniforms.color!, ((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
    gl.bindVertexArray(this.meshes.get(mesh)!.vao); gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, indexOffset * Uint16Array.BYTES_PER_ELEMENT);
  }
  end(): void { this.gl.disable(this.gl.BLEND); this.gl.bindVertexArray(null); }
  readPixels(): Uint8Array { const pixels = new Uint8Array(this.canvas.width * this.canvas.height * 4); this.gl.readPixels(0, 0, this.canvas.width, this.canvas.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels); return pixels; }
  deleteMesh(mesh: Mesh): void { const gpu = this.meshes.get(mesh); if (!gpu) return; this.gl.deleteBuffer(gpu.buffer); this.gl.deleteBuffer(gpu.index); if (gpu.face) this.gl.deleteBuffer(gpu.face); this.gl.deleteVertexArray(gpu.vao); this.meshes.delete(mesh); }
  dispose(): void { for (const mesh of this.meshes.keys()) this.deleteMesh(mesh); this.gl.deleteProgram(this.program); }
  initializationError(cause: unknown): Error { return new RendererInitializationError(cause); }
}
class CanvasBackend implements RenderBackend {
  readonly kind = 'canvas2d' as const;
  // Bounded CPU work even for fullscreen/high-DPR hosts. CSS/world scale is unchanged.
  readonly maxDimension = 384;
  readonly lost = false;
  private context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private rasterizer = new SoftwareRasterizer();
  private projection!: Mat4;
  private eyeState?: SoftwareEyes;
  private alpha = 1;
  private image?: ImageData;
  constructor(private canvas: HTMLCanvasElement | OffscreenCanvas, webglAttempted: boolean) {
    const context = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) throw new Error(webglAttempted ? 'WebGL2 및 Canvas 2D 렌더링을 사용할 수 없습니다.' : 'Canvas 2D 렌더링을 사용할 수 없습니다.');
    this.context = context;
  }
  upload(data: Geometry): Mesh { return { data, count: data.indices.length }; }
  update(_mesh: Mesh, _data: Geometry, _indices: boolean, _reuseVertices: boolean): void { /* Shared scene owns CPU geometry. */ }
  deleteMesh(_mesh: Mesh): void { /* No GPU allocation. */ }
  begin(projection: Mat4): void { this.projection = projection; this.rasterizer.clear(this.canvas.width, this.canvas.height); }
  eyes(eyes?: SoftwareEyes): void { this.eyeState = eyes; }
  opacity(value: number): void { this.alpha = value; }
  draw(mesh: Mesh, model: Mat4, color: string, count: number, indexOffset: number): void { this.rasterizer.draw(mesh.data, model, this.projection, color, count, indexOffset, this.alpha, this.eyeState); }
  end(): void {
    if (!this.image || this.image.width !== this.canvas.width || this.image.height !== this.canvas.height) this.image = this.context.createImageData(this.canvas.width, this.canvas.height);
    this.image.data.set(this.rasterizer.pixels); this.context.putImageData(this.image, 0, 0);
  }
  readPixels(): Uint8Array { return this.rasterizer.readPixels(); }
  dispose(): void { this.image = undefined; this.rasterizer.dispose(); }
  initializationError(cause: unknown): Error { return cause instanceof Error ? cause : new Error(String(cause)); }
}
