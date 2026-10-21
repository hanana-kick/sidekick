import type { Vec3 } from './design.cjs';
export declare const clamp: (v: number, min: number, max: number) => number;
export declare const add: (a: Vec3, b: Vec3) => Vec3;
export declare const sub: (a: Vec3, b: Vec3) => Vec3;
export declare const scale: (a: Vec3, k: number) => Vec3;
export declare const dot: (a: Vec3, b: Vec3) => number;
export declare const cross: (a: Vec3, b: Vec3) => Vec3;
export declare function normalize(v: Vec3): Vec3;
export type Mat4 = Float32Array;
export declare function identity(): Mat4;
export declare function multiply(a: Mat4, b: Mat4): Mat4;
export declare function transform(position?: Vec3, rotation?: Vec3, size?: Vec3): Mat4;
export declare function frameMatrix(position: Vec3, tangent: Vec3, bitangent: Vec3, normal: Vec3): Mat4;
export declare function orthographic(width: number, height: number): Mat4;
/** Exact critically damped spring integration for a fixed target. */
export declare function spring(current: number, velocity: number, target: number, dt: number, omega?: number): [number, number];
