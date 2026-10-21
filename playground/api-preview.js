import { scenarioCopy } from './demo-scenarios.js';
/** Only repository-owned demo documents can be mounted here. */
export function mountAPIPreview(doc, text, { locale, onReset, onReady, onError, onToggle = () => {} }) {
  const win = doc.defaultView, $ = id => doc.getElementById(id);
  const panel = $('bot-tools'), launcher = $('bot-tools-launcher');
  let revision = 0, runtime = null, frame = null, language = locale(), status = 'previewLoading';
  function setOpen(open, restore = true) {
    panel.hidden = !open;
    onToggle(open);
    launcher.setAttribute('aria-expanded', String(open));
    if (open) $('bot-tools-close').focus();
    else if (restore) launcher.focus();
  }
  launcher.addEventListener('click', () => setOpen(panel.hidden));
  $('bot-tools-close').addEventListener('click', () => setOpen(false));
  doc.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); setOpen(false); }
  });
  const refreshLabels = () => {
    $('preview-status').textContent = text(status);
    if($('scenario-hint'))$('scenario-hint').textContent=(scenarioCopy[language]||scenarioCopy.en).hint[['company','shop','community'].indexOf($('preview-site').value)]||'';
    if (frame) frame.title = `${text('previewFrameTitle')} · ${text(`preview.${$('preview-site').value}`)}`;
  };
  function disposeFrame() {
    try { onReset(); }
    finally {
      try { runtime?.dispose(); }
      finally { runtime = null; frame?.remove(); frame = null; }
    }
  }
  function load() {
    const generation = ++revision;
    disposeFrame();
    status = 'previewLoading';
    const selected = ['company', 'shop', 'community'].includes($('preview-site').value) ? $('preview-site').value : 'company';
    frame = doc.createElement('iframe');
    const next = frame;
    next.id = 'site-preview-frame';
    // Fixed authored same-origin demo; never user HTML or an external URL.
    next.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    next.setAttribute('referrerpolicy', 'no-referrer');
    const url = new URL('./api-demo.html', win.location.href);
    url.searchParams.set('site', selected); url.searchParams.set('lang', language);
    next.src = url.href;
    next.addEventListener('load', async () => {
      try {
        const loaded = await next.contentWindow.sidekickDemoReady;
        if (generation !== revision) { loaded?.dispose(); return; }
        if (!loaded?.bot || loaded.bot.ownerDocument !== next.contentDocument) throw new Error('Demo runtime unavailable');
        runtime = loaded;
        await onReady(loaded, generation);
        if (generation !== revision) return;
        status = 'previewReady'; refreshLabels();
      } catch (error) {
        if (generation !== revision) return;
        try { disposeFrame(); } catch (cleanupError) { console.warn('Demo cleanup failed', cleanupError); }
        status = 'previewFailed'; refreshLabels(); onError(error);
      }
    }, { once: true });
    $('preview-surface').append(next); refreshLabels();
  }
  $('preview-site').addEventListener('change', load);
  $('preview-refresh').addEventListener('click', load);
  win.addEventListener('pagehide', event => {
    if (event.persisted) return;
    ++revision; disposeFrame();
  });
  return {
    setOpen, start: load,
    refreshLabels() {
      const nextLanguage = locale();
      if (language !== nextLanguage) { language = nextLanguage; load(); }
      else refreshLabels();
    },
  };
}
