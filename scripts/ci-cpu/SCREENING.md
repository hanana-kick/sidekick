# Proposed exploratory area screening (not dispatched)

Scope: Canvas main and worker only, four jobs total. Each backend runs sizes320/480/640/1024 in forward order in one job and reverse order in another. Each size receives a fresh browser process AND fresh owned temporary Chrome profile. Baseline and atomic share that browser for their ABBA cycle. No runtime source, quality, cadence, sandbox or accounting change.

Each size: exact raw and visible parity at DPR1/2/3, initial ownership stabilization (minimum60s plus30s stable, maximum120s), five-second idle counter, then one ABBA cycle at DPR1, with10s warmup plus30s measurement per window. At most one attempt per size; no retry based on CPU values. Every invalid partial cycle is retained, never compared. The coordinator continues the remaining predetermined sizes to preserve coverage and exits nonzero if any case is invalid.

Estimated job duration: four sizes ×(60–120s gate +5s idle +160s ABBA), plus parity and dependencies: approximately16–22minutes, bounded by30minutes. Four jobs can run independently; budget approximately64–88runner-minutes, with120runner-minutes absolute job-time limit. No hardware-GPU inference. Only the measured DPR1 workload supports CPU observations.

Fixed validity criteria: actual requested backend; zero differing raw and visible channels with equal dimensions; complete owned PID/starttime continuity; positive frame count; complete four-window ABBA cycle; no changed rendering source, quality or cadence. Failure means invalid, not slower/faster. Record actual CPU user/system counters, frame cadence, actual backing/crop dimensions and all presentation deltas for every valid window.

Screening selection rule: a size/backend is a candidate for confirmation only if both independent ABBA cycles reduce pooled CPU/draw, their frame cadence remains comparable, and parity/accounting are valid. Report both ratios and every window; do not average away a sign reversal. Two cycles are exploratory and cannot establish deployment eligibility or a universal threshold. Repeat only necessary boundary/backend cases with a separately reviewed fixed confirmation plan. Never interpolate a threshold from endpoints; keep default/small sizes on baseline. Actual Canvas backing caps at384, so CSS size and backing area must both be reported.

Changes for review:
- run.mjs: one selected screening size/cycle, per-case output paths, fresh temporary profile only in screening; shared prepared bundle remains unchanged.
- screen.mjs: fixed opposite orders, separate child runner/browser per size, preserve invalid results and continue the fixed list with no retries.
- workflow: optional screening plan, fixed four-job Canvas matrix and nested artifact paths.
- workflow-matrix.test.mjs: actual expressions tested for screening, pilot, full and main-only retry selection.

This proposal is local only. Existing main SwiftShader retry and its frozen remote code are unchanged.
