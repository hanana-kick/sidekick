# Inherited task-clock: local synthetic capability, not browser proof

## Scope and result

An unprivileged self-only perf_event_open succeeded in the local execution environment (kernel6.18.55, perf_event_paranoid2). Existing cc/header were used; no perf tool was installed. The event is software task-clock, pid0/cpu-1, inherit1, exclude_kernel1, exclude_hv1, no group, no sampling ring buffer. No other browser/process is attached, no security/sysctl/capability setting changes, and no fallback flags are attempted on failure.

Minimal source: `scripts/diagnostics/perf-task-clock-toy.c`. The final version compiles with `cc -O2 -Wall -Wextra -pthread` and passed all bounded synthetic checks. Every child has a short independent deadline, all created threads are joined, and all owned child processes are reaped. The subreaper flag is used only for deterministic cleanup of the orphan toy; CPU accounting comes exclusively from the perf counter.

Final raw output: `artifacts/perf-task-clock-toy/final-bounded-result.jsonl`. Earlier developmental outputs remain preserved, not selected by favorable performance. These are capability/correctness checks, not an optimization benchmark.

## Verified toy behavior

Each CPU stage burns50ms of thread CPU. Cumulative task-clock results in milliseconds:

- Initial0.093; after own work50.346.
- After new thread exit100.587; after forked child reaped151.118.
- After explicitly auto-reaped child201.436. Unlike wait-based accounting, this work remains counted.
- Reparented grandchild while still alive252.231; after its exit252.311. Its work was included live and not added twice on exit.
- After fork+exec child exit303.375; counter FD was close-on-exec but the inherited event still accounted the child.
- Two concurrent live children403.911; after both exit404.059.
- Four further thread create/join cycles604.957.
- All owned children reaped at shutdown; every read had equal enabled/running fields.

Single50ms increments must be40–75ms, concurrent100ms must be80–150ms, four-thread200ms must be160–300ms. Reaping an already measured live child may not add another large work block (10ms maximum extra). These broad predeclared toy checks catch omission/double count while allowing launch/measurement overhead. They are not production performance acceptance bounds.

## User/kernel and read semantics

A syscall-heavy own-work stage returned getrusage user2.674ms plus system47.329ms, while task-clock increased50.253ms. Despite exclude_kernel1, this task-clock implementation measures scheduled task context time, not user-only CPU. The test requires at least10ms observed system CPU and task-clock within5ms of user+system. Do not label the metric user-only or reuse this conclusion on an untested kernel.

The API describes inheritance of **new** child tasks only, not existing descendants, and warns against incompatible grouped reads. Enabled/running distinguish full counting from multiplexed/unscheduled intervals; this probe rejects unequal values rather than scaling estimates. [perf_event_open(2)](https://man7.org/linux/man-pages/man2/perf_event_open.2.html)

Upstream implementation reads current child events under child_mutex and accumulates exited-child counts into the parent event. Its task-clock callback uses scheduled context time, consistent with the local user+system cross-check. This avoids userspace wait/reap frontier reconstruction. The implementation also explicitly distinguishes inherited reads from atomic local reads: aggregated child reads are not one simultaneous instant across all CPUs. [Linux perf implementation](https://github.com/torvalds/linux/blob/master/kernel/events/core.c)

Each probe read records monotonic start/end timestamps. Final local read durations were about1.2–14.5microseconds, but that is only the small synthetic tree. A future browser protocol must bound and report its own counter-read latency and frame-snapshot alignment, reject incomplete reads, and never claim instantaneous exact alignment. Keep the counter alive across child exits and take deltas; do not add proc/wait totals on top. Task-clock is CPU scheduling time, not hardware GPU usage.

Perf access depends on policy and credentials. Ordinary local success does not grant or establish CI capability. If the CI syscall returns EACCES/EPERM, stop; do not change paranoid, capabilities, security policy or exclusions to get around it. [Kernel perf security documentation](https://docs.kernel.org/admin-guide/perf-security.html)

## Proposed capability-only CI plan (not implemented or dispatched)

One new manual experimental plan with one Ubuntu job, at most3minutes:
1. Checkout the reviewed source. Read kernel version and perf_event_paranoid only.
2. Verify existing cc/header; if absent, report unavailable. Do not apt/npm install anything.
3. Compile this toy to a local artifact path and run it exactly once. Preserve stdout, exit status, source digest and environment facts. Opening denied exits77 with exact errno and no retry; inheritance/counting failures also stop.
4. Upload only those diagnostic artifacts. No Chrome launch, browser attach, benchmark matrix, cgroup, sudo, capability/sysctl changes or security flags.

The fixture must retain its current scope and all toy cases. A successful job would establish only that this exact inherited counter behaves correctly for these controlled trees on that runner. A separate reviewed browser pilot would still be required: attach the event before any target threads/children exist, maintain a dedicated launcher boundary that excludes unrelated coordinator/server work, prove the sandboxed browser's actual inheritance/exec behavior, and record supervisor overhead if included. Existing invalid CPU cycles remain invalid; the new Canvas candidate has no valid CPU comparison yet.

## Capability workflow implementation and integrity repair

The experiment-only workflow now accepts `perf-capability`. Its browser matrix has a job-level exclusion for that input, while the single non-matrix capability job requires that input and a non-main branch. Therefore pilot remains two browser jobs, full remains four browser jobs, and perf-capability runs exactly one three-minute toy job with zero browser jobs. The capability job only checks out source, invokes the existing Python/compiler/header runner, and uploads diagnostic text/JSON/source. No dependency installation, browser launch, policy modification or fallback occurs.

`run-perf-capability.py` records kernel, machine, readable perf policy, compiler/header availability, SHA256 of the exact C source, compile status, toy exit status, raw phase records (including enabled/running and read boundaries), stderr and a structured failure reason. Unavailable prerequisites or a denied perf open stop this path; the runner never retries. A toy success is not browser or performance evidence.

The integrity repair checks exact pipe transfers and markers, pthread joins, successful normal exits for waited children, and live-child state before and after both live snapshots. Reads longer than a predeclared 100 ms fail this capability probe rather than pretending that widely separated boundaries are simultaneous. This bound is a toy integrity ceiling, not an approved browser timing tolerance. A child killed by its deadline cannot pass the live/waited checks merely because its CPU count is in range.

The deliberately auto-reaped child has a completion handshake followed immediately by `_exit(0)`, and the parent requires ECHILD after its blocking wait. Its exit status is intrinsically unavailable under SIGCHLD=SIG_IGN, so the final record explicitly says `autoReapExitStatusAvailable=false`; no status-verified normal exit is claimed for that one phase. Other child exits are status-verified. All children retain independent three-second deadlines, and the supervisor five seconds.

Local regression verification: the normal probe passes; the reviewer's injected 3.1-second delay before the sixth 24-byte counter read fails with `counter-read-exceeded-100ms`; replacing a successful child `_exit(0)` with `_exit(23)` fails with `child-not-normal-success`. The Python test also checks mutually exclusive workflow job guards and absence of install/browser commands in the capability job. Existing CPU harness tests remain 25/25. These local outcomes are not a claim about CI permissions.
