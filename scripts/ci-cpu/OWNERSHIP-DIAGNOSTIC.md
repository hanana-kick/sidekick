# One bounded ownership diagnostic, pending review

One experimental CI job, plan=ownership, maximum eight minutes including setup. Launch a new owned sandboxed Chrome process with a fresh temporary profile and the exact screening flags. It never attaches to the supplied cloud browser or any user browser. No flag changes, security changes, performance matrix or retry.

After the baseline main-thread Canvas bot at CSS320/DPR1 is ready, leave it paused and record approximately180 seconds of owned-process metadata at a100ms target interval. The actual sample timestamps and elapsed duration are retained. This is an idle lifecycle diagnostic, not a CPU/performance comparison.

Walk only the launched root's /proc/<pid>/task/<tid>/children lineage. Record PID, parent PID, discovery parent/TID, starttime, sanitized comm label and process state. Record exact failure stage (stat, task-list, thread-children), PID/TID and errno. A not-seen event is not asserted to be a confirmed exit; temporary traversal failures remain visible.

For process roles, call the documented SystemInfo.getProcessInfo through a browser session created from this owned Playwright launch. Join role labels only to independently discovered owned PIDs; discard all CPU-time fields and non-owned IDs. No command lines, environment variables, URLs, profiles or process contents are read. Unknown or too-short-lived roles remain unknown. Role polling itself can perturb timing, which is acceptable for classification but precludes performance claims.

Output: artifacts/ci-cpu/ownership-diagnostic/result.json with configuration, sample metadata, appearance/not-seen events, precise traversal errors and cleanup errors. No process killing or accounting relaxation. Existing CPU sampler and rejected artifacts are unchanged.

Fixed stopping conditions: stop after the180-second observation, an unrecoverable fixture/launch failure, or the eight-minute CI job limit. Do not dispatch another run automatically. Review whether transient children are identified as utilities, renderers or unknown, and whether ENOENT arises from a thread entry while its parent process remains present. Do not generalize paused-idle observations to active rendering.
