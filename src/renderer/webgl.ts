import type { Activity, Anchor, AvatarDesign, RenderStyle, Vec2, Vec3 } from '../core/design.js';
import type { Pose } from '../core/motion.js';
import { activityFrame } from '../core/motion.js';
import { clamp, multiply, orthographic, spring, transform } from '../core/math.js';
import type { Mat4 } from '../core/math.js';
import { bodyNormal, bodyPoint, sampleSurface } from '../core/surface.js';
import { sphere, torus } from './geometry.js';
import type { Geometry } from './geometry.js';
interface Mesh { vao: WebGLVertexArrayObject; buffer: WebGLBuffer; index: WebGLBuffer; count: number; data: Geometry }
export interface RenderState { pose: Pose; activity: Activity; time: number; delta: number; reduced: boolean; style: RenderStyle; view: Vec2 }
const vertexSource = `#version 300 es
precision highp float;
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
uniform mat4 model;
uniform mat4 projection;
out vec3 vNormal;
void main() {
  vNormal = mat3(transpose(inverse(model))) * normal;
  gl_Position = projection * model * vec4(position, 1.0);
}`;
const fragmentSource = `#version 300 es
precision highp float;
in vec3 vNormal;
uniform vec3 color;
uniform bool flatStyle;
out vec4 outColor;
void main() {
  if (flatStyle) { outColor = vec4(color, 1.0); return; }
  vec3 n = normalize(vNormal);
  vec3 light = normalize(vec3(-0.6, 0.9, 1.4));
  float diffuse = max(dot(n, light), 0.0);
  float fill = max(dot(n, normalize(vec3(1.0, 0.2, 0.7))), 0.0);
  float specular = pow(max(dot(n, normalize(light + vec3(0.0, 0.0, 1.0))), 0.0), 38.0);
  vec3 linearColor = pow(color, vec3(2.2));
  vec3 shaded = linearColor * (0.37 + 0.58 * diffuse + 0.12 * fill) + 0.13 * specular;
  outColor = vec4(pow(clamp(shaded, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}`;
