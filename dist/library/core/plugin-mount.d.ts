import type { BodyDesign, Vec3 } from './design.js';
import type { AccessoryPluginMaterial, AccessoryPluginMount, PluginAccessoryAsset, AccessoryPluginGeometry } from './accessory-plugins.js';
import type { ShapeContour } from './contours.js';
import type { ShapeWeights } from './plugin-attachment.js';
export { resolveAccessoryPluginMount } from './plugin-attachment.js';
import type { AccessoryPluginEyeMeasurements } from './plugin-deformation.js';
import type { SurfaceFrame } from './surface.js';
import type { Mat4 } from './math.js';
export interface AccessoryPluginFitOptions {
    contour?: ShapeContour;
    depth?: number;
    squash?: number;
    shapeWeights?: ShapeWeights;
    eyes?: AccessoryPluginEyeMeasurements;
    /** Authored local pose rotation, applied before the rigid clearance solve. */
    rotation?: Vec3;
}
export interface AccessoryPluginFit {
    /** Body-local draw matrix; apply body orientation/movement exactly once after it. */
    matrix: Mat4;
    frame: SurfaceFrame;
    mount: AccessoryPluginMount;
    seating: number;
    /** Present only for derived geometry; positions are body-local and matrix is identity. */
    geometry?: AccessoryPluginGeometry;
}
/** Solid material resolution shared by every backend. */
export declare function accessoryPluginMaterialColor(color: string, material?: AccessoryPluginMaterial): string;
/** Renderer-owned fit cache. Author buffers stay immutable; only changed derived meshes upload. */
export declare class AccessoryPluginFitter {
    private readonly asset;
    private readonly points;
    private readonly indices;
    private readonly composedIndices;
    private readonly connectors;
    private readonly parts?;
    private contour?;
    private weights?;
    private key;
    private result?;
    constructor(asset: PluginAccessoryAsset);
    sample(body: BodyDesign, options?: AccessoryPluginFitOptions): AccessoryPluginFit;
}
/** Stateless fitting helper for author previews and geometry parity tests. */
export declare function fitAccessoryPlugin(asset: PluginAccessoryAsset, body: BodyDesign, options?: AccessoryPluginFitOptions): AccessoryPluginFit;
