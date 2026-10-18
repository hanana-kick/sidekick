import { mountSiteHeader } from './shared-header.js';
import { createAccessory, MATERIAL_SHAPE_LABELS } from '../src/index.ts';
import { codeForAction, executeAction } from './playground-actions.js';
import { loadStudioSession, applyStudioSession } from './studio-session.ts';

const $ = id => document.getElementById(id);
mountSiteHeader($('site-header-brand'), 'api');
const bot = $('bot');
let storage; try { storage = localStorage; } catch {}
const studioSession = loadStudioSession(storage);
$('studio-session-status').textContent = studioSession.message;
let initialized = false, initializing = false, gesture = null, selectedAction = null, code = '', lastAction = null, lastCode = '', execution = 0;
const samples = [];
const number = value => Math.round(value * 100) / 100;
const numeric = id => {
  const input = $(id);
  if (input.value === '' || !input.checkValidity()) throw new RangeError(`${input.closest('label')?.querySelector('span')?.textContent ?? id}: 유효한 범위의 숫자를 입력하세요.`);
  return Number(input.value);
};
const viewportPoint = point => ({ x: number(Math.max(0, Math.min(Math.max(0, innerWidth - bot.offsetWidth), point.x))), y: number(Math.max(0, Math.min(Math.max(0, innerHeight - bot.offsetHeight), point.y))) });
const center = () => viewportPoint({ x: (innerWidth - bot.offsetWidth) / 2, y: (innerHeight - bot.offsetHeight) / 2 });
for (const [value, label] of Object.entries(MATERIAL_SHAPE_LABELS)) {
  const option = document.createElement('option'); option.value = value; option.textContent = label; $('shape').append(option);
}
$('shape').value = 'heart'; $('head-accessory').value = 'beret'; $('eyes-accessory').value = 'glasses';
function movementOptions() {
  const duration = numeric('duration'), travel = $('travel').value;
  if (travel === 'none') return { duration, easing: $('easing').value, travel };
  return { duration, travel, ...($('auto-speed').checked ? {} : { maxSpeed: numeric('max-speed') }), acceleration: numeric('acceleration'), deceleration: numeric('deceleration') };
}
function readAction() {
  switch ($('action-kind').value) {
    case 'movement': if ($('move-method').value === 'moveToElement') {
      const selector = $('target-selector').value.trim();
      if (!selector || !document.querySelector(selector)) throw new TypeError('대상 CSS 선택자에 해당하는 엘리먼트가 없습니다.');
      return { method: 'moveToElement', args: [selector, { x: numeric('target-x'), y: numeric('target-y'), alignX: $('align-x').value, alignY: $('align-y').value, anchor: $('element-anchor').checked, ...movementOptions() }] };
    } return { method: $('move-method').value, args: [{ x: numeric('target-x'), y: numeric('target-y') }, movementOptions()] };
    case 'anchor': return { method: 'detachAnchor', args: [] };
    case 'activity': {
      const method = $('activity-operation').value;
      if (method === 'stop') return { method, args: [] };
      if (method === 'setActivity') return { method, args: [$('activity').value] };
      const duration = numeric('activity-duration');
      return { method, args: [$('activity').value, ...(duration ? [{ duration }] : [])] };
    }
    case 'expression': return { method: 'setExpression', args: [$('eye-side').value, $('expression').value, { duration: numeric('expression-duration') }] };
    case 'tracking': return { property: 'trackingMode', value: $('tracking-mode').value };
    case 'orientation': return { steps: [{ method: 'setBodyOrientation', args: [{ yaw: numeric('body-yaw'), pitch: numeric('body-pitch'), roll: numeric('body-roll') }] }, { property: 'zoom', value: numeric('zoom') }] };
    case 'assets': return { method: 'transitionTo', args: [{ shape: $('shape').value, accessories: ['head-accessory', 'eyes-accessory', 'neck-accessory'].map(id => $(id).value).filter(Boolean) }, { duration: numeric('transition-duration') }] };
    case 'presence': return $('presence-operation').value === 'enter'
      ? { method: 'enter', args: [{ x: numeric('entrance-x'), y: numeric('entrance-y') }, { from: $('presence-edge').value }] }
      : { method: 'exit', args: [{ to: $('presence-edge').value }] };
    default: throw new TypeError('할 일을 선택하세요.');
  }
}
function renderCode(action) {
  selectedAction = action;
  code = codeForAction(action, $('code-format').value, studioSession.scene);
  $('invocation').textContent = code; $('copy-status').textContent = '';
}
function renderLastCode(action) {
  lastAction = action;
  lastCode = codeForAction(action, $('code-format').value, studioSession.scene);
  $('last-invocation').textContent = lastCode;
  $('last-copy-status').textContent = '';
  $('last-execution').hidden = false;
}
function refresh() {
  const kind = $('action-kind').value;
  for (const panel of document.querySelectorAll('[data-action]')) panel.hidden = panel.dataset.action !== kind;
  const natural = $('travel').value === 'natural';
  $('physical-options').hidden = !natural; $('max-speed').disabled = !natural || $('auto-speed').checked; $('easing').disabled = natural;
  $('duration-label').textContent = natural ? '0 = 즉시, 양수 = 자연 비행' : '이동 시간 · ms';
  $('timing-help').textContent = natural ? '거리에 무관한 최고 속도를 향해 가속하다 제동 거리에서 감속합니다. 짧은 이동은 최고 속도에 도달하지 않고, 먼 곳은 더 오래 걸립니다. 양수 duration은 무시합니다.' : '지정한 시간과 easing으로 이동합니다.';
  const elementRelative = $('move-method').value === 'moveToElement';
  $('element-target-options').hidden = !elementRelative;
  $('x-label').textContent = elementRelative ? 'X offset · CSS px' : $('move-method').value === 'moveBy' ? 'ΔX · CSS px' : 'X · viewport px';
  $('y-label').textContent = elementRelative ? 'Y offset · CSS px' : $('move-method').value === 'moveBy' ? 'ΔY · CSS px' : 'Y · viewport px';
  $('activity-duration').disabled = $('activity-operation').value !== 'play'; $('activity').disabled = $('activity-operation').value === 'stop';
  $('entrance-coordinates').hidden = $('presence-operation').value === 'exit';
  try { renderCode(readAction()); $('execute').disabled = !initialized; }
  catch (error) { selectedAction = null; code = `// ${error.message}`; $('invocation').textContent = code; $('copy-status').textContent = ''; $('execute').disabled = true; }
}
function graph(movement, speed, acceleration) {
  const now = performance.now(), last = samples.at(-1);
  if (last && now - last.time < 1000 / 30) samples[samples.length - 1] = { time: last.time, speed, acceleration };
  else samples.push({ time: now, speed, acceleration });
  while (samples.length > 240 || (samples.length > 1 && samples[1].time < now - 6000)) samples.shift();
  for (const [key, fallback, top] of [['speed', 320, 12], ['acceleration', 1200, 78]]) {
    const scale = Math.ceil(Math.max(fallback, ...samples.map(sample => sample[key])) / 100) * 100;
    $(`${key}-plot`).setAttribute('points', samples.map(sample => `${number(Math.max(0, (sample.time - now + 6000) / 6000) * 300 + 8)},${number(top + 40 - sample[key] / scale * 40)}`).join(' '));
    $(`${key}-scale`).textContent = `${scale}`;
  }
  $('motion-graph').dataset.phase = movement.phase;
}
function telemetry(detail = bot.movementState) {
  const movement = detail ?? { phase: 'idle', progress: 0 }, position = bot.position;
  const velocity = movement.velocity ?? { x: 0, y: 0 }, acceleration = movement.acceleration ?? { x: 0, y: 0 };
  const speed = movement.speed ?? Math.hypot(velocity.x, velocity.y), magnitude = Math.hypot(acceleration.x, acceleration.y);
  const phase = bot.presenceState === 'hidden' ? 'hidden' : movement.phase;
  if ($('phase').textContent !== phase) $('phase').textContent = phase;
  // Hidden diagnostics must not add per-frame layout/graph work to the avatar.
  if (!$('diagnostics').open) return;
  const progress = Math.max(0, Math.min(1, movement.progress)); $('progress').value = progress; $('progress-value').textContent = `${Math.round(progress * 100)}%`;
  $('position').textContent = `x ${number(position.x)} · y ${number(position.y)}`; $('activity-state').textContent = bot.activity;
  $('speed').textContent = `${number(speed)} px/s`; $('velocity').textContent = `x ${number(velocity.x)} · y ${number(velocity.y)}`;
  $('acceleration-value').textContent = `${number(magnitude)} px/s²`; $('acceleration-vector').textContent = `x ${number(acceleration.x)} · y ${number(acceleration.y)}`;
  graph(movement, speed, magnitude);
}
function report(kind, result) {
  const entry = document.createElement('li'), title = document.createElement('strong'), value = document.createElement('pre');
  title.textContent = kind; value.textContent = JSON.stringify(result, null, 2); entry.append(title, value); $('result-log').prepend(entry);
  while ($('result-log').children.length > 12) $('result-log').lastElementChild.remove();
}
async function run(action) {
  const id = ++execution; renderLastCode(action);
  $('status').textContent = '실행 중…';
  try {
    const promise = executeAction(bot, action, createAccessory); telemetry();
    const result = await promise;
    report(action.method ?? action.property ?? 'bodyOrientation / zoom', result ?? { applied: true });
    if (id === execution) $('status').textContent = result?.finished === false ? '중단되었습니다.' : '적용되었습니다.';
    telemetry();
  } catch (error) { report('error', error.message); if (id === execution) $('status').textContent = error.message; }
}
$('execute').onclick = () => { try { void run(readAction()); } catch (error) { $('status').textContent = error.message; } };
const cancelMove = () => void run({ method: 'cancelMove', args: [] });
$('cancel').onclick = cancelMove; $('cancel-preview').onclick = cancelMove;
$('detach-anchor').onclick = () => void run({ method: 'detachAnchor', args: [] });
$('cancel-transition').onclick = () => void run({ method: 'cancelTransition', args: [] });
for (const input of document.querySelectorAll('#action-panel input, #action-panel select')) input.addEventListener('input', refresh);
$('code-format').onchange = () => { if (selectedAction) renderCode(selectedAction); if (lastAction) renderLastCode(lastAction); };
$('diagnostics').addEventListener('toggle', () => { if ($('diagnostics').open) telemetry(); });
$('clear-log').onclick = () => $('result-log').replaceChildren();
function copyCode(sourceId, statusId, getCode) { return async () => {
  const copied = getCode();
  try { await navigator.clipboard.writeText(copied); $(statusId).textContent = copied === getCode() ? '코드를 복사했습니다.' : '이전 코드를 복사했습니다. 변경된 코드를 다시 복사하세요.'; }
  catch { const range = document.createRange(); range.selectNodeContents($(sourceId)); const selection = getSelection(); selection?.removeAllRanges(); selection?.addRange(range); $(statusId).textContent = '선택된 코드를 직접 복사하세요.'; }
}; }
$('copy').onclick = copyCode('invocation', 'copy-status', () => code);
$('copy-last').onclick = copyCode('last-invocation', 'last-copy-status', () => lastCode);
// Controls, links, selectable code and the header never become destination clicks.
const excluded = event => event.composedPath().some(target => target instanceof Element && Boolean(target.closest('button,input,select,textarea,label,a,summary,pre,[contenteditable],[role=button],[role=combobox],.card,.app-header,.flight-toolbar,details')));
document.addEventListener('pointerdown', event => {
  if (!initialized || !event.isPrimary || event.button !== 0 || excluded(event) || getSelection()?.toString()) { gesture = null; return; }
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, scrollX, scrollY, time: performance.now() };
});
window.addEventListener('pointermove', event => { if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) gesture = null; }, { passive: true });
window.addEventListener('pointercancel', () => { gesture = null; }, { passive: true });
window.addEventListener('scroll', () => { gesture = null; }, { passive: true });
window.addEventListener('pointerup', event => {
  const tap = gesture; gesture = null;
  if (!tap || tap.id !== event.pointerId || excluded(event) || getSelection()?.toString() || performance.now() - tap.time > 600 || scrollX !== tap.scrollX || scrollY !== tap.scrollY || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8) return;
  const point = viewportPoint({ x: event.clientX - bot.offsetWidth / 2, y: event.clientY - bot.offsetHeight / 2 });
  // Page navigation is a separate invocation, never an edit to the user's draft.
  try { void run({ method: 'moveTo', args: [point, movementOptions()] }); }
  catch (error) { $('status').textContent = error.message; }
}, { passive: true });
bot.addEventListener('sidekick-move-progress', event => telemetry(event.detail));
for (const name of ['move-end', 'play-end', 'transition-end', 'enter-end', 'exit-end']) bot.addEventListener(`sidekick-${name}`, event => { report(`sidekick-${name}`, event.detail); telemetry(); });
async function initialize() {
  if (initialized || initializing) return; initializing = true;
  await applyStudioSession(bot, studioSession.scene);
  bot.interaction = 'none';
  $('tracking-mode').value = studioSession.scene.trackingMode;
  for (const axis of ['yaw', 'pitch', 'roll']) $(`body-${axis}`).value = String(studioSession.scene.bodyOrientation[axis]);
  $('zoom').value = String(studioSession.scene.zoom);
  const point = center(); void bot.moveTo(point, { duration: 0, travel: 'none' });
  $('target-x').value = String(point.x); $('target-y').value = String(point.y); $('entrance-x').value = String(point.x); $('entrance-y').value = String(point.y);
  bot.setAttribute('data-configured', '');
  initialized = true; initializing = false;
  refresh(); telemetry(); $('status').textContent = '준비되었습니다. 값을 설정하고 실행해 보세요.';
}
bot.addEventListener('sidekick-ready', initialize); if (bot.ready) initialize();
window.addEventListener('resize', () => { gesture = null; /* The avatar viewport bounds handle resize, without replacing the selected command. */ telemetry(); });
const preference = matchMedia('(prefers-reduced-motion: reduce)');
function showPreference() { $('motion-preference').textContent = preference.matches ? '운영체제의 모션 줄이기 설정이 켜져 있어 이동이 즉시 적용됩니다.' : '운영체제의 모션 줄이기 설정을 존중합니다.'; }
preference.addEventListener('change', showPreference); showPreference(); refresh();
$('install-code').textContent = `npm install github:hanana-kick/sidekick#v0.8.0\n\n<!-- HTML: Studio에서 설정한 봇으로 시작 -->\n<sidekick-avatar id="bot" placement="viewport"\n  style="width:180px;height:180px;pointer-events:none">\n</sidekick-avatar>\n<script type="module">\n  import 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.8.0/dist/browser/sidekick.js';\n  const scene = ${JSON.stringify(studioSession.scene, null, 2)};\n  const bot = document.querySelector('#bot');\n  bot.design = scene.design;\n  bot.setActivity(scene.activity);\n  bot.bodyOrientation = scene.bodyOrientation;\n  bot.zoom = scene.zoom;\n  bot.trackingMode = scene.trackingMode;\n  bot.paused = scene.paused;\n  bot.lookAt({ space: 'view', ...scene.gaze });\n  bot.seek(scene.time);\n  await bot.motion.to(scene.motion, { duration: 0 });\n  // 위 호출 코드를 이 위치에 넣으세요.\n</script>`;
