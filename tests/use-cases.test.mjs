import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionDestination, dockInViewport, alignWithElement, connectTaskEvents } from '../playground/use-case-actions.js';
import { JSDOM } from 'jsdom';
import { mountSiteHeader } from '../playground/shared-header.js';
test('section target clamps to measured DOM size with a safe interior margin', () => {
  const bot = { offsetWidth: 128, offsetHeight: 128 }, section = { clientWidth: 500, clientHeight: 300 };
  assert.deepEqual(sectionDestination(bot, section, { x: -800, y: 800 }), { x: 20, y: 152 });
  assert.deepEqual(sectionDestination(bot, { clientWidth: 100, clientHeight: 100 }, { x: 50, y: 50 }), { x: 0, y: 0 });
});
test('element example forwards real target and alignment without rewriting coordinate frame', () => {
  const target = {}, options = { alignX: 'right', alignY: 'bottom', x: -10, y: 20 };
  const bot = { moveToElement: (a,b) => { assert.equal(a,target); assert.equal(b,options); return 123; } };
  assert.equal(alignWithElement(bot,target,options),123);
});
test('shared navigation includes Use cases and correct relative paths', () => {
  const dom = new JSDOM('<header></header>'); const host = dom.window.document.querySelector('header');
  mountSiteHeader(host,'usecases','../');
  assert.deepEqual([...host.querySelectorAll('nav a')].map(a => a.getAttribute('href')), ['../','../api-playground.html','../use-cases.html']);
  assert.equal(host.querySelector('[aria-current]').textContent,'Use cases');
});
test('copyable event function cancels stale submit timer on another event and cleanup', async () => {
  const dom = new JSDOM('<div id="target"></div><form><input required value="test"><select><option value="error">error</option></select></form><output></output>');
  const { document, AbortController, CustomEvent } = dom.window;
  const previous = globalThis.CustomEvent; globalThis.CustomEvent = CustomEvent;
  try {
    const target = document.querySelector('#target'), form = document.querySelector('form'), output = document.querySelector('output'), controller = new AbortController();
    const calls = []; const bot = { setActivity: x => calls.push(x), setExpression: () => Promise.resolve(), moveToElement: () => Promise.resolve(), play: x => calls.push(x) };
    connectTaskEvents(bot,target,form,output,controller.signal);
    form.dispatchEvent(new dom.window.Event('submit',{ cancelable:true }));
    assert.equal(output.textContent,'처리 중…');
    target.dispatchEvent(new CustomEvent('demo-task',{ detail:{state:'success'} }));
    await new Promise(resolve => setTimeout(resolve,950));
    assert.equal(output.textContent,'작업 완료'); assert.ok(calls.includes('celebrating'));
    controller.abort(); const count = calls.length;
    target.dispatchEvent(new CustomEvent('demo-task',{ detail:{state:'error'} }));
    assert.equal(calls.length,count);
  } finally { globalThis.CustomEvent = previous; }
});
