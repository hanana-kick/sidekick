import '../src/index.ts';
import actionSource from './use-case-actions.js?raw';
import { mountSiteHeader } from './shared-header.js';
import { loadStudioSession, applyStudioSession } from './studio-session.ts';
import { dockInViewport, sectionDestination, alignWithElement, connectTaskEvents } from './use-case-actions.js';
const $ = id => document.getElementById(id);
mountSiteHeader($('site-header-brand'), 'usecases');
const header = document.querySelector('.app-header');
const headerObserver = new ResizeObserver(() => document.documentElement.style.setProperty('--header-height', `${header.getBoundingClientRect().height}px`));
headerObserver.observe(header);
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
renderCode('viewport', common + `// Small transparent canvas; DOM is fixed to the viewport.\nbot.style.width = '200px'; bot.style.height = '200px';\n${exampleSource('dockInViewport')}\nawait dockInViewport(bot);\nconst controller = new AbortController();\nwindow.addEventListener('resize', () => dockInViewport(bot), { signal: controller.signal });\n// Optional natural exit:\n// await bot.exit({ to: 'right' });\n// On unmount: controller.abort(); bot.remove();`);
renderCode('section', common + `const section = document.querySelector('#section-area');\nsection.style.position = 'relative'; section.style.overflow = 'hidden';\nbot.placement = 'inline';\nbot.style.position = 'absolute'; bot.style.left = '0'; bot.style.top = '0';\n// Put the bot inside section BEFORE initialization. Its DOM origin is the anchor.\n${exampleSource('sectionDestination')}\n// Queue destinations until the preceding flight is finished to avoid\n// outward inertia on abrupt reversal near a container boundary.\nawait bot.moveTo(sectionDestination(bot, section, { x: 200, y: 100 }));\n// A resize requires re-clamping the current position to the new section size.\n// The container scrolls with the document; no scroll listener is needed.`);
function refreshAnchorCode() {
  const options = { alignX: $('align-x').value, alignY: $('align-y').value, x: Number($('offset-x').value), y: Number($('offset-y').value), anchor: $('anchor-follow').checked };
  renderCode('anchor', common + `bot.movementBounds = 'none'; // Follow a DOM target even when it scrolls offscreen.\nconst target = document.querySelector('#anchor-target');\nawait bot.moveToElement(target, ${JSON.stringify(options, null, 2)});\n// anchor: true keeps following the target DOM through scroll/layout changes.\n// anchor: false samples its position once.\n// bot.detachAnchor(); // release at the current position`);
  return options;
}
refreshAnchorCode();
renderCode('events', common + `bot.movementBounds = 'none';\nconst target = document.querySelector('#event-target');\nconst form = document.querySelector('#demo-form');\nconst output = document.querySelector('#event-status');\nconst controller = new AbortController();\n${exampleSource('connectTaskEvents')}\nconnectTaskEvents(bot, target, form, output, controller.signal);\n// Your app can send a result directly:\ntarget.dispatchEvent(new CustomEvent('demo-task', { detail: { state: 'success' } }));\n// On unmount: controller.abort(); bot.remove();`);
function stop() {
  revision++;
  if (active) { active.controller.abort(); active.observer?.disconnect(); active.intersection?.disconnect(); active.bot.remove(); }
  active = null;
  $('anchor-status').textContent = 'DOM 연결 대기';
  for (const button of document.querySelectorAll('[data-start]')) button.setAttribute('aria-pressed', 'false');
  for (const button of document.querySelectorAll('#viewport-return,#viewport-exit,[data-section],#anchor-move,#anchor-detach,#task-submit,#event-success')) button.disabled = true;
  $('demo-status').textContent = '예제가 종료되었습니다.';
}
async function activate(kind) {
  stop(); const token = revision;
  for (const panel of document.querySelectorAll('section.case')) panel.hidden = panel.id !== `case-${kind}`;
  for (const button of document.querySelectorAll('[data-start]')) button.setAttribute('aria-pressed', String(button.dataset.start === kind));
  $('demo-status').removeAttribute('data-error');
  $('scroll-description').textContent = kind === 'viewport' ? '화면 오른쪽 아래의 봇은 같은 자리에 남습니다. 상단 메뉴로 다른 예제를 바로 선택할 수 있습니다.' : kind === 'section' ? '섹션 안의 봇은 섹션과 함께 위로 올라갑니다. 화면에 고정된 봇과의 차이입니다.' : kind === 'anchor' ? 'DOM 연결을 유지한 봇은 기준 카드와 함께 스크롤됩니다. 연결을 해제하면 현재 화면 위치에 남습니다.' : '이벤트 반응 예제의 봇은 작업 카드에 연결되어 있습니다. 예제로 돌아가 결과를 바꿔 보세요.';
  const controller = new AbortController();
  const bot = document.createElement('sidekick-avatar'); bot.id = 'demo-bot'; bot.className = 'demo-bot';
  bot.setAttribute('placement', kind === 'section' ? 'inline' : 'viewport');
  bot.setAttribute('interaction', 'none');
  const entry = active = { kind, bot, controller, busy: false, pending: null };
  $('demo-status').textContent = `${labels[kind]} 준비 중…`;
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('렌더러 초기화 시간이 초과되었습니다. 예제를 다시 선택해 주세요.')), 12000);
    const finish = () => { clearTimeout(timer); resolve(); };
    bot.addEventListener('sidekick-ready', finish, { once: true, signal: controller.signal });
    bot.addEventListener('sidekick-error', event => { if (!event.detail.recoverable) { clearTimeout(timer); reject(new Error('이 브라우저에서 WebGL 렌더러를 시작할 수 없습니다. 하드웨어 가속 또는 WebGL 지원을 확인해 주세요. 사용 코드는 계속 볼 수 있습니다.')); } }, { signal: controller.signal });
    controller.signal.addEventListener('abort', finish, { once: true });
  });
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
    bot.movementBounds = 'none';
    await bot.moveToElement(target, { ...(kind === 'anchor' ? refreshAnchorCode() : { alignX: 'right', alignY: 'center', anchor: true }), duration: 0 });
    if (kind === 'anchor') $('anchor-status').textContent = $('anchor-follow').checked ? '연결 중 · 카드를 옮기거나 페이지를 스크롤해 보세요.' : '한 번 이동 · 이후 DOM을 따라가지 않습니다.';
    if (kind === 'events') connectTaskEvents(bot, target, $('demo-form'), $('event-status'), signal);
  }
  if (token !== revision) return;
  bot.setAttribute('data-configured', '');
  $('demo-status').textContent = `${labels[kind]} 활성화 · Studio 봇 준비 완료`;
  $('stop-demo').disabled = false;
  document.querySelector(`[data-start="${kind}"]`).setAttribute('aria-pressed', 'true');
  const selectors = { viewport: '#viewport-return,#viewport-exit', section: '[data-section]', anchor: '#anchor-move,#anchor-detach', events: '#task-submit,#event-success' };
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
function handleError(error) { $('demo-status').textContent = `실행할 수 없습니다: ${error.message}`; $('demo-status').setAttribute('data-error', ''); }
for (const button of document.querySelectorAll('[data-start]')) button.addEventListener('click', () => { void activate(button.dataset.start).catch(handleError); document.querySelector(`#case-${button.dataset.start}`).scrollIntoView({ block: 'start', behavior: 'instant' }); });
$('stop-demo').addEventListener('click', stop);
$('viewport-return').addEventListener('click', () => { if (active?.kind === 'viewport') void dockInViewport(active.bot).catch(handleError); });
$('viewport-exit').addEventListener('click', () => { if (active?.kind === 'viewport') void active.bot.exit({ to: 'right' }).catch(handleError); });
for (const button of document.querySelectorAll('[data-section]')) button.addEventListener('click', () => {
  if (active?.kind !== 'section') return;
  const section = $('section-area'), bot = active.bot;
  const fraction = { left: 0, center: .5, right: 1 }[button.dataset.section];
  void sectionMove({ x: (section.clientWidth - bot.offsetWidth) * fraction, y: (section.clientHeight - bot.offsetHeight) / 2 }).catch(handleError);
});
for (const id of ['align-x', 'align-y', 'offset-x', 'offset-y', 'anchor-follow']) $(id).addEventListener('input', refreshAnchorCode);
$('anchor-move').addEventListener('click', () => {
  if (active?.kind !== 'anchor') return;
  if (!$('offset-x').checkValidity() || !$('offset-y').checkValidity() || $('offset-x').value === '' || $('offset-y').value === '') { $('demo-status').textContent = '오프셋은 -500 ~ 500 사이 숫자를 입력하세요.'; return; }
  void alignWithElement(active.bot, $('anchor-target'), refreshAnchorCode()).then(() => { $('anchor-status').textContent = active?.bot.elementAnchor ? '연결 중 · DOM 위치를 계속 따라갑니다.' : '한 번 이동 완료 · DOM 연결 없음'; }).catch(handleError);
});
$('event-success').addEventListener('click', () => { if (active?.kind === 'events') $('event-target').dispatchEvent(new CustomEvent('demo-task', { detail: { state: 'success' } })); });
// Inactive form never navigates away, even when Enter is pressed in a field.
$('demo-form').addEventListener('submit', event => event.preventDefault());
for (const button of document.querySelectorAll('[data-copy]')) button.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(codes[button.dataset.copy]); button.textContent = '복사됨'; }
  catch { button.textContent = '복사 권한이 없습니다 · 위 코드를 선택하세요'; }
});
window.addEventListener('pagehide', () => { stop(); headerObserver.disconnect(); });
document.addEventListener('visibilitychange', () => { if (active) active.bot.paused = document.hidden || active.visible === false || session.scene.paused; });

$('anchor-detach').addEventListener('click', () => { if (active?.kind !== 'anchor') return; active.bot.detachAnchor(); $('anchor-status').textContent = '연결 해제 · 이후 DOM 위치를 따라가지 않습니다.'; });
$('anchor-shift').addEventListener('click', () => $('anchor-target').classList.toggle('shifted'));
for (const button of document.querySelectorAll('[data-scroll-demo]')) button.addEventListener('click', () => $('scroll-demo').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }));
$('back-to-demo').addEventListener('click', () => document.querySelector('section.case:not([hidden])').scrollIntoView({ behavior: 'smooth', block: 'start' }));
// Show a real example immediately; the selector is also the retry control.
void activate('viewport').catch(handleError);
