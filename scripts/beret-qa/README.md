# Beret rendering regression harness

This harness records actual `AvatarRenderer` calls and replays its production vertex shader, geometry, matrices and culling in native Mesa GLES3. A diagnostic fragment shader writes object IDs and 16-bit screen depth. Counts are coverage, not an aesthetic score.

Final results: [Korean summary](validation-summary.ko.md), [render report](render-report.json), [geometry report](geometry-report.json), and [performance cost](performance-report.md).

## Requirements

Run from `scripts/beret-qa` with the project's installed `tsx` dev dependency, Node.js, a C compiler, and Linux Mesa `libEGL.so.1` supporting surfaceless GLES3. No additional npm dependency is required.

```sh
node build-native.mjs
```

The generated `native-grid` binary is not committed. Freeze source files for a complete run. Use separate output directories for each source revision. `provenance.json` records SHA256 hashes, and `native.log` records the GL implementation.

## Full finite matrix

```sh
LP_NUM_THREADS=2 SOURCE=../.. TOPOLOGY=coherent31 OUT=output-static SIZE=384 ZOOM=1.5 node --import tsx run-sharded.mjs
LP_NUM_THREADS=2 SOURCE=../.. TOPOLOGY=coherent31 OUT=output-phases SIZE=384 ZOOM=1.5 PHASE_MATRIX=1 FPS=60 node --import tsx run-sharded.mjs
LP_NUM_THREADS=2 SOURCE=../.. TOPOLOGY=coherent31 OUT=output-temporal SIZE=192 TEMPORAL=1 FPS=30 node --import tsx run-sharded.mjs
LP_NUM_THREADS=2 SOURCE=../.. TOPOLOGY=coherent31 OUT=output-morph SIZE=384 ZOOM=1.5 MORPH=1 TEMPORAL=1 FPS=60 SHAPES=heart,flower,clover8Leaf VIEWS='[[0,-30],[45,15]]' node --import tsx grid.mjs
```

- Static: 35 shapes × yaw 0–345° in 15° steps × pitch −90–90° in 15° steps = **10,920** cases. Camera roll 0; neutral still pose.
- Phase-angle: the same grid × eight actual activity extrema = **87,360** cases. Select squash minima/maxima for idle, listening, speaking and celebrating on a 60 fps grid over 0–10 seconds. Warm each phase chronologically from zero; freeze delta at zero while changing camera. Exact selections are in `phases.json`.
- Dense temporal: 35 shapes × six modes × 181 frames × two cameras = **76,020** cases. Modes are idle, thinking, listening, speaking, celebrating and accessory-turn. Frames cover 0–6 seconds at 30 fps; cameras are (0°,−30°) and (45°,15°). Accessory-turn includes ±0.1 rad joint rotations plus bounded sinusoidal body rotations.
- Interrupted morph: heart→boom→pixelTriangle, flower→triangle→square, clover8Leaf→heart→circle; retarget at 600 ms; 121 frames at 60 fps and two cameras = **726** cases.

Total: **175,026 cases**, three diagnostic native passes per case. Each matrix has unique keys, but actual geometric states can overlap between matrices. This does not prove every continuous time/angle combination. Exact coverage is specified in `matrix.json`.

The sharded runner caps each Node process at 192 MB, verifies complete shape counts and unique keys, and checks source hashes before merging. Incomplete runs are not passes. Keep at most two bounded streams running if memory permits; do not benchmark performance concurrently.

## Runtime fidelity

Each independent activity/camera/morph sequence starts with a new renderer. `delta` is in seconds and animation runs with `reduced:false`. Static tests use reduced motion. Rows retain body/hat model matrices, raw and world-space maximum/RMS vertex steps, mask changes and effective seating. A stateful renderer transform can move an otherwise unchanged mesh, so raw mesh displacement alone is insufficient.

`RUNTIME_CASES=1 TEMPORAL=1 CASES_FILE=... FPS=30` warms every selected runtime case from frame zero before replay. Phase cases use `PHASE_MATRIX=1 CASES_FILE=...`. `CAPTURE_ALL=1` saves images; `CAPTURE_FRAMES=...` restricts saved images without removing numerical frames. `DETAILED_MASKS=1` adds garment-only visibility comparisons.

## Diagnostic interpretation

Each case renders:
1. All objects with production culling.
2. All objects with culling disabled.
3. Garment only with production culling.

IDs: 1 body/yellow, 2 outer cuff/dark red, 3 crown/stem/red, 4 inner lining/blue, 5 rolled lip/green. Current geometry has 2,050 vertices and 4,096 triangles. Coherent topology has original vertices 0–1857; appended inner-wall vertices 1858–2049 belong to lining, not the crown. Baseline v0.2.5 uses different topology: omit `TOPOLOGY=coherent31` for a detached baseline worktree supplied as an absolute `SOURCE`.

Natural body occlusion is not disappearing cloth. Connected mask fragments can be edge rasterization. High mask XOR can be ordinary body movement. Near-depth ties and culling discrepancies require investigation, not an automatic aesthetic verdict. Visible lining inside a real cavity is legitimate; the cavity is empty space, not a solid collision volume.

A strict automatic silhouette class requires zero removed cuff/crown pixels, one connected garment-only crown, every cuff pixel within two pixels of the silhouette, and zero culling/ID/depth discrepancies. Other diagnostic flags need paired visual review. Inspect ambiguous cases at 768 px. Independent triangle-intersection, winding, degeneracy and motion-convergence tests remain separate gates.

## Baseline-positive controls

Released v0.2.5 commit `92ae6f80d06397c8bf6371f1fc1423b9568e18b4` reproduces the unsupported PixelTriangle cuff tongue, folded lining and genuine self-intersections. Cookie6Sided idle 425→426 changes approximately 74% of the front garment-mask union; SoftBurst idle 87→88 moves a cuff vertex by approximately 0.103 body units.

Use `STRESS=1 TEMPORAL=1 FPS=60 SHAPES=cookie6Sided` for the Cookie control. For SoftBurst use `SHAPES=softBurst TARGET=88 ACTIVITY=idle`. Match baseline camera/size/zoom exactly when comparing. `validate-repros.mjs` requires known baseline failures and their removal; its success applies only to those regressions.

## Acceptance and limitations

The approved visual intent permits brief intermediate openings and rapid supported cloth relaxation. It does not permit conspicuous independent jumps, torn/intersecting cloth, disappearance, or severe cap distortion. A velocity threshold alone cannot distinguish these cases. Case-specific reviewed recovery bounds and any small residual numerical discontinuity must be reported, not generalized into a loose global tolerance.

Raw frame buffers are overwritten; retain compressed metrics, provenance, exact coverage, representative/flagged images and per-case dispositions. Carry older native results forward only after exact equivalence of every affected rendered state, including model matrices and history-dependent state. A clean intersection count does not establish convincing wearing or cavity occupancy.
