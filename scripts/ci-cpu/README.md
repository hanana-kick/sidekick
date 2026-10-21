# Isolated owned-browser CPU pilot

This branch overrides existing `animation-qa.yml` only to permit manual dispatch
against an experiment branch. Never merge that workflow override into main.
The named job and output explicitly are NOT release validation. No production
path enables either candidate. Contents permission remains read-only.

Pilot: atomic versus baseline, main thread, forced Canvas, CSS640 DPR1. One
ABBA cycle; each window has10s normal-cadence warmup and30s timed observation.
Expected measurement time2m40s plus installation/parity/5s idle. Timeout30min.
`plan=full` is a later opt-in only after pilot validation: four independent
main/worker × Canvas/SwiftShader jobs, CSS160/640, threeABBA cycles per size.
Each job has16min warmup/measurement plus setup/parity; total64runner-min plus
setup. SwiftShader is software WebGL, not a hardware GPU benchmark.

Reconstruction validates every baseline src SHA256 before copying only local
source into generated .ci-runtime trees. The checked-in66KB patch recreates
candidate source from baseline and every candidate file is then checked. Exact
baseline/candidate commit identifiers and src tree are in manifest.json.
This works even if the upload branch was created from a newer remote commit:
its src files MUST exactly match original69117a2, otherwise preparation stops.
Candidate f831c28 lifecycle browser QA is pending at preparation time. The
experimental pilot may run with its own fail-closed parity gate; full promotion
still requires separate lifecycle correctness acceptance. Historical e2c30a4 timing stays separate.

Fresh owned Chromium uses the existing sandbox-preserving launchServer pattern
from api-demo-browser.test.mjs: chromiumSandbox=true, ignoreDefaultArgs=true,
headless/pipe/no-startup-window, plus existing software renderer flags. It uses
CHROMIUM_PATH or installed Google Chrome or Chromium, then Playwright Chromium.
No --no-sandbox, profile attachment, OS security setting, or denied-browser retry.
Failure to launch is a blocker, not authorization to weaken sandboxing.

CPU accounting reads only /proc for launchServer.process().pid and recursively
its owned task children. No global process scan, command lines, environments,
URLs, or unrelated process contents. Process utime+stime excludes cutime/cstime
so descendants are not double counted. PID+starttime checks detect reuse.
The100ms sampler retains raw counters and monotonic timestamps. Missing/exited,
new, or reused processes make a window invalid instead of silently undercounting.
Detached/reparented processes cannot be attributed; detected descendant loss
invalidates the run. Sampling overhead belongs to the external Node controller,
not Chrome; it is present equally in all variants. CPU boundary includes the
two tiny browser snapshot requests, and actual CPU wall interval is recorded.

Untimed exact RGBA parity checks raw capture and actual presented surface
separately, including expansion of atomic crop. A single differing channel
rejects eligibility, including driver edge/premultiplication differences; no
silent tolerances. Full mode checks160/320/640/1024 × requestedDPR1/2/3 first.
Actual backend and backing dimensions are asserted/reported, so Canvas cap384
cannot be mistaken for a large hardware WebGL framebuffer.

Frame counts are renderer counters. Callback gaps are DELIVERY cadence, not
GPU-completion times or worker render self-time. Historical renderCpu values
are renderer wall time, not CPU time. CPU user/system values come exclusively
from owned process counters. Bitmap/presentation durations remain wall time.
Result JSON retains full counters, environment, manifest, errors, parity and
snapshots; CSV contains per-window summary. No automatic performance-pass
threshold or improvement assertion is made. A completed measurement is not
proof of a win or permission to deploy.

Local validations permitted here: node --test scripts/ci-cpu/owned-process-cpu.test.mjs;
node scripts/ci-cpu/prepare.mjs; node --check scripts/ci-cpu/run.mjs.
Actual browser execution is reserved for the separately approved CI runner.

Pilot run 39554610923 stopped before parity or timing: Chrome 155 reported WebGL2 despite the disable-webgl flag. The fixture now passes the existing RuntimeState renderer selector explicitly (canvas2d for Canvas trials, auto for SwiftShader) in both main and worker paths, while retaining the actual-backend assertion. No browser security setting or rendering source was changed.
