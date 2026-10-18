import type { AccessoryPreset, AccessorySlot, Vec2, Vec3 } from './design.js';
import type { Anchor, ResolvedAccessoryDesign, ResolvedEyeDesign } from './resolved-design.js';
import { MATERIAL_SHAPE_NAMES } from './shapes.js';
import type { MaterialShapeName } from './shapes.js';

/** Maximum world-unit volume depth. XY retains the Material catalog outline. */
export const BODY_DEPTH_RANGE = Object.freeze([0.08, 1.2] as const);
export const MOUNT_UV_RANGE = Object.freeze([-0.65, 0.65] as const);
export const MOUNT_OFFSET_RANGE = Object.freeze([0, 0.25] as const);
/** Per-shape multipliers of the global neutral eye dimensions and spacing. */
export const EYE_PROFILE_SCALE_RANGE = Object.freeze([0.5, 1.5] as const);
/** Additive surface-chart V adjustment, independent of expression weights. */
export const EYE_PROFILE_OFFSET_Y_RANGE = Object.freeze([-0.35, 0.35] as const);
/** Additive calibration of an accessory's existing surface anchor, in its own region. */
export interface ShapeMount { uv: Vec2; offset: number }
/** Shape calibration never contains smile/blink weights or expression targets. */
export interface ShapeEyeProfile { width: number; height: number; spacing: number; offsetY: number }
/** Internal equipment fit. Position and model orientation are deliberately independent.
 * Crown UV chooses a lobe by perimeter phase; rotation describes the cap band /
 * halo plane in an upright crown frame, never the radial direction to that lobe.
 */
export interface CuratedAccessoryMount { anchor: Anchor; rotation: Vec3; scale: number }
export type CuratedAccessoryKey = Exclude<AccessoryPreset, 'earring' | 'starEarring'> | 'leftEarring' | 'rightEarring' | 'leftStarEarring' | 'rightStarEarring';
const CURATED_ACCESSORY_KEYS: readonly CuratedAccessoryKey[] = ['beret', 'halo', 'crown', 'glasses', 'sunglasses', 'moustache', 'goatee', 'bowTie', 'scarf', 'necklace', 'leftEarring', 'rightEarring', 'leftStarEarring', 'rightStarEarring'];
/** Legacy calibration is validated on import, never used as a public slot map. */
export type ScarfSupportFit = readonly [angle: number, level: number, left: number, right: number];
export interface ShapeProfile { beretDrapeLimit: number; beretFitTransition: number; beretDrapeStrength: number; beretFitRoom: number; beretFitTilt: number; beretFitCenter: Vec2; scarfFit: ScarfSupportFit; depth: number; mounts: Record<'head' | 'face', ShapeMount>; eyes: ShapeEyeProfile; accessories: Record<CuratedAccessoryKey, CuratedAccessoryMount> }
/** Older saved depth/mount overrides may omit eyes; resolution fills shape defaults. */
export type ShapeProfileInput = Omit<ShapeProfile, 'eyes' | 'accessories' | 'scarfFit' | 'beretFitTilt' | 'beretFitCenter' | 'beretFitRoom' | 'beretDrapeStrength' | 'beretFitTransition' | 'beretDrapeLimit'> & { eyes?: ShapeEyeProfile };
export type ShapeProfiles = Partial<Record<MaterialShapeName, ShapeProfileInput>>;
export type ResolvedShapeProfiles = Partial<Record<MaterialShapeName, ShapeProfile>>;
export type ShapeEyeGeometry = Pick<ResolvedEyeDesign, 'width' | 'height' | 'spacing' | 'anchor'>;

function immutable(profile: ShapeProfile): ShapeProfile {
  Object.freeze(profile.eyes); Object.freeze(profile.scarfFit); Object.freeze(profile.beretFitCenter);
  for (const mount of Object.values(profile.accessories)) {
    Object.freeze(mount.anchor.uv); Object.freeze(mount.anchor); Object.freeze(mount.rotation); Object.freeze(mount);
  }
  Object.freeze(profile.accessories);
  Object.freeze(profile.mounts.head.uv); Object.freeze(profile.mounts.face.uv);
  Object.freeze(profile.mounts.head); Object.freeze(profile.mounts.face); Object.freeze(profile.mounts);
  return Object.freeze(profile);
}
/**
 * Lower-face and lower-body junctions are semantic: these bodies have no neck
 * or ears. Values are canonical XY, not proportions of a fabricated skeleton.
 * Narrow lower lobes receive a smaller tie/collar; low eyes get a lower mouth.
 * Tuple: mouth Y, neck Y, size, left/right ear phase, ear size, mouth/neck tilt.
 * Earring phase chooses the side shoulder, while its independent upright plane
 * keeps both hoops readable from the front instead of copying the radial tilt.
 */
