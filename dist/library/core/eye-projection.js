import { clamp, normalize } from './math.js';
import { resolveShapeEyeGeometry, resolveShapeProfile } from './shape-profiles.js';
import { shapeContour, contourSignedDistance } from './contours.js';
import { containsRectangleWithMargin } from './contour-rectangle.js';
import { sampleSurfaceAtXY, BODY_SIZE } from './surface.js';
// The plane inverse is diagnostic only. Surface-local shader coordinates never
// invert this matrix, so partial eyes can remain visible across a curved limb.
const MIN_FRONT_AREA = 0.015;
const fittingCache = new WeakMap();
/** Orthographic camera coordinates; +Z points toward the camera. */
export function viewPoint(matrix, point, vector = false) {
    return [0, 1, 2].map(row => matrix[row] * point[0] + matrix[4 + row] * point[1] + matrix[8 + row] * point[2] + (vector ? 0 : matrix[12 + row]));
}
/**
 * Orthographic projection of the stable body front-plane frame. Keep both raw
 * columns: normalizing them or making them perpendicular would billboard the
 * glyph, erasing yaw/pitch foreshortening and combined-rotation shear.
 * `root` includes the animated pose and authored body rotations, but not local body squash.
 */
export function eyeBasis(root) {
    const right = viewPoint(root, [1, 0, 0], true), up = viewPoint(root, [0, 1, 0], true);
    return [right[0], right[1], up[0], up[1]];
}
/** Centers follow the rounded surface; the renderer evaluates glyphs in local XY. */
export function projectEyes(design, root, face = [0, 0], gaze = [0, 0], squash = 1, contour, profile) {
    const displayedProfile = profile ?? resolveShapeProfile(design.body.shape);
    const eye = { ...design.eyes, ...resolveShapeEyeGeometry(design.eyes, displayedProfile) };
    const basis = eyeBasis(root), [rx, ry, ux, uy] = basis;
    const determinant = rx * uy - ry * ux;
    const frontFacing = determinant > MIN_FRONT_AREA;
    // Keep finite diagnostic inverse rows; they no longer control glyph rendering.
    const inverseBasis = frontFacing ? [uy / determinant, -ux / determinant, -ry / determinant, rx / determinant] : [0, 0, 0, 0];
    const u = clamp(eye.anchor.uv[0], -1.35 + eye.spacing / 2, 1.35 - eye.spacing / 2);
    const v = clamp(eye.anchor.uv[1], -1.35, 1.35);
    const unit = Math.min(BODY_SIZE[0], BODY_SIZE[1]) * 0.5 * eye.scale;
    const size = [eye.width * unit, eye.height * unit];
    const outline = contour ?? shapeContour({ kind: 'material', name: design.body.shape });
    const original = [-1, 1].map(side => {
        const uv = [u + side * eye.spacing / 2, v], alpha = uv[0] * 1.05, beta = uv[1] * .9;
        return { uv, x: Math.tan(alpha), y: Math.tan(beta) / Math.cos(alpha) };
    });
    // Reserve the whole reachable shape-key envelope, independent of the current
    // weights or camera. A left smile/blink cannot slide the right eye. Targets
    // remain editable, but never shrink/warp the glyph to fit a concave outline.
    const stretch = 1 / Math.sqrt(squash), width = eye.width * eye.scale, height = eye.height * eye.scale, glyphUnit = Math.min(width, height);
    const envelopes = [eye.left, eye.right].map(state => {
        const { smile, blink } = state.targets;
        const smileExtent = width * smile.radius + glyphUnit * smile.thickness / 2;
        const halfWidth = Math.max(width / 2, smileExtent);
        const bottom = -Math.max(height, glyphUnit * smile.thickness, glyphUnit * blink.thickness) / 2;
        const top = Math.max(height / 2, smileExtent, glyphUnit * blink.thickness / 2);
        return { halfWidth, bottom, top };
    });
    // Leave a rounded-surface shoulder between a glyph and a deep notch. A tiny
    // alpha-only margin fits the frontal outline but places ink on steep lobe
    // walls, stretching it sideways as the volume turns.
    const shoulder = Math.max(.1, ...envelopes.map(envelope => envelope.halfWidth * 1.25));
    const fits = (amount) => original.every((center, index) => {
        const envelope = envelopes[index];
        return containsRectangleWithMargin(outline, center.x * amount, center.y * amount, envelope.halfWidth / stretch, envelope.bottom / squash, envelope.top / squash, shoulder);
    });
    // Camera and expression weights do not affect fitting. Reuse the same result
    // while orbiting or blinking; moving faces and live morphs remain exact.
    let contourFits = fittingCache.get(outline);
    if (!contourFits) {
        contourFits = new Map();
        fittingCache.set(outline, contourFits);
    }
    const fittingKey = JSON.stringify([u, v, squash, eye.spacing, width, height, eye.left.targets, eye.right.targets]);
    let fit = contourFits.get(fittingKey);
    if (fit === undefined) {
        fit = 1;
        if (!fits(1) && fits(0)) {
            let low = 0, high = 1;
            // Find the first boundary of the central valid interval, rather than jumping
            // across a concave notch to a disconnected lobe.
            for (let i = 1; i <= 40; i++) {
                const amount = i / 40;
                if (!fits(amount)) {
                    high = amount;
                    break;
                }
                low = amount;
            }
            for (let i = 0; i < 12; i++) {
                const mid = (low + high) / 2;
                if (fits(mid))
                    low = mid;
                else
                    high = mid;
            }
            const separation = Math.hypot(original[1].x - original[0].x, original[1].y - original[0].y);
            const minimum = Math.min(1, (envelopes[0].halfWidth + envelopes[1].halfWidth + .02) / stretch / Math.max(1e-6, separation));
            fit = Math.max(minimum, low);
        }
        if (contourFits.size >= 32)
            contourFits.clear();
        contourFits.set(fittingKey, fit);
    }
    // Fit the neutral pair once, then translate it as a single unit. Re-fitting
    // the angular targets toward the origin makes the outer eye stop while the
    // inner eye keeps moving, collapsing the spacing on concave shapes.
    const targetU = clamp(u + face[0] + clamp(gaze[0], -1, 1) * .1, -1.35 + eye.spacing / 2, 1.35 - eye.spacing / 2);
    const targetV = clamp(v + face[1] + clamp(gaze[1], -1, 1) * .1, -1.35, 1.35);
    const dx = Math.tan(targetU * 1.05) - Math.tan(u * 1.05);
    const dy = Math.tan(targetV * .9) / Math.cos(targetU * 1.05) - Math.tan(v * .9) / Math.cos(u * 1.05);
    // The neutral shoulder reserves travel. Gaze may use that space, but keeps
    // the entire smile/blink envelope inside the surface with a small margin.
    const travelFits = (amount) => original.every((center, index) => {
        const envelope = envelopes[index];
        return containsRectangleWithMargin(outline, center.x * fit + dx * amount, center.y * fit + dy * amount, envelope.halfWidth / stretch, envelope.bottom / squash, envelope.top / squash, .015);
    });
    const travelKey = `travel:${fittingKey}:${dx}:${dy}`;
    let travel = contourFits.get(travelKey);
    if (travel === undefined) {
        travel = 1;
        if (dx !== 0 || dy !== 0) {
            if (!travelFits(0))
                travel = 0;
            else {
                // Stop at the first boundary: never jump across a notch into another lobe.
                let low = 0, high = 1;
                for (let i = 1; i <= 12; i++) {
                    const amount = i / 12;
                    if (!travelFits(amount)) {
                        high = amount;
                        break;
                    }
                    low = amount;
                }
                if (low < 1)
                    for (let i = 0; i < 12; i++) {
                        const mid = (low + high) / 2;
                        if (travelFits(mid))
                            low = mid;
                        else
                            high = mid;
                    }
                travel = low;
            }
        }
        if (contourFits.size >= 64)
            contourFits.clear();
        contourFits.set(travelKey, travel);
    }
    const one = (side) => {
        const originalEye = original[side < 0 ? 0 : 1];
        const raw = [originalEye.x * fit + dx * travel, originalEye.y * fit + dy * travel, 1];
        const direction = normalize(raw);
        const frame = sampleSurfaceAtXY(design.body, raw[0], raw[1], squash, outline, displayedProfile);
        // Readback of the actual curved surface. Rendering uses this stable local XY
        // chart and lets triangle depth clip partial eyes, never a binary center gate.
        return { center: viewPoint(root, frame.position), localCenter: frame.position, direction, visible: contourSignedDistance(outline, raw[0], raw[1]) > 0 && viewPoint(root, frame.normal, true)[2] > MIN_FRONT_AREA };
    };
    const largestFootprint = Math.max(size[1], ...envelopes.map(envelope => envelope.halfWidth * unit * 2 / eye.scale));
    return { left: one(-1), right: one(1), size, basis, inverseBasis, depthRange: Math.max(...size, largestFootprint) * 1.8 };
}
/**
 * Diagnostic: reject a projected center hidden by another part of the body.
 * The renderer intentionally does not use this binary center visibility test;
 * body-local fragment ownership and the depth buffer clip partial eyes instead.
 * Uses the rendered mesh itself, so a star lobe cannot receive a hidden eye.
 * A tiny tolerance covers the exact analytic anchor versus tessellated surface.
 */
