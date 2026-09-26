#!/usr/bin/env node
/**
 * Instala un componente del registry en el proyecto actual (cwd).
 *
 * Uso:
 *   node scripts/add.mjs <component-name>
 *   node scripts/add.mjs button
 *   node scripts/add.mjs button --path components/ui
 *
 * El registry se lee desde el paquete rzz-ui (carpeta del monorepo / install).
 * El destino por defecto es `<cwd>/src/ui`.
 */

import { cp, mkdir, readFile, access, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Raíz del paquete rzz-ui (donde viven registry/ y dist/). */
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REGISTRY_DIR = path.join(PACKAGE_ROOT, 'registry');
const REGISTRY_JSON = path.join(REGISTRY_DIR, 'registry.json');

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

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ name?: string, destRel: string, help: boolean }} */
  const out = { destRel: 'src/ui', help: false };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      out.help = true;
      continue;
    }
    if (arg === '--path' || arg === '-p') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        fail('Indicá un path relativo: --path src/ui');
      }
      out.destRel = value;
      i += 1;
      continue;
    }
    if (arg.startsWith('-')) {
      fail(`Flag desconocido: ${arg}`);
    }
    positional.push(arg);
  }

  out.name = positional[0]?.trim();
  return out;
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
    fail(`No se encontró el registro en ${REGISTRY_JSON}`);
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

/**
 * @param {string} name
 * @param {string} destRoot
 */
async function copyComponent(name, destRoot) {
  const sourceDir = path.join(REGISTRY_DIR, 'ui', name);
  const destDir = path.join(destRoot, name);

  if (!(await pathExists(sourceDir))) {
    fail(`No existe la carpeta fuente: ${sourceDir}`);
  }

  await mkdir(destDir, { recursive: true });
  await cp(sourceDir, destDir, { recursive: true, force: true });

  return { sourceDir, destDir };
}

/**
 * Copia variables.css al consumidor si aún no tiene dist/css/variables.css.
 * @param {string} projectRoot
 */
async function ensureVariablesCss(projectRoot) {
  const dest = path.join(projectRoot, 'dist', 'css', 'variables.css');
  const source = path.join(PACKAGE_ROOT, 'dist', 'css', 'variables.css');
  if (await pathExists(dest)) return { copied: false, dest };
  if (!(await pathExists(source))) {
    log(
      `${YELLOW}⚠${RESET} No hay ${path.relative(PACKAGE_ROOT, source)} en el paquete. Corré build:tokens en rzz-ui.`,
    );
    return { copied: false, dest };
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(source, dest, { force: true });
  return { copied: true, dest };
}

function printHelp() {
  log(`${BOLD}Uso:${RESET} rzz-ui add <component> [--path <rel>]`);
  log(`${DIM}Ejemplo:${RESET} rzz-ui add button`);
  log(`${DIM}        ${RESET} rzz-ui add dialog --path components/ui`);
  log('');
  log('Instala en el directorio actual (cwd). El registry sale del paquete rzz-ui.');
}

async function main() {
  const { name, destRel, help } = parseArgs(process.argv.slice(2));

  if (help || !name) {
    printHelp();
    process.exit(help ? 0 : 1);
  }

  const projectRoot = process.cwd();
  const destRoot = path.resolve(projectRoot, destRel);

  const registry = await loadRegistry();
  const installOrder = resolveInstallOrder(registry, name);

  const destLabel = path.relative(projectRoot, destRoot) || '.';
  log(`${BOLD}Instalando${RESET} ${name} → ${destLabel}`);
  log(`${DIM}cwd${RESET} ${projectRoot}`);
  log(`${DIM}pkg${RESET} ${PACKAGE_ROOT}`);

  for (const componentName of installOrder) {
    const item = findItem(registry, componentName);
    const isDep = componentName !== name;
    const { destDir } = await copyComponent(componentName, destRoot);

    const label = isDep ? `${DIM}(dep)${RESET} ` : '';
    const shown = path.relative(projectRoot, destDir) || destDir;
    log(`${GREEN}✔${RESET} ${label}${BOLD}${componentName}${RESET} → ${shown}`);

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

  const vars = await ensureVariablesCss(projectRoot);
  if (vars.copied) {
    log(
      `${GREEN}✔${RESET} ${BOLD}dist/css/variables.css${RESET} → ${path.relative(projectRoot, vars.dest)}`,
    );
  }

  log(
    `${GREEN}${BOLD}Listo.${RESET} Incluí dist/css/variables.css antes de los CSS del componente.`,
  );

  // Hint file for consumers (optional, non-fatal)
  const hintPath = path.join(destRoot, '.rzz-ui');
  try {
    await writeFile(
      hintPath,
      JSON.stringify(
        {
          package: 'rzz-ui',
          installedAt: new Date().toISOString(),
          lastComponent: name,
        },
        null,
        2,
      ),
      'utf8',
    );
  } catch {
    /* ignore */
  }
}

main().catch((error) => {
  fail(error.stack ?? error.message);
});
