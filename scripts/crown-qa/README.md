# Crown production preview and finite visibility harness

This developer-only harness captures actual `AvatarRenderer` crown geometry, production vertex/fragment shaders, uniforms, matrices, default colors, and draw order. Native Mesa EGL/GLES3 replays the draws with depth testing and back-face culling. It does not replace crown geometry or use AI-generated imagery.

Requirements: Node plus the repository's `tsx` dependency, `cc`, Linux Mesa `libEGL.so.1`, Python 3 with Pillow, and DejaVu Sans for labeled sheets. No browser is required. Commands run from the project root.

## Production catalog

```sh
SOURCE="$PWD" OUT=/absolute/output/path SIZE=512 \
  node --import tsx scripts/crown-qa/production-catalog.mjs
python3 scripts/crown-qa/compose.py /absolute/output/path --label 'Crown candidate'
```

The default matrix is all 35 catalog shapes at front `(yaw 0, pitch 0)`, quarter `(45, 15)`, and underside `(0, -45)`, zoom 1.5. Each shape/view starts with a fresh renderer in neutral still pose, reduced motion, time 0, and delta 0. All three production draws are retained: body with eyes, crown band, and crown shell/points. Transparent pixels are composited on `#f5f5f5`. Individual PNGs retain the configured native resolution; montage assembly only pastes exact panels and adds text headings.

Optional environment variables:

- `SHAPES=heart,puffy` restricts shapes.
- `SIZE=768 ZOOM=2` creates larger native closeups.
- `VIEWS='[["front",0,0],["side",90,0]]'` customizes the named views.
- `CAPTURE_LAYERS=1` also renders separate body-only and crown-only PNGs.
- `CAPTURE_GEOMETRY=1` writes recorded vertices, indices, and uniforms for independent geometry review.

`provenance.json` records every source file's SHA256, shader hashes, exact views, colors, and image hashes. Source hashes are checked again at completion. Freeze `src` into a separate source directory for each revision; changing source during a run fails the run. The renderer needs only that source directory's `src` files. Run the harness from the actual project so the installed `tsx` loader is available.

A baseline comparison requires identical shape order, views, and native image size:

```sh
python3 scripts/crown-qa/compose.py /absolute/candidate/path \
  --label 'Crown candidate' --baseline /absolute/baseline/path
```

This creates three all-shape sheets and fifteen before/after pages, seven shapes per page and one view per page. The top row is baseline; the bottom is candidate.

## Finite visibility and culling scan

```sh
SOURCE=/absolute/frozen-source OUT=/absolute/grid-output SIZE=192 STEP=15 \
  node --import tsx scripts/crown-qa/visibility-grid.mjs
```

The default grid is 35 shapes × 24 yaw angles (0–345°) × 13 pitch angles (−90–90°), totaling 10,920 unique cases and 32,760 native passes. It uses the unchanged production vertex shader with a diagnostic fragment shader encoding object ID plus 16-bit screen depth. IDs are derived directly from actual crown draw boundaries: 1 body, 2 band, 3 points/shell. Each case renders all objects with production culling, all objects with culling disabled, and crown only with production culling.

Outputs are `views.jsonl.gz`, `summary.json`, `provenance.json`, and `native.log`; diagnostic PNGs are not retained. SIGINT or SIGTERM completes the current case and writes a clearly incomplete summary with the exact observed case count and stop reason. A complete scan explicitly records `complete: true` and checks expected counts and unique keys.

Interpretation limits: ordinary body occlusion can produce zero visible crown pixels. Small culling ID/depth differences flag review, not automatic defects. These counts do not certify contact, aesthetics, motion continuity, or all continuous viewing angles. Physical contact and fit require separate geometry diagnostics and visual review.

## Frozen task artifacts

The initial v0.3.1 baseline was frozen at commit `577b9ccf4d4bbc7ba5125f365c09e70fa9d86fbc` under `/workspace/shared/crown-fit-qa/baseline-source`; baseline renders are under `/workspace/shared/crown-fit-qa/baseline`. Each candidate has its own output folder and source snapshot. Candidate 1's completed grid concerns an earlier visually rejected fit and must not be presented as validation of later candidates.

Reproduce the final candidate-5 catalog and its baseline comparisons from the preserved snapshot:

```sh
SOURCE=/workspace/shared/crown-fit-qa/candidate-5-source \
OUT=/workspace/shared/crown-fit-qa/candidate-5-reproduced SIZE=512 \
  node --import tsx scripts/crown-qa/production-catalog.mjs
python3 scripts/crown-qa/compose.py /workspace/shared/crown-fit-qa/candidate-5-reproduced \
  --label 'Crown fit candidate 5' --baseline /workspace/shared/crown-fit-qa/baseline
```

Candidate 5's completed angular scan is saved in `/workspace/shared/crown-fit-qa/candidate-5-grid`. Reproduce it separately:

```sh
SOURCE=/workspace/shared/crown-fit-qa/candidate-5-source \
OUT=/workspace/shared/crown-fit-qa/candidate-5-grid SIZE=192 STEP=15 \
  node --import tsx scripts/crown-qa/visibility-grid.mjs
```

## Bounded activity sampling

```sh
SOURCE=/workspace/shared/crown-fit-qa/candidate-5-source \
OUT=/workspace/shared/crown-fit-qa/candidate-5-activities SIZE=192 \
  node --import tsx scripts/crown-qa/activity-grid.mjs
```

Exact coverage: 35 shapes × six public activities (`still`, `idle`, `thinking`, `listening`, `speaking`, `celebrating`) × 13 timestamps (`0, 0.5, …, 6` seconds) × two viewpoints `(0, -30)` and `(45, 15)` = 5,460 sampled cases and 16,380 native passes. Each activity/view sequence starts with a fresh renderer, first-frame delta 0, then advances chronologically at 60fps with delta `1/60` and reduced motion disabled. State is preserved throughout the sequence. The full matrix makes 151,620 production renderer calls, but native visibility/culling is measured only at the 13 selected timestamps.

The output includes raw compressed per-case metrics, source hashes, exact sample frames/timestamps, warm-up counts, independent sequence counts, and 0.5-second sample-to-sample crown-mask changes. Those sample changes are ordinary motion diagnostics; they do not prove dense per-frame continuity. SIGINT/SIGTERM saves an explicitly incomplete result, as in the static harness.

## Targeted high-resolution culling review

`visibility-grid.mjs` also accepts `CASES_FILE`, a JSON array of exact `{shape, camera}` cases. The run checks unique keys and counts this explicit list rather than claiming full angular coverage. `DETAIL_PIXELS=1` records up to 32 discrepancy coordinates and IDs/depths per case.

```sh
SOURCE=/workspace/shared/crown-fit-qa/candidate-5-source \
OUT=/workspace/shared/crown-fit-qa/candidate-5-flags-768 \
CASES_FILE=/workspace/shared/crown-fit-qa/candidate-5-grid/flagged-cases.json SIZE=768 \
  node --import tsx scripts/crown-qa/visibility-grid.mjs
```

All 128 flagged candidate-5 low-resolution cases were rechecked at 768px. Remaining individual-pixel details are in `/workspace/shared/crown-fit-qa/candidate-5-residual-pixels`. The static grid's `unchanged-related-source-hashes.json` records exact baseline/candidate SHA256s for the beret, scarf, cloth-clearance, catalog accessory, and WebGL renderer files. Their byte identity does not by itself certify unchanged behavior through shared callers; independent rendering parity tests cover that separately.
