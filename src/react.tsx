import { createElement, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { defineElements } from './elements/define.js';
import type { BotState, Mood } from './core/types.js';
import type { AvatarItem, AvatarMode, BodyShapeKind, EyeKind, MouthKind } from './avatar/types.js';

defineElements();

type CommonProps = {
  className?: string;
  style?: CSSProperties;
  id?: string;
  hidden?: boolean;
  role?: string;
  'aria-label'?: string;
  children?: ReactNode;
};

export interface SkkAvatarProps extends CommonProps {
  seed?: string;
  mode?: AvatarMode;
  shape?: BodyShapeKind;
  eyes?: EyeKind;
  mouth?: MouthKind;
  accessories?: string;
  hue?: number;
  state?: BotState;
  mood?: Mood;
  size?: number;
  reducedMotion?: boolean;
  paused?: boolean;
  avatar?: AvatarItem;
}

export interface SkkBotProps extends SkkAvatarProps {
  position?: string;
  positionMode?: 'fixed' | 'absolute';
  anchorSelector?: string;
  placement?: string;
  alignment?: string;
  gap?: number;
  offsetX?: number;
  offsetY?: number;
  margin?: number;
  padding?: number;
  drag?: boolean;
  persist?: boolean | string;
  snap?: number;
  portal?: boolean;
  zIndex?: number;
}

export interface SkkBubbleProps extends CommonProps {
  message?: string;
  variant?: 'info' | 'success' | 'warning' | 'error' | 'thinking';
  tail?: 'none' | 'top' | 'bottom' | 'left' | 'right';
  duration?: number;
  open?: boolean;
  dismissible?: boolean;
}

/** Object/array props cannot travel through HTML attributes, so they become properties. */
const PROPERTY_PROPS = new Set(['accessories', 'avatar', 'offset']);

function applyProps(el: HTMLElement, props: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || key === 'className' || key === 'style' || value === undefined) continue;
    if (PROPERTY_PROPS.has(key) || typeof value === 'object') {
      (el as unknown as Record<string, unknown>)[key] = value;
    } else if (typeof value === 'boolean') {
      if (value) el.setAttribute(key, '');
      else el.removeAttribute(key);
    } else {
      el.setAttribute(key, String(value));
    }
  }
}

function useCustomElement(props: Record<string, unknown>) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (ref.current) applyProps(ref.current, props);
  }, [props]);
  return ref;
}

/**
 * Thin React wrappers. They render the custom element directly and forward
 * non-primitive props as properties, which is what the engine expects.
 */
export function SkkAvatar(props: SkkAvatarProps) {
  const ref = useCustomElement(props as unknown as Record<string, unknown>);
  return createElement('skk-avatar', { ref, className: props.className, style: props.style });
}

export function SkkBot(props: SkkBotProps) {
  const ref = useCustomElement(props as unknown as Record<string, unknown>);
  return createElement('skk-bot', { ref, className: props.className, style: props.style }, props.children);
}

export function SkkBubble(props: SkkBubbleProps) {
  const ref = useCustomElement(props as unknown as Record<string, unknown>);
  return createElement('skk-bubble', { ref, className: props.className, style: props.style }, props.children);
}

/** Imperative helpers for callers holding a ref to the rendered element. */
export function requestState(el: HTMLElement | null | undefined, state: BotState): void {
  (el as unknown as { request?: (state: BotState) => void })?.request?.(state);
}

export function moveBotTo(
  el: HTMLElement | null | undefined,
  x: number,
  y: number,
  options: { persist?: boolean } = {},
): void {
  (el as unknown as { moveTo?: (x: number, y: number, options?: { persist?: boolean }) => void })?.moveTo?.(
    x,
    y,
    options,
  );
}
