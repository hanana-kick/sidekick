import type { ContourPoint } from '../core/contours.js';
export declare const orient: (a: ContourPoint, b: ContourPoint, c: ContourPoint) => number;
interface Triangle {
    ids: [number, number, number];
    neighbors: [number, number, number];
    live: boolean;
}
/**
 * Constrained Delaunay refinement. Only interior edges can flip or enter an
 * insertion cavity, so every outline segment survives and concavities stay
 * empty. Local adjacency walks/cavities avoid rescanning the growing mesh.
 */
export declare class VolumeTriangulation {
    readonly points: ContourPoint[];
    readonly triangles: Triangle[];
    private readonly edges;
    private readonly free;
    private readonly cavity;
    private readonly pending;
    private readonly cavityBoundary;
    private cursor;
    constructor(boundary: readonly ContourPoint[]);
    private key;
    private add;
    private remove;
    private locate;
    insert(point: ContourPoint): boolean;
}
export {};
