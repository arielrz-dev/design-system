#!/usr/bin/env node
/**
 * Falla si algún CSS del registry (o src/ui) consume --rzz-primitive-* / --ds-primitive-*.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = [
  path.join(ROOT, 'registry', 'ui'),
  path.join(ROOT, 'src', 'ui'),
];

const FORBIDDEN = /--(?:rzz|ds)-primitive-/;

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

async function main() {
  /** @type {string[]} */
  const offenders = [];

  for (const target of TARGETS) {
    const files = await walkCss(target);
    for (const file of files) {
      const text = await readFile(file, 'utf8');
      if (FORBIDDEN.test(text)) {
        offenders.push(path.relative(ROOT, file));
      }
    }
  }

  if (offenders.length > 0) {
    console.error('✖ Componentes con tokens primitive (prohibido):');
    for (const file of offenders) console.error(`  - ${file}`);
    process.exit(1);
  }

  console.log('✔ Sin --*-primitive-* en CSS de componentes');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
