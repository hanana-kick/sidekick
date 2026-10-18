## Repository installation and prerequisites

Place this folder at `scripts/beret-qa`. It requires Node.js, the project’s existing `tsx` development dependency, a C compiler, and Linux Mesa `libEGL.so.1` with surfaceless GLES 3 support. No additional npm dependency is introduced. Run `node build-native.mjs` from this folder first. The helper binary is generated, not committed.

For a candidate run from this folder: `SOURCE=../.. TOPOLOGY=coherent31 OUT=output node --import tsx grid.mjs`. Use a detached worktree for the baseline and provide its absolute path as SOURCE. Keep separate output folders. Native Mesa diagnostics complement, rather than replace, browser integration tests.

# Beret angular and temporal validation

This independent harness records actual `AvatarRenderer` WebGL calls and executes the production vertex shader and matrices in a persistent Mesa GLES3 context. Only the fragment shader is replaced with object IDs and 16-bit screen depth. It does not infer correctness from screenshot counts or red-pixel counts.

## Running

Run from this directory, using the existing project's TypeScript loader:

```
SOURCE=../.. TOPOLOGY=coherent31 OUT=output SIZE=384 ZOOM=1.5 \
  node --import tsx grid.mjs
```

For a baseline run, use `SOURCE=/absolute/path/to/baseline-worktree` and omit `TOPOLOGY=coherent31`. Freeze the source before starting a run. `provenance.json` records source-file SHA256 hashes; `native.log` records the graphics implementation. `build-native.mjs` builds the persistent native replay helper from the included C source.

## Precise coverage

- Static: all 35 catalog shapes × 24 yaw values (0–345°, every 15°) × 13 pitch values (−90–90°, every 15°) = **10,920 views**. Camera roll 0, neutral pose, still activity. This is a finite grid, not a proof over infinitely many angles.
- Temporal (`TEMPORAL=1`): 181 frames at 30 fps over 0–6 seconds; idle, thinking, listening, speaking, celebrating, and accessory-turn; cameras (yaw 0°, pitch −30°) and (45°, 15°); all 35 shapes. **76,020 frames**, each with three diagnostic native passes. Accessory-turn adds ±0.1-radian accessory rotations and bounded sinusoidal body rotations. Runtime squash and the production accessory behavior remain active; the candidate beret intentionally no longer applies delayed accessory rotation.
- Angular animation extrema (`PHASE_MATRIX=1 FPS=60`): all 35 shapes × the full 312-angle grid × eight actual runtime phases = **87,360 views**. Phases are squash minima/maxima of idle, listening, speaking, and celebrating, selected on a 60 fps grid over 0–10 seconds. Each is warmed from time zero and frozen at delta zero while varying camera. Exact selected frames and motion states are retained in phases.json and each metric row.
- Exact runtime stress (`STRESS=1 FPS=60`): replay from time zero, then retain the target and two neighboring frames on each side. Targets include Slanted speaking frame 522, Boom idle frame 129, and celebrating frame 196 for selected difficult shapes.
- Exact flicker controls: Cookie6Sided idle frames 425→426 and SoftBurst idle frames 87→88. Use `TARGET=88 ACTIVITY=idle` for the latter.
- Interrupted morphs (`MORPH=1 TEMPORAL=1 FPS=60`): heart→boom→pixelTriangle, flower→triangle→square, and clover8Leaf→heart→circle. Retarget at 600 ms. Each sequence has 121 frames at two cameras, giving **726 frames**.

The angular phase sweep command is `SOURCE=../.. TOPOLOGY=coherent31 PHASE_MATRIX=1 FPS=60 SIZE=384 ZOOM=1.5 OUT=output-phases node --import tsx grid.mjs`. Temporal tests do not test every time sample at every camera angle. Broad static screening is 384 px with 1.5× zoom; exact defects are also replayed at 768 px with 2× zoom.

## Masks and metrics

Three passes per state:

1. Production face culling with all objects.
2. Culling disabled, with all objects.
3. Production culling with the garment only.

Object IDs: 1 body, 2 exterior cuff, 3 exterior crown/stem, 4 lining, 5 turned lip. Diagnostic PNG colors are yellow, dark red, red, blue, and green respectively. The production depth buffer handles occlusion. A garment hidden behind the body is not counted as a disappearing mesh.

