// Positive-area overlap of coplanar triangles, projected along the dominant normal.
export function coplanarOverlap(a, b) {
  const u = a[1].map((v, i) => v - a[0][i]), v = a[2].map((value, i) => value - a[0][i]);
  const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const length = Math.hypot(...normal);
  if (length < 1e-12) return 0;
  if (b.some(p => Math.abs(p.reduce((sum, x, i) => sum + (x - a[0][i]) * normal[i], 0)) / length > 1e-8)) return 0;
  const axis = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
  const project = p => p.filter((_, j) => j !== axis), A = a.map(project), B = b.map(project);
  const side = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const sign = Math.sign(side(B[0], B[1], B[2]));
  let polygon = A;
  for (let i = 0; i < 3 && polygon.length; i++) {
    const q = B[i], r = B[(i + 1) % 3], next = [];
    for (let j = 0; j < polygon.length; j++) {
      const p = polygon[j], t = polygon[(j + 1) % polygon.length], d = sign * side(q, r, p), e = sign * side(q, r, t);
      if (d >= 0) next.push(p);
      if ((d >= 0) !== (e >= 0)) {
        const fraction = d / (d - e);
        next.push([p[0] + fraction * (t[0] - p[0]), p[1] + fraction * (t[1] - p[1])]);
      }
    }
    polygon = next;
  }
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    area += p[0] * q[1] - p[1] * q[0];
  }
  return Math.abs(area) * .5 * length / Math.abs(normal[axis]);
}
