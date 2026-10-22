import test from 'node:test';
import assert from 'node:assert/strict';
import { createScrollIntent } from '../playground/demo-scroll-intent.js';

// Keep time, canceled callbacks, and the pending queue observable. No real timers
// are used, including when deliberately replaying a canceled callback.
function createHarness(options = {}) {
  let time = 0;
  let nextId = 1;
  let maxPending = 0;
  const pending = new Map();
  const callbacks = new Map();
  const events = [];
  const quietMs = options.quietMs ?? 180;
  const intent = createScrollIntent({
    now: () => time,
    setTimer(callback, delay) {
      assert.ok(delay > 0 && delay <= quietMs, 'settle timers have a bounded delay');
      const id = nextId++;
      callbacks.set(id, callback);
      pending.set(id, { callback, due: time + delay });
      maxPending = Math.max(maxPending, pending.size);
      assert.ok(pending.size <= 1, 'only one settle timer may be pending');
      return id;
    },
    clearTimer: id => pending.delete(id),
    onFast: () => events.push({ type: 'fast', time, blocked: intent.blocked(), fast: intent.fast() }),
    onSettle: () => events.push({ type: 'settle', time, blocked: intent.blocked(), fast: intent.fast() }),
    ...options,
  });
  return {
    intent,
    events,
    pending,
    callbacks,
    count: type => events.filter(event => event.type === type).length,
    maxPending: () => maxPending,
    now: () => time,
    advance(milliseconds) {
      const target = time + milliseconds;
      assert.ok(milliseconds >= 0, 'fake time is monotonic');
      let executions = 0;
      while (true) {
        const next = [...pending.entries()].sort((a, b) => a[1].due - b[1].due)[0];
        if (!next || next[1].due > target) break;
        assert.ok(++executions < 1000, 'there is no permanent timer polling');
        time = next[1].due;
        pending.delete(next[0]);
        next[1].callback();
      }
      time = target;
    },
    sampleAfter(milliseconds, source, x, y, height) {
      this.advance(milliseconds);
      intent.sample(source, x, y, height);
    },
  };
}

test('construction and priming are idle and never poll', () => {
  const h = createHarness();
  h.intent.prime({}, 2400, 9800);
  h.advance(60_000);
  assert.equal(h.intent.blocked(), false);
  assert.equal(h.intent.fast(), false);
  assert.equal(h.callbacks.size, 0);
  assert.deepEqual(h.events, []);
});

test('an unknown source establishes its position without inventing displacement', () => {
  const h = createHarness();
  h.intent.sample({}, 5000, 9000);
  assert.equal(h.intent.fast(), false);
  assert.equal(h.count('fast'), 0);
  h.advance(180);
  assert.equal(h.intent.blocked(), false);
  assert.equal(h.count('settle'), 1);
  assert.equal(h.pending.size, 0);
});

test('a rapid burst cancels once and settles exactly 180 ms after the last sample', () => {
  const h = createHarness();
  const source = {};
  h.intent.prime(source, 0, 0);
  h.sampleAfter(16, source, 0, 18);
  assert.equal(h.intent.fast(), false);
  h.sampleAfter(16, source, 0, 36);
  assert.deepEqual(h.events, [{ type: 'fast', time: 32, blocked: true, fast: true }]);
  for (let y = 54; y <= 108; y += 18) h.sampleAfter(16, source, 0, y);
  assert.equal(h.count('fast'), 1);
  const lastSample = h.now();
  h.advance(179);
  assert.equal(h.intent.blocked(), true);
  assert.equal(h.count('settle'), 0);
  h.advance(1);
  assert.deepEqual(h.events.at(-1), { type: 'settle', time: lastSample + 180, blocked: false, fast: false });
  h.advance(60_000);
  assert.equal(h.count('settle'), 1);
  assert.equal(h.pending.size, 0);
  assert.equal(h.maxPending(), 1);
});

test('large vertical, horizontal, diagonal and viewport-relative jumps cancel immediately', async t => {
  for (const [name, x, y, height] of [
    ['vertical', 0, 110, 600],
    ['horizontal', 110, 0, 600],
    ['diagonal', 80, 80, 600],
    ['small viewport minimum', 0, 72, 100],
    ['tall viewport', 0, 180, 1000],
  ]) {
    await t.test(name, () => {
      const h = createHarness();
      const source = {};
      h.intent.prime(source, 0, 0);
      h.sampleAfter(1000, source, x, y, height);
      assert.equal(h.intent.fast(), true, 'a jump does not depend on a short prior interval');
      assert.equal(h.count('fast'), 1);
      h.advance(180);
      assert.equal(h.count('settle'), 1);
      assert.equal(h.pending.size, 0);
    });
  }
});

