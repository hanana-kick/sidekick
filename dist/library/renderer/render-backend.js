import { vertexSource, fragmentSource } from './webgl-shaders.js';
import { SoftwareRasterizer } from './software-rasterizer.js';
/** The acquired WebGL canvas cannot be rebound to 2D; its owner must replace it. */
export class RendererInitializationError extends Error {
    constructor(cause) { super(cause instanceof Error ? cause.message : String(cause), { cause }); this.name = 'RendererInitializationError'; }
}
export function createBackend(canvas, options) {
    if (options.renderer !== 'canvas2d') {
        let gl;
        try {
            gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'low-power' });
        }
        catch {
            gl = null;
        }
        if (gl) {
            try {
                return new WebGLBackend(canvas, gl);
            }
            catch (error) {
                throw new RendererInitializationError(error);
            }
        }
    }
    return new CanvasBackend(canvas, options.renderer !== 'canvas2d');
}
class WebGLBackend {
    canvas;
    gl;
    kind = 'webgl2';
    maxDimension = 2048;
    program;
    uniforms = {};
    meshes = new Map();
    get lost() { return this.gl.isContextLost(); }
    constructor(canvas, gl) {
        this.canvas = canvas;
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
            for (const name of ['opacity', 'model', 'projection', 'color', 'eyesOn', 'eyeColor', 'eyeCenters', 'eyeSize', 'eyeStates', 'eyeLeftTargets', 'eyeRightTargets', 'faceScale']) {
                const location = gl.getUniformLocation(program, name);
                if (!location)
                    throw new Error(`uniform ${name} 없음`);
                this.uniforms[name] = location;
            }
            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.BACK);
            gl.clearColor(0, 0, 0, 0);
        }
        catch (error) {
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
            const mesh = { count: data.indices.length, data };
            this.meshes.set(mesh, { vao, buffer, index });
            return mesh;
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
    update(mesh, data, indices, reuseVertices) {
        const gpu = this.meshes.get(mesh), gl = this.gl;
        gl.bindVertexArray(gpu.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, gpu.buffer);
        if (reuseVertices)
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.vertices);
        else
            gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.DYNAMIC_DRAW);
        if (indices) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gpu.index);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
        }
        gl.bindVertexArray(null);
    }
    begin(projection) {
        const gl = this.gl;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.uniforms.projection, false, projection);
    }
    eyes(eyes) {
        const gl = this.gl, u = this.uniforms;
        gl.uniform1i(u.eyesOn, eyes ? 1 : 0);
        if (!eyes)
            return;
        gl.uniform3f(u.eyeColor, eyes.color[0], eyes.color[1], eyes.color[2]);
        gl.uniform4f(u.eyeCenters, eyes.centers[0], eyes.centers[1], eyes.centers[2], eyes.centers[3]);
        gl.uniform2f(u.eyeSize, eyes.size[0], eyes.size[1]);
        gl.uniform2f(u.faceScale, eyes.faceScale[0], eyes.faceScale[1]);
        for (const [key, values] of [['eyeStates', eyes.states], ['eyeLeftTargets', eyes.leftTargets], ['eyeRightTargets', eyes.rightTargets]])
            gl.uniform4f(u[key], values[0], values[1], values[2], values[3]);
    }
    opacity(value) { const gl = this.gl; if (value < 1) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    else
        gl.disable(gl.BLEND); gl.uniform1f(this.uniforms.opacity, value); }
    draw(mesh, model, hex, count, indexOffset) {
        const gl = this.gl, value = parseInt(hex.slice(1), 16);
        gl.uniformMatrix4fv(this.uniforms.model, false, model);
        gl.uniform3f(this.uniforms.color, ((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
        gl.bindVertexArray(this.meshes.get(mesh).vao);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, indexOffset * Uint16Array.BYTES_PER_ELEMENT);
    }
    end() { this.gl.disable(this.gl.BLEND); this.gl.bindVertexArray(null); }
    readPixels() { const pixels = new Uint8Array(this.canvas.width * this.canvas.height * 4); this.gl.readPixels(0, 0, this.canvas.width, this.canvas.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels); return pixels; }
    deleteMesh(mesh) { const gpu = this.meshes.get(mesh); if (!gpu)
        return; this.gl.deleteBuffer(gpu.buffer); this.gl.deleteBuffer(gpu.index); this.gl.deleteVertexArray(gpu.vao); this.meshes.delete(mesh); }
    dispose() { for (const mesh of this.meshes.keys())
        this.deleteMesh(mesh); this.gl.deleteProgram(this.program); }
    initializationError(cause) { return new RendererInitializationError(cause); }
}
class CanvasBackend {
    canvas;
    kind = 'canvas2d';
    // Bounded CPU work even for fullscreen/high-DPR hosts. CSS/world scale is unchanged.
    maxDimension = 384;
    lost = false;
    context;
    rasterizer = new SoftwareRasterizer();
    projection;
    eyeState;
    alpha = 1;
    image;
    constructor(canvas, webglAttempted) {
        this.canvas = canvas;
        const context = canvas.getContext('2d', { alpha: true });
        if (!context)
            throw new Error(webglAttempted ? 'WebGL2 및 Canvas 2D 렌더링을 사용할 수 없습니다.' : 'Canvas 2D 렌더링을 사용할 수 없습니다.');
        this.context = context;
    }
    upload(data) { return { data, count: data.indices.length }; }
    update(_mesh, _data, _indices, _reuseVertices) { }
    deleteMesh(_mesh) { }
    begin(projection) { this.projection = projection; this.rasterizer.clear(this.canvas.width, this.canvas.height); }
    eyes(eyes) { this.eyeState = eyes; }
    opacity(value) { this.alpha = value; }
    draw(mesh, model, color, count, indexOffset) { this.rasterizer.draw(mesh.data, model, this.projection, color, count, indexOffset, this.alpha, this.eyeState); }
    end() {
        if (!this.image || this.image.width !== this.canvas.width || this.image.height !== this.canvas.height)
            this.image = this.context.createImageData(this.canvas.width, this.canvas.height);
        this.image.data.set(this.rasterizer.pixels);
        this.context.putImageData(this.image, 0, 0);
    }
    readPixels() { return this.rasterizer.readPixels(); }
    dispose() { this.image = undefined; this.rasterizer.dispose(); }
    initializationError(cause) { return cause instanceof Error ? cause : new Error(String(cause)); }
}
