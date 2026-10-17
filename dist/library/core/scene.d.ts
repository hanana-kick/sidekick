import type { Activity, AvatarDesign } from './design.js';
import type { CameraAngles } from './camera.js';
import type { MotionTarget } from './motion.js';
import type { TrackingMode } from './tracking.js';
export declare const MAX_SCENE_BYTES = 65536;
export interface SidekickScene {
    sceneVersion: 2;
    design: AvatarDesign;
    camera: CameraAngles;
    activity: Activity;
    paused: boolean;
    trackingMode: TrackingMode;
    interaction: 'none' | 'box';
    renderStyle: 'flat';
    gaze: {
        x: number;
        y: number;
    };
    time: number;
    motion: MotionTarget;
    shapeDuration: number;
    shapeEasing: 'smooth' | 'linear';
    motionDuration: number;
    motionEasing: 'smooth' | 'linear';
}
export type SceneInput = Partial<Omit<SidekickScene, 'sceneVersion' | 'camera' | 'gaze'>> & {
    /** Legacy eyes-only input; an explicit trackingMode takes precedence. */
    mouseTracking?: boolean;
    camera?: Partial<CameraAngles>;
    gaze?: Partial<SidekickScene['gaze']>;
};
/** Strict pure validation: no element, storage or active animation is touched. */
export declare function parseScene(input: unknown): SidekickScene;
/** Complete a scene with runtime defaults; geometry remains solely in the design contract. */
export declare function createScene(input?: SceneInput): SidekickScene;
export interface SceneMigration {
    scene: SidekickScene;
    warnings: string[];
    legacyDesign: boolean;
}
/** Accept a versioned scene or an existing v1–v7 design file. */
export declare function migrateScene(input: unknown): SceneMigration;
export declare function serializeScene(scene: SidekickScene): string;
