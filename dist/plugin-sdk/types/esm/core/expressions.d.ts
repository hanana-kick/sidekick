/** Public expression state contains animation weights only. Geometry is curated internally. */
export type EyeExpression = 'neutral' | 'smile' | 'blink';
export interface EyeShapeWeights {
    smile: number;
    blink: number;
}
export interface EyeState {
    weights: EyeShapeWeights;
}
export interface EyeStatePatch {
    weights?: Partial<EyeShapeWeights>;
}
/** Convenience input is converted immediately; canonical designs store only weights. */
export interface LegacyEyeState {
    expression: EyeExpression;
    openness: number;
}
export type LegacyEyeStatePatch = Partial<LegacyEyeState>;
export type EyeStateInputPatch = (EyeStatePatch & {
    expression?: never;
    openness?: never;
}) | (LegacyEyeStatePatch & {
    weights?: never;
});
export interface EyeExpressionPose {
    openness: number;
    smile: number;
}
export declare const EYE_EXPRESSIONS: readonly EyeExpression[];
export declare const EYE_STATE_RANGES: Readonly<{
    weights: Readonly<{
        smile: readonly [0, 1];
        blink: readonly [0, 1];
    }>;
}>;
export declare const EYE_STATE_DEFAULTS: Readonly<{
    weights: Readonly<{
        smile: 0;
        blink: 0;
    }>;
}>;
export declare function eyeExpressionWeights(expression: EyeExpression): EyeShapeWeights;
/** Validate a complete canonical state and return an isolated copy. */
export declare function parseEyeState(input: unknown, path?: string): EyeState;
export declare function migrateV4EyeState(input: unknown, path?: string): EyeState;
export declare function migrateV5EyeState(input: unknown, path?: string): EyeState;
export declare function migrateEyeState(input: unknown, path?: string): EyeState;
/** Atomic partial weight patch. Legacy selectors normalize once; mixed input rejects. */
export declare function patchEyeState(state: EyeState, patch: EyeStateInputPatch, path?: string): EyeState;
export declare function createEyeState(patch?: EyeStateInputPatch): EyeState;
export declare function expressionPose(state: EyeState | LegacyEyeState): EyeExpressionPose;
/** Short lid closure, gentler reopening, and an unhurried expression change. */
export declare function expressionDuration(expression: EyeExpression): number;
/** Idle blink: fast closure, a short closed beat, slower opening, all with zero endpoint velocity. */
export declare function automaticBlink(time: number): number;
/** Two closures constrain the same lid, rather than multiplying into a third blink. */
export declare function composeEyePose(pose: EyeExpressionPose, globalOpenness?: number, automaticOpenness?: number): EyeExpressionPose;
/**
 * Never begin an idle blink during a deliberate eye transition. An idle blink
 * already in progress is allowed to finish, so a new command cannot pop it open.
 * Each eye owns its latch, including a suppressed blink's entire reopen phase.
 */
export declare class EyeBlinkGate {
    private eyes;
    private lastTime?;
    reset(): void;
    sample(blink: number, motion?: {
        left: boolean;
        right: boolean;
    }, time?: number): {
        left: number;
        right: number;
    };
}
