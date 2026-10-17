export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function normalize(v) { const length = Math.hypot(...v); return length > 1e-12 ? scale(v, 1 / length) : [0, 0, 1]; }
export function identity() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
export function multiply(a, b) {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++)
        for (let row = 0; row < 4; row++) {
            out[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
        }
    return out;
}
export function transform(position = [0, 0, 0], rotation = [0, 0, 0], size = [1, 1, 1]) {
    const [x, y, z] = rotation;
    const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
    const rx = new Float32Array([1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1]);
    const ry = new Float32Array([cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]);
    const rz = new Float32Array([cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const m = multiply(multiply(rz, ry), rx);
    for (let i = 0; i < 12; i++)
        m[i] = m[i] * size[Math.floor(i / 4)];
    m[12] = position[0];
    m[13] = position[1];
    m[14] = position[2];
    return m;
}
export function frameMatrix(position, tangent, bitangent, normal) {
    return new Float32Array([...tangent, 0, ...bitangent, 0, ...normal, 0, ...position, 1]);
}
export function orthographic(width, height) {
    return new Float32Array([2 / width, 0, 0, 0, 0, 2 / height, 0, 0, 0, 0, -2 / 20, 0, 0, -0.14 / height, 0, 1]);
}
/** Exact critically damped spring integration for a fixed target. */
export function spring(current, velocity, target, dt, omega = 14) {
    const offset = current - target, e = Math.exp(-omega * dt), t = (velocity + omega * offset) * dt;
    return [target + (offset + t) * e, (velocity - omega * t) * e];
}
