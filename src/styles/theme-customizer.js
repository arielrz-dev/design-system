/**
 * Theme Customizer — aplica data-theme-color / data-radius, persiste y copia CSS.
 *
 * Uso:
 *   import { initThemeCustomizer } from './theme-customizer.js';
 *   initThemeCustomizer({ toast });
 */

const COLOR_KEY = 'rzz-theme-color';
const RADIUS_KEY = 'rzz-theme-radius';

/** Valores equivalentes a variables.css sin overrides (lo que instala el CLI). */
const DEFAULT_COLOR = 'blue';
const DEFAULT_RADIUS = 'md';

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
  const next = pick(color, THEME_COLORS, DEFAULT_COLOR);
  document.documentElement.setAttribute('data-theme-color', next);
  localStorage.setItem(COLOR_KEY, next);
  syncSwatches(next);
  syncCustomIndicator();
  return next;
}

/**
 * @param {string} radius
 */
export function applyThemeRadius(radius) {
  let next = pick(radius, THEME_RADII, DEFAULT_RADIUS);
  // Migración: preferencias viejas con "full"
  if (radius === 'full') next = 'lg';
  document.documentElement.setAttribute('data-radius', next);
  localStorage.setItem(RADIUS_KEY, next);
  syncRadiusButtons(next);
  syncCustomIndicator();
  return next;
}

export function isCustomTheme() {
  const root = document.documentElement;
  return (
    pick(root.getAttribute('data-theme-color'), THEME_COLORS, DEFAULT_COLOR) !== DEFAULT_COLOR ||
    pick(root.getAttribute('data-radius'), THEME_RADII, DEFAULT_RADIUS) !== DEFAULT_RADIUS
  );
}

export function resetTheme() {
  applyThemeColor(DEFAULT_COLOR);
  applyThemeRadius(DEFAULT_RADIUS);
}

function syncCustomIndicator() {
  const custom = isCustomTheme();
  document
    .querySelectorAll('[data-theme-custom-indicator], [data-theme-custom-notice]')
    .forEach((el) => {
      if (el instanceof HTMLElement) el.hidden = !custom;
    });
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
 * Lee las custom properties declaradas en themes.css para un selector exacto,
 * así el snippet nunca diverge de los presets.
 * @param {string} selector
 * @returns {string[]}
 */
function readPresetDeclarations(selector) {
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule) || rule.selectorText !== selector) continue;
      return Array.from(rule.style)
        .filter((prop) => prop.startsWith('--rzz-'))
        .map((prop) => `  ${prop}: ${rule.style.getPropertyValue(prop).trim()};`);
    }
  }
  return [];
}

/**
 * @returns {string}
 */
export function buildThemeCssSnippet() {
  const color = pick(
    document.documentElement.getAttribute('data-theme-color'),
    THEME_COLORS,
    DEFAULT_COLOR,
  );
  const radius = pick(
    document.documentElement.getAttribute('data-radius'),
    THEME_RADII,
    DEFAULT_RADIUS,
  );
  const light = readPresetDeclarations(`[data-theme-color="${color}"]`);
  const dark = readPresetDeclarations(`[data-theme="dark"][data-theme-color="${color}"]`);
  const radii = readPresetDeclarations(`[data-radius="${radius}"]`);

  return [
    `/* rzz-ui theme — color: ${color}, radius: ${radius}. Pegar después de variables.css. */`,
    ':root {',
    ...light,
    ...radii,
    '}',
    '',
    '[data-theme="dark"] {',
    ...dark,
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
  const color = pick(localStorage.getItem(COLOR_KEY), THEME_COLORS, DEFAULT_COLOR);
  let radiusRaw = localStorage.getItem(RADIUS_KEY);
  if (radiusRaw === 'full') radiusRaw = 'lg';
  const radius = pick(radiusRaw, THEME_RADII, DEFAULT_RADIUS);
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
  syncCustomIndicator();

  root.querySelectorAll('[data-theme-reset]').forEach((btn) => {
    btn.addEventListener('click', resetTheme);
  });

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
  isCustomTheme,
  resetTheme,
  buildThemeCssSnippet,
  copyThemeCss,
  restoreThemePreferences,
  initThemeCustomizer,
};
