#!/usr/bin/env node
/**
 * Integridad del registry:
 * - registry.json ↔ disco: carpetas, archivos declarados, huérfanos, targets.
 * - registryDependencies: existen, sin autodependencia ni ciclos.
 * - registry/ui ↔ src/ui: copia instalada idéntica (mismos archivos y contenido).
 * - index.html y docs/index.html: todo lo que cargan de registry/ existe.
 * Sale con 1 ante cualquier problema.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const REGISTRY_DIR = 'registry';
const REGISTRY_JSON = path.join(REGISTRY_DIR, 'registry.json');
const UI_DIR = path.join(REGISTRY_DIR, 'ui');
const MIRROR_DIR = path.join('src', 'ui');
const SHOWCASES = ['index.html', 'docs/index.html'];
const FILE_TYPES = new Set(['registry:style', 'registry:snippet', 'registry:script']);
const TEXT_EXT = new Set(['.css', '.js', '.mjs', '.html', '.json', '.md', '.txt']);

const COLOR = !process.env.NO_COLOR && (process.stdout.isTTY || Boolean(process.env.CI));
const ansi = (code) => (COLOR ? `\x1b[${code}m` : '');
const GREEN = ansi(32);
const RED = ansi(31);
const DIM = ansi(2);
const RESET = ansi(0);

const errors = [];
const toPosix = (p) => p.split(path.sep).join('/');

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full)));
    else out.push(full);
  }
  return out;
}

/** Texto con finales de línea normalizados (autocrlf no debe dar falsos positivos). */
async function content(file) {
  const buffer = await readFile(file);
  return TEXT_EXT.has(path.extname(file)) ? buffer.toString('utf8').replace(/\r\n/g, '\n') : buffer;
}

async function checkManifest(items) {
  const names = new Set();
  const declared = new Set();

  for (const item of items) {
    const label = `registry.json › ${item.name ?? '(sin name)'}`;
    if (!item.name || typeof item.name !== 'string') {
      errors.push(`${label}: falta "name"`);
      continue;
    }
    if (names.has(item.name)) errors.push(`${label}: nombre duplicado`);
    names.add(item.name);

    const foundation = item.meta?.foundation === true;
    if (!foundation && !(await exists(path.join(UI_DIR, item.name)))) {
      errors.push(`${label}: no existe la carpeta registry/ui/${item.name}/`);
    }
    if (!Array.isArray(item.files) || item.files.length === 0) {
      errors.push(`${label}: "files" vacío`);
      continue;
    }

    const targets = new Set();
    for (const file of item.files) {
      if (!FILE_TYPES.has(file.type)) errors.push(`${label}: ${file.path} tiene type "${file.type}" no válido`);
      if (!foundation && !file.path?.startsWith(`ui/${item.name}/`)) {
        errors.push(`${label}: ${file.path} está fuera de ui/${item.name}/`);
      }
      if (!(await exists(path.join(REGISTRY_DIR, file.path)))) {
        errors.push(`${label}: declara ${file.path} pero el archivo no existe`);
      }
      const target = file.target ?? path.basename(file.path);
      if (targets.has(target)) errors.push(`${label}: target "${target}" repetido`);
      targets.add(target);
      declared.add(path.posix.normalize(file.path));
    }
  }

  for (const item of items) {
    for (const dep of item.registryDependencies ?? []) {
      if (dep === item.name) errors.push(`registry.json › ${item.name}: se declara como su propia dependencia`);
      else if (!names.has(dep)) errors.push(`registry.json › ${item.name}: dependencia "${dep}" no existe en el manifiesto`);
    }
  }

  const byName = new Map(items.map((item) => [item.name, item]));
  const visit = (name, trail) => {
    if (trail.includes(name)) {
      errors.push(`registry.json: dependencia circular ${[...trail, name].join(' → ')}`);
      return;
    }
    for (const dep of byName.get(name)?.registryDependencies ?? []) {
      if (byName.has(dep) && dep !== name) visit(dep, [...trail, name]);
    }
  };
  for (const name of names) visit(name, []);

  for (const dir of await readdir(UI_DIR)) {
    if (!names.has(dir)) errors.push(`registry/ui/${dir}/: carpeta sin entrada en registry.json`);
  }
  for (const file of await listFiles(UI_DIR)) {
    const rel = toPosix(path.relative(REGISTRY_DIR, file));
    if (!declared.has(rel)) errors.push(`registry/${rel}: archivo no declarado en registry.json (el CLI no lo instalaría)`);
  }

  return { names, declared };
}

async function checkMirror() {
  const source = new Set((await listFiles(UI_DIR)).map((f) => toPosix(path.relative(UI_DIR, f))));
  const mirror = (await exists(MIRROR_DIR))
    ? new Set((await listFiles(MIRROR_DIR)).map((f) => toPosix(path.relative(MIRROR_DIR, f))))
    : new Set();

  let identical = 0;
  for (const rel of source) {
    if (!mirror.has(rel)) {
      errors.push(`src/ui/${rel}: falta (existe en registry/ui)`);
      continue;
    }
    const [a, b] = await Promise.all([content(path.join(UI_DIR, rel)), content(path.join(MIRROR_DIR, rel))]);
    const same = typeof a === 'string' ? a === b : a.equals(/** @type {Buffer} */ (b));
    if (same) identical += 1;
    else errors.push(`src/ui/${rel}: difiere de registry/ui/${rel}`);
  }
  for (const rel of mirror) {
    if (!source.has(rel)) errors.push(`src/ui/${rel}: sobra (no existe en registry/ui)`);
  }
  return identical;
}

async function checkShowcases() {
  let refs = 0;
  for (const page of SHOWCASES) {
    if (!(await exists(page))) continue;
    const html = await readFile(page, 'utf8');
    for (const [, url] of html.matchAll(/(?:href|src)="([^"#?]*registry\/[^"#?]+)"/g)) {
      refs += 1;
      const target = path.join(path.dirname(page), url);
      if (!(await exists(target))) errors.push(`${page}: carga ${url} pero no existe`);
    }
  }
  return refs;
}

async function main() {
  let registry;
  try {
    registry = JSON.parse(await readFile(REGISTRY_JSON, 'utf8'));
  } catch (error) {
    console.error(`${RED}✖${RESET} No se pudo leer ${REGISTRY_JSON}: ${error.message}`);
    process.exit(1);
  }
  const items = Array.isArray(registry.items) ? registry.items : [];
  if (items.length === 0) errors.push('registry.json: "items" vacío');

  const { names, declared } = await checkManifest(items);
  const identical = await checkMirror();
  const refs = await checkShowcases();

  if (errors.length > 0) {
    console.error(`${RED}✖ ${errors.length} problema(s) de integridad del registry:${RESET}`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`${GREEN}✔ Registry íntegro${RESET}`);
  console.log(`  ${names.size} items y ${declared.size} archivos declarados, todos en disco y sin huérfanos`);
  console.log(`  src/ui idéntico a registry/ui (${identical} archivos)`);
  console.log(`  ${refs} recursos de registry/ cargados por el playground y las docs ${DIM}(todos existen)${RESET}`);
}

main().catch((error) => {
  console.error(`${RED}✖${RESET} ${error.stack ?? error.message}`);
  process.exit(1);
});
