import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { SpeechController, validateSpeech } from '../src/element/speech.ts';

function fixture() {
  const dom = new JSDOM('<body><button id="focus">Keep focus</button><div id="bot"></div>', { pretendToBeVisual: true });
  const doc = dom.window.document, host = doc.querySelector<HTMLElement>('#bot')!;
  let reads = 0, position = { x: 0, y: 0 }, available = true;
  host.getBoundingClientRect = () => { reads++; return { left: 200 + position.x, top: 200 + position.y, width: 115, height: 115 } as DOMRect; };
  const speech = new SpeechController(host, () => ({ ...position }), () => available);
  return { dom, doc, host, speech, reads: () => reads, move: (x: number, y: number) => { position = { x, y }; speech.move(); }, hide: () => { available = false; speech.move(); }, bubble: () => doc.querySelector('[data-sidekick-speech]')?.shadowRoot?.querySelector<HTMLElement>('.bubble'), close: () => { speech.clear(); dom.window.close(); } };
}

test('strict bounded plain-data validation', () => {
  assert.equal(validateSpeech('Hello').duration, 5000);
  for (const text of ['', '  ', 'x'.repeat(1001), 123]) assert.throws(() => validateSpeech(text as string));
  for (const options of [{ duration: NaN }, { duration: Infinity }, { duration: -1 }, { duration: 60001 }, { placement: 'left' }, { dismissible: 'true' }, { dismissLabel: '' }, { html: true }, []]) assert.throws(() => validateSpeech('Hi', options as never));
  let invoked = false;
  assert.throws(() => validateSpeech('Hi', { get duration() { invoked = true; return 1; } }));
  assert.equal(invoked, false);
});

test('all four locales, HTML is text, replacement does not steal focus', () => {
  const f = fixture(); f.doc.querySelector<HTMLElement>('#focus')!.focus();
  for (const text of ['이게 더 싼거야!', 'This one costs less!', '这个更便宜！', 'こちらの方がお得！', '<img src=x onerror=alert(1)>']) {
    f.speech.say(text, { duration: 0 });
    assert.equal(f.bubble()?.textContent, text);
    assert.equal(f.bubble()?.querySelector('img'), null);
    assert.equal(f.doc.querySelectorAll('[data-sidekick-speech]').length, 1);
    assert.equal(f.doc.activeElement?.id, 'focus');
    assert.equal(f.bubble()?.querySelector('[role=status]')?.getAttribute('aria-live'), 'polite');
  }
  assert.throws(() => f.speech.say('x'.repeat(1001)));
  assert.equal(f.bubble()?.textContent, '<img src=x onerror=alert(1)>'); f.close();
});

test('existing movement clock uses cached layout and clears offscreen', () => {
  const f = fixture(); f.speech.say('Moving', { duration: 0 }); const reads = f.reads();
  for (let x = 1; x <= 100; x++) f.move(x, 0);
  assert.equal(f.reads(), reads);
  f.move(2000, 0); assert.equal(f.bubble(), undefined);
  f.move(0, 0); assert.equal(f.bubble(), undefined); f.close();
});

test('narrow viewport and long unbroken text remain constrained; keyboard dismiss', () => {
  const f = fixture(); Object.defineProperty(f.dom.window, 'innerWidth', { value: 240 });
  f.speech.say('長'.repeat(1000), { duration: 0, dismissible: true, dismissLabel: '閉じる' });
  assert.equal(f.bubble()?.style.width, '224px');
  assert.equal(f.bubble()?.querySelector('button')?.getAttribute('aria-label'), '閉じる');
  f.bubble()?.querySelector('button')?.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(f.bubble(), undefined); f.close();
});

