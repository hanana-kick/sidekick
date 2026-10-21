#!/usr/bin/env python3
"""Read-only, own-membership-only cgroup capability probe. Never writes cgroups."""
import errno
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re


def unescape(value):
    return re.sub(r'\\([0-7]{3})', lambda m: chr(int(m[1], 8)), value)


def resolve_membership(cgroup, mountinfo):
    memberships = [line.split(':', 2)[2] for line in cgroup.splitlines()
                   if line.startswith('0::')]
    if len(memberships) != 1:
        return {'status': 'no-unambiguous-v2-membership'}
    member = PurePosixPath(memberships[0])
    if not member.is_absolute() or '..' in member.parts:
        return {'status': 'invalid-membership'}
    candidates = []
    for line in mountinfo.splitlines():
        left, sep, right = line.partition(' - ')
        if not sep or right.split()[0] != 'cgroup2':
            continue
        fields = left.split()
        root, mount = map(lambda x: PurePosixPath(unescape(x)), (fields[3], fields[4]))
        if '..' in root.parts or '..' in mount.parts or not mount.is_absolute():
            continue
        try:
            relative = member.relative_to(root)
        except ValueError:
            continue
        candidates.append({'path': str(mount / relative), 'mountRoot': str(root),
                           'mountPoint': str(mount), 'mountReadOnly': 'ro' in fields[5].split(',')})
    if len(candidates) != 1:
        return {'status': 'ambiguous-or-unmapped-mount', 'membership': str(member),
                'candidateCount': len(candidates)}
    return {'status': 'resolved', 'membership': str(member), **candidates[0]}


def error_info(e):
    return {'error': errno.errorcode.get(e.errno, type(e).__name__)}


def metadata(path):
    try:
        stat = os.stat(path)
        return {'uid': stat.st_uid, 'gid': stat.st_gid, 'mode': oct(stat.st_mode & 0o7777),
                'readable': os.access(path, os.R_OK, effective_ids=True),
                'writable': os.access(path, os.W_OK, effective_ids=True)}
    except OSError as e:
        return error_info(e)


def probe():
    result = {'kind': 'capability-only-no-browser-no-performance', 'kernel': platform.release(),
              'effectiveUid': os.geteuid(), 'effectiveGid': os.getegid(),
              'limitations': ['Writability is not delegation or authorization.',
                             'Absent delegation marker does not exclude older or ancestor delegation.',
                             'Shared group accounting is not browser-only accounting.'],
              'safeExclusiveBrowserScopeDemonstrated': False}
    try:
        resolution = resolve_membership(Path('/proc/self/cgroup').read_text(),
                                        Path('/proc/self/mountinfo').read_text())
    except OSError as e:
        result['discovery'] = error_info(e)
        return result
    result['discovery'] = resolution
    if resolution['status'] != 'resolved':
        return result
    path = Path(resolution['path'])
    result['directory'] = metadata(path)
    result['files'] = {}
    for name in ['cgroup.type', 'cgroup.controllers', 'cgroup.subtree_control', 'cpu.stat']:
        entry = metadata(path / name)
        try:
            # Only documented controller/accounting values; never membership/command lines.
            with open(path / name) as handle:
                value = handle.read(16385)
            entry['value'] = value if len(value) <= 16384 else None
            if len(value) > 16384:
                entry['error'] = 'OVERSIZED'
        except OSError as e:
            entry.update(error_info(e))
        result['files'][name] = entry
    result['placementFileMetadataOnly'] = metadata(path / 'cgroup.procs')
    try:
        marker = os.getxattr(path, 'user.delegate')
        result['delegationMarker'] = {'isOne': marker == b'1', 'present': True}
    except OSError as e:
        result['delegationMarker'] = error_info(e)
    result['assessment'] = 'Existing own-group facts only; no exclusive browser scope established.'
    return result


if __name__ == '__main__':
    # The only write is a local result artifact, never a cgroup or system setting.
    output = Path('artifacts/ci-cpu/cgroup-capability/result.json')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(probe(), indent=2) + '\n')
    print(output.read_text())
