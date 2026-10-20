/** Test-only, serializable into Window or a dedicated worker before rendering.
 * Deny context creation, not renderer selection or diagnostics: production code
 * must still discover the missing capability and build its real Canvas backend.
 */
export function installNoWebGL() {
  const audit = globalThis.__sidekickNoWebGL = { denied: 0 };
  for (const name of ['HTMLCanvasElement', 'OffscreenCanvas']) {
    const prototype = globalThis[name]?.prototype;
    if (!prototype?.getContext) continue;
    const original = prototype.getContext;
    prototype.getContext = function (kind, ...args) {
      if (kind === 'webgl2' || kind === 'webgl' || kind === 'experimental-webgl') { audit.denied++; return null; }
      return original.call(this, kind, ...args);
    };
  }
}
