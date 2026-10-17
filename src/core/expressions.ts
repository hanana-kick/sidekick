/** Public expression state contains animation weights only. Geometry is curated internally. */
export type EyeExpression = 'neutral' | 'smile' | 'blink';
export interface EyeShapeWeights { smile: number; blink: number }
export interface EyeState { weights: EyeShapeWeights }
export interface EyeStatePatch { weights?: Partial<EyeShapeWeights> }
/** Convenience input is converted immediately; canonical designs store only weights. */
export interface LegacyEyeState { expression: EyeExpression; openness: number }
export type LegacyEyeStatePatch = Partial<LegacyEyeState>;
export type EyeStateInputPatch =
  | (EyeStatePatch & { expression?: never; openness?: never })
  | (LegacyEyeStatePatch & { weights?: never });
export interface EyeExpressionPose { openness: number; smile: number }
export const EYE_EXPRESSIONS: readonly EyeExpression[] = Object.freeze(['neutral', 'smile', 'blink']);
export const EYE_STATE_RANGES = Object.freeze({
  weights: Object.freeze({ smile: Object.freeze([0, 1] as const), blink: Object.freeze([0, 1] as const) }),
});
export const EYE_STATE_DEFAULTS = Object.freeze({ weights: Object.freeze({ smile: 0, blink: 0 }) });

function eyeRecord(value: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path}: 객체가 필요합니다.`);
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path}: 일반 객체가 필요합니다.`);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !keys.includes(key)) throw new TypeError(`${path}.${String(key)}: 지원하지 않는 항목입니다.`);
    const field = Object.getOwnPropertyDescriptor(value, key)!;
    if (!field.enumerable || !Object.hasOwn(field, 'value')) throw new TypeError(`${path}.${key}: 일반 데이터 항목이 필요합니다.`);
  }
  return value as Record<string, unknown>;
}
function eyeNumber(value: unknown, range: readonly [number, number], path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < range[0] || value > range[1]) throw new RangeError(`${path}: ${range[0]}~${range[1]}의 유한한 숫자가 필요합니다.`);
  return value;
}
function eyeExpression(value: unknown, path: string): EyeExpression {
  if (typeof value !== 'string' || !EYE_EXPRESSIONS.includes(value as EyeExpression)) throw new TypeError(`${path}: neutral, smile, blink 중 하나여야 합니다.`);
  return value as EyeExpression;
}
export function eyeExpressionWeights(expression: EyeExpression): EyeShapeWeights {
  const preset = eyeExpression(expression, 'expression');
  return { smile: preset === 'smile' ? 1 : 0, blink: preset === 'blink' ? 1 : 0 };
}
/** Validate a complete canonical state and return an isolated copy. */
export function parseEyeState(input: unknown, path = 'eye'): EyeState {
  const state = eyeRecord(input, path, ['weights']);
  const weights = eyeRecord(state.weights, `${path}.weights`, ['smile', 'blink']);
  return { weights: {
    smile: eyeNumber(weights.smile, EYE_STATE_RANGES.weights.smile, `${path}.weights.smile`),
    blink: eyeNumber(weights.blink, EYE_STATE_RANGES.weights.blink, `${path}.weights.blink`),
  } };
}
/** Import-only validation: discarded geometry must still be well-formed. */
function migrateTargetEyeState(input: unknown, version: 4 | 5, path: string): EyeState {
  const state = eyeRecord(input, path, ['weights', 'targets']);
  const targets = eyeRecord(state.targets, `${path}.targets`, ['smile', 'blink']);
  const smile = eyeRecord(targets.smile, `${path}.targets.smile`, version === 4 ? ['width', 'arc', 'thickness'] : ['radius', 'thickness']);
  const blink = eyeRecord(targets.blink, `${path}.targets.blink`, ['thickness']);
  if (version === 4) {
    eyeNumber(smile.width, [1, 2.5], `${path}.targets.smile.width`);
    eyeNumber(smile.arc, [0.1, 0.65], `${path}.targets.smile.arc`);
  } else eyeNumber(smile.radius, [0.25, 1.25], `${path}.targets.smile.radius`);
  eyeNumber(smile.thickness, [0.1, 0.5], `${path}.targets.smile.thickness`);
  eyeNumber(blink.thickness, [0.05, 0.25], `${path}.targets.blink.thickness`);
  return parseEyeState({ weights: state.weights }, path);
}
export function migrateV4EyeState(input: unknown, path = 'eye'): EyeState { return migrateTargetEyeState(input, 4, path); }
export function migrateV5EyeState(input: unknown, path = 'eye'): EyeState { return migrateTargetEyeState(input, 5, path); }
export function migrateEyeState(input: unknown, path = 'eye'): EyeState {
  const state = eyeRecord(input, path, ['expression', 'openness']);
  const expression = eyeExpression(state.expression, `${path}.expression`);
  const openness = eyeNumber(state.openness, EYE_STATE_RANGES.weights.blink, `${path}.openness`);
  return createEyeState({ weights: { smile: expression === 'smile' ? 1 : 0, blink: expression === 'blink' ? 1 : 1 - openness } });
}
/** Atomic partial weight patch. Legacy selectors normalize once; mixed input rejects. */
export function patchEyeState(state: EyeState, patch: EyeStateInputPatch, path = 'eye'): EyeState {
  const current = parseEyeState(state, path);
  const change = eyeRecord(patch, path, ['weights', 'expression', 'openness']);
  const legacy = Object.hasOwn(change, 'expression') || Object.hasOwn(change, 'openness');
  if (legacy) {
    if (Object.hasOwn(change, 'weights')) throw new TypeError(`${path}: expression/openness와 weights를 함께 사용할 수 없습니다.`);
    if (Object.hasOwn(change, 'expression')) current.weights = eyeExpressionWeights(eyeExpression(change.expression, `${path}.expression`));
    if (Object.hasOwn(change, 'openness')) {
      const openness = eyeNumber(change.openness, EYE_STATE_RANGES.weights.blink, `${path}.openness`);
      current.weights.blink = change.expression === 'blink' ? 1 : 1 - openness;
    }
    return current;
  }
  if (Object.hasOwn(change, 'weights')) {
    current.weights = { ...current.weights, ...eyeRecord(change.weights, `${path}.weights`, ['smile', 'blink']) } as EyeShapeWeights;
  }
  return parseEyeState(current, path);
}
export function createEyeState(patch: EyeStateInputPatch = {}): EyeState { return patchEyeState(EYE_STATE_DEFAULTS, patch); }
export function expressionPose(state: EyeState | LegacyEyeState): EyeExpressionPose {
  const value = eyeRecord(state, 'eye', ['weights', 'expression', 'openness']);
  if (Object.hasOwn(value, 'expression') || Object.hasOwn(value, 'openness')) {
    const canonical = migrateEyeState(state);
    return { openness: value.expression === 'blink' ? 0 : value.openness as number, smile: canonical.weights.smile };
  }
  const canonical = parseEyeState(state);
  return { openness: 1 - canonical.weights.blink, smile: canonical.weights.smile };
}

