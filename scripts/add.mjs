#!/usr/bin/env node
/**
 * CLI local estilo shadcn: copia un componente del registry a src/components/ui/.
 *
 * Uso:
 *   node scripts/add.mjs <component-name>
 *   node scripts/add.mjs button
 *   node scripts/add.mjs card
 */

import { cp, mkdir, readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REGISTRY_DIR = path.join(ROOT, 'registry');
const REGISTRY_JSON = path.join(REGISTRY_DIR, 'registry.json');
const DEST_ROOT = path.join(ROOT, 'src', 'components', 'ui');

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';

function log(message) {
  console.log(message);
}

function fail(message, code = 1) {
  console.error(`${RED}✖${RESET} ${message}`);
  process.exit(code);
}

async function pathExists(target) {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function loadRegistry() {
  if (!(await pathExists(REGISTRY_JSON))) {
    fail(`No se encontró el registro en ${path.relative(ROOT, REGISTRY_JSON)}`);
  }

  try {
    const raw = await readFile(REGISTRY_JSON, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    fail(`No se pudo leer registry.json: ${error.message}`);
  }
}

function findItem(registry, name) {
  const items = Array.isArray(registry.items) ? registry.items : [];
  return items.find((item) => item.name === name);
}

function listAvailable(registry) {
  const items = Array.isArray(registry.items) ? registry.items : [];
  if (items.length === 0) return '(ninguno)';
  return items.map((item) => item.name).join(', ');
}

/**
 * Resuelve dependencias del registro en orden topológico simple (deps primero).
 * @param {object} registry
 * @param {string} name
 * @param {Set<string>} [seen]
 */
function resolveInstallOrder(registry, name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);

  const item = findItem(registry, name);
  if (!item) {
    fail(
      `Componente "${name}" no existe en el registro.\n  Disponibles: ${listAvailable(registry)}`,
    );
  }

  const deps = Array.isArray(item.registryDependencies)
    ? item.registryDependencies
    : [];

  const order = [];
  for (const dep of deps) {
    order.push(...resolveInstallOrder(registry, dep, seen));
  }
  order.push(name);
  return order;
}

async function copyComponent(name) {
  const sourceDir = path.join(REGISTRY_DIR, 'ui', name);
  const destDir = path.join(DEST_ROOT, name);

  if (!(await pathExists(sourceDir))) {
    fail(`No existe la carpeta fuente: ${path.relative(ROOT, sourceDir)}`);
  }

  await mkdir(destDir, { recursive: true });
  await cp(sourceDir, destDir, { recursive: true, force: true });

  return { sourceDir, destDir };
}

async function main() {
  const name = process.argv[2]?.trim();

  if (!name || name === '--help' || name === '-h') {
    log(`${BOLD}Uso:${RESET} node scripts/add.mjs <component-name>`);
    log(`${DIM}Ejemplo:${RESET} node scripts/add.mjs button`);
    if (!name) process.exit(1);
    process.exit(0);
  }

  const registry = await loadRegistry();
  const installOrder = resolveInstallOrder(registry, name);

  log(`${BOLD}Instalando${RESET} ${name} → ${path.relative(ROOT, DEST_ROOT)}`);

  for (const componentName of installOrder) {
    const item = findItem(registry, componentName);
    const isDep = componentName !== name;
    const { destDir } = await copyComponent(componentName);

    const label = isDep ? `${DIM}(dep)${RESET} ` : '';
    log(
      `${GREEN}✔${RESET} ${label}${BOLD}${componentName}${RESET} → ${path.relative(ROOT, destDir)}`,
    );

    if (item?.files?.length) {
      for (const file of item.files) {
        const targetName = file.target ?? path.basename(file.path);
        log(`  ${DIM}${targetName}${RESET}`);
      }
    }

    if (Array.isArray(item?.dependencies) && item.dependencies.length > 0) {
      log(
        `  ${YELLOW}npm deps:${RESET} ${item.dependencies.join(', ')} (instalar manualmente si aplica)`,
      );
    }
  }

  log(`${GREEN}${BOLD}Listo.${RESET} Incluye dist/css/variables.css en tu página.`);
}

main().catch((error) => {
  fail(error.stack ?? error.message);
});
