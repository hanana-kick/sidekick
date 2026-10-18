# Independent geometry audit

From the repository root run:

```sh
npm run build:all
node scripts/beret-qa/geometry-audit.mjs beret-geometry-audit.json
```

The runner uses the compiled production `beretGeometry`, actual interpolated shape profile (including fitting tilt and center), and production body geometry. It writes a compact JSON report and exits nonzero for a failing state. Rebuild immediately before running; source hashes in the report identify the corresponding checkout. Do not carry an older report forward across geometry changes without byte-equivalence checks.

Coverage:

- All 35 catalog shapes, neutral pose and ±0.1 radians around each accessory axis: 245 states, plus six simultaneous-axis turn samples per shape (210 states).
- Three actual interrupted morph paths at 60 fps for two seconds, with retargeting on frame 36: Flower→Triangle→Square, Heart→Boom→PixelTriangle, Clover8Leaf→Heart→Circle. These contribute 363 states.
- Six further direct and six interrupted paths at 0.1 progress increments add 132 states, giving 950 sampled states overall.
- Every state checks triangle interior intersections, positive-area coplanar overlap, body/hat triangle crossings, manifold edge incidence and orientation, Euler characteristic, positive signed volume, degenerate triangles, and face-normal agreement.

The triangle helper's synthetic tests cover separation, genuine crossing, coplanar overlap, seam-only contact, and crossing triangles that share a vertex. Tolerances are documented in `tests/helpers/geometry/intersections.mjs` and correspond to a body reference width of 1.18 units. Concealed intersections receive no automatic exemption.

This finite matrix does not prove correctness at every real-valued angle or time. Pair it with the real-renderer angular/temporal harness, fine-time convergence around flagged intervals, and high-resolution visual review. Closed-manifold topology alone is insufficient: the old duplicated lining and independently fitted rings could cross despite acceptable edge incidence.

Historical regression neighborhoods worth keeping in dense motion checks:

- Boom, combined-axis turn, 30 fps frames 17→18, 60→61, 144→145.
- Pentagon, frames 49→50, including t=1.6468→1.6468333333333334 and t=1.6617666666666668→1.6618000000000002.
- Combined rotation is `[sin(2t), sin(1.3t), sin(0.7t)] * 0.1`, with actual idle squash.

Compare successive vertex positions as the time interval is subdivided. A fixed nonzero jump under refinement signals a discontinuity. The fitting search also has a finite insertion quantization step; report that floor rather than claiming perfect continuous-time smoothness.

Camera yaw/pitch/roll and the shared body-root rotation are rigid transforms, so they cannot change triangle intersections or manifold topology. They can change visibility, clipping, back-face culling, and depth precision; those are checked by the separate angular renderer harness. The explicit accessory rotations in this geometry matrix do change fitting and therefore require independent collision checks.
