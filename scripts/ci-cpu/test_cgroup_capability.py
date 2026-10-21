import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('probe', Path(__file__).with_name('cgroup-capability.py'))
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

class ResolutionTests(unittest.TestCase):
    def test_normal(self):
        result = probe.resolve_membership('0::/owned/job\n', '30 20 0:1 / /sys/fs/cgroup rw - cgroup2 cgroup rw')
        self.assertEqual(result['path'], '/sys/fs/cgroup/owned/job')
    def test_mount_subtree(self):
        result = probe.resolve_membership('0::/owned/job\n', '30 20 0:1 /owned /sys/fs/cgroup ro - cgroup2 cgroup ro')
        self.assertEqual(result['path'], '/sys/fs/cgroup/job')
        self.assertTrue(result['mountReadOnly'])
    def test_escaped_mount(self):
        result = probe.resolve_membership('0::/owned\n', r'30 20 0:1 / /a\040b rw - cgroup2 cgroup rw')
        self.assertEqual(result['path'], '/a b/owned')
    def test_ambiguous_namespace_fails_closed(self):
        result = probe.resolve_membership('0::/\n', '30 20 0:1 /host/sub /sys/fs/cgroup rw - cgroup2 cgroup rw')
        self.assertEqual(result['status'], 'ambiguous-or-unmapped-mount')
    def test_parent_traversal_rejected(self):
        self.assertEqual(probe.resolve_membership('0::/../other', '')['status'], 'invalid-membership')
    def test_legacy(self):
        self.assertEqual(probe.resolve_membership('1:cpu:/x', '')['status'], 'no-unambiguous-v2-membership')

if __name__ == '__main__':
    unittest.main()
