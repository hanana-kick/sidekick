import { validateMoveOptions, validatePosition } from './movement.js';
import type { AvatarPosition, MoveOptions } from './movement.js';

export type HorizontalAlignment = 'left' | 'center' | 'right';
export type VerticalAlignment = 'top' | 'center' | 'bottom';
/** Align matching points of the target and avatar border-boxes, then add CSS-pixel offsets. */
export interface MoveToElementOptions extends MoveOptions {
  x?: number;
  y?: number;
  alignX?: HorizontalAlignment;
  alignY?: VerticalAlignment;
}
const horizontal = { left: 0, center: .5, right: 1 };
const vertical = { top: 0, center: .5, bottom: 1 };

/** Read layout once. No observers or persistent reference to the target are retained. */
export function resolveElementTarget(avatar: HTMLElement, position: AvatarPosition, target: Element, options: MoveToElementOptions = {}): { position: AvatarPosition; options: MoveOptions } {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('moveToElement options must be an object');
  const { x = 0, y = 0, alignX = 'left', alignY = 'top', ...moveOptions } = options;
  validatePosition({ x, y }); validateMoveOptions(moveOptions);
  if (!Object.hasOwn(horizontal, alignX) || !Object.hasOwn(vertical, alignY)) throw new TypeError('alignX must be left, center or right; alignY must be top, center or bottom');
  const view = avatar.ownerDocument.defaultView;
  if (!view || !avatar.isConnected || !(target instanceof view.Element) || !target.isConnected || target.ownerDocument !== avatar.ownerDocument) throw new TypeError('moveToElement requires connected avatar and target Elements in the same document');
  const ownZoom = view.getComputedStyle(avatar).zoom;
  if (ownZoom && ownZoom !== '1' && ownZoom !== 'normal') throw new TypeError('moveToElement does not support CSS zoom on the avatar; use CSS transform: scale() instead');
  // Parent transforms change the units/direction of CSS translate. Own transforms do not:
  // translate precedes rotate/scale/transform, so the measured own border-box is valid.
  let parent: Element | null = avatar.parentElement ?? (avatar.getRootNode() as ShadowRoot).host ?? null;
  while (parent) {
    const style = view.getComputedStyle(parent);
    if ([style.transform, style.scale, style.rotate, style.perspective].some(value => value && value !== 'none') || (style.zoom && style.zoom !== '1' && style.zoom !== 'normal')) throw new TypeError('moveToElement does not support transformed or zoomed avatar ancestors; place the avatar directly under an untransformed document body');
    parent = parent.parentElement ?? (parent.getRootNode() as ShadowRoot).host ?? null;
  }
  const from = avatar.getBoundingClientRect(), to = target.getBoundingClientRect();
  for (const rect of [from, to]) for (const value of [rect.left, rect.top, rect.width, rect.height]) if (!Number.isFinite(value)) throw new TypeError('moveToElement requires finite layout rectangles');
  return {
    position: validatePosition({
      x: position.x + to.left - from.left + (to.width - from.width) * horizontal[alignX] + x,
      y: position.y + to.top - from.top + (to.height - from.height) * vertical[alignY] + y,
    }),
    options: moveOptions,
  };
}
