# Site-only analytics

See [Product analytics](product-analytics.md) for the GA4 events, active
section dwell definition, custom definitions and dashboard setup plan. The requirements
below apply to the GA4 provider; either provider can be configured independently.

Analytics is **off by default**. Consent version 2 requires fresh opt-in for product metrics
and includes the exact configured provider audience. No measurement ID is committed. The library, React wrapper,
CDN files and browser ZIP do not import the website header or analytics implementation.
Only the production site at `https://sidekick.hananakick.cc` can initialize it; Vite dev,
localhost previews, other origins and internal state-preview pages do not collect visits.

## Activation checklist (site owner)

1. Select the site's existing GA4 web stream and provide its `G-…` measurement ID. This
   public ID is not a secret. Do not use an API key or create a property implicitly.
2. In that stream's **Enhanced measurement** settings, turn **Enhanced measurement off**
   and verify it is off. In particular, automatic history pageviews, site-search and form
   tracking must be off. `send_page_view: false` alone does **not** disable GA's history
   listener. Automatic events could otherwise include query strings or form metadata.
   Also review connected tag destinations and custom property-side event rules: no
   additional tags/destinations or rules collecting user input are part of this setup.
3. Review the site's visitor privacy disclosures and relevant obligations. This minimal
   consent UI is a technical baseline, not a legal compliance certification. Google still
   receives standard browser/network information and sets analytics cookies after opt-in.
4. Only after verifying steps 1–3, set repository Actions variables
   `SIDEKICK_GA_MEASUREMENT_ID` to that ID and `SIDEKICK_GA_ENABLED` to `true`.
   The existing, manually approved Pages build maps these to `VITE_GA_MEASUREMENT_ID`
   and `VITE_GA_ENABLED`. Both are build-time values, not runtime secrets. Deploy through
   the existing publication approval process. This change does not set those variables.
5. On the deployed site, use a clean browser: confirm no Google script or collection
   request before consent or after “Do not allow”; allow, verify exactly one manual
   `page_view` per route in Network/GA Realtime, navigate Guide sections and back/forward,
   then revoke and confirm no subsequent collection. Verify denied-consent reloads too.
   Inspect decoded requests with deliberately recognizable fake query/input/design values:
   none should appear. Do not use actual personal information for this check.

For an explicitly authorized local build, the same two `VITE_` environment values may be
provided to `npm run build:all`. The production-origin restriction still prevents local
previews from contacting Google. Unset either setting (or use enabled=false) and rebuild
for a site-wide kill switch. Never activate a real property just to run automated tests.

## Data and consent behavior

- No Google script, preconnect, pixel, or consent ping before affirmative opt-in. Closing
  the notice does not opt in. Allow and deny have equal visual prominence.
- Choice is stored locally under a versioned, measurement-ID-specific key. Blocked storage
  does not prevent the site working, and consent is then limited to the current page.
- “Analytics” / “방문 통계” stays available to change the choice. Withdrawal immediately
  sets Google's documented `ga-disable-…` switch, stops our events and removes host-only
  `sidekick_site_ga*` cookies. It cannot undo events already transmitted. Other open tabs
  honor the storage event. Re-enabling requires another explicit opt-in.
- Advertising storage, user data and personalization remain denied; Google signals and
  ad personalization signals are disabled. Analytics cookies are host-only with a custom
  prefix and 60-day expiration. We do not set `user_id` or collect custom user properties. Curated product-event
  parameters are documented separately in `product-analytics.md`.
- Only canonical `/studio`, `/api-playground`, and `/guide/<allowlisted-section>` virtual
  paths are reported. These are analytics labels, not new server routes. Page titles are
  fixed labels. Actual query strings, hashes, referrers, design JSON, context/source state,
  free-text values, form actions and arbitrary link targets are never passed by this code.
- Guide hash/back-forward navigation produces a view; language/framework/settings changes
  and repeated renders on the same section do not. No history monkey-patching is needed.
- Google automatically supplies session/engagement measurements after consent. Sanitized
  page defaults are updated with each manual view; Enhanced Measurement must stay disabled.
- Network failure does not block the editor. There is no polling or background retry loop;
  another explicit Allow action can retry a failed tag load.

## Verification

`node --test tests/site-analytics.test.mjs` checks routing/consent/UI without loading Google.
`npm run test:site-analytics:build` (requires a clean, committed worktree because the
release packager enforces this) builds a temporary configured site with a synthetic,
non-production test ID and checks dev/off builds plus library/browser/release isolation.
The synthetic ID is only in test fixtures and is never put into deployment configuration.
Run `npm run typecheck`, `npm test` and the browser suite before publication.

## Official references consulted

- https://developers.google.com/analytics/devguides/collection/ga4/views
- https://developers.google.com/analytics/devguides/collection/ga4/reference/config
- https://developers.google.com/tag-platform/security/concepts/consent-mode
- https://developers.google.com/tag-platform/security/guides/privacy
- https://developers.google.com/tag-platform/security/guides/customize-cookies

## Current production rollout (2026-10-20)

This rollout uses **GA4 only**, measurement ID `G-1VRBQNQE89`, for `https://sidekick.hananakick.cc/`. The Pages workflow enables GA4 after the activation checklist was verified: Enhanced Measurement, Google Signals, user-provided data, advertising personalization, and detailed location/device collection are off; no connected site tags exist. The website never sends User-ID. Collection still requires each visitor's explicit consent. The consent dialog names and links only the enabled Google Analytics provider.


The deployed website contains Google Analytics only. No other analytics provider transport or configuration is included.
