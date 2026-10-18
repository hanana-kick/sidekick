# Rigid crown placement validation

Candidate 5, 2026-10-18. Implementation commits: `25d6bb4`, `9785ba3`, `68b8cdc`. Integration with the movement release and final browser/deployment CI are separate, pending steps.

## Implementation

- 35 authored support locations, orientations, and uniform sizes.
- Crown support uses actual canonical XY coordinates, not the perimeter's arc-length chart. Concave shapes therefore retain the selected summit/lobe.
- The existing open metal circlet mesh is unchanged. Body geometry can occupy its empty aperture. Only rigid placement and uniform scaling are permitted; there is no wrapping, bending, nonuniform scaling, or shader hiding.
- Body morphs interpolate support coordinates, orientation and uniform size. The metal topology and relative vertex distances remain constant after factoring out uniform size.

## Checks

- Full `npm test`: 575 passed, 1 existing intentional skip; typecheck passed.
- Additional final crown suite: 6 passed, including 210 squash/rotation poses, 183 interrupted morph frames, and 2,730 sampled activity states. Every vertex is constrained by distances to four noncoplanar reference vertices.
- Independent metal/body triangle checks: 105 states (35 shapes × squash 0.86, 1, 1.14), zero intersections.
- Unchanged accessory parity: 770 recorded production cases (35 shapes × 11 non-crown presets × two activities), identical vertex/index bytes and shader uniforms versus v0.3.1.
- Production-color previews: 105 panels (35 shapes × front, quarter, underside), plus baseline comparisons.
- Static native rendering: 10,920 unique cases (35 × 24 yaw × 13 pitch), 32,760 diagnostic passes.
- Activity native rendering: 5,460 sampled cases (35 × six activities × 13 timestamps × two views), 16,380 passes. 420 independently initialized sequences advance chronologically at 60fps, totaling 151,620 renderer calls.

## Diagnostic results and limits

Static crown-only masks exist in every case. 245 zero-visible full-scene cases at extreme pitch are accounted for by body occlusion. At 192px, eight views lose one crown pixel under culling; 96 have at most two ID differences, and 32 have at most two depth differences. Rechecking all 128 flagged cases at 768px removes every missing-crown/depth difference; two one-pixel band-versus-shell ID assignments remain at identical encoded depth. This supports a raster-edge explanation, not an independent geometry proof.

Activity samples show zero crown disappearances (minimum visible area 555px), zero missing-crown culling pixels, and zero body/crown near-depth ties. 71 samples have at most two ID differences; 22 have at most one depth difference.

These are finite angle/time grids, not all continuous angles and times. The activity masks are sampled every 0.5 seconds, despite chronological 60fps warm-up. Rigidity does not require a metal ring to touch every point of an irregular outline; supported overhang/open space can remain. A numerical pass does not replace aesthetic approval.

The final source differs from the frozen candidate-5 rendering source only in one explanatory comment. All 47 TypeScript files have identical transpiled output after comment removal; the equivalence manifest is retained with the QA artifacts.

Raw provenance, compressed metrics, images and logs are retained in the task's crown-fit-qa evidence directory. The adjacent harness README documents reproduction; no new runtime dependency is introduced.

A subsequent 768px review also covered every flagged activity case. No missing crown pixels remained. Residuals were individual band/shell ID assignments at identical encoded depth, plus one Heart pixel whose encoded depth differs by 3/65,535. This is retained as a small rasterization discrepancy rather than described as zero numerical error.
