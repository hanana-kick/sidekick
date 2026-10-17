/** Design tokens for every `<skk-*>` element, exposed as CSS custom properties. */
export interface ThemeTokens {
  radius?: string;
  font?: string;
  focus?: string;
  muted?: string;
  success?: string;
  warning?: string;
  error?: string;
  bubbleBg?: string;
  bubbleFg?: string;
  bubbleBorder?: string;
  bubbleShadow?: string;
  durationPop?: string;
  zIndex?: string;
}

export const DEFAULT_TOKENS: Required<ThemeTokens> = {
  radius: '14px',
  font: '500 13px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  focus: '#4cc9f0',
  muted: '#6b7280',
  success: '#24c88a',
  warning: '#f7c948',
  error: '#ef5b5b',
  bubbleBg: '#ffffff',
  bubbleFg: '#16181d',
  bubbleBorder: 'rgba(15,23,42,.08)',
  bubbleShadow: '0 8px 24px rgba(15,23,42,.14)',
  durationPop: '180ms',
  zIndex: '9999',
};

const CSS_VAR_NAMES: Record<keyof ThemeTokens, string> = {
  radius: '--skk-radius',
  font: '--skk-font',
  focus: '--skk-focus',
  muted: '--skk-muted',
  success: '--skk-success',
  warning: '--skk-warning',
  error: '--skk-error',
  bubbleBg: '--skk-bubble-bg',
  bubbleFg: '--skk-bubble-fg',
  bubbleBorder: '--skk-bubble-border',
  bubbleShadow: '--skk-bubble-shadow',
  durationPop: '--skk-duration-pop',
  zIndex: '--skk-z-index',
};

/** Serialises tokens into a `:root { ... }` block. */
export function themeCSS(tokens: ThemeTokens = {}): string {
  const merged = { ...DEFAULT_TOKENS, ...tokens };
  const declarations = Object.entries(CSS_VAR_NAMES)
    .map(([key, cssVar]) => `  ${cssVar}: ${merged[key as keyof ThemeTokens]};`)
    .join('\n');
  return `:root {\n${declarations}\n}`;
}

/**
 * Injects the token block once per root. Returns the `<style>` element so the
 * caller can remove it later.
 */
export function applyTheme(
  root: Document | ShadowRoot = typeof document !== 'undefined' ? document : (null as unknown as Document),
  tokens: ThemeTokens = {},
): HTMLElement | null {
  if (!root) return null;
  const existing = root.querySelector?.('[data-skk-theme]') as HTMLStyleElement | null;
  const style = existing ?? document.createElement('style');
  style.setAttribute('data-skk-theme', '');
  style.textContent = themeCSS(tokens);
  if (!existing) {
    // A Document only accepts a single element child, so target <head> there.
    const host: Node = 'head' in root ? (root.head ?? root.documentElement) : root;
    host.appendChild(style);
  }
  return style;
}
