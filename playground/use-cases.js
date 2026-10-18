import '../src/index.ts';
import actionSource from './use-case-actions.js?raw';
import { mountSiteHeader } from './shared-header.js';
import { loadStudioSession, applyStudioSession } from './studio-session.ts';
import { dockInViewport, sectionDestination, alignWithElement, connectTaskEvents } from './use-case-actions.js';
const $ = id => document.getElementById(id);
mountSiteHeader($('site-header-brand'), 'usecases');
let storage; try { storage = localStorage; } catch {}
const session = loadStudioSession(storage);
$('session-status').textContent = session.message;
let active = null, revision = 0;
const labels = { viewport: '화면 고정', section: '섹션 안 이동', anchor: '엘리먼트 정렬', events: '이벤트 반응' };
const common = '// Registered and initialized <sidekick-avatar id="demo-bot">\nconst bot = document.querySelector("#demo-bot");\n';
const codes = {};
// Preserve readable, executable names in snippets even in minified production bundles.
function exampleSource(name) {
  const start = actionSource.indexOf('export function ' + name + '(');
  const end = actionSource.indexOf('\nexport function ', start + 1);
  return actionSource.slice(start, end < 0 ? undefined : end).replace('export function ', 'function ').trim();
}
function renderCode(kind, source) { codes[kind] = source; $(`code-${kind}`).textContent = source; }
renderCode('viewport', common + `// Small transparent canvas; DOM is fixed to the viewport.\nbot.style.width = '128px'; bot.style.height = '128px';\n${exampleSource('dockInViewport')}\nawait dockInViewport(bot);\nconst controller = new AbortController();\nwindow.addEventListener('resize', () => dockInViewport(bot), { signal: controller.signal });\n// Optional natural exit:\n// await bot.exit({ to: 'right' });\n// On unmount: controller.abort(); bot.remove();`);
renderCode('section', common + `const section = document.querySelector('#section-area');\nsection.style.position = 'relative'; section.style.overflow = 'hidden';\nbot.placement = 'inline';\nbot.style.position = 'absolute'; bot.style.left = '0'; bot.style.top = '0';\n// Put the bot inside section BEFORE initialization. Its DOM origin is the anchor.\n${exampleSource('sectionDestination')}\n// Queue destinations until the preceding flight is finished to avoid\n// outward inertia on abrupt reversal near a container boundary.\nawait bot.moveTo(sectionDestination(bot, section, { x: 200, y: 100 }));\n// A resize requires re-clamping the current position to the new section size.\n// The container scrolls with the document; no scroll listener is needed.`);
function refreshAnchorCode() {
  const options = { alignX: $('align-x').value, alignY: $('align-y').value, x: Number($('offset-x').value), y: Number($('offset-y').value) };
  renderCode('anchor', common + `const target = document.querySelector('#anchor-target');\nawait bot.moveToElement(target, ${JSON.stringify(options, null, 2)});\n// Samples the target's current DOM rectangle on each call.\n// Target and bot use the same alignment point, then x/y offsets.`);
  return options;
}
refreshAnchorCode();
renderCode('events', common + `const target = document.querySelector('#event-target');\nconst form = document.querySelector('#demo-form');\nconst output = document.querySelector('#event-status');\nconst controller = new AbortController();\n${exampleSource('connectTaskEvents')}\nconnectTaskEvents(bot, target, form, output, controller.signal);\n// Your app can send a result directly:\ntarget.dispatchEvent(new CustomEvent('demo-task', { detail: { state: 'success' } }));\n// On unmount: controller.abort(); bot.remove();`);
function stop() {
  revision++;
  if (active) { active.controller.abort(); active.observer?.disconnect(); active.intersection?.disconnect(); active.bot.remove(); }
  active = null;
  $('demo-toolbar').hidden = true;
  for (const button of document.querySelectorAll('[data-start]')) button.setAttribute('aria-pressed', 'false');
  for (const button of document.querySelectorAll('#viewport-return,#viewport-exit,[data-section],#anchor-move,#task-submit,#event-success')) button.disabled = true;
  $('demo-status').textContent = '예제가 종료되었습니다.';
}
async function activate(kind) {
  stop(); const token = revision;
  const controller = new AbortController();
  const bot = document.createElement('sidekick-avatar'); bot.id = 'demo-bot'; bot.className = 'demo-bot';
  bot.setAttribute('placement', kind === 'section' ? 'inline' : 'viewport');
  bot.setAttribute('interaction', 'none');
  const entry = active = { kind, bot, controller, busy: false, pending: null };
  $('demo-status').textContent = `${labels[kind]} 준비 중…`;
  const ready = new Promise(resolve => { bot.addEventListener('sidekick-ready', resolve, { once: true, signal: controller.signal }); controller.signal.addEventListener('abort', resolve, { once: true }); });
  (kind === 'section' ? $('section-area') : document.body).append(bot);
  if (!bot.ready) await ready;
  if (token !== revision) return;
  await applyStudioSession(bot, session.scene);
  if (token !== revision) return;
  bot.interaction = 'none';
  const signal = controller.signal;
  if (kind === 'viewport') {
    await bot.moveTo({ x: Math.max(0, innerWidth - bot.offsetWidth - 20), y: Math.max(0, innerHeight - bot.offsetHeight - 78) }, { duration: 0 });
    window.addEventListener('resize', () => { if (bot.presenceState !== 'hidden') void dockInViewport(bot); }, { signal });
  } else if (kind === 'section') {
    const section = $('section-area');
    await bot.moveTo(sectionDestination(bot, section, { x: section.clientWidth / 2 - bot.offsetWidth / 2, y: 100 }), { duration: 0 });
    entry.observer = new ResizeObserver(() => {
      if (token !== revision) return;
      entry.pending = null;
      void bot.moveTo(sectionDestination(bot, section, bot.position), { duration: 0 });
    }); entry.observer.observe(section);
    entry.intersection = new IntersectionObserver(([record]) => { entry.visible = record.isIntersecting; bot.paused = document.hidden || !entry.visible || session.scene.paused; }); entry.intersection.observe(section);
    let down;
    section.addEventListener('pointerdown', event => { if (event.isPrimary) down = { x: event.clientX, y: event.clientY, scroll: scrollY, id: event.pointerId }; }, { signal, passive: true });
    section.addEventListener('pointerup', event => {
      const start = down; down = null;
      if (!start || event.pointerId !== start.id || scrollY !== start.scroll || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
      const rect = section.getBoundingClientRect();
      void sectionMove({ x: event.clientX - rect.left - section.clientLeft - bot.offsetWidth / 2, y: event.clientY - rect.top - section.clientTop - bot.offsetHeight / 2 });
    }, { signal, passive: true });
    section.addEventListener('pointercancel', () => { down = null; }, { signal, passive: true });
  } else {
    const target = $(kind === 'anchor' ? 'anchor-target' : 'event-target');
    await bot.moveToElement(target, { alignX: 'center', alignY: 'center', duration: 0 });
    if (kind === 'events') connectTaskEvents(bot, target, $('demo-form'), $('event-status'), signal);
  }
  if (token !== revision) return;
  bot.setAttribute('data-configured', '');
  $('demo-status').textContent = `${labels[kind]} 활성화 · Studio 봇 준비 완료`;
  $('active-label').textContent = labels[kind]; $('demo-toolbar').hidden = false;
  document.querySelector(`[data-start="${kind}"]`).setAttribute('aria-pressed', 'true');
  const selectors = { viewport: '#viewport-return,#viewport-exit', section: '[data-section]', anchor: '#anchor-move', events: '#task-submit,#event-success' };
  for (const button of document.querySelectorAll(selectors[kind])) button.disabled = false;
}
async function sectionMove(point) {
  const entry = active; if (entry?.kind !== 'section') return;
  entry.pending = point; if (entry.busy) return;
  entry.busy = true;
  try {
    while (active === entry && entry.pending) {
      const next = entry.pending; entry.pending = null;
      await entry.bot.moveTo(sectionDestination(entry.bot, $('section-area'), next));
    }
  } finally { entry.busy = false; }
}
function handleError(error) { $('demo-status').textContent = `실행할 수 없습니다: ${error.message}`; }
for (const button of document.querySelectorAll('[data-start]')) button.addEventListener('click', () => { void activate(button.dataset.start).catch(handleError); });
$('stop-demo').addEventListener('click', stop);
$('viewport-return').addEventListener('click', () => { if (active?.kind === 'viewport') void dockInViewport(active.bot).catch(handleError); });
$('viewport-exit').addEventListener('click', () => { if (active?.kind === 'viewport') void active.bot.exit({ to: 'right' }).catch(handleError); });
for (const button of document.querySelectorAll('[data-section]')) button.addEventListener('click', () => {
  if (active?.kind !== 'section') return;
  const section = $('section-area'), bot = active.bot;
  const fraction = { left: 0, center: .5, right: 1 }[button.dataset.section];
  void sectionMove({ x: (section.clientWidth - bot.offsetWidth) * fraction, y: (section.clientHeight - bot.offsetHeight) / 2 }).catch(handleError);
});
for (const id of ['align-x', 'align-y', 'offset-x', 'offset-y']) $(id).addEventListener('input', refreshAnchorCode);
$('anchor-move').addEventListener('click', () => {
  if (active?.kind !== 'anchor') return;
  if (!$('offset-x').checkValidity() || !$('offset-y').checkValidity() || $('offset-x').value === '' || $('offset-y').value === '') { $('demo-status').textContent = '오프셋은 -500 ~ 500 사이 숫자를 입력하세요.'; return; }
  void alignWithElement(active.bot, $('anchor-target'), refreshAnchorCode()).catch(handleError);
});
$('event-success').addEventListener('click', () => { if (active?.kind === 'events') $('event-target').dispatchEvent(new CustomEvent('demo-task', { detail: { state: 'success' } })); });
// Inactive form never navigates away, even when Enter is pressed in a field.
$('demo-form').addEventListener('submit', event => event.preventDefault());
for (const button of document.querySelectorAll('[data-copy]')) button.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(codes[button.dataset.copy]); button.textContent = '복사됨'; }
  catch { button.textContent = '복사 권한이 없습니다 · 위 코드를 선택하세요'; }
});
window.addEventListener('pagehide', stop);
document.addEventListener('visibilitychange', () => { if (active) active.bot.paused = document.hidden || active.visible === false || session.scene.paused; });
