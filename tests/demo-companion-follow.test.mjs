import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createCompanionFollow } from '../playground/demo-companion-follow.js';
import { installDemoScenarios } from '../playground/demo-scenarios.js';

function setup(t, { width = 800, height = 600 } = {}) {
 const dom = new JSDOM('<body><div id="bot"></div></body>', { pretendToBeVisual: true });
 t.after(() => dom.window.close());
 const win = dom.window, doc = win.document, bot = doc.querySelector('#bot'), calls = [];
 let time = 100, anchor = null;
 Object.defineProperties(win, { innerWidth: { value: width, configurable: true }, innerHeight: { value: height, configurable: true } });
 Object.defineProperties(bot, { offsetWidth: { value: 115 }, offsetHeight: { value: 115 }, elementAnchor: { get: () => anchor }, position: { get: () => ({ x: 200, y: 200 }) } });
 Object.assign(bot, {
  moveToElement(target, options) { anchor = { target }; calls.push({ target, options }); return Promise.resolve({ finished: true }); },
  cancelMove() { anchor = null; },
  detachAnchor() { anchor = null; },
  getBoundingClientRect() { return { left: 200, top: 200, right: 315, bottom: 315, width: 115, height: 115 }; },
 });
 t.mock.method(win.performance, 'now', () => time);
 win.matchMedia = () => ({ matches: false });
 const follow = createCompanionFollow({ bot, doc, win });
 t.after(() => follow.dispose());
 return { win, doc, bot, calls, follow, advance(ms = 16) { time += ms; }, externalAnchor(target) { anchor = target ? { target } : null; } };
}

test('companion marker is inert, layout-bearing, body-owned and disposed', t => {
 const x = setup(t), marker = x.doc.querySelector('[data-companion-follow]');
 assert.ok(marker);
 assert.equal(marker.parentElement, x.doc.body);
 assert.equal(marker.getAttribute('aria-hidden'), 'true');
 assert.equal(marker.style.position, 'fixed');
 assert.equal(marker.style.pointerEvents, 'none');
 assert.equal(marker.style.opacity, '0');
 assert.ok(parseFloat(marker.style.width) > 0 && parseFloat(marker.style.height) > 0);
 assert.notEqual(marker.style.display, 'none');
 x.follow.dispose();
 assert.equal(marker.isConnected, false);
 x.follow.follow(80);
 assert.equal(x.calls.length, 0);
});

test('scroll samples retarget the same natural anchor instead of issuing new moves', t => {
 const x = setup(t);
 x.follow.follow(0);
 const marker = x.calls[0].target, initialTop = parseFloat(marker.style.top);
 for (let i = 0; i < 12; i++) { x.advance(); x.follow.follow(12); }
 assert.equal(x.calls.length, 1);
 assert.equal(x.follow.active, true);
 assert.equal(x.calls[0].options.anchor, true);
 assert.equal(x.calls[0].options.travel, 'natural');
 assert.ok(parseFloat(marker.style.top) < initialTop);
 for (let i = 0; i < 12; i++) { x.advance(); x.follow.follow(-12); }
 assert.ok(parseFloat(marker.style.top) > initialTop, 'reversal changes the live destination');
 assert.equal(x.calls.length, 1);
});

test('settling recenters the existing anchor without a replacement move', t => {
 const x = setup(t);
 x.follow.follow(0);
 const marker = x.calls[0].target, restingTop = marker.style.top;
 x.advance(); x.follow.follow(300);
 assert.notEqual(marker.style.top, restingTop);
 x.follow.settle();
 assert.equal(marker.style.top, restingTop);
 assert.equal(x.calls.length, 1);
});

test('released follow can transfer back on the next gesture without removing the marker', t => {
 const x = setup(t);
 x.follow.follow(30);
 const marker = x.calls[0].target;
 x.follow.release();
 assert.equal(x.follow.active, false);
 assert.equal(marker.isConnected, true);
 x.advance(); x.follow.follow(-30);
 assert.equal(x.calls.length, 2);
 assert.equal(x.calls[1].target, marker);
});

test('a rejected follow request releases ownership so the next gesture can recover', async t => {
 const x = setup(t);
 const original = x.bot.moveToElement;
 x.bot.moveToElement = () => Promise.reject(new Error('temporary unavailable target'));
 x.follow.follow(40);
 await Promise.resolve(); await Promise.resolve();
 assert.equal(x.follow.active, false, 'a rejected request must not latch imaginary ownership');
 x.bot.moveToElement = original;
 x.advance(); x.follow.follow(40);
 assert.equal(x.calls.length, 1);
});

test('an old rejected request cannot clear a newer successful follow owner', async t => {
 const x = setup(t);
 const original = x.bot.moveToElement;
 let reject;
 x.bot.moveToElement = () => new Promise((_, fail) => { reject = fail; });
 x.follow.follow(40);
 x.follow.release();
 x.bot.moveToElement = original;
 x.advance(); x.follow.follow(40);
 reject(new Error('old request failed'));
 await Promise.resolve(); await Promise.resolve();
 assert.equal(x.follow.active, true);
 assert.equal(x.calls.length, 1);
});

