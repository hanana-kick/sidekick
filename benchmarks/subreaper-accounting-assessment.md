# Subreaper accounting: insufficient for arbitrary browser windows

## Finding

A dedicated launch supervisor using PR_SET_CHILD_SUBREAPER does not, by itself, provide complete unbiased CPU accounting for the proposed live-browser measurement windows. Controlled tests reproduce both delayed propagation and irreversible loss under an intermediate parent's auto-reap policy. The new Canvas candidate therefore remains CPU-unproven; the failed pilot cannot be repaired retrospectively. No browser, cgroup, privilege change, external upload or CI dispatch was used in this investigation.

## Authoritative semantics

- RUSAGE_CHILDREN includes terminated children that were waited for; deeper descendants propagate only if the intervening descendants waited for their children. RUSAGE_SELF covers the calling process's threads, not its live descendant tree. [getrusage(2)](https://man7.org/linux/man-pages/man2/getrusage.2.html)
- A subreaper adopts descendants when their immediate parent terminates, allowing it to wait for those orphans. It does not intercept a still-living parent's waits. The attribute is not inherited across fork, although preserved across exec. [PR_SET_CHILD_SUBREAPER](https://man7.org/linux/man-pages/man2/PR_SET_CHILD_SUBREAPER.2const.html)
- Explicit SIGCHLD=SIG_IGN or SA_NOCLDWAIT prevents terminated children from becoming waitable zombies; wait eventually reports ECHILD. The default disposition and explicit SIG_IGN are distinct. [wait(2)](https://man7.org/linux/man-pages/man2/wait.2.html)
- proc stat utime/stime are own CPU, while cutime/cstime cover waited-for children. These counters are not an atomic tree snapshot. [proc_pid_stat(5)](https://man7.org/linux/man-pages/man5/proc_pid_stat.5.html)

## Controlled local evidence

Script: `scripts/diagnostics/subreaper-accounting-toy.py`. Each scenario launches its own temporary supervisor and only synthetic descendants; the subreaper flag affects that process alone. Pipes deliberately order operations. No other process is inspected. Three scenarios completed with assertions passing; raw output is `artifacts/subreaper-toy/result.json`.

1. **Waited grandchild, parent alive.** Grandchild burned80.002ms CPU and became a zombie. Its parent subsequently waited, retaining81.040ms in RUSAGE_CHILDREN. The outer supervisor still reported0ms because the parent had not exited. After parent exit, final wait4 returned82.833ms including small parent overhead.
2. **Forced observation race.** Reading that grandchild's own proc CPU before the wait and its parent's cutime afterward produced160ms, almost twice the final82.833ms. Reading the parent's cutime before the wait and finding the child absent afterward produced0ms for the same work. This demonstrates double count and omission under two legitimate sequential observation orders; it is not merely a hypothetical timing concern.
3. **Orphan adoption.** An intermediate parent exited without waiting. The supervisor reaped both parent and adopted grandchild once; summed wait4 CPU81.373ms agreed with RUSAGE_CHILDREN81.374ms (rounding). This is the case subreaper handles correctly.
4. **Intermediate auto-reap.** A live intermediate parent explicitly ignored SIGCHLD. Its child burned80.003ms, but parent RUSAGE_CHILDREN remained0. Final outer wait4/RUSAGE_CHILDREN contained only1.459ms, not the child's work. The child was reaped before it could become an orphan, so adoption could not recover it.

There are three independently launched scenarios; the first supplies both observations1 and2. Values describe synthetic CPU work only, not Chrome or the candidate renderer.

## Accounting derivation and limits

In an ideal synchronized snapshot, a disjoint accounting frontier could sum each still-unreaped process's own CPU plus its accumulated already-reaped descendant CPU, together with the supervisor's already-reaped child totals. Once a child is reaped, remove its separate contribution because the parent's child totals now own it. Do not add saved exited-PID CPU again, do not sum per-wait totals and RUSAGE_CHILDREN together, and do not count a zombie both separately and as already reaped.

This construction requires a complete frontier and verified propagation. Sequential proc reads race with wait and reparenting, as the toy demonstrates. Equal PID sets in two polls do not prove that no short-lived child was born and reaped between them. A paused bot or an idle-looking browser is not a global process-tree barrier. Parent changes alone also do not tell us which ancestor owns a historical waited total.

Adding a supervisor's own CPU does not recover missing descendant CPU; it merely adds supervisor work to the metric. An exact whole-lifetime total could be valid for a restricted process tree whose every wait/auto-reap behavior is controlled and whose orphans are all adopted and reaped once. That restriction has not been demonstrated for Chrome, its sandbox helpers and background utilities. The successful orphan toy is not proof of that browser-wide prerequisite.

Even with those prerequisites proven, final lifetime accounting combines startup, warmup, all active windows and shutdown. It does not assign delayed waited totals to the correct existing30-second ABBA interval. A new whole-invocation protocol would be a materially different measurement, not a reconstruction of rejected windows.

## Decision

Do not replace the strict sampler with subreaper plus naive live/reaped sums. Do not claim that longer warmup, stable endpoint PID lists, or summing cutime/cstime makes the tree complete. No safe complete browser-window method is established with the currently verified capabilities. The cgroup route remains closed at its negative capability result. Preserve the new candidate's exact-pixel/cadence evidence separately from its absent valid CPU comparison. Further runtime changes or new accounting experiments require a separately reviewed plan; no automatic retry is proposed.
