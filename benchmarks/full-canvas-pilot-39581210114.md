# Full-canvas crop pilot: incomplete CPU accounting

Run https://github.com/hanana-kick/sidekick/actions/runs/39581210114, remote experiment9bc2a2a4e620cd5fa3aec973fd67c96ff0a15716. Baseline6cbd651f; candidateaa42a3d. Both Canvas main/worker CSS640 jobs completed with failure. **Zero valid ABBA cycles out of two attempted. No efficacy comparison is permitted.** No replacement/full run was started.

## Successful harness invariants

Both jobs passed source/build tests and all three untimed requested-DPR1/2/3 raw/full-visible pixel comparisons: zero differing channels, matching dimensions. All requests hit the Canvas384×384 backing cap, so these are not uncapped high-resolution DPR tests. Both variants retained full384×384 canvas presentation; candidate initial internal storage was208×224 at backing offset96,80. Its initial damage rectangle covered the full canvas. This is storage/presentation evidence, not CPU improvement.

Main baseline948draws/31.4944 per second; candidate947/31.4698. Worker baseline948/31.5148; candidate949/31.5947. These sampled windows meet individual predeclared cadence bounds, but neither complete paired-cycle gate can be evaluated. The candidate CPU windows are invalid and must not be compared with baseline CPU. Cleanup had no errors.

## Exact observed accounting failures

Main: Chrome155.0.8059.84, rootPID3051, EPYC9V74. Ten established owned PIDs were present throughout idle and baseline A1 and throughout candidate B1. An additional PID3584 appeared in exactly one sample,28.241seconds into B1, with startTicks31272 and zero observed user/system ticks. It disappeared on subsequent samples. Its lifetime CPU is unknown, so the entire cycle remains invalid. It was not one of the earlier parity/warmup process identities.

Worker: Chrome155.0.8059.39, rootPID3030, EPYC9V74. The same ten owned PIDs were present throughout idle, A1 and B1. PID3135 was present with the same startTicks7190 in every one of261 B1 samples; its user/system counters increased638/61→889/76ticks. A single ENOENT was recorded against this PID. Since its stat entry was successfully added in every sample, the error arose afterward in task-directory or thread-children traversal, not in that process's stat read. The current sampler does not record the failing substage/TID, so exact file and cause cannot be reconstructed. This is not a demonstrated process exit and is still a strict invalid cycle.

Initial stability gates took93.31seconds(main) and90.49seconds(worker), with30.38/30.41seconds stable ownership. That initial state did not prevent later churn/traversal races.

## Page/worker lifecycle audit

The fixture creates one Playwright page and calls goto exactly once per fresh browser cycle. All parity variants and measured variants reuse that page; no iframe or variant navigation is created. Each setup disposes the prior bridge and removes its canvas. Main uses no dedicated rendering worker. Worker uses the ordinary WorkerRenderBridge, whose dispose removes listeners, clears startup timeout and calls worker.terminate(). The same mirrored worker bridge source is used for both variants.

Consequently, evidence does not support a claim that navigation between variants or leftover parity pages caused these failures. A main-mode short-lived child appeared late despite there being no rendering workers, while worker-mode failure retained every process identity. Earlier warmup processes did exit, but they were absent before the idle and measurement windows. Their exact Chrome roles were not recorded, and no role is inferred here.

No structural lifecycle fix is justified by this artifact. Removing all browser helpers from ownership or ignoring thread traversal errors would relax accounting and is not proposed. If further diagnosis is explicitly approved, the smallest instrumentation change would preserve strict failure while recording stat/task-list/thread-children stages and TID, plus page/worker creation/disposal events outside timed intervals. That would improve attribution, not itself repair missing accounting. No privileges/cgroups/flags changes or automatic retries are proposed.

Artifacts: `artifacts/pilot-39581210114/main` and `worker`; GitHub artifact IDs12337440182 and12336234470. The previous atomic candidate's gains do not apply to this new candidate.
