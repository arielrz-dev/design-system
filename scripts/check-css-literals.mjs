#!/usr/bin/env node
/**
 * Falla si algún CSS del registry (o src/ui) usa valores que ya tienen token:
 * - duraciones en ms o curvas cubic-bezier() → --rzz-duration-* / --rzz-ease-*
 * - transition: all → listar las propiedades que cambian
 * - opacity numérica en reglas de disabled → --rzz-opacity-disabled
 * Los ciclos de animaciones en loop (spinner, shimmer) usan segundos y quedan fuera.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = [
  path.join(ROOT, 'registry', 'ui'),
  path.join(ROOT, 'src', 'ui'),
];

const CHECKS = [
  { pattern: /\b\d+(?:\.\d+)?ms\b/, message: 'duración en ms (usar --rzz-duration-*)' },
  { pattern: /cubic-bezier\(/, message: 'cubic-bezier() literal (usar --rzz-ease-*)' },
  { pattern: /transition(?:-property)?\s*:\s*all\b/, message: 'transition: all (listar propiedades)' },
];

const DISABLED_SELECTOR = /disabled/;
const LITERAL_OPACITY = /(?:^|[;{\s])opacity\s*:\s*(0?\.\d+|0)\s*[;}]/;

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function walkCss(dir) {
  /** @type {string[]} */
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walkCss(full)));
    else if (entry.name.endsWith('.css')) out.push(full);
  }
  return out;
}

/** @param {string} css */
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));

/**
 * @param {string} css
 * @param {number} index
 */
const lineAt = (css, index) => css.slice(0, index).split('\n').length;

async function main() {
  /** @type {string[]} */
  const offenders = [];

  for (const target of TARGETS) {
    for (const file of await walkCss(target)) {
      const rel = path.relative(ROOT, file).split(path.sep).join('/');
      const css = stripComments(await readFile(file, 'utf8'));

      css.split('\n').forEach((line, i) => {
        for (const { pattern, message } of CHECKS) {
          if (pattern.test(line)) offenders.push(`${rel}:${i + 1} ${message}`);
        }
      });

      // Reglas más internas (sin llaves anidadas): selector { declaraciones }
      for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const [, selector, body] = match;
        if (DISABLED_SELECTOR.test(selector) && LITERAL_OPACITY.test(`;${body};`)) {
          const start = match.index + (selector.length - selector.trimStart().length);
          offenders.push(`${rel}:${lineAt(css, start)} opacity literal en disabled (usar --rzz-opacity-disabled)`);
        }
      }
    }
  }

  if (offenders.length > 0) {
    console.error(`✖ ${offenders.length} valor(es) literal(es) con token disponible:`);
    for (const line of offenders) console.error(`  - ${line}`);
    process.exit(1);
  }

  console.log('✔ Motion y disabled de componentes vía tokens');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
