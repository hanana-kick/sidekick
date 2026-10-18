# Beret shape fitting performance

Compare the reconstructed candidate against release v0.2.6 (e88b850) with the same Node/runtime and machine. Run sequential ABBA order with other geometry/render tests paused. This is CPU pipeline timing, not a mobile frame-rate guarantee. Preserve raw per-frame data, source hashes and medians/p95 separately. The earlier v27 results were lost during execution environment replacement and are not reused as final certification.

Set BASELINE_SOURCE, CANDIDATE_SOURCE and SIDEKICK_BENCH_OUTPUT, then run node --import tsx benchmark.mjs baseline 1; candidate 2; candidate 3; baseline 4.
