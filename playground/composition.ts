import { createAccessory, createDesign } from '../src/core/design.js';
import { createScene, migrateScene } from '../src/core/scene.js';
import type { SidekickScene } from '../src/core/scene.js';
export interface Composition { width: number; height: number; background: string; characterX: number; characterY: number; characterHeight: number; text: string; textX: number; textY: number; fontSize: number; textColor: string; font: 'sans' | 'serif' | 'mono' }
export const FONT_FAMILIES = { sans: '"Geist Variable", Arial, sans-serif', serif: 'Georgia, serif', mono: 'monospace' };
export const defaultComposition = (): Composition => ({ width: 1200, height: 630, background: '#ffffff', characterX: 38.8533333333, characterY: 50, characterHeight: 30.5904761905, text: 'Sidekick', textX: 48.02, textY: 50, fontSize: 58.08, textColor: '#24242c', font: 'sans' });
export function parseComposition(input: unknown): Composition {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('장면 배치 객체가 필요합니다.');
  const p = input as Record<string, unknown>, defaults = defaultComposition();
  if (Object.keys(p).some(key => !Object.hasOwn(defaults, key))) throw new Error('지원하지 않는 장면 배치 항목입니다.');
  const number = (key: string, min: number, max: number): number => { const value = p[key]; if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${key}: ${min}–${max} 범위의 숫자가 필요합니다.`); return value; };
  const color = (key: string): string => { const value = p[key]; if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) throw new Error(`${key}: HEX 색상이 필요합니다.`); return value; };
  if (typeof p.text !== 'string' || p.text.length > 200) throw new Error('텍스트는 200자 이하여야 합니다.');
  if (p.font !== 'sans' && p.font !== 'serif' && p.font !== 'mono') throw new Error('지원하지 않는 글꼴입니다.');
  const width = number('width', 320, 4096), height = number('height', 320, 4096);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width * height > 8388608) throw new Error('정수 크기, 최대 8메가픽셀까지 지원합니다.');
  return { width, height, background: color('background'), characterX: number('characterX', 0, 100), characterY: number('characterY', 0, 100), characterHeight: number('characterHeight', 10, 140), text: p.text, textX: number('textX', 0, 100), textY: number('textY', 0, 100), fontSize: number('fontSize', 12, 300), textColor: color('textColor'), font: p.font };
}
export function parseCompositionDocument(raw: string): { composition: Composition; avatar: SidekickScene } {
  if (new TextEncoder().encode(raw).length > 131072) throw new Error('장면 파일은 128 KiB 이하여야 합니다.');
  const value = JSON.parse(raw);
  if (value?.compositionVersion === undefined) return { composition: defaultComposition(), avatar: migrateScene(value).scene };
  if (value.compositionVersion !== 1 || Object.keys(value).some(key => !['compositionVersion', 'composition', 'avatar'].includes(key))) throw new Error('지원하지 않는 장면 파일입니다.');
  return { composition: parseComposition(value.composition), avatar: migrateScene(value.avatar).scene };
}
export function serializeComposition(composition: Composition, avatar: SidekickScene): string { return JSON.stringify({ compositionVersion: 1, composition: parseComposition(composition), avatar: migrateScene(avatar).scene }, null, 2); }
export function ogAvatarScene(): SidekickScene { return createScene({ design: createDesign({ body: { shape: 'ghostish', color: '#FFCC37' }, eyes: { left: { weights: { smile: 1, blink: 0 } }, right: { weights: { smile: 1, blink: 0 } } }, accessories: [createAccessory('glasses'), createAccessory('beret'), createAccessory('bowTie')] }), bodyOrientation: { yaw: 0, pitch: 0, roll: 0 }, activity: 'still', paused: true, trackingMode: 'off' }); }
/** Both preview and export use this exact pixel-space compositor. Avatar is alpha-cropped first. */
export function paintComposition(canvas: HTMLCanvasElement, composition: Composition, image: CanvasImageSource & { width: number; height: number }): void {
  const p = parseComposition(composition); canvas.width = p.width; canvas.height = p.height;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas 2D를 사용할 수 없습니다.');
  ctx.fillStyle = p.background; ctx.fillRect(0, 0, p.width, p.height);
  const h = p.height * p.characterHeight / 100, w = h * image.width / image.height;
  ctx.drawImage(image, p.width * p.characterX / 100 - w / 2, p.height * p.characterY / 100 - h / 2, w, h);
  ctx.font = `650 ${p.fontSize}px ${FONT_FAMILIES[p.font]}`; ctx.fillStyle = p.textColor; ctx.textBaseline = 'middle';
  const lines = p.text.split('\n'), step = p.fontSize * 1.2;
  lines.forEach((line, i) => ctx.fillText(line, p.width * p.textX / 100, p.height * p.textY / 100 + (i - (lines.length - 1) / 2) * step));
}
