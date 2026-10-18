/** Framework-free, DOM-independent design and motion API. */
export * from './core/design.js';
export * from './core/motion.js';
export * from './core/body-orientation.js';
export { ZOOM_RANGE, createZoom } from './core/zoom.js';
export { EYE_EXPRESSIONS, EYE_STATE_DEFAULTS, EYE_STATE_RANGES, createEyeState, parseEyeState, patchEyeState, eyeExpressionWeights } from './core/expressions.js';
export type { EyeExpression, EyeShapeWeights, EyeState, EyeStatePatch, EyeStateInputPatch } from './core/expressions.js';
export type { ShapeMotionOptions, ShapeMotionResult } from './core/shape-motion.js';
export { MATERIAL_SHAPE_LABELS } from './core/shapes.js';
export { alphaBounds, cropPixels } from './core/pixels.js';
export type { PixelBuffer, AlphaBounds, SnapshotOptions } from './core/pixels.js';
export { MAX_SCENE_BYTES, createScene, parseScene, serializeScene, migrateScene } from './core/scene.js';
export type { SidekickScene, SceneInput, SceneMigration } from './core/scene.js';
export { TRACKING_MODES } from './core/tracking.js';
export type { TrackingMode } from './core/tracking.js';