test('rapid reversal counts traveled distance instead of net displacement', () => {
  const h = createHarness();
  const source = {};
  h.intent.prime(source, 0, 0);
  h.sampleAfter(16, source, 0, 20);
  h.sampleAfter(16, source, 0, 0);
  assert.equal(h.intent.fast(), true);
  assert.equal(h.count('fast'), 1);
  h.advance(180);
  assert.equal(h.count('settle'), 1);
});

test('continuous small fast steps accumulate into a rapid gesture', () => {
  const h = createHarness();
  const source = {};
  h.intent.prime(source, 0, 0);
  for (let y = 6; y <= 30; y += 6) {
    h.sampleAfter(8, source, 0, y);
    assert.equal(h.intent.fast(), false);
  }
  h.sampleAfter(8, source, 0, 36);
  assert.equal(h.intent.fast(), true);
  for (let y = 42; y <= 240; y += 6) h.sampleAfter(8, source, 0, y);
  assert.equal(h.count('fast'), 1);
  assert.equal(h.count('settle'), 0);
  h.advance(180);
  assert.equal(h.count('settle'), 1);
});

test('one-pixel high-frequency motion is fast accumulation, not a slow inertial tail', () => {
  const h = createHarness();
  const source = {};
  h.intent.prime(source, 0, 0);
  for (let y = 1; y <= 250; y++) h.sampleAfter(1, source, 0, y);
  assert.equal(h.intent.fast(), true);
  assert.equal(h.count('fast'), 1);
  assert.equal(h.count('settle'), 0);
  h.advance(180);
  assert.equal(h.count('settle'), 1);
});

test('slow tiny actual movement preserves live-follow without a fast cancellation', () => {
  const h = createHarness();
  const source = {};
  h.intent.prime(source, 300, 1000);
  for (let y = 1001; y <= 1008; y++) {
    h.sampleAfter(25, source, 300, y);
    assert.equal(h.intent.fast(), false);
  }
  assert.equal(h.count('fast'), 0);
  h.advance(180);
  assert.equal(h.count('settle'), 1);
  assert.equal(h.pending.size, 0);
});

test('ongoing meaningful but slow motion waits for quiet rather than settling mid-scroll', () => {
  const h = createHarness();
  const source = {};
  h.intent.prime(source, 0, 0);
  for (let y = 3; y <= 60; y += 3) h.sampleAfter(50, source, 0, y);
  assert.equal(h.count('fast'), 0);
  assert.equal(h.count('settle'), 0);
  h.advance(179);
  assert.equal(h.count('settle'), 0);
  h.advance(1);
  assert.equal(h.count('settle'), 1);
});

test('a sustained tiny inertial tail settles without requiring total silence', () => {
  const h = createHarness();
  const source = {};
  h.intent.prime(source, 0, 0);
  h.sampleAfter(10, source, 0, 120);
  for (let i = 1; i <= 11; i++) h.sampleAfter(16, source, 0, 120 + i);
  assert.equal(h.count('settle'), 0);
  h.sampleAfter(16, source, 0, 132);
  assert.equal(h.count('settle'), 1, 'settles on an arriving tail sample, before its quiet timer');
  assert.equal(h.intent.fast(), false);
  assert.equal(h.intent.blocked(), false);
  assert.equal(h.pending.size, 0);
  h.advance(60_000);
  assert.equal(h.count('settle'), 1);
});

test('an uninterrupted tiny tail does not repeatedly complete the same rapid gesture', () => {
  const h = createHarness();
  const source = {};
  h.intent.prime(source, 0, 0);
  h.sampleAfter(10, source, 0, 120);
  for (let i = 1; i <= 40; i++) h.sampleAfter(16, source, 0, 120 + i);
  h.advance(180);
  assert.equal(h.count('fast'), 1);
  assert.equal(h.count('settle'), 1);
  assert.equal(h.pending.size, 0);
});

