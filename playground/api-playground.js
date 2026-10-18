import { createAccessory } from '../src/index.ts';

const $ = id => document.getElementById(id);
const bot = $('bot'), stage = $('movement-stage');
const method = $('move-method'), xInput = $('target-x'), yInput = $('target-y');
const durationInput = $('duration'), easingInput = $('easing'), travelInput = $('travel');
const invocation = $('invocation'), log = $('result-log');
let alternate = false, initialized = false, gesture = null, resizeFrame = 0;
let code = '';
const number = value => Math.round(value * 100) / 100;
const pointCode = point => `{ x: ${number(point.x)}, y: ${number(point.y)} }`;
const setCode = value => { code = value; invocation.textContent = value; $('copy-status').textContent = ''; };
const avatarCode = statement => `const avatar = document.querySelector('#bot');\n${statement}`;

function stageBounds() {
  const rect = stage.getBoundingClientRect();
  // Keep the entire fixed-size canvas in the stage, including at narrow widths.
  const minX = Math.max(0, rect.left), minY = Math.max(0, rect.top);
  return { minX, minY, maxX: Math.max(minX, Math.min(innerWidth, rect.right) - bot.offsetWidth), maxY: Math.max(minY, Math.min(innerHeight, rect.bottom) - bot.offsetHeight) };
}
function constrain(point) {
  const bounds = stageBounds();
  return { x: number(Math.max(bounds.minX, Math.min(bounds.maxX, point.x))), y: number(Math.max(bounds.minY, Math.min(bounds.maxY, point.y))) };
}
function center() {
  const rect = stage.getBoundingClientRect();
  return constrain({ x: rect.left + (rect.width - bot.offsetWidth) / 2, y: rect.top + (rect.height - bot.offsetHeight) / 2 });
}
function marker(point) {
  const rect = stage.getBoundingClientRect(), target = $('target-marker');
  target.hidden = false;
  target.style.left = `${point.x + bot.offsetWidth / 2 - rect.left}px`;
  target.style.top = `${point.y + bot.offsetHeight / 2 - rect.top}px`;
}
function readOptions() {
  if (!durationInput.checkValidity() || durationInput.value === '') throw new RangeError('이동 시간은 0–10000ms로 입력하세요.');
  return { duration: Number(durationInput.value), easing: easingInput.value, travel: travelInput.value };
}
function optionsCode(options) { return `{ duration: ${options.duration}, easing: '${options.easing}', travel: '${options.travel}' }`; }
function movementCommand() {
  if (![xInput, yInput].every(input => input.value !== '' && input.checkValidity())) throw new RangeError('X와 Y에 유효한 숫자를 입력하세요.');
  const input = { x: Number(xInput.value), y: Number(yInput.value) }, from = bot.position;
  const target = constrain(method.value === 'moveBy' ? { x: from.x + input.x, y: from.y + input.y } : input);
  const point = method.value === 'moveBy' ? { x: number(target.x - from.x), y: number(target.y - from.y) } : target;
  const options = readOptions();
  return { method: method.value, point, target, options, code: avatarCode(`const result = await avatar.${method.value}(${pointCode(point)}, ${optionsCode(options)});`) };
}
function previewCommand() {
  $('x-label').textContent = method.value === 'moveBy' ? 'ΔX · CSS px' : 'X · viewport px';
  $('y-label').textContent = method.value === 'moveBy' ? 'ΔY · CSS px' : 'Y · viewport px';
  try { setCode(movementCommand().code); }
  catch { setCode('// X, Y, 이동 시간을 입력하면 호출 코드가 표시됩니다.'); }
}
function telemetry(detail = bot.movementState) {
  const movement = detail ?? { phase: 'idle', progress: 0, position: bot.position };
  const position = bot.position;
  if ($('phase').textContent !== movement.phase) $('phase').textContent = movement.phase;
  const progress = Math.max(0, Math.min(1, movement.progress));
  $('progress').value = progress;
  $('progress-value').textContent = `${Math.round(progress * 100)}%`;
  $('position').textContent = `x ${number(position.x)} · y ${number(position.y)}`;
  $('activity-state').textContent = bot.activity;
}
function report(kind, result) {
  const entry = document.createElement('li'), title = document.createElement('span'), value = document.createElement('pre');
  title.className = 'entry-title'; title.textContent = kind;
  value.textContent = JSON.stringify(result, null, 2);
  entry.append(title, value); log.prepend(entry);
  while (log.children.length > 12) log.lastElementChild.remove();
  $('status').textContent = kind === 'error' ? String(result) : `${kind} · ${result?.finished === false ? '중단됨' : result?.finished === true ? '완료' : '업데이트됨'}`;
  telemetry();
}
async function run(kind, source, operation) {
  setCode(source);
  try { const result = await operation(); if (result !== undefined) report(`${kind} result`, result); telemetry(); }
  catch (error) { report('error', error.message); }
}
function move() {
  try {
    const command = movementCommand();
    // Show precisely the values passed to the API after stage bounds are applied.
    xInput.value = String(command.point.x); yInput.value = String(command.point.y);
    marker(command.target);
    void run(command.method, command.code, () => bot[command.method](command.point, command.options));
  } catch (error) { report('error', error.message); }
}
function moveTo(point) { method.value = 'moveTo'; xInput.value = String(point.x); yInput.value = String(point.y); previewCommand(); move(); }
function moveBy(point) { method.value = 'moveBy'; xInput.value = String(point.x); yInput.value = String(point.y); previewCommand(); move(); }
for (const input of [method, xInput, yInput, durationInput, easingInput, travelInput]) input.addEventListener('input', previewCommand);
$('move').onclick = move;
for (const input of [xInput, yInput, durationInput]) input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); move(); } });
for (const button of document.querySelectorAll('[data-dx]')) button.onclick = () => moveBy({ x: Number(button.dataset.dx), y: Number(button.dataset.dy) });
$('cancel').onclick = () => void run('cancelMove', avatarCode('avatar.cancelMove();'), () => bot.cancelMove());
$('play').onclick = () => {
  const activity = $('activity').value;
  void run('play', avatarCode(`const result = await avatar.play('${activity}', { duration: 1000 });`), () => { const result = bot.play(activity, { duration: 1000 }); telemetry(); return result; });
};
$('stop').onclick = () => void run('stop', avatarCode('avatar.stop();'), () => bot.stop());
$('transition').onclick = () => {
  alternate = !alternate;
  const shape = alternate ? 'heart' : 'ghostish', expression = alternate ? 'smile' : 'neutral', accessory = alternate ? 'halo' : 'beret';
  void run('transitionTo', `import { createAccessory } from '@hanana-kick/sidekick';\n\n${avatarCode(`const result = await avatar.transitionTo({\n  shape: '${shape}',\n  expression: '${expression}',\n  accessories: [createAccessory('${accessory}'), createAccessory('glasses')]\n}, { duration: 700 });`)}`, () => bot.transitionTo({ shape, expression, accessories: [createAccessory(accessory), createAccessory('glasses')] }, { duration: 700 }));
};
$('cancel-transition').onclick = () => void run('cancelTransition', avatarCode('avatar.cancelTransition();'), () => bot.cancelTransition());
$('interactive').onchange = event => { bot.interaction = event.target.checked ? 'box' : 'none'; setCode(avatarCode(`avatar.interaction = '${bot.interaction}';`)); };
$('reduce').onchange = event => { bot.paused = event.target.checked; setCode(avatarCode(`avatar.paused = ${bot.paused};`)); telemetry(); };
$('clear-log').onclick = () => { log.replaceChildren(); $('status').textContent = '기록을 비웠습니다.'; };
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(code); $('copy-status').textContent = '코드를 복사했습니다.'; }
  catch {
    const range = document.createRange(); range.selectNodeContents(invocation);
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    $('copy-status').textContent = '선택된 코드를 직접 복사하세요.';
  }
};

