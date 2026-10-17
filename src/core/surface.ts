import type { Anchor, BodyDesign, Vec3 } from './design.js';
import { add, cross, dot, normalize, scale, sub, frameMatrix } from './math.js';
import type { Mat4 } from './math.js';
export interface SurfaceFrame { position: Vec3; normal: Vec3; tangent: Vec3; bitangent: Vec3; matrix: Mat4 }
/** Mesh vertices and attachment anchors must use this SAME deformation function. */
export function bodyPoint(body: BodyDesign, direction: Vec3, squash = 1): Vec3 {
  let [x, y, z] = normalize(direction);
  const exponent = body.shape === 'rounded-box' ? 2 + (1 - body.roundness) * 6 : 2;
  const radius = Math.pow(Math.abs(x) ** exponent + Math.abs(y) ** exponent + Math.abs(z) ** exponent, -1 / exponent);
  x *= radius; y *= radius; z *= radius;
  const width = (1 - body.taper * y) * (1 + body.bulge * Math.exp(-(((y + 0.2) / 0.55) ** 2))) * (body.shape === 'droplet' ? 0.9 - 0.32 * y : 1);
  const stretch = 1 / Math.sqrt(squash);
  return [(x * width + body.bend * y * y) * body.size[0] * 0.5 * stretch, y * body.size[1] * 0.5 * squash, z * width * body.size[2] * 0.5 * stretch];
}
export function bodyNormal(body: BodyDesign, direction: Vec3, squash = 1): Vec3 {
  const d = normalize(direction), helper: Vec3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = scale(normalize(cross(helper, d)), 0.0005), v = scale(normalize(cross(d, u)), 0.0005);
  const du = sub(bodyPoint(body, add(d, u), squash), bodyPoint(body, sub(d, u), squash));
  const dv = sub(bodyPoint(body, add(d, v), squash), bodyPoint(body, sub(d, v), squash));
  return normalize(cross(du, dv));
}
function directionAt(anchor: Anchor): Vec3 {
  const [u, v] = anchor.uv;
  const x = Math.sin(u * 1.05) * Math.cos(v * 0.9), y = Math.sin(v * 0.9), z = Math.cos(u * 1.05) * Math.cos(v * 0.9);
  if (anchor.region === 'crown') return [x, z, -y];
  if (anchor.region === 'left') return [-z, y, x];
  if (anchor.region === 'right') return [z, y, -x];
  return [x, y, z];
}
export function sampleSurface(body: BodyDesign, anchor: Anchor, squash = 1): SurfaceFrame {
  const direction = directionAt(anchor), normal = bodyNormal(body, direction, squash);
  const helper: Vec3 = anchor.region === 'crown' ? [0, 0, -1] : [0, 1, 0];
  let tangent = normalize(cross(helper, normal));
  if (Math.abs(dot(helper, normal)) > 0.99) tangent = normalize(cross([1, 0, 0], normal));
  const bitangent = normalize(cross(normal, tangent));
  const position = add(bodyPoint(body, direction, squash), scale(normal, anchor.offset));
  return { position, normal, tangent, bitangent, matrix: frameMatrix(position, tangent, bitangent, normal) };
}
