import type { AvatarItem, AvatarRenderer, Channels, Primitive3D } from '../../types.js';
import { buildParts } from './parts.js';
import { getMesh, type Mesh } from './geometry.js';
import {
  fromTransform,
  identity,
  mat4,
  multiply,
  normalMatrix,
  perspective,
  type Mat4,
  type Vec3,
} from './math.js';

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat4 uNormalMatrix;
out vec3 vNormal;
out vec3 vWorldPos;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize((uNormalMatrix * vec4(aNormal, 0.0)).xyz);
  gl_Position = uProjection * uView * world;
}`;

const FRAG = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorldPos;
uniform vec3 uColor;
uniform vec3 uEmissive;
uniform float uOpacity;
out vec4 outColor;
void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(-vWorldPos);
  vec3 key = normalize(vec3(0.45, 0.75, 0.62));
  vec3 fill = normalize(vec3(-0.6, 0.15, 0.35));

  float lambert = max(dot(n, key), 0.0);
  float fillLight = max(dot(n, fill), 0.0) * 0.28;
  // Hemisphere ambient keeps the underside from going flat black.
  vec3 ambient = mix(vec3(0.16, 0.18, 0.24), vec3(0.42, 0.45, 0.52), n.y * 0.5 + 0.5);
  float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.6);

  vec3 color = uColor * (ambient + vec3(lambert * 0.85 + fillLight));
  color += vec3(0.75, 0.82, 1.0) * rim * 0.32;
  color += uEmissive;
  outColor = vec4(color, uOpacity);
}`;

interface GpuMesh {
  vao: WebGLVertexArrayObject;
  count: number;
}

/** Shared transform for every part: the avatar is one rigid group. */
function characterTransform(out: Mat4, ch: Channels): Mat4 {
  const squash = 1 + ch.breath;
  const stretch = 1 - ch.breath * 0.55;
  return fromTransform(
    out,
    [ch.sway * 0.55, ch.bob * 0.62, 0],
    [ch.roll * 0.5, ch.yaw, ch.tilt],
    [stretch * ch.scale, squash * ch.scale, stretch * ch.scale],
  );
}

export interface WebGL3DOptions {
  antialias?: boolean;
  /** Background clear colour; null keeps the canvas transparent. */
  clear?: [number, number, number, number] | null;
}

/**
 * Zero-dependency WebGL2 renderer for `AvatarItem`. Falls back to Canvas2D at
 * the engine level whenever WebGL2 is unavailable.
 */
/**
 * Browsers cap concurrent WebGL contexts (~16 in Chrome) and silently kill the oldest
 * one when exceeded. We keep a smaller budget so the engine can degrade to Canvas2D
 * instead of rendering blank avatars.
 */
export const MAX_WEBGL_CONTEXTS = 8;
let liveContexts = 0;

export function liveWebGLContexts(): number {
  return liveContexts;
}

export class WebGL3DRenderer implements AvatarRenderer {
  readonly mode = '3d' as const;
  #canvas: HTMLCanvasElement;
  #gl: WebGL2RenderingContext;
  #destroyed = false;
  #program: WebGLProgram;
  #uniforms: Record<string, WebGLUniformLocation | null> = {};
  #meshes = new Map<string, GpuMesh>();
  #width = 0;
  #height = 0;
  #clear: [number, number, number, number] | null;
  #projection = mat4();
  #view = mat4();
  #model = mat4();
  #normal = mat4();
  #group = mat4();
  #composed = mat4();

  static isSupported(): boolean {
    if (typeof document === 'undefined') return false;
    if (liveContexts >= MAX_WEBGL_CONTEXTS) return false;
    try {
      const probe = document.createElement('canvas');
      return !!probe.getContext('webgl2');
    } catch {
      return false;
    }
  }

  constructor(canvas: HTMLCanvasElement, options: WebGL3DOptions = {}) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: options.antialias ?? true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('WebGL2 is not available');
    liveContexts += 1;
    this.#canvas = canvas;
    this.#gl = gl;
    this.#clear = options.clear ?? null;