test('meaningful motion after a settled tail starts a fresh gesture from the latest position', () => {
  const h = createHarness();
  const source = {};
  h.intent.prime(source, 0, 0);
  h.sampleAfter(10, source, 0, 120);
  for (let i = 1; i <= 40; i++) h.sampleAfter(16, source, 0, 120 + i);
  assert.equal(h.count('settle'), 1);
  assert.equal(h.pending.size, 0);
  h.sampleAfter(50, source, 0, 163);
  assert.equal(h.intent.blocked(), true, 'new meaningful movement reopens the gesture');
  assert.equal(h.intent.fast(), false, 'ignored tail samples still update the position baseline');
  h.sampleAfter(16, source, 0, 283);
  assert.equal(h.count('fast'), 2);
  h.advance(180);
  assert.equal(h.count('settle'), 2);
  assert.equal(h.pending.size, 0);
});

test('window and nested sources have independent position and movement histories', () => {
  const h = createHarness();
  const outer = {};
  const inner = {};
  h.intent.prime(outer, 0, 5000);
  h.intent.prime(inner, 2000, 0);
  h.sampleAfter(16, outer, 0, 5020);
  h.sampleAfter(16, inner, 2000, 20);
  assert.equal(h.count('fast'), 0, 'unrelated source distances must not combine');
  h.sampleAfter(16, outer, 0, 5040);
  assert.equal(h.count('fast'), 1, 'the outer source retains its own rapid history');
  h.advance(180);
  assert.equal(h.count('settle'), 1);
});

test('priming a changed initial position replaces stale speed history without callbacks', () => {
  const h = createHarness();
  const source = {};
  h.intent.prime(source, 0, 0);
  h.sampleAfter(16, source, 0, 20);
  const timerCount = h.callbacks.size;
  h.intent.prime(source, 8000, 9000);
  assert.equal(h.callbacks.size, timerCount, 'prime does not schedule work');
  h.sampleAfter(16, source, 8000, 9020);
  assert.equal(h.count('fast'), 0, 'prime discards prior coordinates and accumulated travel');
  h.advance(180);
  assert.equal(h.count('settle'), 1);
});

test('canceled callbacks cannot settle a more recent sample or a later gesture', () => {
  const h = createHarness();
  const source = {};
  h.intent.prime(source, 0, 0);
  h.sampleAfter(10, source, 0, 120);
  const firstCallback = [...h.callbacks.values()].at(-1);
  h.sampleAfter(16, source, 0, 140);
  firstCallback();
  assert.equal(h.count('settle'), 0);
  assert.equal(h.intent.fast(), true);
  assert.equal(h.pending.size, 1);
  h.advance(180);
  assert.equal(h.count('settle'), 1);
  const previousCallbacks = [...h.callbacks.values()];
  h.sampleAfter(16, source, 0, 300);
  for (const callback of previousCallbacks) callback();
  assert.equal(h.count('settle'), 1);
  assert.equal(h.intent.fast(), true);
  h.advance(180);
  assert.equal(h.count('fast'), 2);
  assert.equal(h.count('settle'), 2);
  assert.equal(h.pending.size, 0);
});

test('reset cancels work, clears all source baselines, and makes canceled callbacks inert', () => {
  const h = createHarness();
  const source = {};
  h.intent.prime(source, 0, 0);
  h.sampleAfter(10, source, 0, 120);
  const stale = [...h.callbacks.values()].at(-1);
  h.intent.reset();
  assert.equal(h.pending.size, 0);
  assert.equal(h.intent.blocked(), false);
  assert.equal(h.intent.fast(), false);
  stale();
  h.sampleAfter(16, source, 0, 9000);
  assert.equal(h.intent.fast(), false, 'first post-reset position is not a jump');
  stale();
  assert.equal(h.count('settle'), 0);
  h.advance(180);
  assert.equal(h.count('settle'), 1);
  assert.equal(h.count('fast'), 1);
});

test('geometry changes defer revalidation without manufacturing fast scroll intent', () => {
  const h = createHarness();
  h.intent.geometry();
  assert.equal(h.intent.blocked(), true);
  assert.equal(h.intent.fast(), false);
  assert.equal(h.count('fast'), 0);
  h.advance(179);
  assert.equal(h.count('settle'), 0);
  h.advance(1);
  assert.equal(h.count('settle'), 1);
  assert.equal(h.intent.blocked(), false);
  assert.equal(h.pending.size, 0);
  h.advance(60_000);
  assert.equal(h.count('settle'), 1);
});

