export interface Geometry {
    vertices: Float32Array;
    indices: Uint16Array;
}
export declare function sphere(longitudes?: number, latitudes?: number, capsule?: boolean): Geometry;
export declare function torus(tube?: number, arc?: number): Geometry;
