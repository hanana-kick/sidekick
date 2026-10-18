/** One brand and navigation for both the React Studio and plain-JS API page. */
export function mountSiteHeader(host, activePage, base = './') {
  const doc = host.ownerDocument;
  const brand = doc.createElement('a');
  brand.className = 'brand'; brand.href = base;
  brand.setAttribute('aria-label', 'Sidekick Studio 홈');
  const avatar = doc.createElement('sidekick-avatar');
  for (const [name, value] of Object.entries({
    class: 'brand-avatar', shape: 'ghostish', 'body-color': '#FFCC37',
    'head-accessory': 'beret', 'eyes-accessory': 'glasses', 'neck-accessory': 'bowTie',
    expression: 'smile', 'zoom': '2', paused: '', interaction: 'none', 'tracking-mode': 'off',
    'aria-hidden': 'true', tabindex: '-1',
  })) avatar.setAttribute(name, value);
  // Keep renderer failure text from overflowing the compact logo slot.
  avatar.addEventListener('sidekick-error', event => { if (!event.detail?.recoverable) avatar.style.visibility = 'hidden'; });
  avatar.addEventListener('sidekick-ready', () => { avatar.style.visibility = ''; });
  const name = doc.createElement('span'); name.textContent = 'sidekick';
  brand.append(avatar, name);
  const nav = doc.createElement('nav'); nav.className = 'product-nav';
  nav.setAttribute('aria-label', 'Sidekick 페이지');
  for (const [page, label, path] of [['studio', 'Studio', ''], ['api', 'API playground', 'api-playground.html'], ['usecases', 'Use cases', 'use-cases.html']]) {
    const link = doc.createElement('a'); link.href = `${base}${path}`; link.textContent = label;
    if (page === activePage) link.setAttribute('aria-current', 'page');
    if (page === 'api') link.id = 'api-playground-link';
    nav.append(link);
  }
  host.replaceChildren(brand, nav);
  return () => host.replaceChildren();
}