export function clipOccludedEyes(eyes, root, vertices, indices) {
    const active = [eyes.left, eyes.right].filter(eye => eye.visible);
    if (!active.length)
        return;
    const projected = new Float32Array(vertices.length / 2);
    for (let i = 0; i < vertices.length; i += 6)
        projected.set(viewPoint(root, [vertices[i], vertices[i + 1], vertices[i + 2]]), i / 2);
    for (const eye of active) {
        let nearest = -Infinity;
        const [x, y] = eye.center;
        for (let i = 0; i < indices.length; i += 3) {
            const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
            const ax = projected[a], ay = projected[a + 1], bx = projected[b], by = projected[b + 1], cx = projected[c], cy = projected[c + 1];
            const determinant = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
            // Back-facing and degenerate triangles do not contribute to the body depth pass.
            if (determinant <= 1e-12)
                continue;
            const wa = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / determinant;
            const wb = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / determinant;
            const wc = 1 - wa - wb;
            if (wa >= -1e-5 && wb >= -1e-5 && wc >= -1e-5)
                nearest = Math.max(nearest, wa * projected[a + 2] + wb * projected[b + 2] + wc * projected[c + 2]);
        }
        const tolerance = Math.max(0.003, Math.max(...eyes.size) * 0.035);
        if (nearest > eye.center[2] + tolerance)
            eye.visible = false;
    }
}
