# Reproduce the final CPU audit

Prepare sibling checkouts named `sidekick-fixed-accessories` (candidate geometry commit `2ec3c693`, or measured HEAD recorded here) and `sidekick-beret-baseline` (v0.2.5). Install their declared dependencies. The candidate must include its checked-in `tests/performance-fixture.mjs`.

Set `SIDEKICK_BENCH_ROOT` to their parent directory, then run `bash reproduce.sh` from this artifact directory. It runs sequential ABBA and the small cached/cold/counting-GL pass; outputs go into a new `rerun` directory by default. Override `SIDEKICK_BENCH_OUTPUT` if desired. Run without competing heavy jobs. Compare source hashes to the supplied fingerprints before interpreting results. To summarize a rerun, place `summarize.py` next to the four rerun JSON files and execute it.

`abba-1-baseline.json`, `abba-2-candidate.json`, `abba-3-candidate.json`, `abba-4-baseline.json` contain every measured frame and stage, including settled tails excluded from active statistics. `abba-summary.json` pools active samples. `cached-cold-counts.json` contains the three-shape raw cached timings, first-fit/body observations and production renderer counting-GL counters. Logs are retained. No GPU or heap allocation measurements are implied.

The source hashes before and after measurement match. The run began after explicit confirmation that heavy render/replay jobs had ended (2026-10-18, approximately 06:41 UTC conversation clock). Candidate HEAD and baseline HEAD are recorded separately. No product source changed during measurement.
