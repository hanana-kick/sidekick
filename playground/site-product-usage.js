/** Explicit website actions only. Prepare before async work; finish only after it succeeds. */
import { recordSiteEvents, siteAnalyticsConsent, siteAnalyticsConsentVersion } from './site-analytics.js';
import { botCombination, sanitizeProductEvent, settingObservations } from './product-analytics-schema.js';
export function prepareBotUsage(win, name, design, context, runtime) {
  const combination = botCombination(design);
  const properties = combination && sanitizeProductEvent(name, { ...context, ...combination });
  const observation_source = { bot_apply: 'apply', bot_copy: 'copy', bot_export: 'export', preset_apply: 'preset' }[name];
  const observations = observation_source ? settingObservations(design, runtime) : [];
  const allowed = siteAnalyticsConsent(win), version = siteAnalyticsConsentVersion(win);
  let finished = false;
  return () => {
    if (finished) return false;
    finished = true;
    if (!allowed || !properties || !siteAnalyticsConsent(win) || siteAnalyticsConsentVersion(win) !== version) return false;
    return recordSiteEvents(win, [{ name, properties }, ...observations.map(observation => ({
      name: 'setting_observation', properties: { site_page: properties.site_page, site_section: properties.site_section, ...observation, observation_source },
    }))]);
  };
}
