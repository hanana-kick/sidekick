import os, pathlib, subprocess, tempfile, unittest
ROOT = pathlib.Path(__file__).resolve().parents[3]
class ToyIntegrity(unittest.TestCase):
    def test_success_and_delayed_live_read_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            binary, wrapper = pathlib.Path(directory)/'toy', pathlib.Path(directory)/'delay.so'
            subprocess.run(['cc','-O2','-Wall','-Wextra','-pthread',str(ROOT/'scripts/diagnostics/perf-task-clock-toy.c'),'-o',str(binary)],check=True)
            subprocess.run(['cc','-shared','-fPIC',str(pathlib.Path(__file__).with_name('perf-delay-read.c')),'-ldl','-o',str(wrapper)],check=True)
            good = subprocess.run([str(binary)],capture_output=True,text=True,timeout=8)
            if good.returncode == 77:
                self.skipTest('perf unavailable; no alternate flags or retry')
            self.assertEqual(good.returncode,0,good.stderr)
            bad = subprocess.run([str(binary)],env={**os.environ,'LD_PRELOAD':str(wrapper)},capture_output=True,text=True,timeout=8)
            self.assertNotEqual(bad.returncode,0)
            self.assertIn('counter-read-exceeded-100ms',bad.stderr)
            subprocess.run(['cc','-shared','-fPIC',str(pathlib.Path(__file__).with_name('perf-fail-child.c')),'-o',str(wrapper)],check=True)
            failed_child = subprocess.run([str(binary)],env={**os.environ,'LD_PRELOAD':str(wrapper)},capture_output=True,text=True,timeout=8)
            self.assertNotEqual(failed_child.returncode,0)
            self.assertIn('child-not-normal-success',failed_child.stderr)
    def test_workflow_job_gates(self):
        source=(ROOT/'.github/workflows/animation-qa.yml').read_text()
        browser,capability=source.split('  perf-capability:\n')
        self.assertIn("inputs.plan != 'perf-capability'",browser)
        self.assertIn("inputs.plan == 'perf-capability'",capability)
        self.assertIn('timeout-minutes: 3',capability)
        for forbidden in ['npm ', 'install', 'sudo', 'playwright']:
            self.assertNotIn(forbidden,capability)
if __name__ == '__main__': unittest.main()
