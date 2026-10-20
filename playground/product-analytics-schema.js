/** Website-only, bounded product taxonomy. Never import from src/ or library entry points. */
import { guideIds } from './guide-navigation.js';

// Append only. These positions are the v1 combination-key encoding, not a hash.
export const PRODUCT_BODY_SHAPES = Object.freeze(['circle','square','slanted','arch','fan','arrow','semiCircle','oval','pill','triangle','diamond','clamShell','pentagon','gem','verySunny','sunny','cookie4Sided','cookie6Sided','cookie7Sided','cookie9Sided','cookie12Sided','ghostish','clover4Leaf','clover8Leaf','burst','softBurst','boom','softBoom','flower','puffy','puffyDiamond','pixelCircle','pixelTriangle','bun','heart']);
export const PRODUCT_EYE_STATES = Object.freeze(['neutral', 'smile', 'blink', 'custom']);
export const PRODUCT_ACCESSORIES = Object.freeze({
  head: Object.freeze(['none', 'beret', 'halo', 'crown']),
  eyes: Object.freeze(['none', 'glasses', 'sunglasses']),
  mouth: Object.freeze(['none', 'moustache', 'goatee']),
  neck: Object.freeze(['none', 'bowTie', 'scarf', 'necklace']),
  leftEar: Object.freeze(['none', 'earring', 'starEarring']),
  rightEar: Object.freeze(['none', 'earring', 'starEarring']),
});
export const PRODUCT_SECTIONS = Object.freeze({
  studio: Object.freeze(['appearance', 'animation', 'orientation', 'scene', 'json']),
  api: Object.freeze(['overview', 'movement', 'anchor', 'activity', 'emotion', 'expression', 'tracking', 'orientation', 'assets', 'presence', 'lifecycle', 'manual-motion', 'performance', ...guideIds]),
  guide: Object.freeze([...guideIds]),
});
const slotFields = Object.freeze({ head: 'accessory_head', eyes: 'accessory_eyes', mouth: 'accessory_mouth', neck: 'accessory_neck', leftEar: 'accessory_left_ear', rightEar: 'accessory_right_ear' });
const botEvents = new Set(['bot_preview', 'bot_apply', 'preset_apply', 'bot_copy', 'bot_export']);
const copyFormats = ['json', 'html', 'react', 'javascript'];
const exportFormats = ['json', 'png'];
const applyKinds = ['json', 'file', 'api'];
const presetNames = ['default', 'sidekick_og'];
const endReasons = ['heartbeat', 'idle', 'hidden', 'blur', 'navigation', 'pagehide'];
// Read only own data fields. In particular, never invoke free-form getters/toJSON.
const data = (object, key) => object && typeof object === 'object' ? Object.getOwnPropertyDescriptor(object, key)?.value : undefined;
const includes = (list, value) => typeof value === 'string' && list.includes(value);

export function sanitizeSiteSection(page, section) {
  return typeof page === 'string' && Object.hasOwn(PRODUCT_SECTIONS, page) && includes(PRODUCT_SECTIONS[page], section) ? section : null;
}

/** Numeric expression weights stay local; only their four UI semantic states leave. */
export function eyeSemanticState(eye) {
  const weights = data(eye, 'weights'), smile = data(weights, 'smile'), blink = data(weights, 'blink');
  if (![smile, blink].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)) return null;
  return smile === 0 && blink === 0 ? 'neutral' : smile === 1 && blink === 0 ? 'smile' : smile === 0 && blink === 1 ? 'blink' : 'custom';
}
function categoricalCombination(properties) {
  const body_shape = data(properties, 'body_shape'), eye_left = data(properties, 'eye_left'), eye_right = data(properties, 'eye_right');
  if (!includes(PRODUCT_BODY_SHAPES, body_shape) || !includes(PRODUCT_EYE_STATES, eye_left) || !includes(PRODUCT_EYE_STATES, eye_right)) return null;
  const result = { schema_version: 1, body_shape, eye_left, eye_right };
  const codes = [PRODUCT_BODY_SHAPES.indexOf(body_shape), PRODUCT_EYE_STATES.indexOf(eye_left), PRODUCT_EYE_STATES.indexOf(eye_right)];
  for (const [slot, field] of Object.entries(slotFields)) {
    const preset = data(properties, field), allowed = PRODUCT_ACCESSORIES[slot];
    if (!includes(allowed, preset)) return null;
    result[field] = preset;
    codes.push(allowed.indexOf(preset));
  }
  // Positional, delimited base36 catalog indices: deterministic and collision-free.
  // The key is < 100 characters, including all independently selected ear slots.
  result.combination_key = `v1.${codes.map(code => code.toString(36)).join('.')}`;
  return result;
}