/** Short lid closure, gentler reopening, and an unhurried expression change. */
export function expressionDuration(expression: EyeExpression): number {
  return expression === 'blink' ? 90 : expression === 'neutral' ? 180 : 280;
}

const bounded = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => { const t = bounded(value); return t * t * (3 - 2 * t); };

/** Idle blink: fast closure, a short closed beat, slower opening, all with zero endpoint velocity. */
export function automaticBlink(time: number): number {
  const phase = ((time % 4.6) + 4.6) % 4.6 - 4.35;
  if (phase <= 0) return 1;
  if (phase < 0.075) return 1 - smooth(phase / 0.075);
  if (phase < 0.11) return 0;
  return smooth((phase - 0.11) / 0.14);
}

/** Two closures constrain the same lid, rather than multiplying into a third blink. */
export function composeEyePose(pose: EyeExpressionPose, globalOpenness = 1, automaticOpenness = 1): EyeExpressionPose {
  return { openness: Math.min(bounded(pose.openness * globalOpenness), bounded(automaticOpenness)), smile: bounded(pose.smile) };
}

/**
 * Never begin an idle blink during a deliberate eye transition. An idle blink
 * already in progress is allowed to finish, so a new command cannot pop it open.
 * Each eye owns its latch, including a suppressed blink's entire reopen phase.
 */
export class EyeBlinkGate {
  private eyes = { left: { running: false, suppressed: false }, right: { running: false, suppressed: false } };
  private lastTime?: number;
  reset(): void {
    this.lastTime = undefined;
    for (const eye of Object.values(this.eyes)) { eye.running = false; eye.suppressed = false; }
  }
  sample(blink: number, motion: { left: boolean; right: boolean } = { left: false, right: false }, time?: number): { left: number; right: number } {
    if (time !== undefined) {
      if (this.lastTime !== undefined && (time < this.lastTime || Math.floor(time / 4.6) !== Math.floor(this.lastTime / 4.6))) this.reset();
      this.lastTime = time;
    }
    const amount = bounded(blink), result = { left: 1, right: 1 };
    for (const side of ['left', 'right'] as const) {
      const eye = this.eyes[side];
      if (amount >= 1) { eye.running = false; eye.suppressed = false; }
      else {
        if (motion[side] && !eye.running) eye.suppressed = true;
        if (!eye.suppressed) { eye.running = true; result[side] = amount; }
      }
    }
    return result;
  }
}
