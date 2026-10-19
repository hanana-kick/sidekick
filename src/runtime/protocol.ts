import type { EmotionValue } from '../core/emotion.js';
import type { TravelPresentation } from '../core/travel.js';
import type { Activity, AvatarDesign, Vec2 } from '../core/design.js';
import type { BodyOrientation } from '../core/body-orientation.js';
import type { MotionOptions, MotionResult, MotionTarget, Pose } from '../core/motion.js';
import type { ShapeMotionOptions } from '../core/shape-motion.js';
import type { MaterialShapeName } from '../core/shapes.js';
import type { TrackingMode } from '../core/tracking.js';
import type { PixelBuffer, SnapshotOptions } from '../core/pixels.js';

/** Private wire format. A generation owns exactly one transferred surface. */
export const PROTOCOL_VERSION = 1;
export interface RuntimeState {
  emotion?: EmotionValue;
  /** Semantic target attention suppresses unrelated activity eye wandering. */
  attention?: boolean;
  design: AvatarDesign; bodyOrientation: BodyOrientation; zoom: number; pose: Pose; activity: Activity;
  paused: boolean; reduced: boolean; active: boolean; time: number;
  travel?: TravelPresentation;
  gaze: Vec2; trackingMode: TrackingMode; trackedGaze?: Vec2;
  width: number; height: number; dpr: number;
}
export interface DesignTransition { equipmentImmediate?: boolean; shape: ShapeMotionOptions; eyes: MotionOptions; eyeSides?: readonly ('left' | 'right')[] }
export type RuntimeCommand =
  | { kind: 'batch'; commands: RuntimeCommand[] }
  | { kind: 'design'; design: AvatarDesign; transition?: DesignTransition; shapeRequest?: number; eyeRequest?: number }
  | { kind: 'motion'; target: MotionTarget; options: MotionOptions; request: number }
  | { kind: 'shape'; shape: MaterialShapeName; options: ShapeMotionOptions; request: number }
  | { kind: 'persist-design'; design: AvatarDesign }
  | { kind: 'cancel' }
  | { kind: 'cancel-assets'; shape: boolean; expression: boolean }
  | { kind: 'state'; state: Partial<Omit<RuntimeState, 'design' | 'pose' | 'width' | 'height' | 'dpr'>> }
  | { kind: 'resize'; width: number; height: number; dpr: number }
  | { kind: 'reset-tracking' }
  | { kind: 'flush'; request: number }
  | { kind: 'capture'; request: number }
  | { kind: 'snapshot'; request: number; options: SnapshotOptions }
  | { kind: 'dispose' };
export interface RuntimeSnapshot {
  travel?: TravelPresentation;
  renderCpu: { lastMs: number; totalMs: number; maxMs: number };
  pose: Pose; time: number; renderedRotation: Pose['rotation']; frames: number; running: boolean; drawCalls: number; buffers: number; width: number; height: number;
}
export type RuntimeEvent =
  | { kind: 'frame'; snapshot: RuntimeSnapshot }
  | { kind: 'complete'; request: number; result: MotionResult; snapshot: RuntimeSnapshot }
  | { kind: 'pixels'; request: number; image: PixelBuffer; snapshot: RuntimeSnapshot }
  | { kind: 'snapshot'; request: number; blob: Blob; snapshot: RuntimeSnapshot }
  | { kind: 'request-error'; request: number; message: string }
  | { kind: 'error'; message: string };
export type WorkerRequest = { version: typeof PROTOCOL_VERSION; generation: number; sequence: number } & (
  | { kind: 'init'; canvas: OffscreenCanvas; state: RuntimeState }
  | { kind: 'command'; command: RuntimeCommand }
);
export type WorkerResponse = { version: typeof PROTOCOL_VERSION; generation: number; sequence: number } & (
  | { kind: 'ready'; snapshot: RuntimeSnapshot }
  | RuntimeEvent
);
