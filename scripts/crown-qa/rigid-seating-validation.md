# Rigid crown seating refinement

Validated on 2026-10-18 against v0.6.0 (`b956d60`).

## Changes

Seventeen authored seats improve opening/body contact. Pointed bodies can turn the
oval opening around its own upright axis before the whole crown leans. This keeps
the original crown shape and proportions; no vertex deformation, opaque covers,
or non-uniform scaling are introduced. The inner wall shares the existing darker
band material so the visible hollow interior reads as a cavity.

The crown still uses two draw calls, 480 vertices and 960 triangles. The regression
fixture verifies exact original vertex/normal bytes and the complete oriented
triangle multiset despite reordering triangles into the existing material batches.

## Verification

- Full `npm test`: 650 passed, one existing environment-dependent skip, zero failures.
- All 35 shapes: front, quarter and underside production-color renders reviewed.
- Static grid: 10,920 views, yaw 0–345° and pitch -90–90°, both in 15° steps;
  32,760 native diagnostic passes.
- Activity grid: 5,460 samples across six activities, two viewpoints and 13 times
  from 0–6 seconds, warmed chronologically at 60 Hz (151,620 renderer calls).
- Static low-resolution flags were rechecked in 51 targeted 768px views. No crown
  pixels were missing due to culling and no body/crown depth ties remained. Two
  slanted-shape views retained one same-material pixel with a 6/65535 diagnostic
  depth difference, without missing coverage.
- All 34 activity depth flags rechecked at 768px: no missing crown pixels, no
  crown-depth discrepancies and no body/crown depth ties. The full activity scan
  had no zero-visible-crown samples.
- 770 non-crown cases: production vertex/index/uniform bytes exactly match v0.6.0.
- Existing rigid-distance, collision and interrupted-morph tests pass.

Run `contact-audit.mjs` with `SOURCE` and `OUT` to measure all 80 actual inner-bottom
rim samples against production body triangles. Examples of mean distance in world
units: triangle .0538 → .0100, heart .0449 → .0184, flower .0730 → .0319, puffy
.0362 → .0174. Boom uses a deliberately tilted spike-supported placement: 15 of
80 rim samples are within .005 units while the opposite side is visibly open.

These are bounded tests and reviewed images, not proof over continuous angles or
physical simulation. Sharp irregular bodies legitimately leave some interior
space. Ordinary rear/underside body occlusion is not a disappearing-mesh defect.