// Authored local scarf supports in canonical body coordinates. These preserve
// the reviewed static wearing poses; morphs interpolate the support itself,
// never reselect a different lobe or mirrored corner at runtime.
const SCARF_SUPPORT_FITS: Record<MaterialShapeName, ScarfSupportFit> = {
  circle: [0,-0.7043028677966102,-0.6903857993674681,0.7065683087210856],
  square: [-0.65,-0.9146402343230225,-0.5608723238291164,0.44926972606263565],
  slanted: [0.65,-0.8776301303284545,-0.37035504573926076,0.4487135928452314],
  arch: [0.65,-0.9278094740403311,-0.4319463690631626,0.5508609443062376],
  fan: [-0.65,-0.9037515535527462,-0.5680077864386106,0.4635930850040692],
  arrow: [-0.65,-0.8072930503931397,-0.4972642182290799,0.1596685923689511],
  semiCircle: [0.65,-0.8200923866922157,0.04600265142827109,0.626387862511066],
  oval: [0,-0.6606667148635399,-0.9215281747767934,0.3681018018427239],
  pill: [0,-0.6774695444915254,-0.8081195367069213,0.5381359550072768],
  triangle: [-0.65,-0.7892793479151976,-0.45626727854430976,0.3570214054414213],
  diamond: [0,-0.7243776483050847,-0.36010181311868933,0.36010170816838877],
  clamShell: [0,-0.5353573754237289,-0.7274880259914442,0.7289982321274535],
  pentagon: [0,-0.649423403898305,-0.7262296374824084,0.7262293689852015],
  gem: [0,-0.7195795791525422,-0.7171965450773221,0.7222448715315412],
  verySunny: [0.65,-0.7437119591137938,-0.6359442413868442,0.3099706887674314],
  sunny: [0,-0.7122632788135592,-0.6762323972390384,0.6886114985706523],
  cookie4Sided: [0.65,-0.8277928733600068,-0.30444970644089814,0.46794655374309446],
  cookie6Sided: [0,-0.6743059644067796,-0.6122682536054963,0.6106680547433238],
  cookie7Sided: [0,-0.7048879493583535,-0.5890649568703806,0.5890649920600484],
  cookie9Sided: [0,-0.6591156130894573,-0.602682861332208,0.60268297038875],
  cookie12Sided: [0,-0.6626009940677966,-0.5996312705291823,0.5996311995555335],
  ghostish: [0.65,-0.9021933096097198,-0.22138737397170477,0.5116246310086562],
  clover4Leaf: [-0.65,-0.8490915339534914,-0.5393894335135024,0.3961241176099506],
  clover8Leaf: [0,-0.7052212829056651,-0.5737213020823895,0.5719377134167324],
  burst: [0.65,-0.560371519908502,-0.5769907138630938,0.7830872687639728],
  softBurst: [0,-0.6259003721186441,-0.6143318667117458,0.6151981866889252],
  boom: [0.65,-0.43,-0.28796896398198396,0.253132093188177],
  softBoom: [0.65,-0.70,-0.02800255261752488,0.21636828997603008],
  flower: [0,-0.6136574957627119,-0.7432241344487527,0.7443211114716622],
  puffy: [-.65,-.84,-.4093640809550523,-.07184240043707998],
  puffyDiamond: [0,-0.6158633474576272,-0.4757797573073582,0.47577957253228886],
  pixelCircle: [-0.65,-0.8770834061912458,-0.40351306170000234,0.49867325337264384],
  pixelTriangle: [0,-0.55,-0.7746996983519764,0.1219997463149052],
  bun: [-0.65,-0.8695092438017838,-0.5362067950222944,0.5086366414343984],
  heart: [0,-0.6577334288135593,-0.19849493208295776,0.1984949628724318],
};
const LOWER_ACCESSORY_FITS: Record<MaterialShapeName, readonly [number, number, number, number, number, number, number, number]> = {
  circle: [-.30, -.69, 1, -0.2, -0.2, 1, 0.26, 0.76], square: [-.30, -.72, 1, -0.3, -0.3, 1, 0.23, 0.73],
  slanted: [-.30, -.65, .95, -0.5, -0.2, .95, 0.24, 0.7], arch: [-.34, -.72, 1, 0.2, 0.2, 1, 0.27, 0.73],
  fan: [-.32, -.68, .92, -0.3, -0.3, .90, 0.23, 0.64], arrow: [-.32, -.53, .78, -0.3, -0.3, .85, 0.38, 0.89],
  semiCircle: [-.27, -.49, .82, -0.3, -0.3, .86, 0.4, 1.03], oval: [-.29, -.66, .85, -0.4, -0.3, .90, 0.28, 0.82],
  pill: [-.30, -.68, .94, -0.1, -0.2, .94, 0.26, 0.75], triangle: [-.44, -.69, .82, -0.4, -0.4, .90, 0.42, 0.85],
  diamond: [-.33, -.69, .86, -0.2, -0.2, .90, 0.26, 0.59], clamShell: [-.27, -.53, .85, -0.2, -0.2, .88, 0.37, 1.02],
  pentagon: [-.33, -.67, .94, -0.1, -0.1, .96, 0.28, 0.76], gem: [-.31, -.70, .96, -0.3, -0.3, .96, 0.23, 0.67],
  verySunny: [-.29, -.65, .84, -0.2, -0.2, .88, 0.19, 0.43], sunny: [-.31, -.68, .92, -0.2, -0.2, .94, 0.21, 0.53],
  cookie4Sided: [-.29, -.60, .86, 0.1, 0.1, .92, 0.3, 0.9], cookie6Sided: [-.30, -.68, .96, -0.3, -0.3, .96, 0.22, 0.67],
  cookie7Sided: [-.30, -.65, .94, -0.2, -0.2, .94, 0.24, 0.76], cookie9Sided: [-.30, -.68, .96, -0.2, -0.2, .94, 0.21, 0.72],
  cookie12Sided: [-.30, -.69, .98, -0.2, -0.2, .96, 0.2, 0.56], ghostish: [-.29, -.61, .92, -0.2, -0.2, .96, 0.36, 1.09],
  clover4Leaf: [-.30, -.62, .84, 0.1, 0.1, .88, 0.33, 0.92], clover8Leaf: [-.30, -.65, .92, -0.3, -0.3, .94, 0.25, 0.79],
  burst: [-.29, -.61, .78, -0.2, -0.2, .84, 0.21, 0.45], softBurst: [-.30, -.65, .86, -0.3, -0.3, .90, 0.23, 0.51],
  boom: [-.24, -.42, .60, -0.2, -0.2, .76, 0.46, 1.21], softBoom: [-.33, -.61, .68, 0, 0, .82, 0.7, 0.25],
  flower: [-.30, -.63, .84, -0.2, -0.2, .90, 0.34, 0.52], puffy: [-.26, -.56, .88, -0.2, -0.2, .94, 0.5, 1.23],
  puffyDiamond: [-.31, -.65, .82, -0.2, -0.2, .90, 0.39, 0.5], pixelCircle: [-.30, -.71, .98, -0.3, -0.3, .96, 0.19, 0.63],
  pixelTriangle: [-.31, -.53, .68, -0.3, -0.2, .82, 0.55, 0.76], bun: [-.32, -.70, .82, 0.2, 0.2, .90, 0.25, 0.76],
  heart: [-.36, -.65, .82, -0.5, -0.5, .92, 0.47, 0.82],
};
/** Rigid bow ties bridge two lower lobes: lift the junction before it reaches a notch. */
const BOW_TIE_FITS: Partial<Record<MaterialShapeName, readonly [number, number, number]>> = {
  oval: [-.52, .85, .50], cookie4Sided: [-.54, .86, .70],
  ghostish: [-.53, .92, .80], clover4Leaf: [-.52, .84, .60], clover8Leaf: [-.55, .92, .50],
  boom: [-.38, .48, 1.00], puffy: [-.48, .80, .80],
};
/** Stable local wearing centers from the approved catalog poses. Interpolate the
 * selected support, never reselect a distant highest lobe during motion. */