/** Dependency-free WebGL2 backend. No DOM outside the supplied canvas is owned here. */
export class AvatarRenderer {
  readonly gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private uniforms: Record<'model' | 'projection' | 'color' | 'flatStyle', WebGLUniformLocation>;
  private meshes: Record<'body' | 'sphere' | 'capsule' | 'ring' | 'halo' | 'arc', Mesh>;
  private bodyDirections: Float32Array;
  private lag = new Map<string, [number, number]>();
  private disposed = false;
  private drawCount = 0;
  private framedDesign?: AvatarDesign;
  private frameSpan = 2.4;
  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'low-power' });
    if (!gl) throw new Error('WebGL2를 사용할 수 없습니다. 브라우저의 하드웨어 가속 설정을 확인하세요.');
    this.gl = gl;
    const compile = (type: number, source: string): WebGLShader => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('셰이더를 생성하지 못했습니다.');
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const info = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(info ?? '셰이더 컴파일 오류'); }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexSource), fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error('WebGL 프로그램을 생성하지 못했습니다.');
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { const info = gl.getProgramInfoLog(program); gl.deleteProgram(program); throw new Error(info ?? '프로그램 연결 오류'); }
    this.program = program;
    const uniform = (name: string): WebGLUniformLocation => { const location = gl.getUniformLocation(program, name); if (!location) throw new Error(`uniform ${name} 없음`); return location; };
    this.uniforms = { model: uniform('model'), projection: uniform('projection'), color: uniform('color'), flatStyle: uniform('flatStyle') };
    this.meshes = { body: this.upload(sphere(40, 28)), sphere: this.upload(sphere()), capsule: this.upload(sphere(24, 20, true)), ring: this.upload(torus(0.10)), halo: this.upload(torus(0.055)), arc: this.upload(torus(0.23, Math.PI)) };
    this.bodyDirections = this.meshes.body.data.vertices.slice();
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.clearColor(0, 0, 0, 0);
  }
  private upload(data: Geometry): Mesh {
    const gl = this.gl, vao = gl.createVertexArray(), buffer = gl.createBuffer(), index = gl.createBuffer();
    if (!vao || !buffer || !index) throw new Error('GPU 버퍼를 생성하지 못했습니다.');
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, buffer, index, count: data.indices.length, data };
  }
  resize(width: number, height: number, dpr = 1): void {
    const ratio = clamp(dpr, 1, 2);
    const w = Math.max(1, Math.min(2048, Math.round(width * ratio))), h = Math.max(1, Math.min(2048, Math.round(height * ratio)));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }
  private draw(mesh: Mesh, model: Mat4, hex: string): void {
    const gl = this.gl, value = parseInt(hex.slice(1), 16);
    gl.uniformMatrix4fv(this.uniforms.model, false, model);
    gl.uniform3f(this.uniforms.color, ((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
    gl.bindVertexArray(mesh.vao); gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0); this.drawCount++;
  }
  render(design: AvatarDesign, state: RenderState): void {
    if (this.disposed || this.gl.isContextLost()) return;
    const gl = this.gl, { pose } = state, activity = activityFrame(state.activity, state.time, state.reduced);
    const roll = pose.rotation[2] + activity.roll;
    const root = transform([0, activity.bob, 0], [pose.rotation[0] + state.view[1], pose.rotation[1] + state.view[0], roll]);
    const aspect = this.canvas.width / this.canvas.height;
    if (this.framedDesign !== design) {
      // A design-level bound, not per-frame auto-framing: animation never pumps the camera.
      let radius = 0;
      for (const squash of [0.88, 1.12]) {
        let bodyRadius = 0;
        for (let i = 0; i < this.bodyDirections.length; i += 6) {
          const direction: Vec3 = [this.bodyDirections[i]!, this.bodyDirections[i + 1]!, this.bodyDirections[i + 2]!];
          bodyRadius = Math.max(bodyRadius, Math.hypot(...bodyPoint(design.body, direction, squash)));
        }
        radius = Math.max(radius, bodyRadius + 0.16 * design.eyes.scale);
        for (const a of design.accessories) radius = Math.max(radius, Math.hypot(...sampleSurface(design.body, a.anchor, squash).position) + 0.43 * a.scale);
      }
      this.frameSpan = Math.max(Math.max(...design.body.size) * 1.25 + 0.9, radius * 2 + 0.34);
      this.framedDesign = design;
    }
    const span = this.frameSpan;
    const height = span * Math.max(1, 1 / aspect), width = height * aspect;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program); gl.uniformMatrix4fv(this.uniforms.projection, false, orthographic(width, height));
    gl.uniform1i(this.uniforms.flatStyle, state.style === 'flat' ? 1 : 0);
    this.drawCount = 0;
    const body = this.meshes.body;
    for (let i = 0; i < this.bodyDirections.length; i += 6) {
      const d: Vec3 = [this.bodyDirections[i]!, this.bodyDirections[i + 1]!, this.bodyDirections[i + 2]!];
      body.data.vertices.set(bodyPoint(design.body, d, activity.squash), i);
      body.data.vertices.set(bodyNormal(design.body, d, activity.squash), i + 3);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, body.buffer); gl.bufferSubData(gl.ARRAY_BUFFER, 0, body.data.vertices);
    this.draw(body, root, design.body.color);
    const mount = (anchor: Anchor, rotation: Vec3 = [0, 0, 0]): Mat4 => multiply(multiply(root, sampleSurface(design.body, anchor, activity.squash).matrix), transform([0, 0, 0], rotation));
    const localDraw = (mesh: Mesh, parent: Mat4, color: string, position: Vec3, size: Vec3, rotation: Vec3 = [0, 0, 0]): void => this.draw(mesh, multiply(parent, transform(position, rotation, size)), color);
    const face: Vec2 = [design.eyes.anchor.uv[0] + pose.face[0], design.eyes.anchor.uv[1] + pose.face[1]];
    const gaze: Vec2 = [pose.gaze[0] + activity.gaze[0], pose.gaze[1] + activity.gaze[1]];
    const openness = Math.max(0.05, pose.openness * activity.blink), eyeSize = design.eyes.scale;
    for (const side of [-1, 1]) {
      const anchor: Anchor = { ...design.eyes.anchor, uv: [clamp(face[0] + side * design.eyes.spacing / 2 + gaze[0] * 0.1, -0.95, 0.95), clamp(face[1] + gaze[1] * 0.1, -0.85, 0.85)] };
      const parent = mount(anchor), ink = design.eyes.color;
      if (design.eyes.preset === 'round') {
        localDraw(this.meshes.sphere, parent, '#fffaf0', [0, 0, 0.018], [0.105 * eyeSize, 0.11 * eyeSize * openness, 0.07 * eyeSize]);
        localDraw(this.meshes.sphere, parent, ink, [gaze[0] * 0.021, gaze[1] * 0.021, 0.081 * eyeSize], [0.052 * eyeSize, 0.06 * eyeSize * openness, 0.027 * eyeSize]);
      } else if (design.eyes.preset === 'arc') {
        localDraw(this.meshes.arc, parent, ink, [0, -0.025, 0.024], [0.083 * eyeSize, 0.077 * eyeSize * openness, 0.083 * eyeSize]);
        for (const end of [-1, 1]) localDraw(this.meshes.sphere, parent, ink, [end * 0.083 * eyeSize, -0.025, 0.024], [0.019 * eyeSize, 0.019 * eyeSize * openness, 0.019 * eyeSize]);
      } else localDraw(this.meshes.capsule, parent, ink, [0, 0, 0.022], [0.043 * eyeSize, 0.064 * eyeSize * openness, 0.043 * eyeSize]);
    }
    const activeIds = new Set(design.accessories.map(a => a.id));
    for (const id of this.lag.keys()) if (!activeIds.has(id)) this.lag.delete(id);
    for (const accessory of design.accessories) {
      const oldLag = this.lag.get(accessory.id) ?? [roll, 0];
      const lag = state.reduced ? [roll, 0] as [number, number] : spring(oldLag[0], oldLag[1], roll, state.delta, 11);
      this.lag.set(accessory.id, lag);
      const extra = pose.accessories[accessory.id] ?? [0, 0, 0];
      const rotation = accessory.rotation.map((v, i) => v + extra[i]!) as Vec3;
      if (accessory.anchor.region === 'crown') rotation[1] -= (lag[0] - roll) * accessory.follow;
      else rotation[2] += (lag[0] - roll) * accessory.follow;
      const anchor: Anchor = { ...accessory.anchor, uv: [...accessory.anchor.uv] };
      if (anchor.region === 'face') { anchor.uv[0] += pose.face[0]; anchor.uv[1] += pose.face[1]; }
      const parent = multiply(mount(anchor, rotation), transform([0, 0, 0], [0, 0, 0], [accessory.scale, accessory.scale, accessory.scale]));
      if (accessory.preset === 'beret') {
        localDraw(this.meshes.sphere, parent, accessory.color, [0.04, 0, 0.04], [0.37, 0.30, 0.10]);
        localDraw(this.meshes.sphere, parent, accessory.color, [0.06, 0, 0.15], [0.025, 0.025, 0.06]);
      } else if (accessory.preset === 'halo') {
        localDraw(this.meshes.halo, parent, accessory.color, [0, 0, 0], [0.34, 0.34, 0.34]);
      } else {
        const spacing = Math.sin(design.eyes.spacing / 2 * 1.05) * design.body.size[0] * 0.5;
        for (const side of [-1, 1]) localDraw(this.meshes.ring, parent, accessory.color, [side * spacing, 0, 0.10], [0.135, 0.14, 0.135]);
        localDraw(this.meshes.sphere, parent, accessory.color, [0, 0.01, 0.10], [Math.max(0.015, spacing - 0.11), 0.014, 0.014]);
      }
    }
    gl.bindVertexArray(null);
  }
  get stats(): { drawCalls: number; buffers: number } { return { drawCalls: this.drawCount, buffers: Object.keys(this.meshes).length * 2 }; }
  /** Call immediately after render; the drawing buffer need not be preserved between frames. */
  readPixels(): Uint8Array {
    const pixels = new Uint8Array(this.canvas.width * this.canvas.height * 4);
    this.gl.readPixels(0, 0, this.canvas.width, this.canvas.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
    return pixels;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const mesh of Object.values(this.meshes)) { this.gl.deleteBuffer(mesh.buffer); this.gl.deleteBuffer(mesh.index); this.gl.deleteVertexArray(mesh.vao); }
    this.gl.deleteProgram(this.program); this.lag.clear();
  }
}
