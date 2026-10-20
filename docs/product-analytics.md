# Sidekick product analytics contract v1

This measures **future, consenting visits to the Sidekick website**, not usage of avatars
embedded in other websites. No historical data is backfilled. Copy/export counts mean
successful website handoffs, not proof that an exported avatar was deployed or used.

## GA4 events

| Event | Meaning | Extra properties |
|---|---|---|
| `setting_change` | Explicit valid setting selection settles (sliders 600 ms) | `setting_key`, `value_category`, `change_source` |
| `setting_observation` | Supported settled settings sampled after successful apply/copy/export/preset | `setting_key`, `value_category`, `observation_source` |
| `bot_preview` | A changed categorical avatar selection settles for 600 ms | combination fields |
| `bot_apply` | A supported explicit design/API apply succeeds | combination fields, `apply_kind` |
| `preset_apply` | An explicit allowlisted preset/reset succeeds | combination fields, `preset` |
| `bot_copy` | Clipboard write succeeds | combination fields, `format` |
| `bot_export` | File/PNG generation succeeds and browser download is requested | combination fields, `format` |
| `section_view` | A consenting visitor enters an allowlisted UI section | `site_page`, `site_section` |
| `section_engagement` | Active time accumulated for that section | `active_duration_ms`, `end_reason` |
| `page_view` | A canonical site/Guide route is viewed | sanitized location/title, empty referrer |

Every product event has `site_page` (`studio`, `api`, `guide`) and allowlisted
`site_section`. `playground/product-analytics-schema.js` is the authoritative taxonomy.
Combination fields are `schema_version=1`, `body_shape`, `eye_left`, `eye_right`,
`accessory_head`, `accessory_eyes`, `accessory_mouth`, `accessory_neck`,
`accessory_left_ear`, `accessory_right_ear`, and `combination_key`.
Eye states are `neutral`, `smile`, `blink`, or `custom`, not raw animation weights.
Accessory values are slot-valid catalog names or `none`, never arbitrary accessory IDs.
Raw colors, numeric transforms, raw design/scene JSON, code, user text, URLs/query strings,
DOM text and raw input values are excluded at a second central sanitizer boundary.

`combination_key` is a compact positional encoding of the catalog categories, not a hash
of user data. Its positions are append-only and versioned, so it is deterministic and
collision-free for the schema. It intentionally groups different colors and continuous
weights together. Exact combination cardinality can still be high; use top-N combinations
and component breakdowns rather than registering raw colors or arbitrary design IDs.
GA4 high-cardinality reports may roll combinations into `(other)` or impose other reporting
limits; do not promise lossless full-combination reporting there. Prefer individual catalog
components in GA; retain the high-cardinality reporting limitation.

Default/restored designs and animation frames are not preview selections. A settled
selection and a successful copy/export are separate actions, not one “usage” count.
Clipboard/export failures are not successful use. Async completion and preview timers
capture consent epochs so a pre-consent action or revoked/regranted pending action is not
silently backfilled. Composition exports are not attributed to an arbitrary selected bot.

Current hook coverage: Studio categorical edits, successful JSON/file apply, valid JSON
and HTML/React clipboard writes, avatar JSON/PNG export, and explicit default/OG preset
application; API explicit successful Run and section selection; Guide/API exercise section
navigation. API snippet copies are deliberately not attributed to the live avatar, because
a snippet can describe another or unknown initial design. Composition exports, recovery-file
exports and failed/invalid drafts are not counted as a known bot-combination handoff.

## Settings popularity is the primary metric

Lead with the distribution of `value_category` **within one `setting_key`**, split by
`site_page`, `site_section` and source. Do not compare mixed value labels across settings.
`setting_change` describes explicit accepted changes, not time spent using a value or
prevalence among all visits. Repeated same-category choices are suppressed; rapid changes
settle for 600 ms. Invalid input, initialization, URL/storage restoration, rerenders and
animation frames do not generate selections. `change_source` is `control` or `preset`.