test('repeated geometry changes retain one timer and make earlier callbacks inert', () => {
  const h = createHarness();
  h.intent.geometry();
  const original = [...h.callbacks.values()].at(-1);
  h.advance(100);
  h.intent.geometry();
  original();
  assert.equal(h.count('settle'), 0);
  h.advance(179);
  assert.equal(h.count('settle'), 0);
  h.advance(1);
  assert.equal(h.count('settle'), 1);
  assert.equal(h.count('fast'), 0);
  assert.equal(h.maxPending(), 1);
});

test('geometry changes and baseline priming preserve a latched rapid gesture until revalidation', () => {
  const h = createHarness();
  const source = {};
  h.intent.prime(source, 0, 0);
  h.sampleAfter(10, source, 0, 120);
  const scrollTimer = [...h.callbacks.values()].at(-1);
  h.advance(100);
  h.intent.geometry();
  h.intent.prime(source, 5000, 9000);
  scrollTimer();
  assert.equal(h.intent.fast(), true);
  assert.equal(h.intent.blocked(), true);
  assert.equal(h.count('fast'), 1);
  assert.equal(h.count('settle'), 0);
  h.sampleAfter(16, source, 5000, 9001);
  assert.equal(h.count('fast'), 1);
  h.advance(179);
  assert.equal(h.count('settle'), 0);
  h.advance(1);
  assert.equal(h.count('settle'), 1);
  assert.equal(h.intent.fast(), false);
});

test('geometry revalidates a previously settled viewport once even without new scrolling', () => {
  const h = createHarness();
  const source = {};
  h.intent.prime(source, 0, 0);
  h.sampleAfter(10, source, 0, 120);
  h.advance(180);
  assert.equal(h.count('settle'), 1);
  h.intent.geometry();
  assert.equal(h.intent.blocked(), true);
  assert.equal(h.intent.fast(), false);
  h.advance(180);
  assert.equal(h.count('settle'), 2);
  assert.equal(h.count('fast'), 1);
  assert.equal(h.pending.size, 0);
});

test('dispose is idempotent and all future samples and stale callbacks are harmless', () => {
  const h = createHarness();
  const source = {};
  h.intent.prime(source, 0, 0);
  h.sampleAfter(10, source, 0, 120);
  const stale = [...h.callbacks.values()].at(-1);
  h.intent.dispose();
  h.intent.dispose();
  h.intent.reset();
  h.intent.prime(source, 8000, 8000);
  h.intent.geometry();
  stale();
  h.sampleAfter(16, source, 0, 20_000);
  h.advance(60_000);
  assert.equal(h.intent.blocked(), false);
  assert.equal(h.intent.fast(), false);
  assert.equal(h.pending.size, 0);
  assert.equal(h.count('settle'), 0);
  assert.equal(h.count('fast'), 1);
  assert.equal(h.callbacks.size, 1);
});

test('the quiet-period option also uses one bounded one-shot timer', () => {
  const h = createHarness({ quietMs: 90 });
  const source = {};
  h.intent.prime(source, 0, 0);
  h.sampleAfter(10, source, 0, 120);
  h.advance(89);
  assert.equal(h.count('settle'), 0);
  h.advance(1);
  assert.equal(h.count('settle'), 1);
  assert.equal(h.pending.size, 0);
});

test('a never-seen nested source opens a dwell after the outer source settles without inventing velocity', () => {
  const h = createHarness();
  const outer = {};
  const nested = {};
  h.intent.prime(outer, 0, 0);
  h.sampleAfter(10, outer, 0, 120);
  h.advance(180);
  assert.equal(h.count('settle'), 1);
  assert.equal(h.intent.blocked(), false);
  h.sampleAfter(16, nested, 0, 500);
  assert.equal(h.intent.blocked(), true, 'a new source must get its own dwell');
  assert.equal(h.intent.fast(), false, 'an unknown initial offset is not traveled distance');
  assert.equal(h.count('fast'), 1, 'only the earlier outer gesture was classified fast');
  assert.equal(h.pending.size, 1);
  h.advance(179);
  assert.equal(h.count('settle'), 1);
  h.advance(1);
  assert.equal(h.count('settle'), 2);
  assert.equal(h.intent.blocked(), false);
  assert.equal(h.pending.size, 0);
  h.advance(60_000);
  assert.equal(h.count('settle'), 2);
});