const BERET_SUPPORT_CENTERS: Record<MaterialShapeName, Vec2> = {
  circle: [0.003202529778314901, -3.408608748279169e-19],
  square: [0.01698021042221885, 9.03718438524266e-20],
  slanted: [0.15131850032469543, 0],
  arch: [-0.0006363198558349243, -3.2798878618709565e-19],
  fan: [-0.13691568770238066, -7.869729787895053e-19],
  arrow: [-0.16759627229074692, 8.479900073282299e-19],
  semiCircle: [0.11204471670398031, 7.939232344393971e-19],
  oval: [0.10196462791259484, 0],
  pill: [0.03092929908453868, -3.2006515187642577e-19],
  triangle: [-0.08168667311281547, 2.217964919140647e-19],
  diamond: [-0.2044561623254606, 4.035150652910108e-19],
  clamShell: [0.13212157836080554, -6.593341704956034e-20],
  pentagon: [-0.1486249841882227, 1.7960405363770694e-18],
  gem: [-0.15716927568393765, -9.107437206215163e-19],
  verySunny: [0.12239394240649157, -5.571137503122266e-20],
  sunny: [0.1286347947880976, -2.55821629257413e-19],
  cookie4Sided: [0.0880737026036468, -2.527842009648267e-19],
  cookie6Sided: [0.09810189892676709, 0],
  cookie7Sided: [0.12295294063978661, 3.2980421308812113e-19],
  cookie9Sided: [0.0628533293487154, 9.786378438514157e-20],
  cookie12Sided: [-0.0038804988258414282, 0],
  ghostish: [-0.015860021663018888, -3.213071536617154e-19],
  clover4Leaf: [0.0834524132552072, 5.905549700049544e-19],
  clover8Leaf: [-0.054168759097783216, -3.166000527301816e-19],
  burst: [0.0004603794263204446, 3.7307929238811236e-19],
  softBurst: [0.05220442273490473, 9.344051706624409e-20],
  boom: [-0.0774359305907004, -1.70229848100482e-19],
  softBoom: [-0.0708967251958692, 1.5886921443561396e-19],
  flower: [-0.028443306685688674, -1.342607280417208e-19],
  puffy: [0.1877238140890791, 4.749466135876582e-19],
  puffyDiamond: [-0.21016602516730368, -2.272240719380594e-20],
  pixelCircle: [0.09263332113088871, 0],
  pixelTriangle: [-0.14357151603117985, -1.512080572535778e-19],
  bun: [0.006347941750584402, 1.2575182321572059e-19],
  heart: [0.002082470543027959, 5.073613683801476e-19],
};
/** Authored curl limits preserve the reviewed neutral garments. These values
 * were calibrated against the actual shell/body triangle audit at default depth.
 * Interpolate them as ordinary profile data: a per-frame ray-hit limiter can
 * switch winners abruptly during morphs. Final cloth contact is still checked
 * against actual triangles; these values alone are not collision guarantees. */
