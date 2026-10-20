/** Site-only settled selection observer. No default/restored designs or per-frame telemetry. */
import { botCombination, sanitizeSiteSection } from './product-analytics-schema.js';
export function createBotPreviewTracker({ hasConsent, consentVersion, record, schedule = setTimeout, cancel = clearTimeout }, initialDesign) {
  let lastObserved = botCombination(initialDesign)?.combination_key ?? null;
  let lastRecorded = lastObserved, lastDesign = initialDesign, lastVersion = consentVersion(), pending = null, disposed = false;
  const clear = () => { if (pending !== null) cancel(pending); pending = null; };
  return {
    observe(design, section) {
      if (disposed) return;
      const version = consentVersion();
      if (version !== lastVersion) {
        // Start a new consent epoch at the last locally observed choice, not historical analytics.
        // No event is replayed, but a new explicit return to an old recorded choice can count.
        lastVersion = version; lastRecorded = lastObserved; clear();
      }
      const combination = botCombination(design), key = combination?.combination_key ?? null;
      const changedDesign = design !== lastDesign; lastDesign = design;
      // Keep slider drags settled even when several numeric values all mean 'custom'.
      if (key === lastObserved && !(pending !== null && changedDesign)) return;
      lastObserved = key; clear();
      if (!combination || !hasConsent() || key === lastRecorded || !sanitizeSiteSection('studio', section)) return;
      pending = schedule(() => {
        pending = null;
        if (disposed || !hasConsent() || consentVersion() !== version) return;
        lastRecorded = key;
        record('bot_preview', { site_page: 'studio', site_section: section, ...combination });
      }, 600);
    },
    dispose() { disposed = true; clear(); },
  };
}
