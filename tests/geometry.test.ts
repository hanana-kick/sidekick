import { describe, expect, it } from 'vitest';
import {
  anchorRect,
  clampRect,
  computePlacement,
  emptyInsets,
  flipSide,
  nearestEdge,
  normalizeInsets,
  parseAnchorKeyword,
  placeAgainstAnchor,
  resolvePlacement,
  snap,
} from '../src/core/geometry.js';

const viewport = { x: 0, y: 0, width: 1000, height: 800 };
const size = { width: 64, height: 64 };

describe('anchorRect', () => {
  it('places the four corners against the container edges', () => {
    expect(anchorRect(viewport, size, 'bottom-right')).toEqual({
      x: 936,
      y: 736,
      width: 64,
      height: 64,
    });
    expect(anchorRect(viewport, size, 'top-left')).toEqual({ x: 0, y: 0, width: 64, height: 64 });
    expect(anchorRect(viewport, size, 'center')).toEqual({ x: 468, y: 368, width: 64, height: 64 });
  });

  it('honours insets and safe areas', () => {
    const placed = anchorRect(
      viewport,
      size,
      'bottom-right',
      { ...emptyInsets(), bottom: 20 },
      emptyInsets(),
    );
    expect(placed.y).toBe(716);
  });
});

describe('placement helpers', () => {
  it('flips sides', () => {
    expect(flipSide('top')).toBe('bottom');
    expect(flipSide('left')).toBe('right');
  });

  it('parses anchor keywords in both orders and separators', () => {
    expect(parseAnchorKeyword('bottom-right', 'top-left')).toBe('bottom-right');
    expect(parseAnchorKeyword('right bottom', 'top-left')).toBe('bottom-right');
    expect(parseAnchorKeyword('nonsense', 'top-left')).toBe('top-left');
    expect(parseAnchorKeyword(null, 'top-left')).toBe('top-left');
  });

  it('normalizes insets from numbers and partials', () => {
    expect(normalizeInsets(8)).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
    expect(normalizeInsets({ top: 4 })).toEqual({ top: 4, right: 0, bottom: 0, left: 0 });
    expect(normalizeInsets(undefined)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('snaps to a grid', () => {
    expect(snap(37, 10)).toBe(40);
    expect(snap(37, 0)).toBe(37);
  });

  it('clamps back into the container', () => {
    const point = clampRect({ x: 1200, y: -50, width: 64, height: 64 }, viewport, 0);
    expect(point).toEqual({ x: 936, y: 0 });
  });

  it('picks the roomiest side for auto placement', () => {
    const anchor = { x: 20, y: 20, width: 40, height: 40 };
    expect(resolvePlacement(anchor, viewport, size, 'auto', 8, 8)).toBe('right');
    const bottomAnchor = { x: 460, y: 740, width: 40, height: 40 };
    expect(resolvePlacement(bottomAnchor, viewport, size, 'auto', 8, 8)).toBe('top');
  });
});

describe('placeAgainstAnchor', () => {
  const anchor = { x: 400, y: 400, width: 48, height: 48 };

  it('positions below the anchor with gap and offset', () => {
    const result = placeAgainstAnchor({
      anchor,
      bounds: viewport,
      size,
      placement: 'bottom',
      alignment: 'center',
      gap: 12,
      offset: { main: 4, cross: -10 },
    });
    expect(result.y).toBe(464);
    expect(result.x).toBe(382);
    expect(result.placement).toBe('bottom');
  });

  it('flips when there is no room on the requested side', () => {
    const nearBottom = { x: 400, y: 760, width: 48, height: 48 };
    const result = placeAgainstAnchor({
      anchor: nearBottom,
      bounds: viewport,
      size,
      placement: 'bottom',
      alignment: 'center',
      gap: 8,
    });
    expect(result.placement).toBe('top');
  });
});

describe('computePlacement', () => {
  it('positions a viewport bot in the bottom-right corner', () => {
    const result = computePlacement({
      mode: 'viewport',
      corner: 'bottom-right',
      containerRect: viewport,
      size,
      padding: 16,
    });
    expect(result.x).toBe(920);
    expect(result.y).toBe(720);
    expect(result.clamped).toBe(false);
  });

  it('keeps a dragged bot inside the container', () => {
    const result = computePlacement({
      mode: 'free',
      containerRect: viewport,
      size,
      position: { x: 5000, y: 5000 },
      padding: 8,
    });
    expect(result.x).toBe(928);
    expect(result.y).toBe(728);
    expect(result.clamped).toBe(true);
  });

  it('snaps free coordinates to the grid', () => {
    const result = computePlacement({
      mode: 'free',
      containerRect: viewport,
      size,
      position: { x: 123, y: 456 },
      snap: 25,
    });
    expect(result.x).toBe(125);
    expect(result.y).toBe(450);
  });

  it('uses the stored position untouched in free mode when clamping is off', () => {
    const result = computePlacement({
      mode: 'free',
      containerRect: viewport,
      size,
      position: { x: -50, y: -50 },
      clamp: false,
    });
    expect(result).toMatchObject({ x: -50, y: -50, clamped: false });
  });
});

describe('nearestEdge', () => {
  it('reports the edge a floating element is closest to', () => {
    expect(nearestEdge({ x: 10, y: 400 }, size, { width: 1000, height: 800 })).toBe('left');
    expect(nearestEdge({ x: 960, y: 400 }, size, { width: 1000, height: 800 })).toBe('right');
  });
});