const BERET_DRAPE_LIMITS: Partial<Record<MaterialShapeName, number>> = {
  verySunny: 0, burst: 0,
  softBurst: .025914255728539178, softBoom: .0735820627175312,
  puffyDiamond: .42053994400183065, pixelCircle: .11545256551201084,
  pixelTriangle: .9000745129671436, heart: .8313476587534501,
};
/** A complete fit record is built independently for each accessory and shape. */
function defaults(shape: MaterialShapeName, depth: number, eyes: readonly [number, number, number, number], beretU: number, beretTilt: number, beretScale = 1, haloHeight = 0.22, glassesScale = 1): ShapeProfile {
  const [width, height, spacing, offsetY] = eyes;
  const [mouthY, neckY, size, leftEarV, rightEarV, earSize, mouthTilt, neckTilt] = LOWER_ACCESSORY_FITS[shape];
  const tie = BOW_TIE_FITS[shape];
  const front = (y: number, scale: number, tilt = 0): CuratedAccessoryMount => ({ anchor: { region: 'face', uv: [0, Math.atan(y) / 0.9], offset: 0 }, rotation: [tilt, 0, 0], scale });
  return immutable({
    beretDrapeLimit: BERET_DRAPE_LIMITS[shape] ?? 1,
    beretFitTransition: 0,
    beretDrapeStrength: shape === 'softBoom' ? .12 : shape === 'pixelCircle' ? .12 : shape === 'puffyDiamond' ? .40 : shape === 'verySunny' ? .60 : shape === 'softBurst' ? .90 : 1,
    beretFitRoom: ['heart', 'flower', 'pixelTriangle', 'burst', 'pixelCircle', 'puffyDiamond', 'verySunny', 'softBurst', 'softBoom', 'boom'].includes(shape) ? 1 : 0,
    beretFitTilt: (shape === 'cookie6Sided' ? -40 : shape === 'heart' ? -40 : shape === 'flower' ? -46 : shape === 'pixelTriangle' ? 15 : shape === 'triangle' ? -14 : shape === 'boom' ? -32 : shape === 'square' || shape === 'bun' ? -42 : -30) * Math.PI / 180,
    beretFitCenter: BERET_SUPPORT_CENTERS[shape], scarfFit: SCARF_SUPPORT_FITS[shape], depth, eyes: { width, height, spacing, offsetY },
    // Historical calibration fields exist only for validating legacy imports.
    mounts: { head: { uv: [0, 0], offset: 0 }, face: { uv: [0, 0], offset: 0 } },
    accessories: {
      beret: { anchor: { region: 'crown', uv: [beretU, 0], offset: 0 }, rotation: [0, beretTilt, 0], scale: beretScale },
      crown: { anchor: { region: 'crown', uv: [beretU, 0], offset: 0 }, rotation: [0, beretTilt * .5, 0], scale: beretScale * .98 },
      halo: { anchor: { region: 'crown', uv: [0, 0], offset: haloHeight }, rotation: [0, 0, 0], scale: 1 },
      glasses: { anchor: { region: 'face', uv: [0, 0.1], offset: 0 }, rotation: [0, 0, 0], scale: glassesScale },
      sunglasses: { anchor: { region: 'face', uv: [0, 0.1], offset: 0 }, rotation: [0, 0, 0], scale: glassesScale },
      moustache: front(mouthY, size, mouthTilt),
      goatee: front(mouthY - .015, size * .88, mouthTilt),
      bowTie: tie ? front(...tie) : front(neckY, size, neckTilt),
      scarf: front(shape === 'softBoom' ? -.46 : neckY, size),
      necklace: front(tie ? tie[0] + .03 : neckY + .055, size * .92),
      leftStarEarring: { anchor: { region: 'left', uv: [0, leftEarV], offset: 0 }, rotation: [0, Math.PI / 2, 0], scale: earSize },
      rightStarEarring: { anchor: { region: 'right', uv: [0, rightEarV], offset: 0 }, rotation: [0, -Math.PI / 2, 0], scale: earSize },
      leftEarring: { anchor: { region: 'left', uv: [0, leftEarV], offset: 0 }, rotation: [0, Math.PI / 2, 0], scale: earSize },
      rightEarring: { anchor: { region: 'right', uv: [0, rightEarV], offset: 0 }, rotation: [0, -Math.PI / 2, 0], scale: earSize },
    },
  });
}
/**
 * Curated fit for every catalog outline. Rounded and pointed crowns use their
 * actual top; split crowns choose a broad neighboring lobe. Each beret's band
 * has its own deliberately chosen plane instead of inheriting its lobe's radial
 * angle. In particular the heart uses the right lobe summit and a level band.
 * Halo placement is independently centered over the current crown envelope.
 * Glasses use neutral eye calibration in one rigid front plane with shared clearance.
 * None of these internal choices changes the Material catalog XY contour.
 */
