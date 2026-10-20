/** Site-only preview shell. URLs are deliberately memory-only: no storage, history or telemetry. */
export function validatePreviewURL(value, protocol = 'https:') {
  let url;
  try { url = new URL(value.trim()); } catch { return { error: 'previewInvalidURL' }; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return { error: 'previewInvalidURL' };
  if (protocol === 'https:' && url.protocol !== 'https:') return { error: 'previewMixedContent' };
  return { url: url.href };
}

export function mountAPIPreview(doc, text, onChange = () => {}) {
  const win = doc.defaultView, $ = id => doc.getElementById(id);
  const panel = $('bot-tools'), launcher = $('bot-tools-launcher');
  let currentURL = null, statusKey = 'previewDemoStatus';
  // Leave the shared language/framework navigation reachable even when it wraps.
  const header = doc.querySelector('.app-header');
  const fitPanel = () => { panel.style.maxHeight = `${Math.max(40, win.innerHeight - (header?.getBoundingClientRect().height ?? 70) - 96)}px`; };
  fitPanel(); win.addEventListener('resize', fitPanel);
  const headerObserver = win.ResizeObserver ? new win.ResizeObserver(fitPanel) : null;
  if (header) headerObserver?.observe(header);
  win.addEventListener('pagehide', event => {
    if (event.persisted) return; // A bfcache restore keeps this document and its listeners alive.
    headerObserver?.disconnect(); win.removeEventListener('resize', fitPanel);
  });
  function setOpen(open, restore = true) {
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    if (open) $('bot-tools-close').focus();
    else if (restore) launcher.focus();
  }
  launcher.addEventListener('click', () => setOpen(panel.hidden));
  $('bot-tools-close').addEventListener('click', () => setOpen(false));
  doc.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); setOpen(false); }
  });
  const refreshLabels = () => { $('preview-status').textContent = text(statusKey); };
  function removeFrame() { $('site-preview-frame')?.remove(); }
  function renderFrame() {
    removeFrame();
    const frame = doc.createElement('iframe');
    frame.id = 'site-preview-frame';
    frame.title = text('previewFrameTitle');
    // Scripts are allowed to render modern sites, but the opaque origin prevents
    // same-origin sandbox escapes. Forms, popups, downloads and top navigation stay blocked.
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.setAttribute('allow', "camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; fullscreen 'none'; clipboard-read 'none'; clipboard-write 'none'; display-capture 'none'; usb 'none'");
    frame.src = currentURL;
    $('preview-surface').append(frame);
    // The browser fires load even for some blocked frames. Never infer success or failure.
    statusKey = 'previewRequested';
    refreshLabels();
  }
  $('preview-form').addEventListener('submit', event => {
    event.preventDefault();
    const result = validatePreviewURL($('preview-url').value, win.location.protocol);
    if (result.error) {
      statusKey = result.error; $('preview-url').setAttribute('aria-invalid', 'true'); refreshLabels(); return;
    }
    $('preview-url').removeAttribute('aria-invalid');
    currentURL = result.url;
    $('preview-demo').hidden = true;
    $('preview-refresh').disabled = false;
    $('preview-overlay-control').hidden = false;
    renderFrame(); onChange();
  });
  $('preview-refresh').addEventListener('click', () => { if (currentURL) renderFrame(); });
  function showDemo() {
    currentURL = null; removeFrame(); $('preview-demo').hidden = false;
    $('preview-refresh').disabled = true; $('preview-overlay-control').hidden = true;
    $('preview-capture').checked = false; $('preview-click-layer').hidden = true;
    $('preview-url').removeAttribute('aria-invalid');
    statusKey = 'previewDemoStatus'; refreshLabels(); onChange();
  }
  $('preview-demo-button').addEventListener('click', showDemo);
  $('preview-capture').addEventListener('change', () => { $('preview-click-layer').hidden = !$('preview-capture').checked; });
  refreshLabels();
  return { setOpen, showDemo, refreshLabels: () => { refreshLabels(); const frame = $('site-preview-frame'); if (frame) frame.title = text('previewFrameTitle'); } };
}
