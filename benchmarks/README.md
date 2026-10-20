# Exact rendering optimization measurements

Recorded 2026-10-20, Node 24.19.0, Linux, AMD EPYC 9V74. These are CPU scene
preparation measurements with a counting WebGL mock, **not browser FPS**.
No GPU driver, rasterization, compositing, or browser presentation is included.
The source changes do not lower resolution, frame rate, or mesh detail.

## Reproduce

Run `node --import tsx scripts/benchmark-scene-renderer.mts --reference=/path/to/baseline-checkout`.
The baseline checkout must contain source and use a compatible renderer API.
The current source commit is `f47c4a3`; baseline commits are recorded in the JSON.
There are three alternating-order paired rounds, each with 120 warm-up frames
and 360 measured frames. The shape is puffy, the activity is speaking, and the
five-accessory scenario is beret, glasses, moustache, scarf, and left earring.

The script reports elapsed wall time and process CPU time separately. Process
CPU includes GC and other V8 threads; it can exceed elapsed time. Other test
processes shared the machine, so these small samples are not hardware guarantees.

## Results

Median five-accessory CPU time:

- Released main `003691e`: 4.893 ms → 4.588 ms (6.2% reduction).
- New Canvas2D-backend baseline `f277c68`, still measured through mock WebGL:
  5.414 ms → 4.520 ms (16.5% reduction).
- Direct-main median wall time: 4.723 ms → 4.444 ms (5.9% reduction).
- The beret-only CPU median improves about 73% against either baseline.

Not every accessory-only measurement improves. For example, the direct-main
scarf sample is 2.238 → 2.412 ms CPU and the earring sample is 0.467 → 0.488 ms.
Use the raw paired measurements rather than treating one aggregate as universal.
A browser/GPU run remains necessary before making end-to-end performance claims.

The deterministic improvement is upload work: animated beret vertices no longer
upload each frame (49,200 → 0 bytes). The five-accessory scene uploads
107,832 → 58,632 bytes/frame, a 45.6% reduction. The same neutral fitted beret is
scaled in the draw matrix, rather than rebuilding a scaled CPU vertex array.
Rigid contact queries use a dense exact spatial table, and contour-distance
queries use an exact prior-edge upper bound. No approximate cache is introduced.

## Correctness evidence

- Three permanent optimization tests cover exact exhaustive contour distances
  across all 35 shapes, arbitrary query ordering, neutral/scaled beret vertex
  agreement within float32 rounding (<1e-7), no redundant beret uploads, and
  invalidation for authored accessory rotation.
- 69 existing renderer/accessory tests passed.
- A separate fallback/morph/continuity batch passed 38 tests with one existing skip.
- An additional old/new comparison of 735 catalog fits (35 shapes × 7 accessory
  presets × 3 squash values, with rotation) found exactly identical vertices,
  normals, indices, and contact metadata.
- Typecheck, full build, and generated-library consistency checks passed.
- No browser visual/performance result is claimed by this CPU-only report.
