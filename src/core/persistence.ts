import type { SavedPosition } from './types.js';
import { isFiniteNumber } from './geometry.js';

export interface PositionStore {
  load(key: string): SavedPosition | null;
  save(key: string, value: SavedPosition): void;
  clear(key: string): void;
}

const isSavedPosition = (value: unknown): value is SavedPosition => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SavedPosition>;
  return isFiniteNumber(candidate.x) && isFiniteNumber(candidate.y);
};

function parse(raw: string | null): SavedPosition | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSavedPosition(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * localStorage-backed store that never throws (private mode / quota / disabled storage).
 * `storage` is injectable for tests.
 */
export function createLocalStore(
  storage: Storage | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined,
  prefix = 'sidekick',
): PositionStore {
  const scoped = (key: string) => `${prefix}:${key}`;
  return {
    load(key) {
      try {
        return parse(storage?.getItem(scoped(key)) ?? null);
      } catch {
        return null;
      }
    },
    save(key, value) {
      try {
        storage?.setItem(scoped(key), JSON.stringify(value));
      } catch {
        /* storage unavailable: position memory is best-effort */
      }
    },
    clear(key) {
      try {
        storage?.removeItem(scoped(key));
      } catch {
        /* ignore */
      }
    },
  };
}

/** In-memory store; also the SSR / no-storage fallback. */
export function createMemoryStore(initial: Record<string, SavedPosition> = {}): PositionStore {
  const map = new Map(Object.entries(initial));
  return {
    load: (key) => map.get(key) ?? null,
    save: (key, value) => void map.set(key, value),
    clear: (key) => void map.delete(key),
  };
}

export const noopStore: PositionStore = {
  load: () => null,
  save: () => undefined,
  clear: () => undefined,
};
