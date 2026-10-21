"""One bounded owned toy invocation; no installation, browser, or policy changes."""
import hashlib, json, os, pathlib, platform, shutil, subprocess, sys
root = pathlib.Path(__file__).resolve().parents[2]
out = root / 'artifacts/perf-capability'
out.mkdir(parents=True, exist_ok=True)
source = root / 'scripts/diagnostics/perf-task-clock-toy.c'
result = {'success': False, 'stage': 'environment', 'kernel': platform.release(),
          'machine': platform.machine(), 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'browserLaunched': False, 'fallbackAttempted': False, 'performanceEvidence': False}
code = 1
try:
    policy = pathlib.Path('/proc/sys/kernel/perf_event_paranoid')
    result['perfEventParanoid'] = policy.read_text().strip() if policy.exists() else None
    compiler = shutil.which('cc')
    result['compiler'] = compiler
    result['headerPresent'] = pathlib.Path('/usr/include/linux/perf_event.h').is_file()
    if not compiler or not result['headerPresent']:
        result.update(stage='prerequisites', reason='existing compiler or Linux header unavailable')
    else:
        result['stage'] = 'compile'
        built = subprocess.run([compiler, '-O2', '-Wall', '-Wextra', '-pthread', str(source), '-o', str(out / 'toy')], capture_output=True, text=True, timeout=30)
        (out / 'compile.txt').write_text(built.stdout + built.stderr)
        result['compileExitCode'] = built.returncode
        if built.returncode:
            result['reason'] = 'compile failed; no install or fallback'
        else:
            result['stage'] = 'owned-toy'
            env = dict(os.environ)
            # Do not introduce injected libraries into the single CI capability check.
            if env.get('LD_PRELOAD'):
                raise RuntimeError('unexpected LD_PRELOAD; refusing altered probe')
            run = subprocess.run([str(out / 'toy')], capture_output=True, text=True, timeout=8, env=env)
            (out / 'result.jsonl').write_text(run.stdout)
            (out / 'stderr.txt').write_text(run.stderr)
            result['exitCode'] = run.returncode
            events = [json.loads(line) for line in run.stdout.splitlines() if line.strip()]
            result['events'] = events
            result['success'] = run.returncode == 0 and any(e.get('stage') == 'complete' and e.get('success') for e in events)
            result['stage'] = 'complete' if result['success'] else 'owned-toy-failed'
            result['reason'] = None if result['success'] else ('permission/capability unavailable; stop path' if run.returncode == 77 else 'toy invariant, child lifecycle, or runtime failure; no retry')
            code = 0 if result['success'] else 1
except subprocess.TimeoutExpired as error:
    def decoded(value):
        return value.decode('utf-8', errors='replace') if isinstance(value, bytes) else (value or '')
    (out / 'timeout-stdout.txt').write_text(decoded(error.stdout))
    (out / 'timeout-stderr.txt').write_text(decoded(error.stderr))
    result['reason'] = f'TimeoutExpired during {result["stage"]}; partial output retained; no retry'
except Exception as error:
    result['reason'] = f'{type(error).__name__}: {error}'
finally:
    (out / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
sys.exit(code)