test('replacement cancels earlier timeout, clear and hidden state remove listeners', async () => {
  const f = fixture(); f.speech.say('Old', { duration: 1 }); f.speech.say('New', { duration: 0 });
  await new Promise(resolve => setTimeout(resolve, 8)); assert.equal(f.bubble()?.textContent, 'New');
  Object.defineProperty(f.doc, 'hidden', { value: true, configurable: true });
  f.doc.dispatchEvent(new f.dom.window.Event('visibilitychange')); assert.equal(f.bubble(), undefined);
  f.speech.say('Hidden'); assert.equal(f.bubble(), undefined);
  Object.defineProperty(f.doc, 'hidden', { value: false });
  f.speech.say('Timed', { duration: 1 }); await new Promise(resolve => setTimeout(resolve, 8)); assert.equal(f.bubble(), undefined);
  f.speech.say('Bye', { duration: 0 }); f.hide(); assert.equal(f.bubble(), undefined);
  const reads = f.reads(); f.doc.dispatchEvent(new f.dom.window.Event('scroll')); assert.equal(f.reads(), reads);
  f.speech.clear(); f.speech.clear(); f.close();
});

test('overflowing mobile message is scrollable and keyboard reachable without trapping ordinary text', () => {
  const f = fixture();
  Object.defineProperty(f.dom.window, 'innerWidth', { value: 240 });
  Object.defineProperty(f.dom.window, 'innerHeight', { value: 240 });
  f.speech.say('長'.repeat(1000), { duration: 0, dismissible: true });
  const bubble = f.bubble()!, message = bubble.querySelector<HTMLElement>('.message')!, button = bubble.querySelector('button')!;
  assert.equal(bubble.style.maxHeight, '224px');
  // JSDOM does not lay out text: model the measured overflow a narrow browser produces.
  Object.defineProperties(message, { scrollHeight: { value: 2000, configurable: true }, clientHeight: { value: 198, configurable: true } });
  f.speech.measure();
  assert.equal(message.textContent?.length, 1000);
  assert.equal(message.tabIndex, 0); assert.equal(message.style.pointerEvents, 'auto');
  assert.equal(button.parentElement, bubble); assert.equal(message.contains(button), false);
  message.focus(); assert.equal(f.doc.activeElement?.shadowRoot?.activeElement, message);
  const css = bubble.getRootNode() as ShadowRoot;
  assert.match(css.querySelector('style')!.textContent!, /\.message\{[^}]*overflow:auto/);
  Object.defineProperty(message, 'scrollHeight', { value: 50 }); f.speech.measure();
  assert.equal(message.hasAttribute('tabindex'), false); assert.equal(message.style.pointerEvents, 'none');
  f.close();
});

test('unsupported ancestor geometry rejects atomically, while own transforms are supported', () => {
  const f = fixture(), parent = f.doc.createElement('div');
  f.host.before(parent); parent.append(f.host);
  f.speech.say('Keep this', { duration: 0 });
  for (const declaration of ['transform:scale(2)', 'scale:2', 'rotate:15deg', 'translate:10px', 'perspective:500px', 'zoom:2']) {
    parent.style.cssText = declaration;
    assert.throws(() => f.speech.say('Invalid'), /say requires/);
    assert.equal(f.bubble()?.textContent, 'Keep this');
  }
  parent.style.cssText = '';
  f.host.style.cssText = 'zoom:2'; assert.throws(() => f.speech.say('Invalid'), /CSS zoom/);
  f.host.style.cssText = 'transform:scale(2) rotate(10deg)';
  assert.doesNotThrow(() => f.speech.say('Own transform', { duration: 0 }));
  for (const target of [f.doc.body, f.doc.documentElement]) {
    for (const declaration of ['transform:translateX(20px)', 'translate:20px', 'filter:blur(0)', 'backdrop-filter:blur(0)', 'contain:layout', 'will-change:transform', 'content-visibility:auto']) {
      target.style.cssText = declaration;
      assert.throws(() => f.speech.say('Invalid portal'), /say requires/);
      assert.equal(f.bubble()?.textContent, 'Own transform');
    }
    target.style.cssText = '';
  }
  f.close();
});
