import { resolveDesign } from '../core/resolved-design.js';
import { cameraViewMatrix, createCamera } from '../core/camera.js';
import { activityFrame } from '../core/motion.js';
import { EyeBlinkGate, composeEyePose } from '../core/expressions.js';
import { clamp, multiply, orthographic, spring, transform } from '../core/math.js';
import { deformBodyPoint, sampleAccessorySurface, BODY_SIZE } from '../core/surface.js';
import { BODY_DEPTH_RANGE, MOUNT_OFFSET_RANGE, accessoryMountProfile, resolveShapeProfile } from '../core/shape-profiles.js';
import { torus } from './geometry.js';
import { projectEyes } from './eye-projection.js';
import { glassesGeometry } from './glasses-geometry.js';
import { beretGeometry, beretBandColor } from './beret-geometry.js';
import { catalogAccessoryGeometry, accessoryDetailColor, CATALOG_ACCESSORY_EXTENT } from './catalog-accessory-geometry.js';
import { bodyGeometry } from './body-geometry.js';
import { shapeContour } from '../core/contours.js';
const vertexSource = `#version 300 es
precision highp float;
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
uniform mat4 model;
uniform mat4 projection;
uniform vec2 faceScale;
out float vFrontCap;
out vec2 vFacePosition;
void main() {
  vFrontCap = normal.z;
  vFacePosition = position.xy * faceScale;
  gl_Position = projection * model * vec4(position, 1.0);
}`;
const fragmentSource = `#version 300 es
precision highp float;
in float vFrontCap;
in vec2 vFacePosition;
uniform vec3 color;
uniform bool eyesOn;
uniform vec3 eyeColor;
uniform vec4 eyeCenters;
uniform vec2 eyeSize;
uniform vec4 eyeStates;
uniform vec4 eyeLeftTargets;
uniform vec4 eyeRightTargets;
out vec4 outColor;
float capsuleDistance(vec2 p, vec2 size) {
  vec2 halfSize = size * 0.5;
  float radius = min(halfSize.x, halfSize.y);
  vec2 q = abs(p) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}
// Exact distance to a circular arc with half-span s and sagitta s*curvature.
// Scale the circle construction by curvature, and rationalize length-radius:
// this avoids catastrophic cancellation in the nearly straight (curvature=0)
// limit. The angular test restricts the nearest point to the arc; otherwise the
// nearest endpoint supplies a genuinely round cap. curvature=1 is a semicircle.
float curveDistance(vec2 p, float halfSpan, float curvature) {
  float x = abs(p.x);
  if (halfSpan <= 0.0) return length(p);
  float bend = clamp(curvature, 0.0, 1.0);
  float offset = halfSpan * (1.0 - bend * bend) * 0.5;
  float scaledY = bend * p.y + offset;
  if (scaledY * halfSpan < x * offset)
    return length(vec2(x - halfSpan, p.y));
  float scaledRadius = halfSpan * (1.0 + bend * bend) * 0.5;
  float denominator = length(vec2(bend * x, scaledY)) + scaledRadius;
  float numerator = bend * (x * x + p.y * p.y - halfSpan * halfSpan) + 2.0 * p.y * offset;
  return abs(numerator / denominator);
}
float eyeDistance(vec2 p, float openness, float smile, vec4 targets) {
  float open = clamp(openness, 0.0, 1.0);
  float happy = clamp(smile, 0.0, 1.0);
  float unit = min(eyeSize.x, eyeSize.y);
  float closedHeight = unit * targets.w;
  float smileHeight = unit * targets.z;
  float openHeight = mix(eyeSize.y, smileHeight, happy);
  float height = mix(closedHeight, openHeight, open);
  float smileWidth = 2.0 * eyeSize.x * targets.x + smileHeight;
  float width = mix(eyeSize.x, smileWidth, happy * open);
  float radius = min(width, height) * 0.5;
  float halfSpan = max(width - height, 0.0) * 0.5;
  // The neutral capsule compresses to a circle before a horizontal arc grows.
  // Both span and sagitta vanish together there, so there is no topology pop.
  // Full smile: halfSpan=eyeSize.x*targets.x and sagitta=halfSpan, independent
  // of neutral height. Full blink: the original thin horizontal capsule,
  // identical at every smile weight. No eye/body animation clocks are involved.
  if (halfSpan <= 0.0) return capsuleDistance(p, vec2(width, height));
  return curveDistance(p, halfSpan, happy * open) - radius;
}
void main() {
  // Uniform per draw: accessories need no curve solves or ink derivatives.
  if (!eyesOn) { outColor = vec4(color, 1.0); return; }
  // Stable body-local surface chart: regular glyphs do not inherit contour
  // deformations. Curved triangles themselves provide tilt, foreshortening and
  // partial occlusion, rather than a screen billboard or binary center test.
  float leftDistance = eyeDistance(vFacePosition - eyeCenters.xy, eyeStates.x, eyeStates.y, eyeLeftTargets);
  float rightDistance = eyeDistance(vFacePosition - eyeCenters.zw, eyeStates.z, eyeStates.w, eyeRightTargets);
  // Independent derivatives prevent one eye's expression from changing the other's AA.
  // Bound the footprint at grazing projected edges to avoid distant ink bleed.
  float maxAA = min(eyeSize.x, eyeSize.y) * 0.2;
  float leftAA = clamp(fwidth(leftDistance), 0.0001, maxAA);
  float rightAA = clamp(fwidth(rightDistance), 0.0001, maxAA);
  float leftInk = 1.0 - smoothstep(-leftAA, leftAA, leftDistance);
  float rightInk = 1.0 - smoothstep(-rightAA, rightAA, rightDistance);
  // Only the front sheet receives ink. The depth buffer hides occluded pieces
  // naturally; the back sheet cannot inherit eyes even when it fills the frame.
  float mask = max(leftInk, rightInk) * step(0.00001, vFrontCap);
  vec3 albedo = mix(color, eyeColor, mask);
  outColor = vec4(albedo, 1.0);
}`;
/** Dependency-free WebGL2 backend. No DOM outside the supplied canvas is owned here. */
export class AvatarRenderer {
    canvas;
    gl;
    program;
    uniforms;
    meshes;
    beretContour;
    beretKey = '';
    beretBandIndexCount = 0;
    glassesContour;
    glassesKey = '';
    catalogMeshes = new Map();
    bodyDirections;
    bodyContour;
    bodyDeformation = '';
    lag = new Map();
    disposed = false;
    drawCount = 0;
    blinkGate = new EyeBlinkGate();
    framingKey = '';
    frameSpan = 2.4;
    displayAspect;
    inputSignature = '';
    resolvedInput;
    constructor(canvas) {
        this.canvas = canvas;
        const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'low-power' });
        if (!gl)
            throw new Error('WebGL2를 사용할 수 없습니다. 브라우저의 하드웨어 가속 설정을 확인하세요.');
        this.gl = gl;
        const compile = (type, source) => {
            const shader = gl.createShader(type);
            if (!shader)
                throw new Error('셰이더를 생성하지 못했습니다.');
            try {
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
                    throw new Error(gl.getShaderInfoLog(shader) ?? '셰이더 컴파일 오류');
                return shader;
            }
            catch (error) {
                gl.deleteShader(shader);
                throw error;
            }
        };
        let vertex, fragment, program = null;
        const uploaded = [];
        try {
            vertex = compile(gl.VERTEX_SHADER, vertexSource);
            fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
            program = gl.createProgram();
            if (!program)
                throw new Error('WebGL 프로그램을 생성하지 못했습니다.');
            gl.attachShader(program, vertex);
            gl.attachShader(program, fragment);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS))
                throw new Error(gl.getProgramInfoLog(program) ?? '프로그램 연결 오류');
            this.program = program;
            const uniform = (name) => { const location = gl.getUniformLocation(program, name); if (!location)
                throw new Error(`uniform ${name} 없음`); return location; };
            this.uniforms = { model: uniform('model'), projection: uniform('projection'), color: uniform('color'), eyesOn: uniform('eyesOn'), eyeColor: uniform('eyeColor'), eyeCenters: uniform('eyeCenters'), eyeSize: uniform('eyeSize'), eyeStates: uniform('eyeStates'), eyeLeftTargets: uniform('eyeLeftTargets'), eyeRightTargets: uniform('eyeRightTargets'), faceScale: uniform('faceScale') };
            const upload = (data) => { const mesh = this.upload(data); uploaded.push(mesh); return mesh; };
            // The first render uploads the requested body; prebuilding a square here
            // would duplicate both CPU triangulation and GPU uploads on every startup.
            this.meshes = { body: upload({ vertices: new Float32Array(0), indices: new Uint16Array(0) }), beret: upload({ vertices: new Float32Array(0), indices: new Uint16Array(0) }), glasses: upload({ vertices: new Float32Array(0), indices: new Uint16Array(0) }), halo: upload(torus(0.055)) };
            this.bodyDirections = new Float32Array(0);
            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.BACK);
            gl.clearColor(0, 0, 0, 0);
        }
        catch (error) {
            // A failed constructor has no owner able to call dispose(). Roll back
            // every completed mesh as well as the program; upload handles its partial mesh.
            for (const mesh of uploaded)
                this.deleteMesh(mesh);
            if (program)
                gl.deleteProgram(program);
            throw error;
        }
        finally {
            if (vertex)
                gl.deleteShader(vertex);
            if (fragment)
                gl.deleteShader(fragment);
        }
    }
    upload(data) {
        const gl = this.gl;
        let vao = null, buffer = null, index = null;
        try {
            vao = gl.createVertexArray();
            buffer = gl.createBuffer();
            index = gl.createBuffer();
            if (!vao || !buffer || !index)
                throw new Error('GPU 버퍼를 생성하지 못했습니다.');
            gl.bindVertexArray(vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
            gl.bindVertexArray(null);
            return { vao, buffer, index, count: data.indices.length, data };
        }
        catch (error) {
            gl.bindVertexArray(null);
            if (buffer)
                gl.deleteBuffer(buffer);
            if (index)
                gl.deleteBuffer(index);
            if (vao)
                gl.deleteVertexArray(vao);
            throw error;
        }
    }
    resize(width, height, dpr = 1) {
        const ratio = clamp(dpr, 1, 2);
        const cssWidth = Math.max(1, width), cssHeight = Math.max(1, height);
        // Cap both axes with one scale. Independent caps stretch large wide/tall hosts.
        const scale = Math.min(ratio, 2048 / Math.max(cssWidth, cssHeight));
        const w = Math.max(1, Math.round(cssWidth * scale)), h = Math.max(1, Math.round(cssHeight * scale));
        // Use the displayed aspect, so backing-pixel rounding cannot deform the body.
        this.displayAspect = cssWidth / cssHeight;
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
    }
    draw(mesh, model, hex, count = mesh.count, indexOffset = 0) {
        const gl = this.gl, value = parseInt(hex.slice(1), 16);
        gl.uniformMatrix4fv(this.uniforms.model, false, model);
        gl.uniform3f(this.uniforms.color, ((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
        gl.bindVertexArray(mesh.vao);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, indexOffset * Uint16Array.BYTES_PER_ELEMENT);
        this.drawCount++;
    }
    render(input, state) {
        if (this.disposed || this.gl.isContextLost())
            return;
        // Direct renderer consumers may edit the same design object between frames.
        const signature = JSON.stringify(input);
        if (signature !== this.inputSignature) {
            this.resolvedInput = resolveDesign(input);
            this.inputSignature = signature;
        }
        const design = this.resolvedInput;
        const gl = this.gl, { pose } = state, activity = activityFrame(state.activity, state.time, state.reduced);
        const roll = pose.rotation[2] + activity.roll;
        const camera = createCamera(state.camera ?? { yaw: (state.view?.[0] ?? 0) * 180 / Math.PI, pitch: (state.view?.[1] ?? 0) * 180 / Math.PI, roll: 0 });
        // View orientation is independent of the body's animated local pose. Matrix
        // composition preserves combined yaw/pitch/roll, unlike adding Euler angles.
        const model = transform([0, activity.bob, 0], [pose.rotation[0], pose.rotation[1], roll]);
        const root = multiply(cameraViewMatrix(camera), model);
        const aspect = this.displayAspect ?? this.canvas.width / this.canvas.height;
        const contour = state.contour ?? shapeContour({ kind: 'material', name: design.body.shape });
        const profile = state.profile ?? resolveShapeProfile(design.body.shape);
        if (contour !== this.bodyContour) {
            const data = bodyGeometry(contour), body = this.meshes.body;
            // Reuse the same GPU resources; transition snapshots can have different topology.
            body.data = { vertices: data.vertices.slice(), indices: data.indices };
            body.count = data.indices.length;
            this.bodyDirections = data.vertices;
            // Upload the final positions once; the old path uploaded canonical positions
            // then immediately replaced them and also uploaded an unused direction attribute.
            for (let i = 0; i < this.bodyDirections.length; i += 6) {
                const d = [this.bodyDirections[i], this.bodyDirections[i + 1], this.bodyDirections[i + 2]];
                body.data.vertices.set(deformBodyPoint(design.body, d, 1, profile), i);
            }
            gl.bindVertexArray(body.vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, body.buffer);
            gl.bufferData(gl.ARRAY_BUFFER, body.data.vertices, gl.DYNAMIC_DRAW);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, body.index);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.DYNAMIC_DRAW);
            gl.bindVertexArray(null);
            this.bodyContour = contour;
            this.bodyDeformation = String(profile.depth);
        }
        // Shape-independent envelope: selecting/retargeting a contour cannot pump zoom.
        const framingKey = JSON.stringify(design.accessories);
        if (framingKey !== this.framingKey) {
            const radius = Math.hypot(BODY_SIZE[0] * 0.5 / Math.sqrt(0.88), BODY_SIZE[1] * 0.56, BODY_DEPTH_RANGE[1] * 0.5 / Math.sqrt(0.88));
            const accessory = Math.max(0, ...design.accessories.map(a => a.anchor.offset + MOUNT_OFFSET_RANGE[1] + (CATALOG_ACCESSORY_EXTENT[a.preset] ?? .43) * a.scale));
            this.frameSpan = Math.max(Math.max(...BODY_SIZE) * 1.25 + 0.9, (radius + accessory) * 2 + 0.34);
            this.framingKey = framingKey;
        }
        const span = this.frameSpan / camera.zoom;
        const height = span * Math.max(1, 1 / aspect), width = height * aspect;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.uniforms.projection, false, orthographic(width, height));
        this.drawCount = 0;
        const body = this.meshes.body;
        const deformation = String(profile.depth);
        if (this.bodyDeformation !== deformation) {
            for (let i = 0; i < this.bodyDirections.length; i += 6) {
                const d = [this.bodyDirections[i], this.bodyDirections[i + 1], this.bodyDirections[i + 2]];
                body.data.vertices.set(deformBodyPoint(design.body, d, 1, profile), i);
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, body.buffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, body.data.vertices);
            this.bodyDeformation = deformation;
        }
        // Squash is exactly the same diagonal scale used by bodyPoint. Applying it
        // in the draw matrix avoids regenerating thousands of contour normals/frame.
        const stretch = 1 / Math.sqrt(activity.squash);
        const bodyRoot = multiply(root, transform([0, 0, 0], [0, 0, 0], [stretch, activity.squash, stretch]));
        // Eye ink is evaluated in the body pass: it has zero depth and cannot alter alpha coverage.
        const eyes = projectEyes(design, root, pose.face, [pose.gaze[0] + activity.gaze[0], pose.gaze[1] + activity.gaze[1]], activity.squash, contour, profile);
        gl.uniform1i(this.uniforms.eyesOn, 1);
        const ink = parseInt(design.eyes.color.slice(1), 16);
        gl.uniform3f(this.uniforms.eyeColor, ((ink >> 16) & 255) / 255, ((ink >> 8) & 255) / 255, (ink & 255) / 255);
        gl.uniform4f(this.uniforms.eyeCenters, eyes.left.localCenter[0], eyes.left.localCenter[1], eyes.right.localCenter[0], eyes.right.localCenter[1]);
        gl.uniform2f(this.uniforms.eyeSize, ...eyes.size);
        gl.uniform2f(this.uniforms.faceScale, stretch, activity.squash);
        const blink = this.blinkGate.sample(activity.blink, state.eyeMotion, state.time);
        const leftPose = composeEyePose(pose.eyes.left, pose.openness, blink.left);
        const rightPose = composeEyePose(pose.eyes.right, pose.openness, blink.right);
        gl.uniform4f(this.uniforms.eyeStates, leftPose.openness, leftPose.smile, rightPose.openness, rightPose.smile);
        const leftTargets = design.eyes.left.targets, rightTargets = design.eyes.right.targets;
        gl.uniform4f(this.uniforms.eyeLeftTargets, leftTargets.smile.radius, 0, leftTargets.smile.thickness, leftTargets.blink.thickness);
        gl.uniform4f(this.uniforms.eyeRightTargets, rightTargets.smile.radius, 0, rightTargets.smile.thickness, rightTargets.blink.thickness);
        this.draw(body, bodyRoot, design.body.color);
        gl.uniform1i(this.uniforms.eyesOn, 0);
        const localDraw = (mesh, parent, color, position, size, rotation = [0, 0, 0]) => this.draw(mesh, multiply(parent, transform(position, rotation, size)), color);
        const activeIds = new Set(design.accessories.map(a => a.id));
        for (const id of this.lag.keys())
            if (!activeIds.has(id))
                this.lag.delete(id);
        const activeSlots = new Set(design.accessories.map(a => a.slot));
        for (const [slot, cached] of this.catalogMeshes)
            if (!activeSlots.has(slot)) {
                this.deleteMesh(cached.mesh);
                this.catalogMeshes.delete(slot);
            }
        for (const accessory of design.accessories) {
            const oldLag = this.lag.get(accessory.id) ?? [roll, 0];
            const lag = state.reduced ? [roll, 0] : spring(oldLag[0], oldLag[1], roll, state.delta, 11);
            this.lag.set(accessory.id, lag);
            const extra = pose.accessories[accessory.id] ?? [0, 0, 0];
            const rotation = accessory.rotation.map((v, i) => v + extra[i]);
            if (accessory.anchor.region === 'crown') {
                if (accessory.preset !== 'beret')
                    rotation[1] -= (lag[0] - roll) * accessory.follow;
            }
            else
                rotation[2] += (lag[0] - roll) * accessory.follow;
            if (accessory.preset === 'glasses' || accessory.preset === 'sunglasses') {
                // Equipment follows the fitted neutral eye layout and face motion. Gaze
                // stays inside the lenses; camera/weights never rebuild the frame mesh.
                const frameEyes = projectEyes(design, root, pose.face, [0, 0], activity.squash, contour, profile);
                const key = JSON.stringify([accessory.preset, frameEyes.left.localCenter, frameEyes.right.localCenter, frameEyes.size, activity.squash, profile.depth, accessoryMountProfile(accessory, profile), accessory.anchor, accessory.scale, rotation]);
                const mesh = this.meshes.glasses;
                if (this.glassesContour !== contour || this.glassesKey !== key) {
                    const data = glassesGeometry(design, accessory, frameEyes, activity.squash, contour, profile, rotation);
                    gl.bindVertexArray(mesh.vao);
                    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
                    if (mesh.data.vertices.length === data.vertices.length)
                        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.vertices);
                    else
                        gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.DYNAMIC_DRAW);
                    if (mesh.data.indices.length !== data.indices.length) {
                        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
                        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
                    }
                    mesh.data = data;
                    mesh.count = data.indices.length;
                    this.glassesContour = contour;
                    this.glassesKey = key;
                }
                const data = mesh.data;
                this.draw(mesh, root, accessory.color, data.frameIndexCount);
                if (data.fillIndexCount)
                    this.draw(mesh, root, accessoryDetailColor(accessoryDetailColor(accessory.color)), data.fillIndexCount, data.frameIndexCount);
                continue;
            }
            if (accessory.preset === 'moustache' || accessory.preset === 'goatee' || accessory.preset === 'bowTie' || accessory.preset === 'scarf' || accessory.preset === 'necklace' || accessory.preset === 'earring' || accessory.preset === 'starEarring') {
                const key = JSON.stringify([accessory.preset, accessory.slot, activity.squash, profile.depth, accessoryMountProfile(accessory, profile), accessory.scale, rotation]);
                let cached = this.catalogMeshes.get(accessory.slot);
                if (!cached || cached.contour !== contour || cached.key !== key) {
                    const data = catalogAccessoryGeometry(design.body, accessory, activity.squash, contour, profile, rotation);
                    if (!cached) {
                        cached = { mesh: this.upload(data), contour, key, mainIndexCount: data.mainIndexCount, detailIndexCount: data.detailIndexCount };
                        this.catalogMeshes.set(accessory.slot, cached);
                    }
                    else {
                        const mesh = cached.mesh;
                        gl.bindVertexArray(mesh.vao);
                        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
                        if (mesh.data.vertices.length === data.vertices.length)
                            gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.vertices);
                        else
                            gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.DYNAMIC_DRAW);
                        if (mesh.data.indices.length !== data.indices.length) {
                            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
                            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
                        }
                        mesh.data = data;
                        mesh.count = data.indices.length;
                        Object.assign(cached, { contour, key, mainIndexCount: data.mainIndexCount, detailIndexCount: data.detailIndexCount });
                    }
                }
                this.draw(cached.mesh, root, accessory.color, cached.mainIndexCount);
                if (cached.detailIndexCount)
                    this.draw(cached.mesh, root, accessoryDetailColor(accessory.color), cached.detailIndexCount, cached.mainIndexCount);
                continue;
            }
            const frame = sampleAccessorySurface(design.body, accessory, activity.squash, contour, profile);
            const mounted = multiply(multiply(root, frame.matrix), transform([0, 0, 0], rotation));
            const parent = multiply(mounted, transform([0, 0, 0], [0, 0, 0], Array(3).fill(accessory.scale * accessoryMountProfile(accessory, profile).scale)));
            if (accessory.preset === 'beret' || accessory.preset === 'crown') {
                const key = JSON.stringify([accessory.preset, activity.squash, profile.depth, profile.beretFitTilt, profile.beretFitCenter, accessoryMountProfile(accessory, profile), accessory.scale, rotation]);
                const mesh = this.meshes.beret;
                if (this.beretContour !== contour || this.beretKey !== key) {
                    const data = beretGeometry(design.body, accessory, activity.squash, contour, profile, rotation);
                    gl.bindVertexArray(mesh.vao);
                    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
                    if (mesh.data.vertices.length === data.vertices.length)
                        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.vertices);
                    else
                        gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.DYNAMIC_DRAW);
                    if (mesh.data.indices !== data.indices) {
                        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
                        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
                    }
                    mesh.data = data;
                    mesh.count = data.indices.length;
                    this.beretBandIndexCount = data.bandIndexCount;
                    this.beretContour = contour;
                    this.beretKey = key;
                }
                this.draw(mesh, root, beretBandColor(accessory.color), this.beretBandIndexCount);
                this.draw(mesh, root, accessory.color, mesh.count - this.beretBandIndexCount, this.beretBandIndexCount);
            }
            else if (accessory.preset === 'halo') {
                localDraw(this.meshes.halo, parent, accessory.color, [0, 0, 0], [0.34, 0.34, 0.34]);
            }
        }
        gl.bindVertexArray(null);
    }
    get stats() { return { drawCalls: this.drawCount, buffers: [...Object.values(this.meshes), ...Array.from(this.catalogMeshes.values(), item => item.mesh)].reduce(count => count + 2, 0) }; }
    /** Call immediately after render; the drawing buffer need not be preserved between frames. */
    readPixels() {
        const pixels = new Uint8Array(this.canvas.width * this.canvas.height * 4);
        this.gl.readPixels(0, 0, this.canvas.width, this.canvas.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
        return pixels;
    }
    deleteMesh(mesh) {
        this.gl.deleteBuffer(mesh.buffer);
        this.gl.deleteBuffer(mesh.index);
        this.gl.deleteVertexArray(mesh.vao);
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        for (const mesh of Object.values(this.meshes))
            this.deleteMesh(mesh);
        for (const cached of this.catalogMeshes.values())
            this.deleteMesh(cached.mesh);
        this.catalogMeshes.clear();
        this.gl.deleteProgram(this.program);
        this.lag.clear();
    }
}
