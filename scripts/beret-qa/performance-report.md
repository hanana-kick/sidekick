# Final beret performance audit: controlled sequential ABBA

Final source: worn-beret.ts SHA-256 fc32adf0b43955a768938adcfbc09997887d5644177b81480f5f2c7cca2a353f. All tracked source hashes verified unchanged before and after the benchmark.

## Conclusion

The final geometry fixes retain a measurable active-morph CPU cost versus v0.2.5: median body+beret pipeline is approximately 3%,11%,16% slower on the three tested paths. Typical cached activity geometry remains cheap, but the final-source all35 activity evidence was collected under contention and is retained separately; do not claim a controlled activity speedup from it. The earlier 22–31 ms morph medians were materially affected by QA contention, as demonstrated by this new sequential comparison.

This is server Node CPU timing, not real GPU/browser/ultra-low-end performance. Candidate active morph p95 ranges16.1–20.6ms before actual GPU work, so a low-end60Hz guarantee is not supported.

## Method

- Intel Xeon Platinum8573C, Node source via tsx. Explicit ABBA order: release,current,current,release, separate sequential processes. Parent confirmed broad native render/audit jobs finished; no other heavy local jobs planned during this run.
- Three actual interrupted ShapeTimeline paths only; no repeated all35 activity sweep. Each starts a1000ms linear transition, retargets at frame36 to another1000ms transition, and advances frames0–120 at60Hz with real idle breathing. Body target changes at request time.
- Each process performs a full path warmup before its measured path. Report pools two measured runs per variant:192 active frames/path, excluding frame0 and settled tail. Raw logs include all121 frames per path, and summaries preserve individual-run medians.
- Pipeline = ShapeTimeline.advance + bodyGeometry + beretGeometry + retarget setup at frame36. Body cache is populated before beret fitting, matching render order. This omits remaining renderer CPU work and GPU execution.
- ABBA controls ordering better than a single reused baseline; it is still a modest single-host sample with GC/scheduler variance. Maxima are preserved, never silently trimmed.

## Active-morph distributions (median/p95/max ms)

| Path | Release pipeline | Final candidate pipeline | Release fit only | Final candidate fit only |
|---|---:|---:|---:|---:|
| flower → triangle → square | 11.977/15.681/22.458 | 12.315/16.525/19.802 | 1.991/3.149/4.064 | 1.962/4.489/7.851 |
| heart → boom → pixelTriangle | 12.471/18.606/29.817 | 13.826/20.600/36.967 | 1.991/2.933/6.922 | 3.807/7.304/8.682 |
| clover8Leaf → heart → circle | 11.327/14.188/15.080 | 13.090/16.069/18.203 | 1.117/1.557/2.366 | 2.891/4.642/6.514 |

## Body build and repeatability

| Path | Release body median/p95/max | Candidate body median/p95/max | Release run pipeline medians | Candidate run pipeline medians |
|---|---:|---:|---:|---:|
| flower → triangle → square | 9.585/12.662/15.782 | 9.643/11.867/13.725 | 12.186 / 11.783 | 12.336 / 11.844 |
| heart → boom → pixelTriangle | 10.024/15.444/26.255 | 10.140/13.822/21.281 | 12.367 / 12.551 | 13.394 / 14.323 |
| clover8Leaf → heart → circle | 9.721/12.298/13.246 | 9.256/12.072/14.099 | 11.813 / 10.698 | 13.416 / 12.948 |

## Other preserved final-source evidence

- The final fc32adf0 all35 activity/cold-fit run was collected at03:25UTC while broad QA used four Mesa threads. It reused an earlier release baseline and cannot establish controlled speedup or regression. Full report:FC32ADF0-LOADED-REPORT.md; raw:fc32adf0-loaded-candidate.json.
- That loaded run measured candidate pooled typical activity medians0.109/0.114/0.114ms (idle/speaking/celebrating), p95 .813/.546/.628ms, with maxima123.0/16.6/21.9ms. Cold fit median7.11ms under load. These are preserved observations, not expected uncontended timings.
- The first breathing cycles can also trigger deterministic cache misses from exact floating-point neutral-depth keys. Typical cheap frames do not mean every early frame is cheap; details and per-shape raw timings are retained.
- Geometry remains1858 vertices/3712 triangles,44592 vertex bytes/22272 index bytes. Earlier production-renderer counting-GL evidence reports two beret draw ranges, no per-frame candidate index upload,40.6% less changing-frame upload traffic than baseline. Counting-GL was not rerun for this final ABBA; no GPU-speed claim.

## Reproducible raw artifacts

- benchmark-abba.mjs: short harness (variant and sequence arguments).
- abba-1-baseline.json and .log
- abba-2-candidate.json and .log
- abba-3-candidate.json and .log
- abba-4-baseline.json and .log
- abba-summary.json:pooled stage distributions and individual-run medians.
- final-source-sha256.txt:current source fingerprints.
- FC32ADF0-LOADED-REPORT.md / fc32adf0-loaded-candidate.json:preserved loaded all35 and morph evidence, explicitly not the controlled comparison.

No product edits were made by the benchmark worker. All benchmark processes have terminated.
