#!/usr/bin/env node
/**
 * Contraste WCAG 2.x AA de los pares críticos de tokens (light y dark) y de los
 * presets de src/styles/themes.css. Sin navegador: lee los JSON y el CSS.
 *
 *   texto ≥ 4.5:1 · bordes de control y foco (1.4.11) ≥ 3:1
 *
 * Los colores con alpha se componen sobre su fondo (y el fondo sobre canvas).
 * Sale con 1 si algún par no cumple.
 */
import { readFile } from 'node:fs/promises';
import { loadAndValidateTokens, parseColor, resolveColor } from './lib/tokens.mjs';

const THEMES_CSS = 'src/styles/themes.css';
const REQUIRED_PRESETS = ['emerald', 'amber', 'rose'];
const TEXT = 4.5;
const NON_TEXT = 3;

const COLOR = !process.env.NO_COLOR && (process.stdout.isTTY || Boolean(process.env.CI));
const ansi = (code) => (COLOR ? `\x1b[${code}m` : '');
const GREEN = ansi(32);
const RED = ansi(31);
const DIM = ansi(2);
const BOLD = ansi(1);
const RESET = ansi(0);

/** Luminancia relativa WCAG de un canal sRGB 0-255. */
function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance({ r, g, b }) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** (L1 + 0.05) / (L2 + 0.05), L1 la más clara. */
export function contrastRatio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Compone `top` (con alpha) sobre `bottom` opaco. */
function over(top, bottom) {
  const a = top.a ?? 1;
  const mix = (t, b) => Math.round(t * a + b * (1 - a));
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

const toHex = ({ r, g, b, a }) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}${a < 1 ? ` @${Math.round(a * 100)}%` : ''}`;

/**
 * Presets de themes.css → { color: { light: props, dark: props } }.
 * En dark aplica la cascada: el bloque light del preset también matchea.
 */
async function loadPresets() {
  const css = await readFile(THEMES_CSS, 'utf8');
  /** @type {Record<string, { light: Record<string, string>, dark: Record<string, string> }>} */
  const presets = {};
  const block = /(\[data-theme="dark"\])?\[data-theme-color="([\w-]+)"\]\s*\{([^}]*)\}/g;
  for (const [, dark, color, body] of css.matchAll(block)) {
    const props = Object.fromEntries(
      [...body.matchAll(/--rzz-([\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
    );
    presets[color] ??= { light: {}, dark: {} };
    Object.assign(presets[color][dark ? 'dark' : 'light'], props);
  }
  for (const preset of Object.values(presets)) preset.dark = { ...preset.light, ...preset.dark };
  return presets;
}

async function main() {
  const { light, dark, errors } = await loadAndValidateTokens();
  if (errors.length > 0) {
    console.error(`${RED}✖${RESET} Tokens inválidos (corré npm run build:tokens para el detalle):\n  - ${errors.join('\n  - ')}`);
    process.exit(1);
  }

  const themes = { light, dark };
  const results = [];

  /**
   * @param {string} group
   * @param {'light' | 'dark'} theme
   * @param {string} label
   * @param {{ r: number, g: number, b: number, a: number }} fg
   * @param {{ r: number, g: number, b: number, a: number }} bg
   * @param {number} min
   */
  const check = (group, theme, label, fg, bg, min) => {
    const canvas = resolveColor(themes[theme], 'surface.canvas');
    const solidBg = over(bg, canvas);
    const ratio = contrastRatio(over(fg, solidBg), solidBg);
    results.push({ group, theme, label, ratio, min, ok: ratio >= min, fg: toHex(fg), bg: toHex(bg) });
  };
  const tokenPair = (group, theme, fgPath, bgPath, min) =>
    check(group, theme, `${fgPath} / ${bgPath}`, resolveColor(themes[theme], fgPath), resolveColor(themes[theme], bgPath), min);

  for (const theme of /** @type {const} */ (['light', 'dark'])) {
    for (const surface of ['surface.canvas', 'surface.card']) {
      tokenPair('Texto vs superficie', theme, 'content.primary', surface, TEXT);
      tokenPair('Texto vs superficie', theme, 'content.secondary', surface, TEXT);
      tokenPair('Texto vs superficie', theme, 'content.muted', surface, TEXT);
    }

    tokenPair('Bordes (1.4.11)', theme, 'border.control', 'surface.card', NON_TEXT);
    tokenPair('Bordes (1.4.11)', theme, 'border.control', 'surface.canvas', NON_TEXT);
    tokenPair('Bordes (1.4.11)', theme, 'border.focus', 'surface.card', NON_TEXT);
    tokenPair('Bordes (1.4.11)', theme, 'border.focus', 'surface.canvas', NON_TEXT);

    for (const state of ['default', 'hover', 'active']) {
      tokenPair('Acciones (texto del botón)', theme, 'content.inverse', `action.danger-${state}`, TEXT);
      tokenPair('Acciones (texto del botón)', theme, 'action.primary-foreground', `action.primary-${state}`, TEXT);
    }

    for (const kind of ['info', 'success', 'warning', 'danger']) {
      tokenPair('Feedback', theme, `feedback.${kind}-foreground`, `feedback.${kind}-subtle`, TEXT);
    }
  }

  const presets = await loadPresets();
  const missing = REQUIRED_PRESETS.filter((name) => !presets[name]);
  if (missing.length > 0) {
    console.error(`${RED}✖${RESET} ${THEMES_CSS}: no se encontraron los presets ${missing.join(', ')}`);
    process.exit(1);
  }

  for (const [name, preset] of Object.entries(presets)) {
    for (const theme of /** @type {const} */ (['light', 'dark'])) {
      const props = preset[theme];
      const group = `Preset ${name}`;
      const fg = parseColor(props['action-primary-foreground'], `${name}/${theme} action-primary-foreground`);
      for (const state of ['default', 'hover', 'active']) {
        const key = `action-primary-${state}`;
        check(group, theme, `botón/badge foreground / ${key}`, fg, parseColor(props[key], `${name}/${theme} ${key}`), TEXT);
      }
      const focus = parseColor(props['border-focus'], `${name}/${theme} border-focus`);
      check(group, theme, 'border-focus / surface.card', focus, resolveColor(themes[theme], 'surface.card'), NON_TEXT);
      check(group, theme, 'border-focus / surface.canvas', focus, resolveColor(themes[theme], 'surface.canvas'), NON_TEXT);
    }
  }

  const failed = results.filter((r) => !r.ok);
  let group = '';
  for (const r of results) {
    if (r.group !== group) {
      group = r.group;
      console.log(`${BOLD}${group}${RESET}`);
    }
    const mark = r.ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    const detail = `${r.ratio.toFixed(2)}:1 (mín. ${r.min}:1)`;
    console.log(`  ${mark} ${r.theme.padEnd(5)} ${r.label.padEnd(52)} ${r.ok ? detail : `${RED}${detail}${RESET}`} ${DIM}${r.fg} sobre ${r.bg}${RESET}`);
  }

  console.log('');
  if (failed.length > 0) {
    console.error(`${RED}✖ ${failed.length} de ${results.length} pares no cumplen WCAG AA:${RESET}`);
    for (const r of failed) {
      console.error(`  - [${r.group} · ${r.theme}] ${r.label}: ${r.ratio.toFixed(2)}:1, se esperaba ≥ ${r.min}:1`);
    }
    process.exit(1);
  }
  console.log(`${GREEN}✔ ${results.length} pares cumplen WCAG AA${RESET} ${DIM}(${Object.keys(presets).length} presets, light y dark)${RESET}`);
}

main().catch((error) => {
  console.error(`${RED}✖${RESET} ${error.message}`);
  process.exit(1);
});
