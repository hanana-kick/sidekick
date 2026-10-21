import type { AccessorySlot, Vec2, Vec3 } from './design.js';
import type { MaterialShapeName } from './shapes.js';
import type { PairedAffineDeformation, AccessoryPluginSurfaceConnector } from './plugin-deformation.js';
/** Indexed triangles: each vertex is [x, y, z, nx, ny, nz] in attachment-local units. */
export interface AccessoryPluginGeometry {
    vertices: Float32Array;
    indices: Uint16Array;
    parts?: AccessoryPluginPart[];
    deformation?: PairedAffineDeformation;
    surfaceConnectors?: AccessoryPluginSurfaceConnector[];
    normalPrecision?: 'float32' | 'float64';
}
/** Omit color to use the equipment instance color. Multiplication rounds each RGB channel. */
export interface AccessoryPluginMaterial {
    color?: string;
    multiplier?: number;
}
/** Ordered, contiguous triangle ranges partition the complete index buffer. */
export interface AccessoryPluginPart {
    indexStart: number;
    indexCount: number;
    material?: AccessoryPluginMaterial;
}
/** Author-owned front chart calibration, independent of the built-in accessory catalog. */
export interface AccessoryPluginMount {
    uv: Vec2;
    offset: number;
    rotation: Vec3;
    scale: number;
}
interface AccessoryPluginAttachmentBase {
    mounts: Record<MaterialShapeName, AccessoryPluginMount>;
    /** Exact rigid front clearance in model units. Defaults to .002; crown-envelope does not run contact. */
    clearance?: number;
    /** Optional inertial following, from zero to one. Defaults to zero. */
    follow?: number;
    followAxis?: 'x' | 'y' | 'z';
    followSign?: -1 | 1;
    geometryScale?: number;
}
/** Closed, consistently outward-wound rigid meshes; post-fit translation/scale may intentionally detach them. */
export type AccessoryPluginAttachment = AccessoryPluginAttachmentBase & ({
    mode: 'contained-front' | 'crown-envelope';
    region?: never;
    perimeterInset?: never;
    containmentClearance?: never;
    referenceUv?: never;
} | {
    mode: 'perimeter-front';
    region: 'left' | 'right';
    perimeterInset?: number;
    containmentClearance?: number;
    referenceUv?: never;
} | {
    mode: 'eye-plane';
    referenceUv?: Vec2;
    region?: never;
    perimeterInset?: never;
    containmentClearance?: never;
});
/** Trusted application code. Functions never cross the render-worker boundary. */
export interface AccessoryPlugin {
    apiVersion: 1;
    id: string;
    slots: readonly AccessorySlot[];
    attachment?: AccessoryPluginAttachment;
    createMesh(): AccessoryPluginGeometry | Promise<AccessoryPluginGeometry>;
}
export type AccessoryPluginModule = AccessoryPlugin | {
    default: AccessoryPlugin;
};
export type AccessoryPluginLoader = () => AccessoryPluginModule | Promise<AccessoryPluginModule>;
/** An owned, structured-cloneable snapshot; no executable plugin code is included. */
export interface PluginAccessoryAsset {
    pluginId: string;
    slots: AccessorySlot[];
    geometry: AccessoryPluginGeometry;
    attachment?: AccessoryPluginAttachment;
}
export declare const ACCESSORY_PLUGIN_LIMITS: Readonly<{
    maxVertices: 16384;
    maxTriangles: 32768;
    maxCoordinate: 16;
    maxParts: 32;
    maxFittedVertices: 2048;
    maxFittedTriangles: 4096;
    maxEquipped: 6;
    maxEquippedFittedVertices: 4096;
    maxEquippedFittedTriangles: 8192;
}>;
/** Exact contact is opt-in and deliberately lower complexity than static geometry. */
export declare function assertAccessoryPluginFitGeometry(geometry: AccessoryPluginGeometry): void;
/** Includes all append-only procedural topology, never just the authored prefix. */
export declare function accessoryPluginGeometryCounts(geometry: AccessoryPluginGeometry): {
    vertices: number;
    triangles: number;
};
/** Atomic equipment budget, shared by controller commits and direct renderer payloads. */
export declare function assertAccessoryPluginEquipmentBudget(items: readonly {
    slot: AccessorySlot;
    asset: PluginAccessoryAsset;
}[]): void;
/** Validate and own a serializable, asset-authored fitting recipe. */
export declare function validateAccessoryPluginAttachment(value: unknown): AccessoryPluginAttachment;
/** Validate and copy before worker transport or renderer use. Shared buffers are forbidden. */
export declare function validateAccessoryPluginGeometry(value: unknown): AccessoryPluginGeometry;
/**
 * One module/factory invocation per registered id. Failed loads stay failed until retry().
 * Own a registry at application scope to share a load across bots. dispose() releases its
 * cache and invalidates pending results; it cannot cancel application dynamic imports.
 */
export declare class AccessoryPluginRegistry {
    private entries;
    private disposed;
    register(value: AccessoryPlugin): void;
    registerLazy(id: string, loader: AccessoryPluginLoader): void;
    has(id: string): boolean;
    load(id: string): Promise<PluginAccessoryAsset>;
    /** Explicitly retry a failed load. In-flight and successful loads remain deduplicated. */
    retry(id: string): Promise<PluginAccessoryAsset>;
    dispose(): void;
    private add;
    private assertLive;
}
export {};
