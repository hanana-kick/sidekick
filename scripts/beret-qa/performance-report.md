# Final beret performance audit

Final geometry commit: `2ec3c693`. Measured candidate HEAD: `5986722db511686eabd74cd6510f93e136207d35`. Release: v0.2.5 (`92ae6f80d06397c8bf6371f1fc1423b9568e18b4`). Source fingerprints matched before and after the complete run.

## Conclusion

The corrected garment trades additional active-morph CPU work for its fitting and continuous collision behavior. Across the three interrupted paths, median pipeline CPU is 43–45% higher than release. Cached idle geometry remains inexpensive, and changing-frame upload traffic is 34.4% lower. First-time fits can still take tens of milliseconds.

These are server Node CPU measurements, not browser/GPU or ultra-low-end device results. Candidate active-morph p95 is 32.8–41.1 ms before remaining renderer/GPU work. A low-end 60 fps guarantee is not supported.

## Method

- Sequential release/current/current/release (ABBA), separate processes; each path has a complete warmup before measurement. Parent confirmed heavy render/replay jobs ended before the run; no concurrent heavy local jobs were planned. This is not a guarantee against all host scheduling noise.
- Three actual ShapeTimeline paths, 1,000 ms linear transitions retargeted at frame 36; frames 0–120 at 60 Hz, with actual idle squash. Body shape target changes at retarget time. Pooled active samples exclude frame 0 and settled tail: 192 frames/path/variant.
- Pipeline = retarget setup + timeline advance + bodyGeometry + beretGeometry. Body mesh is built before fitting, matching renderer order. Raw per-stage timings and both individual run medians are retained.
- Quantiles use sorted index floor(n × percentile); maxima are untrimmed. One ABBA block and three static shapes are a bounded sample. GC, JIT and scheduler variation remain.
- Host: INTEL(R) XEON(R) PLATINUM 8573C; Node v24.19.0; TypeScript source loaded through tsx.

## Active morph: median/p95/max milliseconds

| Path | Release pipeline | Current pipeline | Release fit | Current fit |
|---|---:|---:|---:|---:|
| flower → triangle → square | 12.327/18.302/22.395 | 17.842/41.096/46.025 | 2.044/3.476/5.796 | 7.378/29.356/36.147 |
| heart → boom → pixelTriangle | 13.228/21.779/32.806 | 18.934/34.496/54.095 | 2.055/2.922/7.321 | 7.255/26.224/41.100 |
| clover8Leaf → heart → circle | 11.080/15.752/16.917 | 16.080/32.835/40.809 | 1.109/1.578/2.304 | 6.294/22.271/31.349 |

## Body-build cost and repeatability

| Path | Release body median/p95/max | Current body median/p95/max | Release run medians | Current run medians |
|---|---:|---:|---:|---:|
| flower → triangle → square | 9.889/14.259/15.734 | 9.709/13.229/27.127 | 13.040 / 11.719 | 17.592 / 18.108 |
| heart → boom → pixelTriangle | 10.765/18.277/29.307 | 10.118/12.731/17.714 | 14.172 / 12.119 | 18.614 / 19.498 |
| clover8Leaf → heart → circle | 9.742/13.545/14.504 | 9.334/11.932/13.994 | 11.728 / 10.999 | 15.768 / 16.485 |

## Cached idle and first fit

Body is prebuilt before first-fit timing. Code warms on separate contour identities. Cached results measure 180 breathing frames after warming the entire same interval twice, including exact floating-point cache keys. First fits below are one observation each, not a cold-fit distribution. The baseline Heart body cache was already populated by module behavior, so its body timing is not a cold mesh build.

| Shape | Release cached median/p95/max | Current cached median/p95/max | Release first fit | Current first fit | Current separate body build |
|---|---:|---:|---:|---:|---:|
| square | 1.913/2.476/3.041 | 0.071/0.144/3.384 | 6.104 | 11.437 | 15.026 |
| heart | 0.103/0.144/0.305 | 0.071/0.125/0.801 | 0.205 | 66.327 | 13.172 |
| flower | 2.136/2.788/5.248 | 0.070/0.120/0.580 | 8.379 | 37.603 | 19.491 |

Exact neutral-depth cache keys can differ by floating-point rounding during the first breathing cycles and trigger additional fits. Fully warmed small medians do not promise uniformly cheap first frames. Morph contours change identity and require new fits despite warm JIT. No fresh all-35 activity sweep was performed.

## Draws, buffers, uploads and allocations

- Counting-GL production renderer, 60 changing idle frames for each of Square/Heart/Flower. Both variants: 3 scene draw calls/frame (body plus two beret ranges), 8 buffers and peak 4 VAOs; disposal leaves zero live buffers, VAOs, programs and shaders.
- Current beret: 2,050 vertices / 4,096 triangles; 49,200 vertex bytes / 24,576 shared index bytes. Release: 2,086 vertices / 4,164 triangles; 50,064 / 24,984 bytes.
- Changing-frame upload: current 49,200 bytes/frame versus release 75,048 (34.4% less). Current has zero recurring bufferData calls and one bufferSubData/frame; release has one of each. These are counted API bytes, not GPU execution timing.
- No heap-allocation or GC-byte instrument was run. Upload counts and retained GL object counts must not be presented as total CPU allocation counts.

## Portable raw evidence

See [performance-artifacts/README.md](performance-artifacts/README.md) for reproduction, [pooled summary](performance-artifacts/abba-summary.json), [cached/cold/counting data](performance-artifacts/cached-cold-counts.json), and [source fingerprints](performance-artifacts/source-before-sha256.txt). All raw frames and individual logs are included. Earlier source snapshots and loaded-run numbers are superseded by this report.