// Pointer-up plus a movement/scroll threshold distinguishes a tap from a swipe.
// Do not prevent default: touch scrolling and browser zoom stay available.
stage.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) { gesture = null; return; }
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, scroll: window.scrollY, time: performance.now() };
});
window.addEventListener('pointermove', event => {
  if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) gesture = null;
}, { passive: true });
window.addEventListener('pointercancel', () => { gesture = null; }, { passive: true });
window.addEventListener('pointerup', event => {
  const tap = gesture; gesture = null;
  if (!tap || tap.id !== event.pointerId || performance.now() - tap.time > 600 || Math.abs(window.scrollY - tap.scroll) > 2 || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8) return;
  const rect = stage.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
  moveTo(constrain({ x: event.clientX - bot.offsetWidth / 2, y: event.clientY - bot.offsetHeight / 2 }));
}, { passive: true });
stage.addEventListener('keydown', event => {
  const offsets = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] };
  if (offsets[event.key]) { event.preventDefault(); const [x, y] = offsets[event.key]; moveBy({ x, y }); }
  else if (event.key === 'Home') { event.preventDefault(); moveTo(center()); }
});

bot.addEventListener('sidekick-move-progress', event => telemetry(event.detail));
for (const name of ['move-end', 'play-end', 'transition-end']) bot.addEventListener(`sidekick-${name}`, event => report(`sidekick-${name}`, event.detail));
function initialize() {
  if (initialized) return;
  initialized = true;
  const point = center();
  void bot.moveTo(point, { duration: 0, travel: 'none' });
  const firstTarget = constrain({ x: point.x + 120, y: point.y });
  xInput.value = String(firstTarget.x); yInput.value = String(firstTarget.y);
  previewCommand(); telemetry();
  report('ready', { backend: bot.diagnostics.backend, canvas: { width: bot.offsetWidth, height: bot.offsetHeight } });
}
bot.addEventListener('sidekick-ready', initialize);
if (bot.ready) initialize();
function resize() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    if (!initialized) return;
    const current = bot.position, next = constrain(current);
    // A resized stage invalidates an in-flight destination as well as its current point.
    if (next.x !== current.x || next.y !== current.y || bot.movementState.phase !== 'idle') void bot.moveTo(next, { duration: 0, travel: 'none' });
    $('target-marker').hidden = true;
    telemetry();
  });
}
new ResizeObserver(resize).observe(stage);
window.addEventListener('resize', resize);
const preference = matchMedia('(prefers-reduced-motion: reduce)');
function showPreference() { $('motion-preference').textContent = preference.matches ? '운영체제: 모션 줄이기 켜짐. 이동은 즉시 적용됩니다.' : '운영체제의 모션 줄이기 설정을 존중합니다.'; }
preference.addEventListener('change', showPreference);
showPreference();
