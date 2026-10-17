import type {
  Alignment,
  AnchorKeyword,
  Insets,
  Overflow,
  Placement,
  PlacementInput,
  PlacementResult,
  Point,
  Rect,
  Side,
  Size,
} from './types.js';

export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);

export const snap = (v: number, grid: number): number => (grid > 0 ? Math.round(v / grid) * grid : v);

export const finite = (v: number | undefined, fallback = 0): number =>
  Number.isFinite(v as number) ? (v as number) : fallback;

export const emptyInsets = (v = 0): Insets => ({ top: v, right: v, bottom: v, left: v });

export const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const SIDES: readonly Side[] = ['bottom', 'top', 'right', 'left'];

export const flipSide = (side: Side): Side =>
  side === 'top' ? 'bottom' : side === 'bottom' ? 'top' : side === 'left' ? 'right' : 'left';

export function normalizeInsets(input: Partial<Insets> | number | undefined): Insets {
  if (typeof input === 'number') return emptyInsets(input);
  return {
    top: finite(input?.top),
    right: finite(input?.right),
    bottom: finite(input?.bottom),
    left: finite(input?.left),
  };
}

/** Parses the `anchor` attribute: `"bottom-right"`, `"bottom right"`, `"center"`, ... */
export function parseAnchorKeyword(raw: string | null | undefined, fallback: AnchorKeyword): AnchorKeyword {
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, '-');
  const tokens = normalized.split('-').filter(Boolean);
  const vertical = tokens.find((t) => t === 'top' || t === 'bottom');
  const horizontal = tokens.find((t) => t === 'left' || t === 'right' || t === 'center');
  const primary = vertical
    ? `${vertical}-${horizontal ?? 'center'}`
    : horizontal
      ? `center-${horizontal}`
      : normalized;
  const valid: readonly AnchorKeyword[] = [
    'top-left',
    'top-center',
    'top-right',
    'center-left',
    'center',
    'center-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ];
  return (valid as readonly string[]).includes(primary) ? (primary as AnchorKeyword) : fallback;
}

export function overflowOf(rect: Rect, bounds: Rect, padding = 0): Overflow {
  return {
    top: bounds.y + padding - rect.y,
    left: bounds.x + padding - rect.x,
    right: rect.x + rect.width - (bounds.x + bounds.width - padding),
    bottom: rect.y + rect.height - (bounds.y + bounds.height - padding),
  };
}

const hasOverflow = (o: Overflow): boolean => o.top > 0.5 || o.right > 0.5 || o.bottom > 0.5 || o.left > 0.5;

/** Moves `rect` inside `bounds`, preferring to keep the primary axis untouched. */
export function clampRect(rect: Rect, bounds: Rect, padding = 0): Point {
  const maxX = bounds.x + bounds.width - padding - rect.width;
  const maxY = bounds.y + bounds.height - padding - rect.height;
  return {
    x: maxX < bounds.x + padding ? bounds.x + padding : clamp(rect.x, bounds.x + padding, maxX),
    y: maxY < bounds.y + padding ? bounds.y + padding : clamp(rect.y, bounds.y + padding, maxY),
  };
}

/** Rect for a 3x3 grid keyword, honouring insets + safe area. */
export function anchorRect(
  bounds: Rect,
  size: Size,
  corner: AnchorKeyword,
  insets: Insets = emptyInsets(),
  safeArea: Insets = emptyInsets(),
): Rect {
  const tokens = corner.split('-');
  const vertical = tokens.includes('top') ? 'top' : tokens.includes('bottom') ? 'bottom' : 'center';
  const horizontal = tokens.includes('left') ? 'left' : tokens.includes('right') ? 'right' : 'center';
  const left = bounds.x + insets.left + safeArea.left;
  const right = bounds.x + bounds.width - insets.right - safeArea.right - size.width;
  const top = bounds.y + insets.top + safeArea.top;
  const bottom = bounds.y + bounds.height - insets.bottom - safeArea.bottom - size.height;

  const x = horizontal === 'right' ? right : horizontal === 'center' ? left + (right - left) / 2 : left;
  const y = vertical === 'bottom' ? bottom : vertical === 'center' ? top + (bottom - top) / 2 : top;

  return { x, y, width: size.width, height: size.height };
}

