import type { BotState } from './types.js';

export const BOT_STATES = [
  'idle',
  'listening',
  'thinking',
  'speaking',
  'success',
  'error',
  'sleeping',
] as const;

export function isBotState(value: unknown): value is BotState {
  return typeof value === 'string' && (BOT_STATES as readonly string[]).includes(value);
}

/** States that automatically fall back to the last stable state. */
export const TRANSIENT_DURATIONS: Partial<Record<BotState, number>> = {
  speaking: 3200,
  success: 1600,
  error: 2400,
};

/** States that persist until explicitly changed. */
export const STABLE_STATES: readonly BotState[] = ['idle', 'listening', 'thinking'];

export const isTransient = (state: BotState): boolean => state in TRANSIENT_DURATIONS;

/** `sleeping` ignores everything but an explicit `wake()` / `force` request. */
export const isLocked = (state: BotState): boolean => state === 'sleeping';

export interface StateRequestOptions {
  /** Overrides the auto-revert delay (and, for `speaking`, the utterance length). */
  duration?: number;
  /** Bypasses the `sleeping` lock and the "transient owns idle" rule. */
  force?: boolean;
}

export interface StateRequestResult {
  state: BotState;
  changed: boolean;
  /** Where an auto-revert should land. */
  revertTo?: BotState;
  /** Delay before the auto-revert; `undefined` means "no timer needed". */
  scheduleAfter?: number;
  /** Bumped on every accepted transition so callers can invalidate pending timers. */
  revision: number;
}

/**
 * Small pure-ish state machine for the bot's mood.
 *
 * Rules:
 * - unknown states are ignored
 * - `sleeping` locks the machine until `wake()` or a `force` request
 * - while a transient state is active, `idle` requests are ignored (the timer reverts)
 * - transient states remember the last stable state to revert to
 */
export class BotStateMachine {
  #state: BotState;
  #stable: BotState = 'idle';
  #revision = 0;
  #listeners = new Set<(state: BotState, previous: BotState, result: StateRequestResult) => void>();

  constructor(initial: BotState = 'idle') {
    this.#state = initial;
    if (STABLE_STATES.includes(initial)) this.#stable = initial;
  }

  get state(): BotState {
    return this.#state;
  }

  /** The state transient modes revert to. */
  get stable(): BotState {
    return this.#stable;
  }

  get revision(): number {
    return this.#revision;
  }

  onChange(listener: (state: BotState, previous: BotState, result: StateRequestResult) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  request(next: BotState, options: StateRequestOptions = {}): StateRequestResult {
    const { duration, force = false } = options;
    const previous = this.#state;

    const result = (changed: boolean, extra: Partial<StateRequestResult> = {}): StateRequestResult => ({
      state: this.#state,
      changed,
      revision: this.#revision,
      ...extra,
    });

    if (!isBotState(next)) return result(false);
    if (isLocked(previous) && !force && next !== 'sleeping') return result(false);
    if (isTransient(previous) && next === 'idle' && !force) return result(false);

    if (next === previous) {
      if (!isTransient(next)) return result(false);
      return result(false, {
        revertTo: this.#stable,
        scheduleAfter: duration ?? TRANSIENT_DURATIONS[next],
      });
    }

    this.#state = next;
    this.#revision += 1;
    if (STABLE_STATES.includes(next) && next !== 'sleeping') this.#stable = next;

    const extra: Partial<StateRequestResult> = {};
    if (isTransient(next)) {
      extra.revertTo = this.#stable;
      extra.scheduleAfter = duration ?? TRANSIENT_DURATIONS[next];
    }

    for (const listener of [...this.#listeners]) listener(this.#state, previous, result(true, extra));
    return result(true, extra);
  }

  /** Timer callback: returns to the stable state when a transient state expires. */
  revert(expectedState?: BotState): StateRequestResult {
    if (!isTransient(this.#state)) return { state: this.#state, changed: false, revision: this.#revision };
    if (expectedState && this.#state !== expectedState) {
      return { state: this.#state, changed: false, revision: this.#revision };
    }
    return this.request(this.#stable, { force: true });
  }

  wake(): StateRequestResult {
    return this.#state === 'sleeping'
      ? this.request(this.#stable === 'sleeping' ? 'idle' : this.#stable, { force: true })
      : { state: this.#state, changed: false, revision: this.#revision };
  }
}
