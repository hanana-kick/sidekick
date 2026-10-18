# Sidekick 0.2.7 validation

Baseline: v0.2.6, e88b850f88e6c0f3cc6dae37686fbc972b337337. Final source hashes are in evidence/source.sha256. The selected Pentagon, Flower and Pixel Triangle renders were approved on 2026-10-18. Production previews are byte-identical to those selected images.

## Completed checks

- 1,270 finite actual-triangle geometry states: no cloth/body or self intersections, topology/normal/degeneracy checks pass; maximum independent clearance correction .0045 (limit .006).
- All35 shapes ×181 isolated joint-axis turn frames: no step at or above .015. Historical Circle and Burst dense motion regressions remain fixed.
- Native production/diagnostic rendering: 175 static views (35×5), 6,516 activity/turn cases (revised3×6×2×181), 726 interrupted morph cases; total7,417. Zero culling loss, culling-ID mismatch or depth ties.
- The22 fragmented masks at192px resolve to connected visible crowns at768px; the Puffy underside is wholly body-occluded, not missing geometry. One garment-only 3-pixel tag fragment has no visible-crown split.
- Activity maximum mesh step .0153726 includes actual celebrating squash/lag and is distinct from the isolated-turn criterion. Interrupted morph maximum .0348706. The former Pixel frame92→93 defect drops from .0799436 to .0107069 in actual renderer replay.
- Other32 neutral beret meshes and all35 scarves remain exactly unchanged from the immediately preceding recovered candidate. Other32×5 rendered views are byte-identical to the prior candidate. Diamond,12-sided-cookie,8-leaf-clover preserve release geometry.
- Local tests:60 beret/profile,385 core (one intentional skip),28 Studio,21 package; all pass. Typecheck and90 generated artifact freshness checks pass.
- Lower opening rings6–9 are planar for the final3 at squash .88/1/1.12. Upper crown rings22+ match neutral aperture geometry after rigid placement removal. Existing ±.141 pair-distance and .13 per-vertex deformation bounds remain unchanged; the reference uses the same authored rigid aperture, bounded X .73–1 and Z1–1.08.

## Performance

Sequential isolated ABBA on the same host, after all geometry/render jobs ended.192 active frames per variant/path; pipeline includes timeline, body and beret CPU work, not browser/GPU execution.

| Path | Baseline median/p95 ms | Candidate median/p95 ms | Median change | p95 change |
|---|---:|---:|---:|---:|
| Flower→Triangle→Square |13.215 /33.013|14.220 /31.050|+7.6%|−5.9%|
| Heart→Boom→PixelTriangle |14.107 /26.583|14.867 /26.009|+5.4%|−2.2%|
| Clover8→Heart→Circle |12.942 /27.273|13.138 /30.186|+1.5%|+10.7%|

Raw isolated and preliminary runs are preserved in performance/raw-runs.tgz; the preliminary run overlapped file-upload preparation and is not used as the isolated comparison. CPU costs remain material on weak devices. No ultra-low-end60fps guarantee is made. This revision does not erase the earlier release's measured fitting overhead.

## Social image

The exact owner-selected1200×630 PNG is preserved. SHA256: d9188df94ec2fbd4617e5ad477425ce1ebe5381337d39f7815258ae91c993704. Both OG/Twitter URLs use its hash suffix. The generator cannot overwrite this chosen static asset; Studio's editable scene preset remains independent.

## Remaining integration gate and limits

Local Chromium launch is blocked by the execution sandbox's Unix-socket restriction. Existing GitHub CI runs the real browser tests before promotion. CI/release/Pages status is recorded separately; this document does not claim those steps already succeeded.

These are finite sampled states, not every continuous angle/time or arbitrary input. The previous175,026-case matrix belongs to v0.2.6 and is not claimed for this revision. Natural body occlusion and brief intermediate opening during morphs remain expected. No geometry or visual changes were made after source freeze; later changes are tests, reports and packaging only.