    const program = this.#createProgram(VERT, FRAG);
    this.#program = program;
    gl.useProgram(program);
    for (const name of [
      'uProjection',
      'uView',
      'uModel',
      'uNormalMatrix',
      'uColor',
      'uEmissive',
      'uOpacity',
    ]) {
      this.#uniforms[name] = gl.getUniformLocation(program, name);
    }

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    identity(this.#view);
    fromTransform(this.#view, [0, -0.12, -3.3], [0, 0, 0], [1, 1, 1]);
  }

  #createShader(type: number, source: string): WebGLShader {
    const gl = this.#gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Unable to create shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile failed: ${log}`);
    }
    return shader;
  }

  #createProgram(vs: string, fs: string): WebGLProgram {
    const gl = this.#gl;
    const program = gl.createProgram();
    if (!program) throw new Error('Unable to create program');
    const v = this.#createShader(gl.VERTEX_SHADER, vs);
    const f = this.#createShader(gl.FRAGMENT_SHADER, fs);
    gl.attachShader(program, v);
    gl.attachShader(program, f);
    gl.linkProgram(program);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link failed: ${log}`);
    }
    return program;
  }

  #upload(key: string, mesh: Mesh): GpuMesh {
    const gl = this.#gl;
    const existing = this.#meshes.get(key);
    if (existing) return existing;

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Unable to create VAO');
    gl.bindVertexArray(vao);

    const pos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pos);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.position, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    const norm = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, norm);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.normal, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    const idx = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
    const gpu: GpuMesh = { vao, count: mesh.index.length };
    this.#meshes.set(key, gpu);
    return gpu;
  }

  resize(width: number, height: number, dpr: number): void {
    this.#width = Math.max(1, Math.round(width));
    this.#height = Math.max(1, Math.round(height));
    const ratio = Math.max(1, Math.min(dpr, 2));
    this.#canvas.width = Math.round(this.#width * ratio);
    this.#canvas.height = Math.round(this.#height * ratio);
    this.#gl.viewport(0, 0, this.#canvas.width, this.#canvas.height);
  }

  render(item: AvatarItem, ch: Channels, _time: number): void {
    const gl = this.#gl;
    if (this.#width === 0) return;
    gl.useProgram(this.#program);

    if (this.#clear) {
      gl.clearColor(...this.#clear);
    } else {
      gl.clearColor(0, 0, 0, 0);
    }
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = this.#width / Math.max(1, this.#height);
    perspective(this.#projection, (35 * Math.PI) / 180, aspect, 0.1, 20);
    gl.uniformMatrix4fv(this.#uniforms.uProjection, false, this.#projection);
    gl.uniformMatrix4fv(this.#uniforms.uView, false, this.#view);

    characterTransform(this.#group, ch);

    const parts = buildParts(item, ch);
    // Opaque first (depth-correct), then blended parts far to near.
    const opaque = parts.filter((p) => (p.opacity ?? 1) >= 0.999);
    const blended = parts
      .filter((p) => (p.opacity ?? 1) < 0.999)
      .sort((a, b) => a.position[2] - b.position[2]);

    for (const part of [...opaque, ...blended]) {
      this.#drawPart(part);
    }
  }

  #drawPart(part: Primitive3D): void {
    const gl = this.#gl;
    const segments = part.segments ?? 16;
    const key = `${part.kind}:${segments}`;
    const mesh = getMesh(part.kind, segments);
    const gpu = this.#upload(key, mesh);

    fromTransform(this.#model, part.position as Vec3, part.rotation as Vec3, part.scale as Vec3);
    // Group * local: the local part transform is applied first.
    multiply(this.#composed, this.#group, this.#model);
    gl.uniformMatrix4fv(this.#uniforms.uModel, false, this.#composed);
    gl.uniformMatrix4fv(this.#uniforms.uNormalMatrix, false, normalMatrix(this.#normal, this.#composed));

    gl.uniform3fv(this.#uniforms.uColor, part.color);
    gl.uniform3fv(this.#uniforms.uEmissive, part.emissive ?? [0, 0, 0]);
    gl.uniform1f(this.#uniforms.uOpacity, part.opacity ?? 1);

    gl.bindVertexArray(gpu.vao);
    gl.drawElements(gl.TRIANGLES, gpu.count, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  get width(): number {
    return this.#width;
  }

  get height(): number {
    return this.#height;
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    liveContexts = Math.max(0, liveContexts - 1);
    const gl = this.#gl;
    for (const mesh of this.#meshes.values()) gl.deleteVertexArray(mesh.vao);
    this.#meshes.clear();
    gl.deleteProgram(this.#program);
    const lose = gl.getExtension('WEBGL_lose_context');
    lose?.loseContext();
  }
}
