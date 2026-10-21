/** Trusted local module, loaded once by an application-owned registry. */
export default {
  apiVersion: 1,
  id: 'example/badge',
  slots: ['mouth'],
  createMesh() {
    // Origin is the body attachment; +Z points away from the surface.
    // Counter-clockwise triangles, interleaved position + unit normal.
    return {
      vertices: new Float32Array([
        -.12, -.08, .015, 0, 0, 1,
         .12, -.08, .015, 0, 0, 1,
         .12,  .08, .015, 0, 0, 1,
        -.12,  .08, .015, 0, 0, 1,
      ]),
      indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
    };
  },
};
