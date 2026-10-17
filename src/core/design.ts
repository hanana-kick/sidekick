export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type BodyShape = 'orb' | 'rounded-box' | 'droplet';
export type EyePreset = 'capsule' | 'round' | 'arc';
export type AccessoryPreset = 'beret' | 'halo' | 'glasses';
export type Region = 'face' | 'crown' | 'left' | 'right';
export type RenderStyle = 'flat' | '3d';
export type Activity = 'idle' | 'thinking' | 'listening' | 'speaking' | 'celebrating' | 'still';
export interface Anchor { region: Region; uv: Vec2; offset: number }
export interface BodyDesign {
  shape: BodyShape; size: Vec3; roundness: number;
  taper: number; bulge: number; bend: number; color: string;
}
export interface EyeDesign {
  preset: EyePreset; anchor: Anchor; spacing: number; scale: number; color: string;
}
export interface AccessoryDesign {
  id: string; preset: AccessoryPreset; anchor: Anchor;
  color: string; scale: number; rotation: Vec3; follow: number;
}
export interface AvatarDesign { version: 1; body: BodyDesign; eyes: EyeDesign; accessories: AccessoryDesign[] }
export interface DesignPatch {
  body?: Partial<BodyDesign>;
  eyes?: Partial<Omit<EyeDesign, 'anchor'>> & { anchor?: Partial<Anchor> };
  accessories?: AccessoryDesign[];
}
export const BODY_SHAPES: BodyShape[] = ['orb', 'rounded-box', 'droplet'];
export const EYE_PRESETS: EyePreset[] = ['capsule', 'round', 'arc'];
export const ACCESSORY_PRESETS: AccessoryPreset[] = ['beret', 'halo', 'glasses'];
export const ACTIVITIES: Activity[] = ['idle', 'thinking', 'listening', 'speaking', 'celebrating', 'still'];
const regions: Region[] = ['face', 'crown', 'left', 'right'];
const defaults: AvatarDesign = {
  version: 1,
  body: { shape: 'rounded-box', size: [1.12, 1.18, 0.9], roundness: 0.68, taper: 0, bulge: 0.05, bend: 0, color: '#e9b64d' },
  eyes: { preset: 'capsule', anchor: { region: 'face', uv: [0, 0.1], offset: 0.026 }, spacing: 0.64, scale: 1, color: '#24242c' },
  accessories: [],
};