`setting_observation` samples the supported configuration when a Studio apply, copy,
export or preset succeeds, including supported default values (`observation_source` is
`apply`, `copy`, `export`, or `preset`). Each action emits at most 24 fixed settings: shape,
two semantic eye expressions, six accessory slots, body orientation, activity, tracking,
zoom, paused, shape duration and shape easing, plus body/eye and equipped accessory color families. Repeated successful actions can contribute
repeated observations. This corrects the narrow “only adjusted defaults are visible”
problem for handoffs, but is still **action-weighted**, not all-visitors prevalence,
per-person preferences, end-user embedding, or continuous active-setting occupancy.

### Exact explicit-control coverage

- Studio: shape; body/eye and equipped accessory color families; six accessory slots; left/right semantic eye expressions (weight sliders
  reduce to semantic categories); activity, tracking, paused; shape duration/easing;
  body orientation and yaw/pitch/roll buckets; zoom.
- Guide parameter panels and API Guide exercises: shape, expression/left/right expression,
  six accessory selects and body/eye/six accessory color families, size, zoom, emotion/intensity, placement, tracking, activity,
  paused, interaction, movement bounds, orientation/yaw/pitch/roll, movement speed,
  acceleration/deceleration, travel/easing/duration, shape and motion duration/easing,
  render style; accepted structured behavior type/side/gap, positioning placement/gap/follow,
  and entrance source/side/distance. Behavior presets have source `preset`. Structured
  selectors and offsets are never sent. Clearing an optional attribute or resetting a
  whole Guide panel is not a setting selection and is not included.
- API action controls: shape; head/eyes/neck accessory presets; expressions;
  emotion/intensity/duration; activity/duration; tracking; orientation/zoom;
  travel/easing/duration/speed/acceleration/deceleration; auto-speed, element-anchor,
  presence-side and render-paused, only after the selected action parses validly.

Unsupported controls are **unknown, not unused**. Raw colors, arbitrary JSON, CSS selectors,
coordinates, freeform code/text, gaze targets, IDs and composition/recovery data are
intentionally excluded. Site controls do not instrument library calls in other websites.
The executable `PRODUCT_SETTINGS` vocabulary and hook mappings are authoritative.

### Color families

Eight fixed keys are `body_color_family`, `eye_color_family`, and
`accessory_{head,eyes,mouth,neck,left_ear,right_ear}_color_family`. Only accepted
`#RRGGBB` choices are classified locally; no hex, RGB, hue or lightness value is sent.
Families are black, white, gray, red, orange, yellow, green, cyan, blue, purple, pink,
and brown. Classification uses local HSL: lightness ≤0.12 is black, ≥0.92 white;
otherwise saturation ≤0.12 gray; hue [15,75) with lightness <0.38 brown. Remaining
hue ranges are red [345,360) or [0,15), orange [15,40), yellow [40,75), green [75,165),
cyan [165,195), blue [195,255), purple [255,285), pink [285,345).
These are coarse analysis labels, not exact perceptual color measurements.
Studio and Guide/exercise color controls emit explicit settled changes. Main API action
controls have no color input. Successful Studio snapshots include body/eye and equipped accessory color families,
keeping the fixed maximum at 24 settings. Unequipped slots emit no color observation.
The shape/eye/preset `combination_key` stays unchanged and intentionally ignores colors.

### Numeric categories

- Size: tiny ≤72, small ≤144, medium ≤240, large ≤480, xlarge above (accepted 1–2048).
- Zoom: reduced <1, normal =1, enlarged ≤1.5, large ≤2, xlarge above (0.5–3).
- Intensity: off =0, low ≤0.33, medium ≤0.66, high <1, full =1.
- Gaps/distances: negative (signed positioning only), zero, small ≤8, medium ≤24,
  large ≤64, xlarge above. Accepted absolute bound 10,000.
- Durations: zero, short ≤250 ms, medium ≤1,000 ms, long ≤3,000 ms, extended
  up to the accepted 60,000 ms bound.
- Angles: far_negative <−90, negative <0, zero, positive ≤90, far_positive >90;
  accepted yaw ±360, pitch ±90, roll ±180 degrees.
- Speed/acceleration/deceleration: slow ≤300, medium ≤1,500, fast ≤5,000,
  very_fast up to 100,000. These are separate keys, not interchangeable units.
- Booleans: literal categories `true` and `false`; legacy render style `3d` normalizes
  to `flat` to match supported rendering, not a claim a WebGL backend was used.

## Dwell definition and limitations

