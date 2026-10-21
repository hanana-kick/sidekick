# Demo sizing and select spacing

The API Playground's three authored example sites start their own bot with
`size="115"`. This **host footprint is not the visible character size**: transparent
renderer framing surrounds the body and accessories. At zoom 1, a stationary,
front-facing default square + beret has visible nonzero-alpha bounds of 56 × 64
CSS px (DPR 1) or 55.5 × 64 CSS px (DPR 2). The target is a 64 × 64 visual fit box,
not stretching the artwork to a square. The installation snippet uses the same
115px footprint.

This is a shared site scale, not per-design normalization. A heart + beret retains
its authored proportions at 56 × 55 / 55.5 × 55 CSS px. Larger accessories or
intentional orientation, zoom, emotion and travel poses may extend outside the
rest-pose target. In the sampled idle loop (0–8 seconds in 0.5-second steps), the
largest edge across these two designs reaches 65px at DPR 1 and 65.5px at DPR 2.
There is no per-frame readback, dynamic resizing, deformation or quality change.

Calibration uses actual alpha pixels from the production geometry/projection
and Canvas2D presentation path, with all accessory pixels included. The public
browser regression also measures ordered pixel capture in CSS units and permits
small antialiased edge differences. Host 144 previously produced 70 × 80px for
the default square + beret; host 180 produced 87 × 100px. Merely using a 64px
host would make the visible character much smaller than requested.

This is a demo choice, not a new library default. Consumers' explicit `size`
remains authoritative, and the public size default is still 200. The renderer,
canvas allocation policy, Studio editor preview and original shared-header avatar
are unchanged.

Guide's general state-reference previews use the same 115px CSS footprint. Their
explicit size controls and link context still override that footprint, including
size 200 and zoom 0.75. Deliberately smaller positioning, behavior and entrance
examples, as well as the existing lifecycle layout, retain their authored sizes.

Native single-select controls share a 12px-inset chevron and 36px inline-end text
gutter (8px/28px on the compact header). The compact header gives the longer
framework label more room. RTL reverses the arrow position; forced-color mode
restores the platform arrow. Native option lists, labels and keyboard behavior are
preserved. Multi-selects/listboxes are excluded. Studio's existing Radix trigger
keeps its component and uses matching 12px padding.

Regression coverage:

- `tests/demo-size-selects.test.mjs`: demo scope, explicit Guide size preservation,
  shared CSS import, RTL and forced-color fallback.
- `tests/demo-visible-size.test.ts`: real alpha-to-CSS measurements at DPR 1/2,
  proportion preservation, no clipping and gentle idle overshoot.
- `tests/api-demo-browser.test.mjs`: 115px initial footprints for all three demos,
  explicit 231px override, narrow shared-header labels, native options, keyboard
  navigation and computed RTL/forced-color styling.
- `tests/studio-session-browser.test.mjs`: design-only cross-page isolation with
  the new destination size; Studio preview and original header invariants.
