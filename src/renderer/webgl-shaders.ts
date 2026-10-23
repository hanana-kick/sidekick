export const vertexSource = `#version 300 es
precision highp float;
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
layout(location=2) in vec2 facePosition;
layout(location=3) in float frontCap;
uniform mat4 model;
uniform mat4 projection;
uniform vec2 faceScale;
out float vFrontCap;
out vec2 vFacePosition;
void main() {
  vFrontCap = frontCap;
  vFacePosition = facePosition * faceScale;
  gl_Position = projection * model * vec4(position, 1.0);
}`;
export const fragmentSource = `#version 300 es
precision highp float;
in float vFrontCap;
in vec2 vFacePosition;
uniform vec3 color;
uniform float opacity;
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
  if (!eyesOn) { outColor = vec4(color * opacity, opacity); return; }
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
