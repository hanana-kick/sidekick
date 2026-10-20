export interface BotCombination {
  schema_version: 1;
  body_shape: string;
  eye_left: 'neutral' | 'smile' | 'blink' | 'custom';
  eye_right: 'neutral' | 'smile' | 'blink' | 'custom';
  accessory_head: string;
  accessory_eyes: string;
  accessory_mouth: string;
  accessory_neck: string;
  accessory_left_ear: string;
  accessory_right_ear: string;
  combination_key: string;
}
export const PRODUCT_BODY_SHAPES: readonly string[];
export const PRODUCT_EYE_STATES: readonly string[];
export const PRODUCT_ACCESSORIES: Readonly<Record<string, readonly string[]>>;
export const PRODUCT_SECTIONS: Readonly<Record<'studio' | 'api' | 'guide', readonly string[]>>;
export function sanitizeSiteSection(page: unknown, section: unknown): string | null;
export function eyeSemanticState(eye: unknown): BotCombination['eye_left'] | null;
export function botCombination(design: unknown): BotCombination | null;
export function sanitizeProductEvent(name: unknown, properties: unknown): Record<string, string | number> | null;

export const PRODUCT_SETTINGS: Readonly<Record<string, readonly string[]>>;
export function settingValueCategory(key: unknown, value: unknown): string | null;
export function settingObservations(design: unknown, runtime?: unknown): Array<{ setting_key: string; value_category: string }>;

export const PRODUCT_COLOR_FAMILIES: readonly string[];
export function colorFamily(value: unknown): string | null;
