import { installLifecycleExample, lifecycleMarkup, lifecycleLabels, refreshLifecycleLabels } from './lifecycle-example.js';
import { getFramework, subscribeFramework } from './site-framework.js';
import { getSiteLocale, subscribeSiteLocale } from './site-i18n.js';
import { apiText, applyApiLocale, apiError } from './api-locales.js';
import { mountSiteHeader } from './shared-header.js';
import { createAccessory, MATERIAL_SHAPE_LABELS } from '../src/index.ts';
import { codeForAction, executeAction } from './playground-actions.js';
import { loadStudioSession, applyStudioSession, seedStudioSession } from './studio-session.ts';

import { mountGuideExercise } from './guide-exercise.js';
import { navigationText, guideHref, readGuideSource } from './guide-navigation.js';

mountGuideExercise().then(exercise => {
if (!exercise) {
const $ = id => document.getElementById(id);
mountSiteHeader($('site-header-brand'), 'api');
const bot = $('bot');
let storage; try { storage = localStorage; } catch {}
const studioSession = loadStudioSession(storage);
seedStudioSession(bot, studioSession.scene);
$('studio-session-status').textContent = studioSession.message;
let initialized = false, initializing = false, gesture = null, selectedAction = null, code = '', lastAction = null, lastCode = '', execution = 0;
const samples = [];
const t = (key, values) => apiText(key, values, getSiteLocale());
const notices = new Map([['status', { key: 'initializing' }]]);
const logErrors = new WeakMap();
let validationError = null;
function errorMessage(error) {
  if (error.apiMessage) {
    const { key, values } = error.apiMessage;
    const field = values.fieldId ? $(values.fieldId)?.closest('label')?.querySelector('span')?.textContent ?? values.fieldId : values.field;
    return t(key, { ...values, field });
  }
  return t('actionFailed', { detail: error.message ?? String(error) });
}
function renderNotice(id) {
  const notice = notices.get(id);
  $(id).textContent = notice?.error ? errorMessage(notice.error) : notice?.key ? t(notice.key, notice.values) : '';
}
function notice(id, key, values = {}) { notices.set(id, { key, values }); renderNotice(id); }
function errorNotice(error) { notices.set('status', { error }); renderNotice('status'); }
function clearNotice(id) { notices.delete(id); $(id).textContent = ''; }
function refreshLabels() {
  const natural = $('travel').value === 'natural';
  $('duration-label').textContent = t(natural ? 'durationNatural' : 'durationTimed');
  $('timing-help').textContent = t(natural ? 'timingNatural' : 'timingTimed');
  const method = $('move-method').value;
  $('x-label').textContent = t(method === 'moveToElement' ? 'xOffset' : method === 'moveBy' ? 'xDelta' : 'xViewport');
  $('y-label').textContent = t(method === 'moveToElement' ? 'yOffset' : method === 'moveBy' ? 'yDelta' : 'yViewport');
}
function refreshLocale() {
  applyApiLocale(document);
  if($('lifecycle-live')?.querySelector('#reference-home'))refreshLifecycleLabels($('lifecycle-live'),getSiteLocale());
  const lifecycleLink=document.querySelector('[data-api-i18n="lifecycleGuide"]');if(lifecycleLink)lifecycleLink.href=`./guide.html?lang=${getSiteLocale()}&framework=${getFramework()}#state-lifecycle`;
  refreshLabels();
  $('studio-session-status').textContent = studioSession.message;
  for (const id of notices.keys()) renderNotice(id);
  for (const entry of $('result-log').children) {
    const error = logErrors.get(entry);
    if (error) { entry.querySelector('strong').textContent = t('error'); entry.querySelector('pre').textContent = JSON.stringify(errorMessage(error), null, 2); }
  }
  if (validationError) { code = `// ${errorMessage(validationError)}`; $('invocation').textContent = code; }
  for(const [value,key] of [['performance','performance'],['manual-motion','manual']]){const option=$('action-kind').querySelector('option[value="'+value+'"]');if(option)option.textContent=navigationText[getSiteLocale()][key];}
  const back=$('guide-source-return');if(back&&technicalKinds[technicalLesson]){back.textContent=navigationText[getSiteLocale()].back;back.href=guideHref(readGuideSource(location.href)??{id:technicalLesson==='declarative-lifecycle'?'state-lifecycle':technicalLesson,level:1},getSiteLocale());}
  showPreference(); telemetry();
}

const number = value => Math.round(value * 100) / 100;
const numeric = id => {
  const input = $(id);
  if (input.value === '' || !input.checkValidity()) throw apiError('invalidNumber', { fieldId: id, field: input.closest('label')?.querySelector('span')?.textContent ?? id }, RangeError);
  return Number(input.value);
};
const viewportPoint = point => ({ x: number(Math.max(0, Math.min(Math.max(0, innerWidth - bot.offsetWidth), point.x))), y: number(Math.max(0, Math.min(Math.max(0, innerHeight - bot.offsetHeight), point.y))) });
const center = () => viewportPoint({ x: (innerWidth - bot.offsetWidth) / 2, y: (innerHeight - bot.offsetHeight) / 2 });
for (const value of Object.keys(MATERIAL_SHAPE_LABELS)) {
  const option = document.createElement('option'); option.value = value; option.dataset.apiI18n = `shape.${value}`; option.textContent = t(`shape.${value}`); $('shape').append(option);
}
$('shape').value = 'heart'; $('head-accessory').value = 'beret'; $('eyes-accessory').value = 'glasses';
const technicalLesson=new URL(location.href).searchParams.get('lesson');
const technicalKinds={'placement':'movement','element-anchor':'movement','manual-motion':'manual-motion','performance':'performance','declarative-lifecycle':'lifecycle'};
if(technicalKinds[technicalLesson]){
 const labels=navigationText[getSiteLocale()];
 if(['manual-motion','performance'].includes(technicalLesson)){
  const option=document.createElement('option');option.value=technicalLesson;option.textContent=labels[technicalLesson==='performance'?'performance':'manual'];$('action-kind').append(option);
  const panel=document.createElement('div');panel.dataset.action=technicalLesson;
  if(technicalLesson==='performance'){const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.id='render-paused';input.checked=true;label.append(input,document.createTextNode('paused'));const output=document.createElement('pre');output.id='renderer-diagnostics';const refresh=document.createElement('button');refresh.type='button';refresh.textContent='diagnostics';refresh.onclick=()=>{output.textContent=JSON.stringify(bot.diagnostics,null,2);};panel.append(label,refresh,output);}
  $('action-panel').append(panel);
 }
 const link=document.createElement('a');link.id='guide-source-return';link.href=guideHref(readGuideSource(location.href)??{id:technicalLesson==='declarative-lifecycle'?'state-lifecycle':technicalLesson,level:1},getSiteLocale());link.textContent=labels.back;document.querySelector('.intro').append(link);
}
function movementOptions() {
  const duration = numeric('duration'), travel = $('travel').value;
  if (travel === 'none') return { duration, easing: $('easing').value, travel };
  return { duration, travel, ...($('auto-speed').checked ? {} : { maxSpeed: numeric('max-speed') }), acceleration: numeric('acceleration'), deceleration: numeric('deceleration') };
}
let disposeLifecycleExample = null;
function readAction() {
  switch ($('action-kind').value) {
    case 'lifecycle': return { lifecycle: true, locale: getSiteLocale(), steps: ['home', 'presence', 'task'].map(property => ({ property, value: JSON.parse($('lifecycle-' + property).value) })) };
    case 'movement': if ($('move-method').value === 'moveToElement') {
      const selector = $('target-selector').value.trim();
      let target;
      try { target = selector ? document.querySelector(selector) : null; }
      catch { throw apiError('selectorInvalid'); }
      if (!target) throw apiError('targetMissing');
      return { method: 'moveToElement', args: [selector, { x: numeric('target-x'), y: numeric('target-y'), alignX: $('align-x').value, alignY: $('align-y').value, anchor: $('element-anchor').checked, ...movementOptions() }] };
    } return { method: $('move-method').value, args: [{ x: numeric('target-x'), y: numeric('target-y') }, movementOptions()] };
    case 'performance': return {property:'paused',value:$('render-paused').checked};
    case 'manual-motion': return {sequential:true,steps:[{method:'stopBehavior',args:[]},{property:'trackingMode',value:'off'},{method:'moveTo',args:[{x:120,y:80},{maxSpeed:1350,acceleration:1800,deceleration:2200}]},{method:'lookAt',args:[{space:'view',x:0.7,y:0}]},{method:'setExpression',args:['both','smile',{duration:250}]}]};
    case 'anchor': return { method: 'detachAnchor', args: [] };
    case 'activity': {
      const method = $('activity-operation').value;
      if (method === 'stop') return { method, args: [] };
      if (method === 'setActivity') return { method, args: [$('activity').value] };
      const duration = numeric('activity-duration');
      return { method, args: [$('activity').value, ...(duration ? [{ duration }] : [])] };
    }
    case 'emotion': {
      const method=$('emotion-operation').value;
      if(method==='cancelReaction')return {method,args:[]};
      return {method,args:[$('emotion-name').value,{intensity:numeric('emotion-intensity'),...(method==='reactTo'?{duration:numeric('emotion-duration')}:{})}]};
    }
    case 'expression': return { method: 'setExpression', args: [$('eye-side').value, $('expression').value, { duration: numeric('expression-duration') }] };
    case 'tracking': return { property: 'trackingMode', value: $('tracking-mode').value };
    case 'orientation': return { steps: [{ method: 'setBodyOrientation', args: [{ yaw: numeric('body-yaw'), pitch: numeric('body-pitch'), roll: numeric('body-roll') }] }, { property: 'zoom', value: numeric('zoom') }] };
    case 'assets': return { method: 'transitionTo', args: [{ shape: $('shape').value, accessories: ['head-accessory', 'eyes-accessory', 'neck-accessory'].map(id => $(id).value).filter(Boolean) }, { duration: numeric('transition-duration') }] };
    case 'presence': return $('presence-operation').value === 'enter'
      ? { method: 'enter', args: [{ x: numeric('entrance-x'), y: numeric('entrance-y') }, { from: $('presence-edge').value }] }
      : { method: 'exit', args: [{ to: $('presence-edge').value }] };
    default: throw apiError('selectAction');
  }
}
function renderCode(action) {
  selectedAction = action; validationError = null;
  code = codeForAction(action, getFramework()==='react'?'react':'javascript', studioSession.scene);
  $('invocation').textContent = code; clearNotice('copy-status');
}
function renderLastCode(action) {
  lastAction = action;
  lastCode = codeForAction(action, getFramework()==='react'?'react':'javascript', studioSession.scene);
  $('last-invocation').textContent = lastCode;
  clearNotice('last-copy-status');
  $('last-execution').hidden = false;
}
function refresh() {
  const kind = $('action-kind').value;
  for (const panel of document.querySelectorAll('[data-action]')) panel.hidden = panel.dataset.action !== kind;
  const natural = $('travel').value === 'natural';
  $('physical-options').hidden = !natural; $('max-speed').disabled = !natural || $('auto-speed').checked; $('easing').disabled = natural;
  refreshLabels();
  const elementRelative = $('move-method').value === 'moveToElement';
  $('element-target-options').hidden = !elementRelative;
  $('activity-duration').disabled = $('activity-operation').value !== 'play'; $('activity').disabled = $('activity-operation').value === 'stop';
  $('emotion-duration').disabled = $('emotion-operation').value !== 'reactTo';
  $('emotion-name').disabled = $('emotion-intensity').disabled = $('emotion-operation').value === 'cancelReaction';
  $('entrance-coordinates').hidden = $('presence-operation').value === 'exit';
  try { renderCode(readAction()); $('execute').disabled = !initialized; }
  catch (error) { selectedAction = null; validationError = error; code = `// ${errorMessage(error)}`; $('invocation').textContent = code; clearNotice('copy-status'); $('execute').disabled = true; }
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
  if($('renderer-diagnostics'))$('renderer-diagnostics').textContent=JSON.stringify(bot.diagnostics,null,2);
  const movement = detail ?? { phase: 'idle', progress: 0 }, position = bot.position;
  const velocity = movement.velocity ?? { x: 0, y: 0 }, acceleration = movement.acceleration ?? { x: 0, y: 0 };
  const speed = movement.speed ?? Math.hypot(velocity.x, velocity.y), magnitude = Math.hypot(acceleration.x, acceleration.y);
  const phase = bot.presenceState === 'hidden' ? 'hidden' : movement.phase;
  const phaseLabel = t(`phase.${phase}`);
  if ($('phase').textContent !== phaseLabel) $('phase').textContent = phaseLabel;
  // Hidden diagnostics must not add per-frame layout/graph work to the avatar.
  if (!$('diagnostics').open) return;
  const progress = Math.max(0, Math.min(1, movement.progress)); $('progress').value = progress; $('progress-value').textContent = `${Math.round(progress * 100)}%`;
  $('position').textContent = `x ${number(position.x)} · y ${number(position.y)}`; $('activity-state').textContent = t(`activity.${bot.activity}`);
  $('speed').textContent = `${number(speed)} px/s`; $('velocity').textContent = `x ${number(velocity.x)} · y ${number(velocity.y)}`;
  $('acceleration-value').textContent = `${number(magnitude)} px/s²`; $('acceleration-vector').textContent = `x ${number(acceleration.x)} · y ${number(acceleration.y)}`;
  graph(movement, speed, magnitude);
}
function report(kind, result) {
  const entry = document.createElement('li'), title = document.createElement('strong'), value = document.createElement('pre');
  title.textContent = kind === 'error' ? t('error') : kind;
  if (kind === 'error') logErrors.set(entry, result);
  value.textContent = JSON.stringify(kind === 'error' ? errorMessage(result) : result, null, 2); entry.append(title, value); $('result-log').prepend(entry);
  while ($('result-log').children.length > 12) $('result-log').lastElementChild.remove();
}
async function run(action) {
  const id = ++execution; renderLastCode(action);
  notice('status', 'running');
  try {
    if (action.lifecycle && !$('lifecycle-live').querySelector('#reference-home')) $('lifecycle-live').innerHTML = lifecycleMarkup(getSiteLocale());
    const promise = executeAction(bot, action, createAccessory);
    if (action.lifecycle) {
      disposeLifecycleExample?.();
      disposeLifecycleExample = installLifecycleExample(bot, $('lifecycle-live'), lifecycleLabels[getSiteLocale()] ?? lifecycleLabels.en);
    }
    telemetry();
    const result = await promise;
    report(action.method ?? action.property ?? 'bodyOrientation / zoom', result ?? { applied: true });
    if (id === execution) notice('status', result?.finished === false ? 'interrupted' : 'applied');
    telemetry();
  } catch (error) { report('error', error); if (id === execution) errorNotice(error); }
}
$('execute').onclick = () => { try { void run(readAction()); } catch (error) { errorNotice(error); } };
const cancelMove = () => void run({ method: 'cancelMove', args: [] });
$('cancel').onclick = cancelMove; $('cancel-preview').onclick = cancelMove;
$('detach-anchor').onclick = () => void run({ method: 'detachAnchor', args: [] });
$('cancel-transition').onclick = () => void run({ method: 'cancelTransition', args: [] });
for (const input of document.querySelectorAll('#action-panel input, #action-panel select, #action-panel textarea')) input.addEventListener('input', refresh);
subscribeFramework(() => { if (selectedAction) renderCode(selectedAction); if (lastAction) renderLastCode(lastAction); renderInstallCode(); });
$('diagnostics').addEventListener('toggle', () => { if ($('diagnostics').open) telemetry(); });
window.addEventListener('pagehide', () => disposeLifecycleExample?.(), { once: true });
$('clear-log').onclick = () => $('result-log').replaceChildren();
function copyCode(sourceId, statusId, getCode) { return async () => {
  const copied = getCode();
  try { await navigator.clipboard.writeText(copied); notice(statusId, copied === getCode() ? 'copied' : 'copiedPrevious'); }
  catch { const range = document.createRange(); range.selectNodeContents($(sourceId)); const selection = getSelection(); selection?.removeAllRanges(); selection?.addRange(range); notice(statusId, 'copyManually'); }
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
  catch (error) { errorNotice(error); }
}, { passive: true });
bot.addEventListener('sidekick-move-progress', event => telemetry(event.detail));
for (const name of ['move-end', 'play-end', 'transition-end', 'enter-end', 'exit-end', 'lifecycle-change']) bot.addEventListener(`sidekick-${name}`, event => { report(`sidekick-${name}`, event.detail); telemetry(); });
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
  if(technicalKinds[technicalLesson]){
   $('action-kind').value=technicalKinds[technicalLesson];
   if(technicalLesson==='element-anchor'){$('move-method').value='moveToElement';$('target-selector').value='#action-panel';$('align-x').value='right';$('align-y').value='center';$('element-anchor').checked=true;$('target-x').value='16';$('target-y').value='0';}
   if(technicalLesson==='placement'){$('target-x').value='120';$('target-y').value='80';}
   if(technicalLesson==='performance')$('diagnostics').open=true;
  }
  refresh(); telemetry(); notice('status', 'ready');
}
bot.addEventListener('sidekick-ready', initialize); if (bot.ready) initialize();
window.addEventListener('resize', () => { gesture = null; /* The avatar viewport bounds handle resize, without replacing the selected command. */ telemetry(); });
const preference = matchMedia('(prefers-reduced-motion: reduce)');
function showPreference() { $('motion-preference').textContent = t(preference.matches ? 'reducedMotion' : 'motionPreference'); }
preference.addEventListener('change', showPreference);
subscribeSiteLocale(refreshLocale); refreshLocale(); refresh();
const elementInstallCode = `npm install github:hanana-kick/sidekick#v0.15.1\n\n<!-- HTML: Start with the companion configured in Studio -->\n<sidekick-avatar id="bot" placement="viewport"\n  style="width:180px;height:180px;pointer-events:none">\n</sidekick-avatar>\n<script type="module">\n  import 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.15.1/dist/browser/sidekick.js';\n  const scene = ${JSON.stringify(studioSession.scene, null, 2)};\n  const bot = document.querySelector('#bot');\n  bot.design = scene.design;\n  bot.setActivity(scene.activity);\n  bot.bodyOrientation = scene.bodyOrientation;\n  bot.zoom = scene.zoom;\n  bot.trackingMode = scene.trackingMode;\n  bot.paused = scene.paused;\n  bot.lookAt({ space: 'view', ...scene.gaze });\n  bot.seek(scene.time);\n  await bot.motion.to(scene.motion, { duration: 0 });\n  // Insert the invocation code above here.\n</script>`;

function renderInstallCode(){ $('install-code').textContent=getFramework()==='react'?'npm install github:hanana-kick/sidekick#v0.15.1\n\n'+codeForAction({property:'paused',value:false},'react',studioSession.scene):elementInstallCode; }
renderInstallCode();

}
}).catch(()=>{
 for(const element of [...document.body.children])if(!element.matches('.app-header,script'))element.remove();
 const warning=document.createElement('p');warning.id='invalid-guide-context';warning.setAttribute('role','alert');warning.textContent=navigationText[getSiteLocale()].invalid;document.body.append(warning);
});