export const DEFAULT_SHAPE_PROFILES: Readonly<Record<MaterialShapeName, ShapeProfile>> = Object.freeze({
  circle: defaults('circle', 1.00, [1.04, 1.04, 1.02, 0], 0, -0.06),
  square: defaults('square', 0.90, [1, 1, 1, 0], 0, 0),
  slanted: defaults('slanted', 0.82, [0.96, 1, 0.94, 0], -0.10, 0),
  arch: defaults('arch', 0.90, [1, 1.04, 0.96, -0.04], 0, -0.04),
  fan: defaults('fan', 0.82, [0.92, 0.94, 0.90, -0.04], -0.38, 0.06, 0.90),
  arrow: defaults('arrow', 0.70, [0.86, 0.88, 0.80, -0.06], 0, 0, 0.94),
  semiCircle: defaults('semiCircle', 0.86, [0.92, 0.78, 1, -0.02], 0, -0.04),
  oval: defaults('oval', 0.88, [0.86, 0.94, 0.82, 0], 0.30, -0.02, 0.94),
  pill: defaults('pill', 1.00, [0.96, 1.02, 0.94, 0], 0.10, -0.04),
  triangle: defaults('triangle', 0.72, [0.82, 0.86, 0.78, -0.18], 0, 0, 0.94),
  diamond: defaults('diamond', 0.78, [0.88, 0.98, 0.82, -0.04], 0, 0, 0.94),
  clamShell: defaults('clamShell', 0.90, [1.04, 0.76, 1.02, -0.02], 0, 0),
  pentagon: defaults('pentagon', 0.84, [0.98, 0.98, 0.94, -0.04], 0, 0),
  gem: defaults('gem', 0.84, [0.98, 1, 0.96, -0.02], 0, -0.04),
  verySunny: defaults('verySunny', 0.58, [0.84, 0.86, 0.84, -0.02], 0, 0, 0.94, 0.24),
  sunny: defaults('sunny', 0.66, [0.92, 0.94, 0.90, -0.02], 0, 0),
  cookie4Sided: defaults('cookie4Sided', 0.82, [0.94, 0.98, 0.88, 0], 0.41, 0, 0.94),
  cookie6Sided: defaults('cookie6Sided', 0.78, [0.98, 0.98, 0.96, 0], 0, -0.04),
  cookie7Sided: defaults('cookie7Sided', 0.76, [0.96, 0.98, 0.94, 0], 0, -0.04),
  cookie9Sided: defaults('cookie9Sided', 0.70, [0.98, 1, 0.96, 0], 0, -0.04),
  cookie12Sided: defaults('cookie12Sided', 0.68, [1, 1, 0.98, 0], 0, -0.04),
  ghostish: defaults('ghostish', 0.90, [1, 1.04, 0.96, 0.02], 0, -0.04),
  clover4Leaf: defaults('clover4Leaf', 0.92, [0.90, 0.92, 0.88, -0.02], 0.35, 0, 0.94),
  clover8Leaf: defaults('clover8Leaf', 0.78, [0.94, 0.96, 0.92, 0], 0.22, 0, 0.94),
  burst: defaults('burst', 0.52, [0.82, 0.84, 0.82, -0.02], 0, 0, 0.94, 0.24),
  softBurst: defaults('softBurst', 0.64, [0.88, 0.90, 0.88, -0.02], 0, 0),
  boom: defaults('boom', 0.52, [0.72, 0.72, 0.64, -0.08], 0, 0, 0.92, 0.24),
  softBoom: defaults('softBoom', 0.72, [0.78, 0.80, 0.72, -0.08], 0, 0, 0.92, 0.24),
  flower: defaults('flower', 0.84, [0.88, 0.90, 0.86, -0.02], 0, 0, 0.94),
  puffy: defaults('puffy', 1.08, [0.96, 0.96, 0.92, 0], 0.22, 0, 0.94),
  puffyDiamond: defaults('puffyDiamond', 1.00, [0.90, 0.94, 0.84, -0.02], 0, 0, 0.94),
  pixelCircle: defaults('pixelCircle', 0.74, [1, 1, 0.98, 0], 0, 0),
  pixelTriangle: defaults('pixelTriangle', 0.68, [0.82, 0.84, 0.70, -0.04], -0.36, 0, 0.90, 0.22, 0.86),
  bun: defaults('bun', 1.00, [0.88, 0.82, 0.78, -0.04], 0, 0),
  heart: defaults('heart', 0.90, [0.90, 0.92, 0.88, -0.10], 0.70, 0, 0.90),
});

