import type { BodyDesign, Vec3 } from '../core/design.js';
import type { ResolvedAccessoryDesign } from '../core/resolved-design.js';
import type { ShapeContour } from '../core/contours.js';
import type { ShapeProfile } from '../core/shape-profiles.js';
import type { Geometry } from './geometry.js';
export type CatalogAccessoryPreset = 'moustache' | 'goatee' | 'bowTie' | 'scarf' | 'necklace' | 'earring' | 'starEarring';
/** Flat structural colors, never directional lighting. */
export interface CatalogAccessoryGeometry extends Geometry {
    mainIndexCount: number;
    detailIndexCount: number;
    /** Actual body junction, independent of a rigid object's clearance solve. */
    attachment: Vec3;
    seating: number;
}
export declare const CATALOG_ACCESSORY_CLEARANCE = 0.002;
/** Conservative local extents used by shape-independent camera framing. */
export declare const CATALOG_ACCESSORY_EXTENT: Readonly<Record<CatalogAccessoryPreset, number>>;
/**
 * Bounded low-poly catalog geometry in body-local coordinates. Rigid pieces
 * retain their authored silhouettes and receive one exact front clearance
 * translation; the scarf hangs from two contact folds before the same solve.
 * Camera, gaze, eye expression, color and frame history never enter the fit.
 */
export declare function catalogAccessoryGeometry(body: BodyDesign, accessory: ResolvedAccessoryDesign, squash?: number, contourOverride?: ShapeContour, profileOverride?: ShapeProfile, rotation?: Vec3): CatalogAccessoryGeometry;
/** Derived fold/knot color remains a solid, camera-independent material. */
export declare function accessoryDetailColor(color: string): string;
