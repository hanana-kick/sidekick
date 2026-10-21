import { resolveDesign } from './resolved-design.js';
import { identity } from './math.js';
import { projectEyes } from './eye-projection.js';
/** Current neutral fitted eye geometry: follows face motion, never gaze or expression weights. */
export function getAccessoryPluginEyeMeasurements(design, options = {}) {
    const squash = options.squash ?? 1, face = options.face ?? [0, 0];
    if (!Number.isFinite(squash) || squash < .25 || squash > 4 || face.length !== 2 || !face.every(value => Number.isFinite(value) && Math.abs(value) <= 16))
        throw new RangeError('Invalid neutral eye measurement pose.');
    const projected = projectEyes(resolveDesign(design), identity(), face, [0, 0], squash, options.contour, options.profile);
    return { left: [projected.left.localCenter[0], projected.left.localCenter[1]], right: [projected.right.localCenter[0], projected.right.localCenter[1]], size: [...projected.size] };
}
