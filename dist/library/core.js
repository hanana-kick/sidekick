/** Framework-free, DOM-independent design and motion API. */
export * from './core/design.js';
export * from './core/motion.js';
export * from './core/camera.js';
export { EYE_EXPRESSIONS, EYE_STATE_DEFAULTS, EYE_STATE_RANGES, createEyeState, parseEyeState, patchEyeState, eyeExpressionWeights } from './core/expressions.js';
export { MATERIAL_SHAPE_LABELS } from './core/shapes.js';
export { alphaBounds, cropPixels } from './core/pixels.js';
export { MAX_SCENE_BYTES, createScene, parseScene, serializeScene, migrateScene } from './core/scene.js';
export { TRACKING_MODES } from './core/tracking.js';
