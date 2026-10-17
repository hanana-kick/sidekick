export * from './core/design.js';
export * from './core/motion.js';
export * from './core/camera.js';
export { SidekickAvatar, defineSidekick } from './element/avatar.js';
import { defineSidekick } from './element/avatar.js';
defineSidekick();

export { EYE_EXPRESSIONS, EYE_STATE_DEFAULTS, EYE_STATE_RANGES, createEyeState, parseEyeState, patchEyeState, eyeExpressionWeights } from './core/expressions.js';
export type { EyeExpression, EyeShapeWeights, EyeState, EyeStatePatch, EyeStateInputPatch } from './core/expressions.js';

export type { ShapeMotionOptions, ShapeMotionResult } from './core/shape-motion.js';

export { MATERIAL_SHAPE_LABELS } from './core/shapes.js';
