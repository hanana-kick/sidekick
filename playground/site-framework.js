/** Documentation preference only; never changes avatar settings or application state. */
export const FRAMEWORK_STORAGE_KEY = 'sidekick.site.framework';
export const normalizeFramework = value => ['element', 'react'].includes(value) ? value : null;
const listeners = new Set();
function initialFramework() {
 if (typeof window === 'undefined') return 'element';
 let stored; try { stored = window.localStorage.getItem(FRAMEWORK_STORAGE_KEY); } catch {}
 const query = new URL(window.location.href).searchParams.get('framework');
 const value = normalizeFramework(query) ?? (query === null ? normalizeFramework(stored) : null) ?? 'element';
 if (normalizeFramework(query)) try { window.localStorage.setItem(FRAMEWORK_STORAGE_KEY, value); } catch {}
 return value;
}
let framework = initialFramework();
export const getFramework = () => framework;
export function subscribeFramework(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function setFramework(value) {
 if (!normalizeFramework(value)) throw new RangeError('Unsupported documentation framework');
 const changed = value !== framework; framework = value;
 if (typeof window !== 'undefined') {
  try { window.localStorage.setItem(FRAMEWORK_STORAGE_KEY, value); } catch {}
  const url = new URL(window.location.href); url.searchParams.set('framework', value);
  try { window.history.replaceState(window.history.state, '', url); } catch {}
 }
 if (changed) for (const listener of [...listeners]) listener();
}
export function frameworkHref(path, value = framework) {
 const [beforeHash, hash] = path.split('#', 2), [pathname, search = ''] = beforeHash.split('?', 2);
 const query = new URLSearchParams(search); query.set('framework', normalizeFramework(value) ?? 'element');
 return `${pathname}?${query}${hash === undefined ? '' : '#' + hash}`;
}
if (typeof window !== 'undefined') {
 window.addEventListener('storage', event => { if (event.key === FRAMEWORK_STORAGE_KEY && normalizeFramework(event.newValue)) setFramework(event.newValue); });
 window.addEventListener('popstate', () => { const next = normalizeFramework(new URL(window.location.href).searchParams.get('framework')); if (next) setFramework(next); });
}
