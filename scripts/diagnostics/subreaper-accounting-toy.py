#!/usr/bin/env python3
"""Owned synthetic process trees only; no browser, privileges or system changes.
Each scenario runs in a fresh supervisor; prctl changes only that process.
"""
import ctypes
import json
import os
from pathlib import Path
import resource
import signal
import subprocess
import sys
import time


def cpu(usage):
    return usage.ru_utime + usage.ru_stime


def burn():
    start = time.process_time()
    while time.process_time() - start < 0.08:
        pass
    return time.process_time() - start


def send(fd, value):
    os.write(fd, (json.dumps(value) + '\n').encode())


def receive(fd):
    data = b''
    while not data.endswith(b'\n'):
        part = os.read(fd, 1)
        if not part:
            raise RuntimeError('unexpected pipe EOF')
        data += part
    return json.loads(data)


def own_stat(pid):
    # PID comes only from this supervisor's fork tree and trusted pipe.
    fields = Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()
    hz = os.sysconf('SC_CLK_TCK')
    return {'self': (int(fields[11]) + int(fields[12])) / hz,
            'reaped': (int(fields[13]) + int(fields[14])) / hz,
            'state': fields[0]}


def waited_and_race():
    control_r, control_w = os.pipe()
    status_r, status_w = os.pipe()
    parent = os.fork()
    if parent == 0:
        child = os.fork()
        if child == 0:
            used = burn()
            send(status_w, {'child': os.getpid(), 'burnCpu': used})
            os._exit(0)
        os.read(control_r, 1)
        os.waitpid(child, 0)
        send(status_w, {'parentReapedCpu': cpu(resource.getrusage(resource.RUSAGE_CHILDREN))})
        os.read(control_r, 1)
        os._exit(0)
    ready = receive(status_r)
    # waitid WNOWAIT is unavailable to the grandparent. Child's own burn report
    # plus short pause only makes this controlled zombie demonstration legible.
    time.sleep(0.03)
    parent_before = own_stat(parent)
    child_before = own_stat(ready['child'])
    os.write(control_w, b'w')
    reaped = receive(status_r)
    parent_after = own_stat(parent)
    try:
        own_stat(ready['child'])
        child_after_exists = True
    except FileNotFoundError:
        child_after_exists = False
    supervisor_before_parent_exit = cpu(resource.getrusage(resource.RUSAGE_CHILDREN))
    os.write(control_w, b'x')
    _, _, final = os.wait4(parent, 0)
    return {'scenario': 'waited-grandchild-live-parent-and-observation-race',
            **ready, **reaped, 'childBeforeReap': child_before,
            'parentBeforeReap': parent_before, 'parentAfterReap': parent_after,
            'childAfterReapExists': child_after_exists,
            'supervisorReapedBeforeParentExit': supervisor_before_parent_exit,
            'naiveChildThenParentReapedSum': child_before['self'] + parent_after['reaped'],
            'naiveParentThenMissingChildReapedSum': parent_before['reaped'],
            'finalWait4Cpu': cpu(final)}


def orphan():
    parent = os.fork()
    if parent == 0:
        child = os.fork()
        if child == 0:
            burn()
            os._exit(0)
        os._exit(0)
    results = []
    while True:
        try:
            pid, _, usage = os.wait4(-1, 0)
            results.append({'wasDirectParent': pid == parent, 'cpu': cpu(usage)})
        except ChildProcessError:
            break
    return {'scenario': 'orphan-adopted-by-subreaper', 'waited': results,
            'sumWait4Cpu': sum(x['cpu'] for x in results),
            'rusageChildrenCpu': cpu(resource.getrusage(resource.RUSAGE_CHILDREN))}


def auto_reap():
    report_r, report_w = os.pipe()
    parent = os.fork()
    if parent == 0:
        signal.signal(signal.SIGCHLD, signal.SIG_IGN)
        child = os.fork()
        if child == 0:
            send(report_w, {'grandchildBurnCpu': burn()})
            os._exit(0)
        try:
            os.waitpid(child, 0)
        except ChildProcessError:
            pass
        send(report_w, {'parentReapedCpu': cpu(resource.getrusage(resource.RUSAGE_CHILDREN))})
        os._exit(0)
    first, second = receive(report_r), receive(report_r)
    _, _, usage = os.wait4(parent, 0)
    return {'scenario': 'intermediate-parent-auto-reaps-before-orphaning',
            **first, **second, 'finalWait4Cpu': cpu(usage),
            'supervisorRusageChildrenCpu': cpu(resource.getrusage(resource.RUSAGE_CHILDREN))}


if __name__ == '__main__':
    if len(sys.argv) == 2:
        signal.alarm(5)
        libc = ctypes.CDLL(None, use_errno=True)
        if libc.prctl(36, 1, 0, 0, 0) != 0:  # PR_SET_CHILD_SUBREAPER
            raise OSError(ctypes.get_errno(), 'PR_SET_CHILD_SUBREAPER failed; no fallback')
        result = {'waited': waited_and_race, 'orphan': orphan, 'auto': auto_reap}[sys.argv[1]]()
        print(json.dumps(result))
    else:
        results = []
        for case in ['waited', 'orphan', 'auto']:
            result = subprocess.run([sys.executable, __file__, case], capture_output=True, text=True, timeout=8)
            if result.returncode:
                raise RuntimeError(result.stderr or f'{case} failed with{result.returncode}; no fallback')
            results.append(json.loads(result.stdout))
        a, b, c = results
        assert a['parentReapedCpu'] >= .07 and a['supervisorReapedBeforeParentExit'] == 0
        assert not a['childAfterReapExists'] and a['naiveChildThenParentReapedSum'] > a['finalWait4Cpu'] * 1.5
        assert len(b['waited']) == 2 and b['sumWait4Cpu'] >= .07
        assert abs(b['sumWait4Cpu'] - b['rusageChildrenCpu']) < .001
        assert c['grandchildBurnCpu'] >= .08 and c['parentReapedCpu'] == 0 and c['finalWait4Cpu'] < .04
        output = Path('artifacts/subreaper-toy/result.json')
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps({'scope': 'synthetic-only; not browser performance', 'results': results}, indent=2) + '\n')
        print(output.read_text())