/** Project a validated design to catalog categories, excluding IDs, colors and raw JSON. */
export function botCombination(design) {
  const eyes = data(design, 'eyes'), accessories = data(design, 'accessories');
  if (!Array.isArray(accessories) || accessories.length > 6) return null;
  const categories = { body_shape: data(data(design, 'body'), 'shape'), eye_left: eyeSemanticState(data(eyes, 'left')), eye_right: eyeSemanticState(data(eyes, 'right')) };
  for (const field of Object.values(slotFields)) categories[field] = 'none';
  const occupied = new Set();
  for (let index = 0; index < accessories.length; index++) {
    const item = data(accessories, String(index)), slot = data(item, 'slot'), preset = data(item, 'preset');
    if (typeof slot !== 'string' || !Object.hasOwn(PRODUCT_ACCESSORIES, slot) || !includes(PRODUCT_ACCESSORIES[slot], preset) || preset === 'none' || occupied.has(slot)) return null;
    occupied.add(slot); categories[slotFields[slot]] = preset;
  }
  return categoricalCombination(categories);
}

/** Fixed setting vocabulary shared by explicit controls and successful handoff observations. */
const booleans = Object.freeze(['true', 'false']);
const durations = Object.freeze(['zero', 'short', 'medium', 'long', 'extended']);
const gaps = Object.freeze(['negative', 'zero', 'small', 'medium', 'large', 'xlarge']);
const nonNegativeGaps = Object.freeze(gaps.filter(value => value !== 'negative'));
const angles = Object.freeze(['far_negative', 'negative', 'zero', 'positive', 'far_positive']);
const speeds = Object.freeze(['slow', 'medium', 'fast', 'very_fast']);
export const PRODUCT_COLOR_FAMILIES = Object.freeze(['black', 'white', 'gray', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink', 'brown']);
export const PRODUCT_SETTINGS = Object.freeze({
  body_color_family: PRODUCT_COLOR_FAMILIES, eye_color_family: PRODUCT_COLOR_FAMILIES,
  ...Object.fromEntries(Object.values(slotFields).map(field => [`${field}_color_family`, PRODUCT_COLOR_FAMILIES])),
  body_shape: PRODUCT_BODY_SHAPES,
  expression: PRODUCT_EYE_STATES, left_expression: PRODUCT_EYE_STATES, right_expression: PRODUCT_EYE_STATES,
  ...Object.fromEntries(Object.entries(slotFields).map(([slot, field]) => [field, PRODUCT_ACCESSORIES[slot]])),
  size: Object.freeze(['tiny', 'small', 'medium', 'large', 'xlarge']),
  zoom: Object.freeze(['reduced', 'normal', 'enlarged', 'large', 'xlarge']),
  emotion: Object.freeze(['neutral', 'happy', 'sad', 'curious', 'surprised', 'concerned', 'excited']),
  emotion_intensity: Object.freeze(['off', 'low', 'medium', 'high', 'full']),
  behavior_type: Object.freeze(['none', 'wait', 'follow', 'guide', 'review', 'idle', 'celebrate', 'error']),
  behavior_side: Object.freeze(['left', 'right', 'above', 'below']), behavior_gap: nonNegativeGaps,
  positioning_placement: Object.freeze(['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right']),
  positioning_gap: gaps, positioning_follow: booleans,
  placement: Object.freeze(['inline', 'viewport']), movement_bounds: Object.freeze(['viewport', 'none']),
  entrance_source: Object.freeze(['none', 'element', 'viewport']), entrance_side: Object.freeze(['left', 'right', 'top', 'bottom']), entrance_distance: nonNegativeGaps,
  tracking_mode: Object.freeze(['off', 'eyes', 'eyes-and-body']),
  body_orientation: Object.freeze(['front', 'three-quarter', 'side', 'custom']), body_yaw: angles, body_pitch: angles, body_roll: angles,
  activity: Object.freeze(['idle', 'thinking', 'listening', 'speaking', 'celebrating', 'still']), paused: booleans,
  interaction: Object.freeze(['none', 'box']), render_style: Object.freeze(['flat']),
  move_travel: Object.freeze(['natural', 'none']), move_easing: Object.freeze(['smooth', 'linear']),
  shape_easing: Object.freeze(['smooth', 'linear']), motion_easing: Object.freeze(['smooth', 'linear']),
  move_duration: durations, shape_duration: durations, motion_duration: durations, expression_duration: durations,
  activity_duration: durations, emotion_duration: durations,
  move_max_speed: speeds, move_acceleration: speeds, move_deceleration: speeds,
  auto_speed: booleans, element_anchor: booleans,
});
const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
/** Local-only classification. Never return the input, RGB components, hue or lightness. */
export function colorFamily(value) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) return null;
  const r = parseInt(value.slice(1, 3), 16) / 255, g = parseInt(value.slice(3, 5), 16) / 255, b = parseInt(value.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min, lightness = (max + min) / 2;
  if (lightness <= .12) return 'black';
  if (lightness >= .92) return 'white';
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  if (saturation <= .12) return 'gray';
  let hue = (max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60;
  if (hue < 0) hue += 360;
  if (hue >= 15 && hue < 75 && lightness < .38) return 'brown';
  return hue < 15 || hue >= 345 ? 'red' : hue < 40 ? 'orange' : hue < 75 ? 'yellow' : hue < 165 ? 'green' : hue < 195 ? 'cyan' : hue < 255 ? 'blue' : hue < 285 ? 'purple' : 'pink';
}
/** Convert only an explicitly known setting's accepted value; arbitrary strings/numbers are rejected. */
export function settingValueCategory(key, value) {
  if (typeof key !== 'string' || !Object.hasOwn(PRODUCT_SETTINGS, key)) return null;
  if (PRODUCT_SETTINGS[key] === PRODUCT_COLOR_FAMILIES) return colorFamily(value);
  if (PRODUCT_SETTINGS[key] === booleans) return typeof value === 'boolean' ? String(value) : null;
  if (PRODUCT_SETTINGS[key] === durations) return !finite(value, 0, 60000) ? null : value === 0 ? 'zero' : value <= 250 ? 'short' : value <= 1000 ? 'medium' : value <= 3000 ? 'long' : 'extended';
  if (PRODUCT_SETTINGS[key] === gaps || PRODUCT_SETTINGS[key] === nonNegativeGaps) return !finite(value, key === 'positioning_gap' ? -10000 : 0, 10000) ? null : value < 0 ? 'negative' : value === 0 ? 'zero' : value <= 8 ? 'small' : value <= 24 ? 'medium' : value <= 64 ? 'large' : 'xlarge';
  if (PRODUCT_SETTINGS[key] === angles) return !finite(value, key === 'body_pitch' ? -90 : key === 'body_roll' ? -180 : -360, key === 'body_pitch' ? 90 : key === 'body_roll' ? 180 : 360) ? null : value < -90 ? 'far_negative' : value < 0 ? 'negative' : value === 0 ? 'zero' : value <= 90 ? 'positive' : 'far_positive';
  if (PRODUCT_SETTINGS[key] === speeds) return !finite(value, 1, 100000) ? null : value <= 300 ? 'slow' : value <= 1500 ? 'medium' : value <= 5000 ? 'fast' : 'very_fast';
  if (key === 'size') return !finite(value, 1, 2048) ? null : value <= 72 ? 'tiny' : value <= 144 ? 'small' : value <= 240 ? 'medium' : value <= 480 ? 'large' : 'xlarge';
  if (key === 'zoom') return !finite(value, .5, 3) ? null : value < 1 ? 'reduced' : value === 1 ? 'normal' : value <= 1.5 ? 'enlarged' : value <= 2 ? 'large' : 'xlarge';
  if (key === 'emotion_intensity') return !finite(value, 0, 1) ? null : value === 0 ? 'off' : value <= .33 ? 'low' : value <= .66 ? 'medium' : value < 1 ? 'high' : 'full';
  if (key === 'render_style' && value === '3d') return 'flat';
  return includes(PRODUCT_SETTINGS[key], value) ? value : null;
}
/** At most 24 fixed categorical settings per successful Studio handoff, including defaults. */
export function settingObservations(design, runtime) {
  const combo = botCombination(design); if (!combo) return [];
  const values = { body_shape: combo.body_shape, left_expression: combo.eye_left, right_expression: combo.eye_right };
  for (const field of Object.values(slotFields)) values[field] = combo[field];
  for (const [key, field] of [['body_color_family', 'body'], ['eye_color_family', 'eyes']]) {
    const category = colorFamily(data(data(design, field), 'color')); if (category !== null) values[key] = category;
  }
  const accessories = data(design, 'accessories');
  for (let index = 0; index < accessories.length; index++) {
    const item = data(accessories, String(index)), slot = data(item, 'slot');
    const category = colorFamily(data(item, 'color'));
    if (category !== null) values[`${slotFields[slot]}_color_family`] = category;
  }
  const orientation = data(runtime, 'bodyOrientation');
  if (orientation) {
    const yaw = data(orientation, 'yaw'), pitch = data(orientation, 'pitch'), roll = data(orientation, 'roll');
    if (finite(yaw, -360, 360) && finite(pitch, -90, 90) && finite(roll, -180, 180)) values.body_orientation = pitch === 0 && roll === 0 && [0, 45, 90].includes(yaw) ? yaw === 0 ? 'front' : yaw === 45 ? 'three-quarter' : 'side' : 'custom';
  }
  for (const [key, field] of [['activity', 'activity'], ['tracking_mode', 'trackingMode'], ['zoom', 'zoom'], ['paused', 'paused']]) {
    const category = settingValueCategory(key, data(runtime, field)); if (category !== null) values[key] = category;
  }
  for (const [key, field, alternate] of [['shape_duration', 'shapeDuration', 'duration'], ['shape_easing', 'shapeEasing', 'easing']]) {
    const category = settingValueCategory(key, data(runtime, field) ?? data(runtime, alternate)); if (category !== null) values[key] = category;
  }
  return Object.entries(values).map(([setting_key, value_category]) => ({ setting_key, value_category }));
}

/** Rebuild every event at the provider boundary. Caller-supplied keys/extra fields never survive. */
export function sanitizeProductEvent(name, properties) {
  const site_page = data(properties, 'site_page');
  if (!['studio', 'api', 'guide'].includes(site_page)) return null;
  const site_section = sanitizeSiteSection(site_page, data(properties, 'site_section'));
  if (site_section === null) return null;
  const context = { site_page, site_section };
  if (name === 'section_view') return context;
  if (name === 'setting_change' || name === 'setting_observation') {
    const setting_key = data(properties, 'setting_key'), value_category = data(properties, 'value_category');
    if (typeof setting_key !== 'string' || !Object.hasOwn(PRODUCT_SETTINGS, setting_key) || !includes(PRODUCT_SETTINGS[setting_key], value_category)) return null;
    const sourceField = name === 'setting_change' ? 'change_source' : 'observation_source';
    const source = data(properties, sourceField);
    if (!includes(name === 'setting_change' ? ['control', 'preset'] : ['apply', 'copy', 'export', 'preset'], source)) return null;
    return { ...context, setting_key, value_category, [sourceField]: source };
  }
  if (name === 'section_engagement') {
    const active_duration_ms = data(properties, 'active_duration_ms'), end_reason = data(properties, 'end_reason');
    if (!Number.isInteger(active_duration_ms) || active_duration_ms < 1 || active_duration_ms > 30000 || !includes(endReasons, end_reason)) return null;
    return { ...context, active_duration_ms, end_reason };
  }
  if (!botEvents.has(name)) return null;
  const combination = categoricalCombination(properties);
  if (!combination) return null;
  const result = { ...context, ...combination };
  if (name === 'bot_copy' || name === 'bot_export') {
    const format = data(properties, 'format');
    if (!includes(name === 'bot_copy' ? copyFormats : exportFormats, format)) return null;
    result.format = format;
  }
  if (name === 'bot_apply') {
    const apply_kind = data(properties, 'apply_kind');
    if (!includes(applyKinds, apply_kind)) return null;
    result.apply_kind = apply_kind;
  }
  if (name === 'preset_apply') {
    const preset = data(properties, 'preset');
    if (!includes(presetNames, preset)) return null;
    result.preset = preset;
  }
  return result;
}