function crossCoordinate(anchor: Rect, size: Size, side: Side, alignment: Alignment, cross: number): number {
  if (side === 'top' || side === 'bottom') {
    const base =
      alignment === 'start'
        ? anchor.x
        : alignment === 'end'
          ? anchor.x + anchor.width - size.width
          : anchor.x + (anchor.width - size.width) / 2;
    return base + cross;
  }
  const base =
    alignment === 'start'
      ? anchor.y
      : alignment === 'end'
        ? anchor.y + anchor.height - size.height
        : anchor.y + (anchor.height - size.height) / 2;
  return base + cross;
}

function mainRect(anchor: Rect, size: Size, side: Side, gap: number, main: number): Rect {
  switch (side) {
    case 'top':
      return { x: 0, y: anchor.y - gap - size.height - main, width: size.width, height: size.height };
    case 'bottom':
      return { x: 0, y: anchor.y + anchor.height + gap + main, width: size.width, height: size.height };
    case 'left':
      return { x: anchor.x - gap - size.width - main, y: 0, width: size.width, height: size.height };
    default:
      return { x: anchor.x + anchor.width + gap + main, y: 0, width: size.width, height: size.height };
  }
}

/** Room available on `side`, used to resolve `auto` and to decide flips. */
function roomOn(anchor: Rect, bounds: Rect, side: Side, gap: number, size: Size, padding: number): number {
  switch (side) {
    case 'top':
      return anchor.y - padding - bounds.y - size.height - gap;
    case 'bottom':
      return bounds.y + bounds.height - padding - (anchor.y + anchor.height) - size.height - gap;
    case 'left':
      return anchor.x - padding - bounds.x - size.width - gap;
    default:
      return bounds.x + bounds.width - padding - (anchor.x + anchor.width) - size.width - gap;
  }
}

export function resolvePlacement(
  anchor: Rect,
  bounds: Rect,
  size: Size,
  placement: Placement,
  gap: number,
  padding: number,
): Side {
  if (placement !== 'auto') return placement;
  let best: Side = 'bottom';
  let bestRoom = -Infinity;
  for (const side of SIDES) {
    const room = roomOn(anchor, bounds, side, gap, size, padding);
    if (room > bestRoom) {
      bestRoom = room;
      best = side;
    }
  }
  return best;
}

export function placeAgainstAnchor(input: {
  anchor: Rect;
  bounds: Rect;
  size: Size;
  placement: Placement;
  alignment?: Alignment;
  gap?: number;
  offset?: { main: number; cross: number };
  padding?: number;
  flip?: boolean;
  clamp?: boolean;
}): PlacementResult {
  const {
    anchor,
    bounds,
    size,
    placement: requested,
    alignment = 'center',
    gap = 8,
    offset = { main: 0, cross: 0 },
    padding = 8,
    flip = true,
    clamp: shouldClamp = true,
  } = input;

  let side = resolvePlacement(anchor, bounds, size, requested, gap, padding);
  let rect = mainRect(anchor, size, side, gap, offset.main);
  rect.x = crossCoordinate(anchor, size, side, alignment, offset.cross);

  if (flip && hasOverflow(overflowOf(rect, bounds, padding))) {
    const opposite = flipSide(side);
    const candidate = mainRect(anchor, size, opposite, gap, offset.main);
    candidate.x = crossCoordinate(anchor, size, side, alignment, offset.cross);
    if (
      roomOn(anchor, bounds, opposite, gap, size, padding) > roomOn(anchor, bounds, side, gap, size, padding)
    ) {
      side = opposite;
      rect = candidate;
    }
  }

  let clamped = false;
  let position: Point = { x: rect.x, y: rect.y };
  if (shouldClamp) {
    const fixed = clampRect(rect, bounds, padding);
    clamped = Math.abs(fixed.x - rect.x) > 0.5 || Math.abs(fixed.y - rect.y) > 0.5;
    position = fixed;
  }

  return {
    x: position.x,
    y: position.y,
    placement: side,
    alignment,
    clamped,
    overflow: overflowOf({ ...position, width: size.width, height: size.height }, bounds, padding),
  };
}

