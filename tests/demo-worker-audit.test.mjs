import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { installDemoWorkerAudit } from './helpers/demo-worker-audit.mjs';

function install(top, url) {
  const window = { Worker: class { terminate() {} } };
  runInNewContext(`(${installDemoWorkerAudit.toString()})()`, { window, top: top ?? window, location: { href: url } });
  return window;
}

test('worker audit separates stable header from every replacement document', () => {
  const parent = install(null, 'https://example.test/api-playground.html');
  const header = new parent.Worker();
  const first = install(parent, 'https://example.test/api-demo.html?site=company');
  const old = new first.Worker();
  const second = install(parent, 'https://example.test/api-demo.html?site=shop');
  const current = new second.Worker();
  old.terminate(); old.terminate();
  const audit = JSON.parse(JSON.stringify(parent.demoWorkerAudit));
  assert.deepEqual(audit.header, { created: 1, terminated: 0 });
  assert.deepEqual(audit.demos.map(({ created, terminated }) => ({ created, terminated })), [{ created: 1, terminated: 1 }, { created: 1, terminated: 0 }]);
  assert.equal(audit.demos[1].url, 'https://example.test/api-demo.html?site=shop');
  current.terminate(); header.terminate();
  assert.equal(parent.demoWorkerAudit.header.terminated, 1);
  assert.equal(parent.demoWorkerAudit.demos[1].terminated, 1);
});

test('worker audit exposes leaked retired workers and duplicate current workers', () => {
  const parent = install(null, 'https://example.test/api-playground.html');
  new parent.Worker();
  const first = install(parent, 'https://example.test/api-demo.html?site=company');
  new first.Worker();
  const second = install(parent, 'https://example.test/api-demo.html?site=shop');
  new second.Worker(); new second.Worker();
  assert.equal(parent.demoWorkerAudit.demos[0].terminated, 0);
  assert.equal(parent.demoWorkerAudit.demos[1].created, 2);
  assert.equal(parent.demoWorkerAudit.header.created, 1);
});
