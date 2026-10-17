/** Shared value types for placement + state. Rendering types live in `src/avatar/types.ts`. */

export type BotState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'success' | 'error' | 'sleeping';

export type Mood = 'neutral' | 'happy' | 'alert';

/** 3x3 grid keywords accepted by the `anchor` attribute in viewport/contained modes. */
export type AnchorKeyword =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type Side = 'top' | 'right' | 'bottom' | 'left';

/** Side used when the bot is anchored to another element. `auto` picks the roomiest side. */
export type Placement = Side | 'auto';

export type Alignment = 'start' | 'center' | 'end';

/**
 * - `viewport`: `position: fixed`, positioned against the viewport (3x3 grid + insets).
 * - `contained`: `position: absolute`, positioned inside the nearest positioned ancestor.
 * - `anchor`: positioned against another element, re-tracked on scroll/resize.
 * - `free`: explicit coordinates (dragging, `moveTo()`).
 */
export type PlacementMode = 'viewport' | 'contained' | 'anchor' | 'free';

export type Shape = 'circle' | 'squircle' | 'rounded' | 'square';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Offset {
  /** Along the placement axis (anchor mode only). */
  main: number;
  /** Perpendicular to the placement axis. */
  cross: number;
}

export interface Overflow {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PlacementInput {
  mode: PlacementMode;
  /** Grid keyword for `viewport` / `contained` modes. */
  corner?: AnchorKeyword;
  /** Target rect when `mode === 'anchor'`. Injectable for tests. */
  anchorRect?: Rect;
  /** Containing block rect. Caller supplies the viewport rect for `viewport` mode. */
  containerRect?: Rect;
  size: Size;
  placement?: Placement;
  alignment?: Alignment;
  offset?: Offset;
  /** Gap between the avatar and the anchor element. */
  gap?: number;
  /** Minimum distance kept from container edges when clamping. */
  padding?: number;
  insets?: Insets;
  safeArea?: Insets;
  /** Free coordinates for `mode === 'free'`. */
  position?: Point;
  flip?: boolean;
  clamp?: boolean;
  /** Snap grid size in px (`0` disables snapping). */
  snap?: number;
}

export interface PlacementResult {
  /** Translation in the containing block's coordinate space. */
  x: number;
  y: number;
  /** Placement actually used after `auto` resolution + flip. */
  placement: Placement;
  alignment: Alignment;
  /** True when the result was adjusted to stay inside the container. */
  clamped: boolean;
  overflow: Overflow;
}

export interface SavedPosition {
  x: number;
  y: number;
  corner?: AnchorKeyword;
  mode?: PlacementMode;
}