/**
 * Pure placement solver. All DOM measurements are injected so it is unit-testable.
 * Coordinates are in the containing block's space (viewport for `fixed`).
 */
export function computePlacement(input: PlacementInput): PlacementResult {
  const size = { width: finite(input.size.width), height: finite(input.size.height) };
  const padding = finite(input.padding, 8);
  const insets = normalizeInsets(input.insets);
  const safeArea = normalizeInsets(input.safeArea);
  const bounds: Rect = input.containerRect ?? { x: 0, y: 0, width: 0, height: 0 };

  if (input.mode === 'free') {
    const x = snap(finite(input.position?.x), finite(input.snap));
    const y = snap(finite(input.position?.y), finite(input.snap));
    let clamped = false;
    let point: Point = { x, y };
    if (input.clamp !== false) {
      const fixed = clampRect({ x, y, ...size }, bounds, padding);
      clamped = Math.abs(fixed.x - x) > 0.5 || Math.abs(fixed.y - y) > 0.5;
      point = fixed;
    }
    return {
      x: point.x,
      y: point.y,
      placement: 'bottom',
      alignment: 'center',
      clamped,
      overflow: overflowOf({ ...point, width: size.width, height: size.height }, bounds, padding),
    };
  }

  if (input.mode === 'anchor' && input.anchorRect) {
    const result = placeAgainstAnchor({
      anchor: input.anchorRect,
      bounds,
      size,
      placement: input.placement ?? 'auto',
      alignment: input.alignment,
      gap: finite(input.gap, 8),
      offset: input.offset,
      padding,
      flip: input.flip !== false,
      clamp: input.clamp !== false,
    });
    return {
      ...result,
      x: result.x - bounds.x,
      y: result.y - bounds.y,
      clamped: result.clamped,
    };
  }

  const pad: Insets = {
    top: insets.top + padding,
    right: insets.right + padding,
    bottom: insets.bottom + padding,
    left: insets.left + padding,
  };
  const rect = anchorRect(bounds, size, input.corner ?? 'bottom-right', pad, safeArea);
  let point: Point = { x: rect.x, y: rect.y };
  let clamped = false;
  if (input.clamp !== false) {
    const fixed = clampRect(rect, bounds, padding);
    clamped = Math.abs(fixed.x - rect.x) > 0.5 || Math.abs(fixed.y - rect.y) > 0.5;
    point = fixed;
  }
  if (input.snap) {
    point = { x: snap(point.x, input.snap), y: snap(point.y, input.snap) };
  }
  return {
    x: point.x - bounds.x,
    y: point.y - bounds.y,
    placement: 'bottom',
    alignment: 'center',
    clamped,
    overflow: overflowOf({ ...point, width: size.width, height: size.height }, bounds, padding),
  };
}

/** Nearest viewport edge, used by `edge-dock` after a drag. */
export function nearestEdge(point: Point, size: Size, viewport: Size): Side {
  const cx = point.x + size.width / 2;
  const cy = point.y + size.height / 2;
  const distances: [Side, number][] = [
    ['left', cx],
    ['right', viewport.width - cx],
    ['top', cy],
    ['bottom', viewport.height - cy],
  ];
  distances.sort((a, b) => a[1] - b[1]);
  return distances[0][0];
}
