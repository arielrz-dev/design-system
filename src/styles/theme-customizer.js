/**
 * Theme Customizer — aplica data-theme-color / data-radius, persiste y copia CSS.
 *
 * Uso:
 *   import { initThemeCustomizer } from './theme-customizer.js';
 *   initThemeCustomizer({ toast });
 */

const COLOR_KEY = 'rzz-theme-color';
const RADIUS_KEY = 'rzz-theme-radius';

/** @type {readonly string[]} */
export const THEME_COLORS = Object.freeze([
  'blue',
  'violet',
  'emerald',
  'rose',
  'amber',
  'zinc',
]);

/** @type {readonly string[]} */
export const THEME_RADII = Object.freeze(['none', 'sm', 'md', 'lg']);

/**
 * Valores canónicos light (para "Copiar Variables CSS").
 * @type {Record<string, { primary: string, inverse: string, focus: string, hover: string, active: string }>}
 */
const COLOR_CSS = {
  blue: {
    primary: '#2563eb',
    hover: '#1d4ed8',
    active: '#1e40af',
    inverse: '#ffffff',
    focus: '#3b82f6',
  },
  violet: {
    primary: '#7c3aed',
    hover: '#6d28d9',
    active: '#5b21b6',
    inverse: '#ffffff',
    focus: '#7c3aed',
  },
  emerald: {
    primary: '#10b981',
    hover: '#059669',
    active: '#047857',
    inverse: '#ffffff',
    focus: '#10b981',
  },
  rose: {
    primary: '#f43f5e',
    hover: '#e11d48',
    active: '#be123c',
    inverse: '#ffffff',
    focus: '#f43f5e',
  },
  amber: {
    primary: '#f59e0b',
    hover: '#d97706',
    active: '#b45309',
    inverse: '#0f172a',
    focus: '#f59e0b',
  },
  zinc: {
    primary: '#18181b',
    hover: '#27272a',
    active: '#3f3f46',
    inverse: '#fafafa',
    focus: '#18181b',
  },
};

/**
 * @type {Record<string, { sm: string, md: string, lg: string }>}
 */
const RADIUS_CSS = {
  none: { sm: '0px', md: '0px', lg: '0px' },
  sm: { sm: '2px', md: '4px', lg: '6px' },
  md: { sm: '4px', md: '8px', lg: '12px' },
  lg: { sm: '6px', md: '12px', lg: '16px' },
};

/**
 * @param {string | null | undefined} value
 * @param {readonly string[]} allowed
 * @param {string} fallback
 */
function pick(value, allowed, fallback) {
  return value && allowed.includes(value) ? value : fallback;
}

/**
 * @param {string} color
 */
export function applyThemeColor(color) {
  const next = pick(color, THEME_COLORS, 'blue');
  document.documentElement.setAttribute('data-theme-color', next);
  localStorage.setItem(COLOR_KEY, next);
  syncSwatches(next);
  return next;
}

/**
 * @param {string} radius
 */
export function applyThemeRadius(radius) {
  let next = pick(radius, THEME_RADII, 'md');
  // Migración: preferencias viejas con "full"
  if (radius === 'full') next = 'lg';
  document.documentElement.setAttribute('data-radius', next);
  localStorage.setItem(RADIUS_KEY, next);
  syncRadiusButtons(next);
  return next;
}

/**
 * @param {string} color
 */
function syncSwatches(color) {
  document.querySelectorAll('[data-theme-swatch]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const selected = btn.getAttribute('data-theme-swatch') === color;
    btn.setAttribute('aria-checked', String(selected));
  });
}

/**
 * @param {string} radius
 */
function syncRadiusButtons(radius) {
  document.querySelectorAll('[data-theme-radius]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const selected = btn.getAttribute('data-theme-radius') === radius;
    btn.setAttribute('aria-checked', String(selected));
  });
}

/**
 * @returns {string}
 */
export function buildThemeCssSnippet() {
  const color = pick(
    document.documentElement.getAttribute('data-theme-color'),
    THEME_COLORS,
    'blue',
  );
  const radius = pick(
    document.documentElement.getAttribute('data-radius'),
    THEME_RADII,
    'md',
  );
  const c = COLOR_CSS[color];
  const r = RADIUS_CSS[radius];

  return [
    `/* rzz-ui theme — color: ${color}, radius: ${radius} */`,
    ':root {',
    `  --rzz-action-primary-default: ${c.primary};`,
    `  --rzz-action-primary-hover: ${c.hover};`,
    `  --rzz-action-primary-active: ${c.active};`,
    `  --rzz-content-inverse: ${c.inverse};`,
    `  --rzz-border-focus: ${c.focus};`,
    `  --rzz-radius-sm: ${r.sm};`,
    `  --rzz-radius-md: ${r.md};`,
    `  --rzz-radius-lg: ${r.lg};`,
    '}',
    '',
  ].join('\n');
}

/**
 * @param {{ toast?: { show: (opts: object) => void } }} [options]
 */
export async function copyThemeCss(options = {}) {
  const css = buildThemeCssSnippet();
  try {
    await navigator.clipboard.writeText(css);
    options.toast?.show?.({
      title: 'Tema copiado al portapapeles',
      description: 'Variables CSS listas para pegar.',
      variant: 'success',
    });
    return true;
  } catch {
    options.toast?.show?.({
      title: 'No se pudo copiar',
      description: 'El portapapeles no está disponible en este contexto.',
      variant: 'danger',
    });
    return false;
  }
}

/**
 * Restaura preferencias guardadas (llamar antes del primer paint si es posible).
 */
export function restoreThemePreferences() {
  const color = pick(localStorage.getItem(COLOR_KEY), THEME_COLORS, 'blue');
  let radiusRaw = localStorage.getItem(RADIUS_KEY);
  if (radiusRaw === 'full') radiusRaw = 'lg';
  const radius = pick(radiusRaw, THEME_RADII, 'md');
  document.documentElement.setAttribute('data-theme-color', color);
  document.documentElement.setAttribute('data-radius', radius);
  localStorage.setItem(RADIUS_KEY, radius);
  return { color, radius };
}

/**
 * @param {{ toast?: { show: (opts: object) => void }, root?: ParentNode }} [options]
 */
export function initThemeCustomizer(options = {}) {
  const root = options.root ?? document;
  const { color, radius } = restoreThemePreferences();
  syncSwatches(color);
  syncRadiusButtons(radius);

  root.querySelectorAll('[data-theme-swatch]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.getAttribute('data-theme-swatch');
      if (value) applyThemeColor(value);
    });
  });

  root.querySelectorAll('[data-theme-radius]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.getAttribute('data-theme-radius');
      if (value) applyThemeRadius(value);
    });
  });

  root.querySelectorAll('[data-theme-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      void copyThemeCss({ toast: options.toast });
    });
  });

  return { color, radius };
}

export default {
  THEME_COLORS,
  THEME_RADII,
  applyThemeColor,
  applyThemeRadius,
  buildThemeCssSnippet,
  copyThemeCss,
  restoreThemePreferences,
  initThemeCustomizer,
};