function record(value: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path}: 객체가 필요합니다.`);
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path}: 일반 객체가 필요합니다.`);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !keys.includes(key)) throw new TypeError(`${path}: 지원하지 않는 항목입니다.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError(`${path}.${key}: 일반 데이터 항목이 필요합니다.`);
  }
  return value as Record<string, unknown>;
}
function bounded(value: unknown, limits: readonly [number, number], path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < limits[0] || value > limits[1]) throw new RangeError(`${path}: ${limits[0]}~${limits[1]}의 유한한 숫자가 필요합니다.`);
  return value;
}
function parseMount(value: unknown, path: string): ShapeMount {
  const mount = record(value, path, ['uv', 'offset']);
  if (!Array.isArray(mount.uv) || Object.getPrototypeOf(mount.uv) !== Array.prototype || mount.uv.length !== 2) throw new TypeError(`${path}.uv: 길이가 2인 일반 배열이 필요합니다.`);
  for (const key of Reflect.ownKeys(mount.uv)) {
    if (key === 'length') continue;
    if (key !== '0' && key !== '1') throw new TypeError(`${path}.uv: 지원하지 않는 배열 항목입니다.`);
    const descriptor = Object.getOwnPropertyDescriptor(mount.uv, key)!;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError(`${path}.uv: 일반 데이터 항목이 필요합니다.`);
  }
  if (!Object.hasOwn(mount.uv, 0) || !Object.hasOwn(mount.uv, 1)) throw new TypeError(`${path}.uv: 비어 있는 배열 항목은 지원하지 않습니다.`);
  return { uv: [bounded(mount.uv[0], MOUNT_UV_RANGE, `${path}.uv[0]`), bounded(mount.uv[1], MOUNT_UV_RANGE, `${path}.uv[1]`)], offset: bounded(mount.offset, MOUNT_OFFSET_RANGE, `${path}.offset`) };
}
function parseEyes(value: unknown, path: string): ShapeEyeProfile {
  const eyes = record(value, path, ['width', 'height', 'spacing', 'offsetY']);
  return { width: bounded(eyes.width, EYE_PROFILE_SCALE_RANGE, `${path}.width`), height: bounded(eyes.height, EYE_PROFILE_SCALE_RANGE, `${path}.height`), spacing: bounded(eyes.spacing, EYE_PROFILE_SCALE_RANGE, `${path}.spacing`), offsetY: bounded(eyes.offsetY, EYE_PROFILE_OFFSET_Y_RANGE, `${path}.offsetY`) };
}
function parseProfile(value: unknown, shape: MaterialShapeName, path: string): ShapeProfile {
  const profile = record(value, path, ['depth', 'mounts', 'eyes']);
  const mounts = record(profile.mounts, `${path}.mounts`, ['head', 'face']);
  const eyes = Object.hasOwn(profile, 'eyes') ? parseEyes(profile.eyes, `${path}.eyes`) : { ...DEFAULT_SHAPE_PROFILES[shape].eyes };
  return { beretDrapeLimit: DEFAULT_SHAPE_PROFILES[shape].beretDrapeLimit, beretFitTransition: 0, beretDrapeStrength: DEFAULT_SHAPE_PROFILES[shape].beretDrapeStrength, beretFitRoom: DEFAULT_SHAPE_PROFILES[shape].beretFitRoom, beretFitCenter: DEFAULT_SHAPE_PROFILES[shape].beretFitCenter, beretFitTilt: DEFAULT_SHAPE_PROFILES[shape].beretFitTilt, scarfFit: DEFAULT_SHAPE_PROFILES[shape].scarfFit, depth: bounded(profile.depth, BODY_DEPTH_RANGE, `${path}.depth`), eyes, accessories: DEFAULT_SHAPE_PROFILES[shape].accessories, mounts: { head: parseMount(mounts.head, `${path}.mounts.head`), face: parseMount(mounts.face, `${path}.mounts.face`) } };
}
/** Validate isolated overrides, filling only omitted legacy eyes from the registry. */
export function parseShapeProfiles(value: unknown, path = 'body.profiles'): ResolvedShapeProfiles {
  const profiles = record(value, path, MATERIAL_SHAPE_NAMES), result: ResolvedShapeProfiles = {};
  for (const name of Object.keys(profiles) as MaterialShapeName[]) result[name] = parseProfile(profiles[name], name, `${path}.${name}`);
  return result;
}
/** Returns an immutable snapshot, never a mutable reference into a saved design. */
export function resolveShapeProfile(shape: MaterialShapeName, profiles?: ShapeProfiles): ShapeProfile {
  if (!MATERIAL_SHAPE_NAMES.includes(shape)) throw new TypeError('shape: 지원하는 Material 도형 이름이 필요합니다.');
  if (profiles === undefined) return DEFAULT_SHAPE_PROFILES[shape];
  const map = record(profiles, 'body.profiles', MATERIAL_SHAPE_NAMES);
  return Object.hasOwn(map, shape) ? immutable(parseProfile(map[shape], shape, `body.profiles.${shape}`)) : DEFAULT_SHAPE_PROFILES[shape];
}
export function sameShapeProfile(a: ShapeProfile, b: ShapeProfile): boolean {
  return a.beretDrapeLimit === b.beretDrapeLimit && a.beretFitTransition === b.beretFitTransition && a.beretDrapeStrength === b.beretDrapeStrength && a.beretFitRoom === b.beretFitRoom && a.beretFitCenter.every((v, i) => v === b.beretFitCenter[i]) && a.beretFitTilt === b.beretFitTilt && a.scarfFit.every((value, i) => value === b.scarfFit[i]) && CURATED_ACCESSORY_KEYS.every(preset => { const x = a.accessories[preset], y = b.accessories[preset]; return x.scale === y.scale && x.anchor.region === y.anchor.region && x.anchor.offset === y.anchor.offset && x.anchor.uv.every((value, i) => value === y.anchor.uv[i]) && x.rotation.every((value, i) => value === y.rotation[i]); }) && a.depth === b.depth && (['width', 'height', 'spacing', 'offsetY'] as const).every(key => a.eyes[key] === b.eyes[key]) && (['head', 'face'] as const).every(slot => a.mounts[slot].offset === b.mounts[slot].offset && a.mounts[slot].uv.every((v, i) => v === b.mounts[slot].uv[i]));
}
/** Body volume, eye calibration and equipment use the same transition progress. */
export function interpolateShapeProfile(from: ShapeProfile, to: ShapeProfile, progress: number): ShapeProfile {
  if (progress <= 0) return from;
  if (progress >= 1) return to;
  const mix = (a: number, b: number): number => a + (b - a) * progress;
  const mount = (slot: 'head' | 'face'): ShapeMount => ({ uv: [mix(from.mounts[slot].uv[0], to.mounts[slot].uv[0]), mix(from.mounts[slot].uv[1], to.mounts[slot].uv[1])], offset: mix(from.mounts[slot].offset, to.mounts[slot].offset) });
  const eyes: ShapeEyeProfile = { width: mix(from.eyes.width, to.eyes.width), height: mix(from.eyes.height, to.eyes.height), spacing: mix(from.eyes.spacing, to.eyes.spacing), offsetY: mix(from.eyes.offsetY, to.eyes.offsetY) };
  const equipment = (preset: CuratedAccessoryKey): CuratedAccessoryMount => {
    const a = from.accessories[preset], b = to.accessories[preset];
    // Registry angles stay in a short, consistent range. Linear interpolation
    // avoids quaternion sign ambiguity and preserves exact interruption values.
    return { anchor: { region: a.anchor.region, uv: [mix(a.anchor.uv[0], b.anchor.uv[0]), mix(a.anchor.uv[1], b.anchor.uv[1])], offset: mix(a.anchor.offset, b.anchor.offset) }, rotation: a.rotation.map((value, i) => mix(value, b.rotation[i]!)) as Vec3, scale: mix(a.scale, b.scale) };
  };
  // Release the extra lip curl while the support changes, then restore it with
  // zero endpoint velocity. The hollow cap itself remains fitted and visible.
  const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
  // Relax only the free curl early while changing supports; keep the hollow
  // fitted shell and its slower seating transition throughout the morph.
  const lipStrength = from.beretDrapeStrength * (1 - smooth(progress / .06)) + to.beretDrapeStrength * smooth((progress - .94) / .06);
  const entering = smooth(progress / .14), leaving = smooth((progress - .86) / .14);
  const fitTransition = from.beretFitTransition * (1 - entering) + entering * (1 - leaving) + to.beretFitTransition * leaving;
  return immutable({ beretDrapeLimit: mix(from.beretDrapeLimit, to.beretDrapeLimit), beretFitTransition: fitTransition, beretDrapeStrength: lipStrength, beretFitRoom: mix(from.beretFitRoom, to.beretFitRoom), beretFitCenter: from.beretFitCenter.map((v, i) => mix(v, to.beretFitCenter[i]!)) as Vec2, beretFitTilt: mix(from.beretFitTilt, to.beretFitTilt), scarfFit: from.scarfFit.map((v, i) => mix(v, to.scarfFit[i]!)) as unknown as ScarfSupportFit, depth: mix(from.depth, to.depth), eyes, mounts: { head: mount('head'), face: mount('face') }, accessories: Object.fromEntries(CURATED_ACCESSORY_KEYS.map(key => [key, equipment(key)])) as Record<CuratedAccessoryKey, CuratedAccessoryMount> });
}
/**
 * Apply the displayed shape profile once to the global neutral eye baseline.
 * The existing renderer still owns scale, expression targets/weights and fitting.
 * Neither input is mutated, and the returned anchor is an independent copy.
 */
export function resolveShapeEyeGeometry(eyes: ShapeEyeGeometry, profile: ShapeProfile): ShapeEyeGeometry {
  return {
    width: eyes.width * profile.eyes.width,
    height: eyes.height * profile.eyes.height,
    spacing: eyes.spacing * profile.eyes.spacing,
    anchor: { ...eyes.anchor, uv: [eyes.anchor.uv[0], Math.max(-0.85, Math.min(0.85, eyes.anchor.uv[1] + profile.eyes.offsetY))] },
  };
}
/** Internal calibrated position. Public designs contain no placement controls. */
export function accessoryMountProfile(accessory: Pick<ResolvedAccessoryDesign, 'preset'> & { slot?: AccessorySlot }, profile: ShapeProfile): CuratedAccessoryMount {
  if (accessory.preset !== 'earring' && accessory.preset !== 'starEarring') return profile.accessories[accessory.preset];
  if (accessory.slot !== 'leftEar' && accessory.slot !== 'rightEar') throw new TypeError(`${accessory.preset}: an explicit leftEar or rightEar slot is required.`);
  const left = accessory.slot === 'leftEar';
  return profile.accessories[accessory.preset === 'starEarring' ? (left ? 'leftStarEarring' : 'rightStarEarring') : (left ? 'leftEarring' : 'rightEarring')];
}
export function accessoryMountAnchor(accessory: Pick<ResolvedAccessoryDesign, 'preset'> & { slot?: AccessorySlot }, profile: ShapeProfile): Anchor {
  const anchor = accessoryMountProfile(accessory, profile).anchor;
  return { ...anchor, uv: [...anchor.uv] };
}
