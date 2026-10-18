# Independent geometry audit

From the repository root run:

```sh
npm run build:all
node scripts/beret-qa/geometry-audit.mjs beret-geometry-audit.json
```

The runner uses the compiled production `beretGeometry`, actual interpolated shape profile (including fitting tilt, center, room, transition weight, drape strength, and authored drape limit), and production body geometry. It writes a compact JSON report and exits nonzero for a failing state. Rebuild immediately before running; source hashes in the report identify the corresponding checkout. Do not carry an older report forward across geometry changes without byte-equivalence checks.

Coverage:

- All 35 catalog shapes, neutral pose and ±0.1 radians around each accessory axis: 245 states, plus six simultaneous-axis turn samples per shape (210 states).
- Three actual interrupted morph paths at 60 fps for two seconds, with retargeting on frame 36: Flower→Triangle→Square, Heart→Boom→PixelTriangle, Clover8Leaf→Heart→Circle. These contribute 363 states.
- Six further direct and six interrupted paths at 0.1 progress increments add 132 states.
- Each catalog shape transitions to and from Heart at progress 0.2, 0.5, 0.8, and 0.95: 280 cross-family states, including the identical Heart controls. The full runner therefore checks 1,230 sampled states and reports separate counts by category. This does not cover all 35² ordered shape pairs.
- Every state checks triangle interior intersections, positive-area coplanar overlap, body/hat triangle crossings, manifold edge incidence and orientation, Euler characteristic, positive signed volume, degenerate triangles, and face-normal agreement. The shell must have 2,050 vertices; appended vertices 1,858–2,049 refine inner band 4→5.
- Every state also requires `contactResolved === true` and a finite nonnegative `contactCorrection` no greater than 0.006 model units. The independent triangle test still runs when the production guard reports success. Source and compiled hashes include `cloth-clearance.ts` and its JavaScript output.

The triangle helper's synthetic tests cover separation, genuine crossing, coplanar overlap, seam-only contact, and crossing triangles that share a vertex. Tolerances are documented in `tests/helpers/geometry/intersections.mjs` and correspond to a body reference width of 1.18 units. Concealed intersections receive no automatic exemption.

This finite matrix does not prove correctness at every real-valued angle or time. Pair it with the real-renderer angular/temporal harness, fine-time convergence around flagged intervals, and high-resolution visual review. Closed-manifold topology alone is insufficient: the old duplicated lining and independently fitted rings could cross despite acceptable edge incidence.

Historical regression neighborhoods worth keeping in dense motion checks:

- Boom, combined-axis turn, 30 fps frames 17→18, 60→61, 144→145.
- Boom, combined-axis turn, fractional frames 0.860→0.865: competing nearest support projections previously caused a lip jump while the collision limiter stayed at full amplitude.
- Pentagon, frames 49→50, including t=1.6468→1.6468333333333334 and t=1.6617666666666668→1.6618000000000002.
- Direct Heart→PixelTriangle at progress 0.308→0.309 and 0.394→0.395: adaptive decorative sampling and disconnected fitting pockets previously caused abrupt changes. Include onset, the 0.14/0.86 fitting-weight joins, and interrupted retargets.
- Flower→Triangle near 6.83 ms: narrow Gaussian support transfer previously produced a visually abrupt lip movement despite mathematical convergence. Review whole-frame speed and RMS movement as well as infinitesimal continuity.
- Boom→Heart and Burst→Heart initial frames: sampled deformation-limiter switches previously caused large pops. Authored, interpolated drape limits replace that per-frame binary behavior; collision safety still requires independent testing.
- Combined rotation is `[sin(2t), sin(1.3t), sin(0.7t)] * 0.1`, with actual idle squash.

Compare successive vertex positions as the time interval is subdivided. A fixed nonzero jump under refinement signals a discontinuity. The fitting search also has a finite insertion quantization step; report that floor rather than claiming perfect continuous-time smoothness.

The reviewed candidate retains a small finite fitting residual during Burst→Heart around 25.355–25.356 ms: approximately 0.0030 units of seating change and 0.0042 units of maximum vertex movement. It comes from the settled-fitting branch, not the exact swept contact or a collision-guard correction. Native review accepted its bounded appearance at normal scale under the requested tolerance for minor transitional fitting imperfections. This is an explicitly documented limitation, not a claim of mathematically continuous motion or permission to ignore intersections.

Camera yaw/pitch/roll and the shared body-root rotation are rigid transforms, so they cannot change triangle intersections or manifold topology. They can change visibility, clipping, back-face culling, and depth precision; those are checked by the separate angular renderer harness. The explicit accessory rotations in this geometry matrix do change fitting and therefore require independent collision checks. Any independent runtime hat translation or spring must additionally be checked using the actual body and hat model matrices; validity of the raw meshes alone does not certify such a transform.
