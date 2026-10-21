import test from 'node:test';
import assert from 'node:assert/strict';
import { executeAction, actionSource, codeForAction } from '../playground/playground-actions.js';
import { readFileSync } from 'node:fs';

test('speech actions dispatch and round-trip literal text in all locales', () => {
  for (const text of ['이게 더 싼거야!', 'This one costs less!', '这个更便宜！', 'こちらの方がお得！', "It's <script>\n</script>\\\u2028"]) {
    const calls = [], avatar = { say: (...args) => calls.push(args), clearSpeech: () => calls.push('clear') };
    const options = { duration: 0, placement: 'auto', dismissible: true, dismissLabel: 'Close' };
    const action = { method: 'say', args: [text, options] };
    executeAction(avatar, action); new Function('avatar', actionSource(action))(avatar);
    assert.deepEqual(calls, [[text, options], [text, options]]);
    assert.doesNotMatch(actionSource(action), /await|<script>|<\/script>/);
    assert.match(codeForAction(action, 'react'), /const avatar = ref.current/);
    assert.match(codeForAction(action), /avatar.say\(/);
    executeAction(avatar, { method: 'clearSpeech' }); assert.equal(calls.at(-1), 'clear');
    assert.equal(actionSource({ method: 'clearSpeech' }), 'avatar.clearSpeech();');
  }
});

test('method-only dialogue documentation exists in every locale', () => {
  for (const lang of ['ko', 'en', 'ja', 'zh-CN']) {
    const source = readFileSync(new URL(`../docs/api-playground.${lang}.md`, import.meta.url), 'utf8');
    for (const name of ['say(text, options)', 'clearSpeech()', 'dismissLabel', '1000', 'SpeechOptions']) assert.ok(source.includes(name), `${lang}: ${name}`);
  }
  const schema = readFileSync(new URL('../playground/state-reference-schema.js', import.meta.url), 'utf8');
  assert.doesNotMatch(schema, /field\(['"]speech|json\(['"]speech/);
});