function record(value: unknown, path: string, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path}: 객체가 필요합니다.`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new TypeError(`${path}.${key}: 지원하지 않는 항목입니다.`);
  return value as Record<string, unknown>;
}
export function finite(value: unknown, min: number, max: number, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new RangeError(`${path}: ${min}~${max}의 유한한 숫자가 필요합니다.`);
  return value;
}
function choice<T extends string>(value: unknown, choices: T[], path: string): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new TypeError(`${path}: ${choices.join(', ')} 중 하나여야 합니다.`);
  return value as T;
}
function vector(value: unknown, size: number, min: number, max: number, path: string): number[] {
  if (!Array.isArray(value) || value.length !== size) throw new TypeError(`${path}: 길이가 ${size}인 배열이 필요합니다.`);
  return value.map((item, i) => finite(item, min, max, `${path}[${i}]`));
}
function color(value: unknown): string {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new TypeError('color: #RRGGBB 형식이 필요합니다.');
  return value.toLowerCase();
}
function anchor(value: unknown): Anchor {
  const a = record(value, 'anchor', ['region', 'uv', 'offset']);
  return { region: choice(a.region, regions, 'anchor.region'), uv: vector(a.uv, 2, -0.85, 0.85, 'anchor.uv') as Vec2, offset: finite(a.offset, 0, 0.5, 'anchor.offset') };
}
/** Validate untrusted JSON, reject unknown keys, and return an isolated copy. */
export function parseDesign(input: unknown): AvatarDesign {
  if (typeof input === 'string') {
    if (input.length > 65536) throw new RangeError('디자인 JSON은 64 KiB 이하여야 합니다.');
    input = JSON.parse(input);
  }
  const d = record(input, 'design', ['version', 'body', 'eyes', 'accessories']);
  if (d.version !== 1) throw new TypeError('지원하는 디자인 버전은 1입니다.');
  const b = record(d.body, 'body', ['shape', 'size', 'roundness', 'taper', 'bulge', 'bend', 'color']);
  const e = record(d.eyes, 'eyes', ['preset', 'anchor', 'spacing', 'scale', 'color']);
  if (!Array.isArray(d.accessories) || d.accessories.length > 8) throw new RangeError('액세서리는 최대 8개입니다.');
  const ids = new Set<string>();
  const accessories = d.accessories.map((item): AccessoryDesign => {
    const a = record(item, 'accessory', ['id', 'preset', 'anchor', 'color', 'scale', 'rotation', 'follow']);
    if (typeof a.id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(a.id) || ids.has(a.id)) throw new TypeError('액세서리 id는 중복 없는 영문 소문자/숫자/하이픈이어야 합니다.');
    ids.add(a.id);
    return { id: a.id, preset: choice(a.preset, ACCESSORY_PRESETS, 'accessory.preset'), anchor: anchor(a.anchor), color: color(a.color), scale: finite(a.scale, 0.3, 2, 'accessory.scale'), rotation: vector(a.rotation, 3, -Math.PI, Math.PI, 'accessory.rotation') as Vec3, follow: finite(a.follow, 0, 1, 'accessory.follow') };
  });
  const eyes: EyeDesign = { preset: choice(e.preset, EYE_PRESETS, 'eyes.preset'), anchor: anchor(e.anchor), spacing: finite(e.spacing, 0.2, 1, 'eyes.spacing'), scale: finite(e.scale, 0.4, 1.8, 'eyes.scale'), color: color(e.color) };
  if (eyes.anchor.region !== 'face') throw new TypeError('눈의 장착 영역은 face여야 합니다.');
  return { version: 1, body: { shape: choice(b.shape, BODY_SHAPES, 'body.shape'), size: vector(b.size, 3, 0.4, 2, 'body.size') as Vec3, roundness: finite(b.roundness, 0.15, 1, 'body.roundness'), taper: finite(b.taper, -0.45, 0.45, 'body.taper'), bulge: finite(b.bulge, -0.2, 0.4, 'body.bulge'), bend: finite(b.bend, -0.35, 0.35, 'body.bend'), color: color(b.color) }, eyes, accessories };
}
export function patchDesign(design: AvatarDesign, patch: DesignPatch): AvatarDesign {
  record(patch, 'patch', ['body', 'eyes', 'accessories']);
  return parseDesign({ version: 1, body: { ...design.body, ...patch.body }, eyes: { ...design.eyes, ...patch.eyes, anchor: { ...design.eyes.anchor, ...patch.eyes?.anchor } }, accessories: patch.accessories ?? design.accessories });
}
export function createDesign(patch: DesignPatch = {}): AvatarDesign { return patchDesign(defaults, patch); }
export function createAccessory(preset: AccessoryPreset, id: string = preset): AccessoryDesign {
  const a: AccessoryDesign = { id, preset, anchor: { region: preset === 'glasses' ? 'face' : 'crown', uv: [0, preset === 'glasses' ? 0.1 : 0], offset: preset === 'halo' ? 0.22 : 0.035 }, color: preset === 'beret' ? '#b84742' : preset === 'halo' ? '#f7cc5b' : '#31323d', scale: 1, rotation: [0, preset === 'beret' ? -0.16 : 0, 0], follow: preset === 'glasses' ? 0 : 0.5 };
  return parseDesign({ ...defaults, accessories: [a] }).accessories[0]!;
}
export function serializeDesign(design: AvatarDesign): string { return JSON.stringify(parseDesign(design), null, 2); }
