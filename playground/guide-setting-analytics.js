/** Project accepted Guide values to a fixed telemetry vocabulary; never serialize declarations. */
import { settingValueCategory } from './product-analytics-schema.js';
import { recordSettingChange } from './site-setting-analytics.js';
const scalarKeys = Object.freeze({
 'body-color': 'body_color_family', 'eye-color': 'eye_color_family',
 'head-color': 'accessory_head_color_family', 'eyes-color': 'accessory_eyes_color_family', 'mouth-color': 'accessory_mouth_color_family', 'neck-color': 'accessory_neck_color_family', 'left-ear-color': 'accessory_left_ear_color_family', 'right-ear-color': 'accessory_right_ear_color_family',
 shape: 'body_shape', expression: 'expression', 'left-expression': 'left_expression', 'right-expression': 'right_expression',
 'head-accessory': 'accessory_head', 'eyes-accessory': 'accessory_eyes', 'mouth-accessory': 'accessory_mouth', 'neck-accessory': 'accessory_neck', 'left-ear-accessory': 'accessory_left_ear', 'right-ear-accessory': 'accessory_right_ear',
 size: 'size', zoom: 'zoom', emotion: 'emotion', 'emotion-intensity': 'emotion_intensity', placement: 'placement', 'tracking-mode': 'tracking_mode',
 activity: 'activity', paused: 'paused', interaction: 'interaction', 'movement-bounds': 'movement_bounds',
 'body-orientation': 'body_orientation', 'body-yaw': 'body_yaw', 'body-pitch': 'body_pitch', 'body-roll': 'body_roll',
 'move-max-speed': 'move_max_speed', 'move-acceleration': 'move_acceleration', 'move-deceleration': 'move_deceleration',
 'move-travel': 'move_travel', 'move-easing': 'move_easing', 'move-duration': 'move_duration',
 'shape-duration': 'shape_duration', 'shape-easing': 'shape_easing', 'motion-duration': 'motion_duration', 'motion-easing': 'motion_easing', 'render-style': 'render_style',
});
const valueAt = (object, key) => object && typeof object === 'object' ? Object.getOwnPropertyDescriptor(object, key)?.value : undefined;
export function guideSettingCategories(attribute, value) {
 const result = [];
 const add = (setting_key, raw) => { const value_category = settingValueCategory(setting_key, raw); if (value_category !== null) result.push({ setting_key, value_category }); };
 if (Object.hasOwn(scalarKeys, attribute)) add(scalarKeys[attribute], value);
 if (attribute === 'behavior' && value !== null) {
  add('behavior_type', valueAt(value,'type'));
  add('behavior_side', valueAt(value,'side'));
  add('behavior_gap', valueAt(value,'gap'));
 }
 if (attribute === 'positioning' && value !== null) {
  add('positioning_placement', valueAt(value,'placement'));
  add('positioning_gap', valueAt(value,'gap'));
  add('positioning_follow', valueAt(value,'follow'));
 }
 if (attribute === 'entrance' && value !== null) {
  const source = valueAt(value,'source'); add('entrance_source', source);
  add('entrance_side', valueAt(value,source === 'element' ? 'direction' : 'edge'));
  add('entrance_distance', valueAt(value,source === 'element' ? 'gap' : 'inset'));
 }
 return result;
}
export function recordGuideSetting(win, section, attribute, acceptedValue, source = 'control') {
 const site_page = win.document.documentElement.dataset.guideExercise === 'true' ? 'api' : 'guide';
 for (const pair of guideSettingCategories(attribute, acceptedValue)) recordSettingChange(win, { site_page, site_section: section, ...pair, change_source: source }, { debounce: true });
}
