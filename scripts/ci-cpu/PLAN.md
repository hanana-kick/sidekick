# Full presentation Canvas CPU experiment (local preparation; not dispatched)

Baseline6cbd651f7e3e8db7a7fbbeabbbda4a893e374d4e; candidateaa42a3d41311ba70087a23d6ae2143cd5359c2e5. This is not the historical atomic bitmap experiment. `manifest.json` hashes every baseline/candidate src file and all three experimental runtime dependencies. The minimal candidate patch is a four-file subset of the author's frozen commit; full author patch digest is retained separately. The only production source difference is private→protected backend visibility. Baseline repository source is never patched in place.

`prepare.mjs` validates source/build-input and patch hashes, builds two isolated trees and creates fixture-only copies of the same current-main bridge/worker. The copies change only renderer injection through the existing RenderEngine optional argument and attach renderer identity/storage diagnostics to the one-time ready snapshot. WorkerRenderBridge text remains byte-identical. Both variants use the same injection path and ordinary transferred full OffscreenCanvas; there is no ImageBitmap transport, crop CSS, quality/FPS change or per-frame diagnostic payload. Diagnostics describe the initial paused frame, not a live storage trace.

Pilot: two jobs (main/worker), CSS640, one ABBA each. Pilot validates invariants only and is not efficacy evidence. Full, separately approved later: four jobs (main/worker×115/640), exactly three fixed ABBA cycles per job. Every cycle launches a new browser and owned temporary profile. No replacement cycles or favorable retries. Invariant/setup failures stop that case; counter-invalid cycles are retained and the remaining originally scheduled cycles continue. Three valid cycles are required for a complete full case. Cleanup errors exclude a cycle. Invalid and unattempted counts are explicit.

Each window: same circle+beret scene and normal idle cadence,10-second warmup,30-second measurement, requested DPR1. Untimed raw and full-canvas visible byte parity runs at requested DPR1/2/3 for the case size before timing. Assert actual Canvas backend, intended renderer identity, correct worker/main bridge, transferred flag, full placeholder/backing dimensions and candidate storage validity. CSS115 is an ordinary small forced-candidate measurement, not proof that a future automatic eligibility branch keeps baseline; integration must separately test that policy.

Owned-process sampler is unchanged: utime/stime only, PID+starttime,100ms target, reject observed missing/new/reused process or unreadable counters. Initial gate remains60-second minimum,30-second stable,120-second maximum; it does not promise permanent stability. Preserve idle5seconds and all raw failed evidence. Polling still cannot identify processes born/reaped entirely between samples; never describe it as mathematically complete kernel accounting. No cgroup/sudo/privilege changes. Existing sandboxtrue and explicit browser flags are preserved.

Timing budget: per cycle up to120seconds gate +5idle +160four windows + parity/launch/cleanup. Three cycles roughly15–17minutes plus install;25-minute job cap. Timeout retains whatever artifacts were already saved, but is not completion. Fresh browsers avoid cross-size shared history; results only compare matched variants within size/backend. GPU is unmeasured.

Commands in an approved CI runtime only:
- node --test scripts/ci-cpu/*.test.mjs
- node scripts/ci-cpu/prepare.mjs
- BENCH_PLAN=pilot BENCH_BACKEND=main BENCH_SIZE=640 node scripts/ci-cpu/coordinate.mjs
- BENCH_PLAN=full BENCH_BACKEND=worker BENCH_SIZE=115 node scripts/ci-cpu/coordinate.mjs
- node scripts/ci-cpu/summarize.mjs artifacts/ci-cpu/full/worker-115

Experimental workflow override is only `.github/workflows/animation-qa.yml`: manual pilot/full, contents:read, Ubuntu, existing dependency/browser installation, fixed matrix,25-minute bound, artifact upload, never main. No production CI modifications outside this isolated branch. No remote upload/dispatch until root reviews source/provenance and explicitly approves pilot.

## Predeclared bounded cadence/workload gate (review correction before any run)

The unchanged idle scheduler targets30Hz but RAF quantization has produced~31.5 successful draws/s in the earlier harness. Each30-second window must have29–33 successful draws/s, measured wall duration29–31seconds, a running Canvas runtime, expected backend/renderer identity, full backing and unchanged CSS/draw-call work at both boundaries. Across ABBA, dimensions/backend/draw-call work must match; candidate versus baseline aggregate successful draw rate must differ by no more than2%. The2% bound allows bounded real-time scheduling jitter (roughly18 draws over30seconds), larger than the usual one-frame snapshot-boundary uncertainty; it is an explicit tolerance, not exact equal counts or proof of no FPS change. Both CPU/draw and actual draw rates remain reported. Root accepted this invariant tolerance before any pilot. Passing it does not establish small-size CPU non-regression; that requires the paired CPU results and their noise.

Any violated window or paired-rate gate invalidates the entire cycle. A detected runtime/workload invariant failure stops that case rather than launching replacement cycles. The summary revalidates raw windows, including the900/100/100/900 counterexample, before allowing efficacy output. Bounds cannot be widened after seeing pilot results without a new predeclared protocol revision. Pilot remains invariant-only, never efficacy evidence.
