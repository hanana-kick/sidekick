export function recordSiteEvent(win: Window, name: string, properties: unknown): boolean;
export function setSiteSection(win: Window, page: string, section: string): boolean;
export function siteAnalyticsConsent(win: Window): boolean;
export function siteAnalyticsConsentVersion(win: Window): number;
export function mountSiteAnalytics(doc: Document, page: string): unknown;

export function recordSiteEvents(win: Window, events: Array<{ name: string; properties: unknown }>): boolean;
