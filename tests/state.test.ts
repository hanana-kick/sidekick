import { describe, expect, it } from 'vitest';
import { BotStateMachine, isBotState, isLocked, isTransient } from '../src/core/state.js';

describe('BotStateMachine', () => {
  it('accepts known states only', () => {
    expect(isBotState('thinking')).toBe(true);
    expect(isBotState('dancing')).toBe(false);
  });

  it('bumps the revision on every accepted change', () => {
    const machine = new BotStateMachine('idle');
    const result = machine.request('thinking');
    expect(result.changed).toBe(true);
    expect(machine.state).toBe('thinking');
    expect(machine.revision).toBe(1);
    expect(machine.request('thinking').changed).toBe(false);
  });

  it('notifies listeners with the previous state', () => {
    const machine = new BotStateMachine('idle');
    const seen: Array<[string, string]> = [];
    machine.onChange((state, previous) => seen.push([state, previous]));
    machine.request('speaking');
    machine.request('idle', { force: true });
    expect(seen).toEqual([
      ['speaking', 'idle'],
      ['idle', 'speaking'],
    ]);
  });

  it('schedules a revert for transient states', () => {
    const machine = new BotStateMachine('idle');
    const result = machine.request('success');
    expect(isTransient('success')).toBe(true);
    expect(result.revertTo).toBe('idle');
    expect(result.scheduleAfter).toBeGreaterThan(0);

    expect(machine.revert('success').changed).toBe(true);
    expect(machine.state).toBe('idle');
  });

  it('ignores a stale revert', () => {
    const machine = new BotStateMachine('idle');
    machine.request('success');
    expect(machine.revert('error').changed).toBe(false);
    expect(machine.state).toBe('success');
  });

  it('does not revert to idle while a transient state owns the machine', () => {
    const machine = new BotStateMachine('idle');
    machine.request('speaking');
    expect(machine.request('idle').changed).toBe(false);
    expect(machine.state).toBe('speaking');
  });

  it('locks a sleeping bot unless forced', () => {
    const machine = new BotStateMachine('idle');
    machine.request('sleeping');
    expect(isLocked('sleeping')).toBe(true);
    expect(machine.request('thinking').changed).toBe(false);
    expect(machine.request('thinking', { force: true }).changed).toBe(true);
  });

  it('remembers the last stable state as the revert target', () => {
    const machine = new BotStateMachine('idle');
    machine.request('listening');
    machine.request('success');
    expect(machine.revert('success').state).toBe('listening');
  });

  it('unsubscribes', () => {
    const machine = new BotStateMachine('idle');
    let count = 0;
    const off = machine.onChange(() => (count += 1));
    off();
    machine.request('thinking');
    expect(count).toBe(0);
  });
});
