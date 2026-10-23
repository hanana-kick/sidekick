export interface Geometry {
    vertices: Float32Array;
    indices: Uint16Array;
    /** Optional neutral position/normal chart for eye ink on a skinned body. */
    faceVertices?: Float32Array;
}
export declare function sphere(longitudes?: number, latitudes?: number, capsule?: boolean): Geometry;
export declare function torus(tube?: number, arc?: number): Geometry;
