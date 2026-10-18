/** Self-contained examples: these exact functions execute live and appear in copyable snippets. */
export function dockInViewport(bot) {
  bot.placement = 'viewport';
  return bot.moveTo({ x: Math.max(0, innerWidth - bot.offsetWidth - 20), y: Math.max(0, innerHeight - bot.offsetHeight - 78) });
}
export function sectionDestination(bot, section, point) {
  const maxX = Math.max(0, section.clientWidth - bot.offsetWidth);
  const maxY = Math.max(0, section.clientHeight - bot.offsetHeight);
  const margin = Math.min(20, maxX / 2, maxY / 2);
  return { x: Math.max(margin, Math.min(maxX - margin, point.x)), y: Math.max(margin, Math.min(maxY - margin, point.y)) };
}
export function alignWithElement(bot, target, options) {
  return bot.moveToElement(target, options);
}
export function connectTaskEvents(bot, target, form, output, signal) {
  let revision = 0, timer;
  const finish = event => {
    const state = event.detail?.state;
    if (!['pending', 'success', 'error'].includes(state)) return;
    const current = ++revision;
    clearTimeout(timer);
    output.textContent = state === 'pending' ? '처리 중…' : state === 'success' ? '작업 완료' : '작업 실패 · 다시 시도하세요';
    bot.setActivity(state === 'pending' ? 'thinking' : state === 'success' ? 'celebrating' : 'still');
    void bot.setExpression('both', state === 'success' ? 'smile' : 'neutral', { duration: 200 });
    void bot.moveToElement(target, { alignX: 'right', alignY: 'center', x: 0, y: 0 }).then(() => {
      if (signal.aborted || current !== revision) return;
      if (state === 'success') bot.play('celebrating', { duration: 1600 });
    });
  };
  target.addEventListener('demo-task', finish, { signal });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    target.dispatchEvent(new CustomEvent('demo-task', { detail: { state: 'pending' } }));
    const current = revision;
    const result = form.querySelector('select').value;
    // Local simulation only. Replace this timer with your actual request result.
    timer = setTimeout(() => {
      if (!signal.aborted && current === revision) target.dispatchEvent(new CustomEvent('demo-task', { detail: { state: result } }));
    }, 900);
  }, { signal });
  signal.addEventListener('abort', () => { revision++; clearTimeout(timer); }, { once: true });
}