test('synchronous movement failure does not throw out of the scroll frame or latch ownership', t => {
 const x = setup(t);
 x.bot.moveToElement = () => { throw new Error('unavailable target'); };
 assert.doesNotThrow(() => x.follow.follow(40));
 assert.equal(x.follow.active, false);
});

test('follow destination leaves the complete host onscreen in a short viewport', t => {
 const x = setup(t, { width: 160, height: 160 });
 x.follow.follow(0);
 const marker = x.calls[0].target;
 assert.ok(parseFloat(marker.style.left) >= 0);
 assert.ok(parseFloat(marker.style.top) >= 0);
 assert.ok(parseFloat(marker.style.left) + x.bot.offsetWidth <= x.win.innerWidth);
 assert.ok(parseFloat(marker.style.top) + x.bot.offsetHeight <= x.win.innerHeight);
});

function scenario(t) {
 const dom = new JSDOM('<body><main id="root"><button data-nav="notifications"></button><header class="th-feed-header"></header></main><div id="bot"></div></body>', { pretendToBeVisual: true });
 t.after(() => dom.window.close());
 const win = dom.window, doc = win.document, root = doc.querySelector('#root'), bot = doc.querySelector('#bot');
 let time = 0, id = 0, anchor = null;
 const jobs = new Map(), frames = new Map(), calls = [];
 const rect = (left = 100, top = 80, width = 160, height = 50) => ({ left, top, width, height, right: left + width, bottom: top + height });
 for (const el of root.children) el.getBoundingClientRect = () => rect();
 bot.getBoundingClientRect = () => rect(600, 300, 115, 115);
 Object.defineProperties(bot, { offsetWidth: { value: 115 }, offsetHeight: { value: 115 }, elementAnchor: { get: () => anchor } });
 Object.assign(bot, {
  presence: null,
  moveToElement(target, options) { anchor = { target }; calls.push(['move', target, options]); return Promise.resolve({ finished: true }); },
  cancelMove() { calls.push(['cancel']); anchor = null; },
  detachAnchor() { calls.push(['detach']); anchor = null; },
  clearSpeech() { calls.push(['clear']); },
  say(text) { calls.push(['say', text]); },
 });
 win.matchMedia = () => ({ matches: false });
 win.setTimeout = (fn, ms = 0) => { const next = ++id; jobs.set(next, { fn, at: time + ms }); return next; };
 win.clearTimeout = key => jobs.delete(key);
 win.requestAnimationFrame = fn => { const next = ++id; frames.set(next, fn); return next; };
 win.cancelAnimationFrame = key => frames.delete(key);
 t.mock.method(win.performance, 'now', () => time);
 t.mock.method(Date, 'now', () => 10000 + time);
 const api = installDemoScenarios({ bot, root, site: 'community', window: win });
 t.after(() => api.dispose());
 const advance = ms => {
  const end = time + ms;
  for (let i = 0; i < 1000; i++) {
   const next = [...jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
   if (!next) break;
   jobs.delete(next[0]); time = next[1].at; next[1].fn();
  }
  time = end;
 };
 const frame = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)); };
 return { win, root, bot, calls, api, frames, advance, frame,
  scroll(y, ms = 16, render = true) { advance(ms); win.scrollY = y; win.dispatchEvent(new win.Event('scroll')); if (render) frame(); },
  arrive() { root.dispatchEvent(new win.CustomEvent('sidekick-demo-arrival', { detail: { id: 'test', kind: 'mention' } })); },
 };
}

test('community notice queued before the first scroll RAF survives motion ownership transfer', async t => {
 const x = scenario(t);
 x.scroll(300, 16, false); x.arrive(); x.frame();
 x.advance(180);
 await Promise.resolve(); await Promise.resolve();
 assert.equal(x.calls.filter(call => call[0] === 'say').length, 1);
});

test('tiny settled inertial tails do not steal back a contextual presentation', async t => {
 const x = scenario(t);
 x.scroll(300); x.arrive();
 for (let i = 1; i <= 24; i++) {
  x.scroll(300 + i);
  await Promise.resolve(); await Promise.resolve();
 }
 const follows = x.calls.filter(call => call[0] === 'move' && call[1].hasAttribute('data-companion-follow'));
 assert.equal(follows.length, 1, 'ignored tiny tails must not reacquire motion after settled narration');
 assert.equal(x.calls.filter(call => call[0] === 'say').length, 1);
});

test('pause cancels a queued scroll RAF before manual ownership can begin', t => {
 const x = scenario(t);
 x.scroll(300, 16, false);
 assert.equal(x.frames.size, 1);
 x.api.setPaused(true);
 assert.equal(x.frames.size, 0);
 const count = x.calls.length;
 x.frame();
 assert.equal(x.calls.length, count);
});

test('dispose synchronously stops a pure companion follow without waiting for target removal sampling', t => {
 const x = scenario(t);
 x.scroll(300);
 assert.ok(x.bot.elementAnchor?.target.hasAttribute('data-companion-follow'));
 x.api.dispose();
 assert.equal(x.bot.elementAnchor, null);
 assert.ok(x.calls.some(call => call[0] === 'cancel'));
 assert.ok(x.calls.some(call => call[0] === 'detach'));
});
