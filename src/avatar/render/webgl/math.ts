/** Minimal column-major 4x4 matrix / vec3 helpers (WebGL conventions). */

export type Mat4 = Float32Array;
export type Vec3 = [number, number, number];

export function mat4(): Mat4 {
  const m = new Float32Array(16);
  m[0] = 1;
  m[5] = 1;
  m[10] = 1;
  m[15] = 1;
  return m;
}

export function identity(out: Mat4): Mat4 {
  out.fill(0);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}

export function multiply(out: Mat4, a: Mat4, b: Mat4): Mat4 {
  const a00 = a[0],
    a01 = a[1],
    a02 = a[2],
    a03 = a[3];
  const a10 = a[4],
    a11 = a[5],
    a12 = a[6],
    a13 = a[7];
  const a20 = a[8],
    a21 = a[9],
    a22 = a[10],
    a23 = a[11];
  const a30 = a[12],
    a31 = a[13],
    a32 = a[14],
    a33 = a[15];
  for (let i = 0; i < 4; i += 1) {
    const b0 = b[i * 4];
    const b1 = b[i * 4 + 1];
    const b2 = b[i * 4 + 2];
    const b3 = b[i * 4 + 3];
    out[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  }
  return out;
}

/** R = Rz * Ry * Rx, then scale, then translate (Euler XYZ in radians). */
export function fromTransform(out: Mat4, position: Vec3, rotation: Vec3, scale: Vec3): Mat4 {
  const [sx, sy, sz] = scale;
  const cx = Math.cos(rotation[0]);
  const snx = Math.sin(rotation[0]);
  const cy = Math.cos(rotation[1]);
  const sny = Math.sin(rotation[1]);
  const cz = Math.cos(rotation[2]);
  const snz = Math.sin(rotation[2]);

  const m00 = cz * cy;
  const m01 = cz * sny * snx - snz * cx;
  const m02 = cz * sny * cx + snz * snx;
  const m10 = snz * cy;
  const m11 = snz * sny * snx + cz * cx;
  const m12 = snz * sny * cx - cz * snx;
  const m20 = -sny;
  const m21 = cy * snx;
  const m22 = cy * cx;

  out[0] = m00 * sx;
  out[1] = m01 * sx;
  out[2] = m02 * sx;
  out[3] = 0;
  out[4] = m10 * sy;
  out[5] = m11 * sy;
  out[6] = m12 * sy;
  out[7] = 0;
  out[8] = m20 * sz;
  out[9] = m21 * sz;
  out[10] = m22 * sz;
  out[11] = 0;
  out[12] = position[0];
  out[13] = position[1];
  out[14] = position[2];
  out[15] = 1;
  return out;
}

export function perspective(out: Mat4, fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

/** Inverse-transpose of the upper-left 3x3, expanded to a mat4 for lighting. */
export function normalMatrix(out: Mat4, m: Mat4): Mat4 {
  const a00 = m[0],
    a01 = m[1],
    a02 = m[2];
  const a10 = m[4],
    a11 = m[5],
    a12 = m[6];
  const a20 = m[8],
    a21 = m[9],
    a22 = m[10];
  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;
  let det = a00 * b01 + a01 * b11 + a02 * b21;
  out.fill(0);
  if (Math.abs(det) < 1e-12) {
    out[0] = 1;
    out[5] = 1;
    out[10] = 1;
    return out;
  }
  det = 1 / det;
  out[0] = b01 * det;
  out[1] = (-a22 * a01 + a02 * a21) * det;
  out[2] = (a12 * a01 - a02 * a11) * det;
  out[4] = b11 * det;
  out[5] = (a22 * a00 - a02 * a20) * det;
  out[6] = (-a12 * a00 + a02 * a10) * det;
  out[8] = b21 * det;
  out[9] = (-a21 * a00 + a01 * a20) * det;
  out[10] = (a11 * a00 - a01 * a10) * det;
  return out;
}

export function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}