Count only while consent is granted, the document is visible and focused, and the visitor
has not been idle for 30 seconds. Pointer/key/scroll/touch activity resumes the clock;
no event contents are inspected. Focus/visibility resume also starts a new active span.
There is one active section per page. Navigation flushes the previous section first;
blur/hidden/pagehide flush once, and repeated events cannot double-count an interval.
Withdrawal discards unfinished time rather than sending a final event after consent ends.

A heartbeat flushes at most every 30 seconds, not on each animation frame. Each emitted
`active_duration_ms` is an integer from 1 to 30,000. Delayed timer backlog is split into
bounded aggregates, preserving up to five minutes of recorded active intervals; larger
backlogs are conservatively capped. Idle gaps never accrue past the 30-second cutoff.
`end_reason` is `heartbeat`, `idle`, `hidden`, `blur`, `navigation`, or `pagehide`.

Sum milliseconds / 1,000 for active seconds. For **mean active time per section visit**,
divide that sum by the matching `section_view` count, not by heartbeat event count.
This is a conservative interaction-based reading proxy, not proof of attention. Slow
readers may hit the idle cutoff. Blockers/network loss/navigation shutdown can undercount.
Browser blockers and transport availability can affect delivery.

## GA4 custom definitions (setup plan, not a claim they already exist)

Create event-scoped dimensions for these exact event parameter names:
`site_page`, `site_section`, `body_shape`, `eye_left`, `eye_right`, `accessory_head`,
`accessory_eyes`, `accessory_mouth`, `accessory_neck`, `accessory_left_ear`,
`accessory_right_ear`, `combination_key`, `format`, `apply_kind`, `preset`, `end_reason`,
`setting_key`, `value_category`, `change_source`, `observation_source`.
Create one event-scoped custom metric `active_duration_ms`, unit milliseconds (or Standard
numeric if the selected UI does not offer milliseconds; keep documented units unchanged).
Do not replace GA's automatic engagement metric with this differently defined metric.
Do not add user-scoped properties or user IDs. Reporting definitions can take 24–48 hours
to become available; registration is not evidence events were collected.

Suggested GA4 explorations:
- Primary: `setting_observation` value distribution per key, split by action source and surface.
- Explicit choices: `setting_change` value distribution per key, split by source and surface.
  Control-change counts are supplementary, not a popularity ranking of all active settings.
- Selection: `bot_preview` event count by combination key and component dimensions.
- Handoff: separate `bot_copy` and `bot_export` counts by combination key and format.
- Apply: separate `bot_apply` and `preset_apply`, not combined with preview counts.
- Section attention: sum active duration by page/section; section visits as denominator.
- Ordered funnel: `bot_preview` → `bot_apply` (optional) → `bot_copy` OR `bot_export`.
  Many valid copies need no explicit apply, so an apply-only funnel is not overall conversion.

Keep all Enhanced Measurement off as required in `site-analytics.md`; otherwise automatic
history/search/form events can bypass this curated payload contract.

## GA-only consent and delivery

Only Google Analytics is included. Consent version 3 is scoped to the measurement ID;
older consent keys are not reused. A successful handoff validates all its curated events
before submitting standard GA event calls (action plus at most 24 observations). GA owns
its network transport. No analytics script loads before visitor opt-in; withdrawal disables
GA and discards pending events. No user ID or extra visitor identity is created by this site.
Choose a reporting period only after activation and show empty/no-data states honestly.
Never present instrumentation as historical findings.

## Validation before activation

Offline tests stub all network and use synthetic measurement IDs only. Verify configured/off site
builds and package/ZIP isolation. On the approved deployment, verify actual GA collection,
Realtime/manual events, no pre-consent requests, sanitized payloads, exact route/section
attribution, copy/export failure paths, idle/background cutoff and withdrawal. Avoid sending
real personal data as a diagnostic. Do not claim this network check has run until it has.

References checked:
- https://developers.google.com/analytics/devguides/collection/ga4/event-parameters
- https://support.google.com/analytics/answer/14239696
- https://support.google.com/analytics/answer/14239619
- https://support.google.com/analytics/answer/14240153
- https://support.google.com/analytics/answer/12226705
- https://support.google.com/analytics/answer/13331684
