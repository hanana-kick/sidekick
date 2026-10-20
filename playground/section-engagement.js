/** Foreground, focused, non-idle dwell. No DOM text or input values are read. */
export const ACTIVE_IDLE_MS = 30_000;
export const ENGAGEMENT_FLUSH_MS = 30_000;
export function createSectionEngagement(win, { emit, initialSection, now = () => win.performance.now() }) {
  let section = initialSection, enabled = false, active = false, last = now(), interaction = last, flushed = last, duration = 0, timer;
  const visible = () => win.document.visibilityState === 'visible' && win.document.hasFocus();
  const accrue = () => {
    const time = now();
    if (active) duration = Math.min(300_000, duration + Math.max(0, Math.min(time, interaction + ACTIVE_IDLE_MS) - last));
    last = time;
    if (time >= interaction + ACTIVE_IDLE_MS) active = false;
  };
  function flush(reason) {
    accrue();
    let measured = Math.floor(duration); duration = 0; flushed = now();
    // Preserve late-timer backlog in bounded aggregates, at most 5 minutes/10 events.
    while (enabled && measured > 0) {
      const chunk = Math.min(ENGAGEMENT_FLUSH_MS, measured); measured -= chunk;
      emit('section_engagement', { ...section, active_duration_ms: chunk, end_reason: reason });
    }
  }
  function schedule() {
    win.clearTimeout(timer); timer = undefined;
    if (!enabled || !active) return;
    timer = win.setTimeout(() => { flush(now() >= interaction + ACTIVE_IDLE_MS ? 'idle' : 'heartbeat'); schedule(); }, Math.max(1, Math.min(flushed + ENGAGEMENT_FLUSH_MS - now(), interaction + ACTIVE_IDLE_MS - now())));
  }
  function activity() {
    if (!enabled || !visible()) return;
    accrue(); interaction = now(); last = interaction;
    if (!active && duration === 0) flushed = interaction;
    active = true; schedule();
  }
  function pause(reason) { flush(reason); active = false; win.clearTimeout(timer); }
  function visibility() { if (visible()) activity(); else pause('hidden'); }
  const onBlur = () => pause('blur');
  const onHide = () => pause('pagehide');
  for (const event of ['pointerdown', 'keydown', 'scroll', 'touchstart']) win.addEventListener(event, activity, { passive: true, capture: true });
  win.addEventListener('focus', activity); win.addEventListener('blur', onBlur);
  win.addEventListener('pagehide', onHide); win.addEventListener('pageshow', visibility);
  win.document.addEventListener('visibilitychange', visibility);
  return {
    setEnabled(value) {
      if (value === enabled) return;
      // Withdrawal discards pending dwell instead of transmitting another event.
      enabled = value; active = false; duration = 0; last = now(); flushed = last; win.clearTimeout(timer);
      if (enabled) activity();
    },
    setSection(next) {
      if (next.site_page === section.site_page && next.site_section === section.site_section) return false;
      flush('navigation'); section = next; last = now(); duration = 0;
      // Navigation is user activity only when the tab is actually visible/focused.
      activity(); return true;
    },
    flush,
    dispose() {
      enabled = false; active = false; duration = 0; win.clearTimeout(timer);
      for (const event of ['pointerdown', 'keydown', 'scroll', 'touchstart']) win.removeEventListener(event, activity, { capture: true });
      win.removeEventListener('focus', activity); win.removeEventListener('blur', onBlur);
      win.removeEventListener('pagehide', onHide); win.removeEventListener('pageshow', visibility);
      win.document.removeEventListener('visibilitychange', visibility);
    },
  };
}
