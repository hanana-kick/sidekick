/** Deterministic hashing + PRNG. Same seed always produces the same avatar. */

/** FNV-1a, 32-bit, returned as 8 hex chars. */
export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Widens a hash to 16 hex chars (two FNV rounds) for fewer collisions on long lists. */
export function hashStringWide(input: string): string {
  const a = hashString(input);
  const b = hashString(`${input}\u0000sidekick`);
  return `${a}${b}`;
}

export interface Random {
  next(): number;
  int(min: number, max: number): number;
  range(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[], fallback: T): T;
  sample<T>(items: readonly T[], count: number): T[];
  weighted<T>(items: readonly { value: T; weight: number }[]): T | undefined;
  fork(label: string): Random;
}

/** mulberry32 — small, fast, good enough for cosmetic variation. */
export function createRandom(seed: string | number): Random {
  const seedString = String(seed);
  let state = parseInt(hashString(seedString), 16) >>> 0;
  if (state === 0) state = 0x9e3779b9;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => Math.floor(next() * (max - min + 1)) + min;

  const random: Random = {
    next,
    int,
    range: (min, max) => next() * (max - min) + min,
    chance: (probability) => next() < probability,
    pick: (items, fallback) => (items.length > 0 ? items[Math.floor(next() * items.length)] : fallback),
    sample: (items, count) => {
      const pool = [...items];
      const out: (typeof items)[number][] = [];
      const n = Math.min(count, pool.length);
      for (let i = 0; i < n; i += 1) {
        out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
      }
      return out;
    },
    weighted: (items) => {
      const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
      if (total <= 0) return undefined;
      let ticket = next() * total;
      for (const item of items) {
        ticket -= Math.max(0, item.weight);
        if (ticket <= 0) return item.value;
      }
      return items[items.length - 1]?.value;
    },
    fork: (label) => createRandom(`${seedString}::${label}`),
  };

  return random;
}

/**
 * Smooth deterministic pseudo-noise in [-1, 1]: a sum of incommensurate sines.
 * Used for mouth flapping and idle jitter so motion never looks like a loop.
 */
export function smoothNoise(t: number, seed = 0): number {
  const p = (seed % 1000) * 0.6180339887;
  return (
    (Math.sin(t * 1.0 + p * 6.2831853) +
      Math.sin(t * 2.31 + p * 3.1) * 0.55 +
      Math.sin(t * 4.79 + p * 1.7) * 0.3) /
    1.85
  );
}

let counter = 0;

/** Non-deterministic seed, handy for "random avatar" buttons. */
export function randomSeed(): string {
  counter = (counter + 1) % 1_000_000;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}