JSONL stores the exact shape, camera, activity, time, frame, object areas, natural occlusion, culling differences, near-depth ties, and connected exterior regions. Temporal rows additionally include mask XOR and, in the current harness, maximum/RMS vertex displacement in body-local coordinates.

Mask XOR includes expected movement. Small connected components can be raster aliasing. Neither metric is an aesthetic pass/fail criterion on its own. Suspected failures require high-resolution review and geometry evidence.

`BODY_POINTS` can project independently computed triangle-intersection points onto the ID/depth buffers. The recorded tolerance is a 1-pixel neighborhood and 20/65535 normalized depth. Only exterior-skin points are considered. This indicates that an intersection is near a visible exterior surface; it does not automatically prove perceptible clipping. Concealed lining and the turned lip require separate classification.

## Validated baseline controls

Frozen baseline: v0.2.5, commit `92ae6f80d06397c8bf6371f1fc1423b9568e18b4`.

- The high-resolution PixelTriangle front view reproduces the user's unsupported cuff tongue and lining wedge. Independent visual review confirmed the match.
- Independent geometry tests find true cuff self-intersections and outer/lining crossings.
- Projected intersection probes identify Flower front-view crown penetration at ring 4 and Slanted side-view penetration at rings 4–5.
- Cookie6Sided frame 426 changes 74.2% of the front-view garment mask union, while adjacent frames change about 1%. The corresponding underside value is 79.0%. Culling differences are zero: this is a geometry/anchor jump.
- SoftBurst idle frame 88 moves a cuff vertex by 0.1026 body units in one frame.

`validate-repros.mjs` requires these known baseline defects to be detected and the candidate to eliminate them. Its thresholds are explicit, and its output is limited to those exact regressions. It does not claim global fit acceptance.

## Artifacts and limits

`baseline-grid384` contains the complete static matrix. `baseline-temporal` contains the complete broad temporal run when its summary is present. `baseline-flicker`, `baseline-softburst-idle`, and matching candidate folders contain exact high-resolution controls. `baseline-exposure` contains projected intersection probes. `baseline-morph` contains the selected interrupted transitions.

Raw frame files are overwritten and deleted. Only metrics and limited representative/failing PNGs are retained. Candidate topology is explicitly versioned: the older 16-ring outer shell plus offset lining must not be classified using the new coherent 31-ring profile.

Final acceptance requires independent self-intersection, degeneracy, winding/stretch checks and visual review of the reproduced failures. The grid harness intentionally reports diagnostic flags instead of inventing an aesthetic success verdict.

## Focused reproduction and triage

`ACTIVITIES=accessory-turn TEMPORAL=1` selects the changed explicit-rotation subset:35×181×2=12,670 states. Keep source revisions in separate output folders. Carry older render results forward only with exhaustive byte-equivalence of every affected geometry state, not a static endpoint assumption.

`PHASE_MATRIX=1 CASES_FILE=/absolute/path/cases.json DETAILED_MASKS=1 CAPTURE_ALL=1` replays exact selected phase/camera cases after warming each activity. Each case contains `shape`, `phaseIndex`, and `camera.yaw/pitch`. Detailed masks record garment-only components and cuff/crown pixels removed by foreground occlusion. `CAPTURE_FRAMES=67,68,69,70,71,72` limits retained PNGs without changing the full numerical run.

A narrowly defined intrinsic-silhouette class requires zero removed cuff/crown pixels, a single connected garment-only crown, every cuff pixel within two pixels of the garment silhouette, and zero culling/depth discrepancies. Cases outside that class require visual classification; this rule does not establish animation smoothness or authorize ignoring mesh-intersection failures.

For bounded memory, replace `grid.mjs` with `run-sharded.mjs` in the same command. Each shape runs in a separate192MB-heap Node process. The runner verifies source hashes remain identical, each shard reaches its expected count, and state keys are unique before merging. Failed shards remain evidence; an incomplete run is not a pass. Keep the source frozen for the entire command.

Structural checks and motion convergence are documented in [geometry-audit.md](geometry-audit.md). Final sampled results are in [render-report.json](render-report.json), [geometry-report.json](geometry-report.json), and [performance-report.md](performance-report.md).
