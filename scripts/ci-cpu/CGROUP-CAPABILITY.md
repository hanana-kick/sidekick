# Proposed single read-only CI capability probe

Plan `capability` on the experiment branch runs exactly one Ubuntu job (three-minute timeout), with checkout, six synthetic path-resolution tests, one Python-standard-library probe, and JSON artifact upload. The existing browser job is skipped. There is no npm install, browser installation/launch, performance comparison, retry, or cgroup mutation.

The probe reads only `/proc/self/cgroup`, `/proc/self/mountinfo`, the resolved own cgroup directory metadata, four named controller/accounting files, cgroup.procs metadata (not contents), and the `user.delegate` marker. It reports effective IDs and kernel version, exact own-scope mapping, ownership/mode, effective access checks, readable counters and precise errors. It never enumerates other processes or directories, queries full command lines, writes control files, creates/migrates groups, uses sudo, contacts a manager to create units, or changes permissions/controllers/security.

Ambiguous/unmapped namespace paths stop cgroup inspection. Missing/unreadable files remain explicit. Writability alone never implies delegated authority. A marker on the exact group is useful positive evidence, but absent markers cannot exclude older or ancestor delegation; this deliberately narrow probe does not search parents. `safeExclusiveBrowserScopeDemonstrated` remains false because this probe does not create or establish any exclusive browser scope. Readability of the current shared group is not enough to proceed with a benchmark.

A successful job means only that the capability artifact was collected, including negative/unknown capability facts. Root must review the artifact and decide whether existing authority and an exclusive accounting route exist. If not, stop without privilege requests or automatic alternatives. No run has been dispatched by this worker.

Research rationale and authoritative sources: `benchmarks/churn-safe-cpu-accounting.md`.
