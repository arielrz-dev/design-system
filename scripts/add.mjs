#!/usr/bin/env node
/**
 * Instala uno o más componentes del registry en el proyecto actual (cwd).
 *
 * Uso:
 *   node scripts/add.mjs <component...> [--path <rel>] [--overwrite | -f] [--dry-run]
 *   node scripts/add.mjs --tokens            actualiza solo los estilos base y las fuentes
 *
 * Destinos (relativos al cwd, --path por defecto `src/ui`):
 *   <path>/<componente>/   archivos del componente
 *   <path>/styles/         variables.css + foundations (reduced-motion.css)
 *   <path>/fonts/          Inter; variables.css la carga desde ../fonts/
 * Sin --path, si el proyecto ya tiene dist/css/variables.css (instalaciones
 * ≤ 0.3), los estilos base siguen en dist/css y las fuentes en dist/fonts.
 *
 * Nunca reemplaza un archivo existente con contenido distinto, salvo con
 * --overwrite (todo) o --tokens (solo estilos base y fuentes).
 */

import { copyFile, mkdir, readFile, readdir, access, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Raíz del paquete rzz-ui (donde viven registry/ y dist/). */
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REGISTRY_DIR = path.join(PACKAGE_ROOT, 'registry');
const REGISTRY_JSON = path.join(REGISTRY_DIR, 'registry.json');
const VARIABLES_SOURCE = path.join(PACKAGE_ROOT, 'dist', 'css', 'variables.css');
const FONTS_SOURCE = path.join(PACKAGE_ROOT, 'dist', 'fonts');
const DEFAULT_PATH = 'src/ui';

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
  const out = {
    /** @type {string[]} */
    names: [],
    destRel: DEFAULT_PATH,
    pathGiven: false,
    overwrite: false,
    dryRun: false,
    tokens: false,
    help: false,
  };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      out.help = true;
    } else if (arg === '-f' || arg === '--overwrite') {
      out.overwrite = true;
    } else if (arg === '--dry-run') {
      out.dryRun = true;
    } else if (arg === '--tokens') {
      out.tokens = true;
    } else if (arg === '--path' || arg === '-p' || arg.startsWith('--path=')) {
      const value = arg.startsWith('--path=') ? arg.slice('--path='.length) : argv[i + 1];
      if (!value || value.startsWith('-')) {
        fail('Indicá un path relativo: --path src/ui');
      }
      out.destRel = value;
      out.pathGiven = true;
      if (!arg.startsWith('--path=')) i += 1;
    } else if (arg.startsWith('-')) {
      fail(`Flag desconocido: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  out.names = [...new Set(positional.map((arg) => arg.trim()).filter(Boolean))];
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

function registryItems(registry) {
  return Array.isArray(registry.items) ? registry.items : [];
}

function findItem(registry, name) {
  return registryItems(registry).find((item) => item.name === name);
}

function isFoundation(item) {
  return item?.meta?.foundation === true;
}

function listAvailable(registry) {
  const names = registryItems(registry)
    .filter((item) => !isFoundation(item))
    .map((item) => item.name);
  return names.length > 0 ? names.join(', ') : '(ninguno)';
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
 * Carpeta de estilos base y de fuentes. Sin --path se respeta una instalación
 * previa en dist/css para no duplicar variables.css.
 * @param {string} projectRoot
 * @param {string} destRoot
 * @param {boolean} pathGiven
 */
async function resolveBaseDirs(projectRoot, destRoot, pathGiven) {
  const legacyStyles = path.join(projectRoot, 'dist', 'css');
  const styles = path.join(destRoot, 'styles');
  const legacyInUse =
    !pathGiven &&
    !(await pathExists(path.join(styles, 'variables.css'))) &&
    (await pathExists(path.join(legacyStyles, 'variables.css')));

  if (legacyInUse) {
    return { stylesDir: legacyStyles, fontsDir: path.join(projectRoot, 'dist', 'fonts'), legacy: true };
  }
  return { stylesDir: styles, fontsDir: path.join(destRoot, 'fonts'), legacy: false };
}

/**
 * @typedef {{ group: string, source: string, dest: string, force: boolean, base: boolean }} CopyOp
 * @typedef {'create' | 'update' | 'unchanged' | 'skip'} OpStatus
 */

/**
 * @param {CopyOp} op
 * @returns {Promise<OpStatus>}
 */
async function classify(op) {
  if (!(await pathExists(op.dest))) return 'create';
  const [incoming, current] = await Promise.all([readFile(op.source), readFile(op.dest)]);
  if (incoming.equals(current)) return 'unchanged';
  return op.force ? 'update' : 'skip';
}

function printHelp() {
  log(`${BOLD}Uso:${RESET} rzz-ui add <component...> [opciones]`);
  log(`     rzz-ui add --tokens [opciones]`);
  log('');
  log(`  --path, -p <rel>   carpeta base en el proyecto (default: ${DEFAULT_PATH})`);
  log('  --overwrite, -f    reemplaza archivos existentes que difieran');
  log('  --tokens           actualiza solo variables.css, reduced-motion.css y fuentes');
  log('  --dry-run          muestra qué se crearía o reemplazaría, sin escribir nada');
  log('');
  log(`${DIM}Ejemplo:${RESET} rzz-ui add button`);
  log(`${DIM}        ${RESET} rzz-ui add button dialog --path components/ui --dry-run`);
  log('');
  log('Instala en el directorio actual (cwd). El registry sale del paquete rzz-ui.');
}

async function main() {
  const { names, destRel, pathGiven, overwrite, dryRun, tokens, help } = parseArgs(
    process.argv.slice(2),
  );

  if (help || (names.length === 0 && !tokens)) {
    printHelp();
    process.exit(help ? 0 : 1);
  }

  const projectRoot = process.cwd();
  const destRoot = path.resolve(projectRoot, destRel);
  const rel = (target) => (path.relative(projectRoot, target) || '.').split(path.sep).join('/');

  const registry = await loadRegistry();
  const seen = new Set();
  const installOrder = names.flatMap((name) => resolveInstallOrder(registry, name, seen));
  const { stylesDir, fontsDir, legacy } = await resolveBaseDirs(projectRoot, destRoot, pathGiven);
  const forceBase = overwrite || tokens;
  // Dentro del propio repo rzz-ui, dist/ ya es la fuente (y se publica): no copiar base ahí.
  const isPackageRepo = path.relative(projectRoot, PACKAGE_ROOT) === '';

  /** @type {CopyOp[]} */
  const ops = [];
  /** @type {Map<string, string[]>} */
  const npmDeps = new Map();

  for (const componentName of installOrder) {
    const item = findItem(registry, componentName);
    if (isFoundation(item)) continue;
    const group = names.includes(componentName)
      ? componentName
      : `${componentName} ${DIM}(dep)${RESET}`;
    for (const file of item.files ?? []) {
      ops.push({
        group,
        source: path.join(REGISTRY_DIR, file.path),
        dest: path.join(destRoot, componentName, file.target ?? path.basename(file.path)),
        force: overwrite,
        base: false,
      });
    }
    if (Array.isArray(item.dependencies) && item.dependencies.length > 0) {
      npmDeps.set(componentName, item.dependencies);
    }
  }

  const baseGroup = `estilos base ${DIM}(${rel(stylesDir)})${RESET}`;
  if (!isPackageRepo) {
    ops.push({
      group: baseGroup,
      source: VARIABLES_SOURCE,
      dest: path.join(stylesDir, 'variables.css'),
      force: forceBase,
      base: true,
    });
    for (const item of registryItems(registry).filter(isFoundation)) {
      for (const file of item.files ?? []) {
        ops.push({
          group: baseGroup,
          source: path.join(REGISTRY_DIR, file.path),
          dest: path.join(stylesDir, file.target ?? path.basename(file.path)),
          force: forceBase,
          base: true,
        });
      }
    }
  }
  if (!isPackageRepo && (await pathExists(FONTS_SOURCE))) {
    for (const file of await readdir(FONTS_SOURCE)) {
      ops.push({
        group: `fuentes ${DIM}(${rel(fontsDir)})${RESET}`,
        source: path.join(FONTS_SOURCE, file),
        dest: path.join(fontsDir, file),
        force: forceBase,
        base: true,
      });
    }
  }

  const missing = [];
  for (const op of ops) {
    if (!(await pathExists(op.source))) missing.push(path.relative(PACKAGE_ROOT, op.source));
  }
  if (missing.length > 0) {
    fail(
      `Faltan archivos en el paquete rzz-ui (no se escribió nada):\n  ${missing.join('\n  ')}\n  Si es un clon local, corré npm run build:tokens.`,
    );
  }

  const what = [names.join(', '), tokens ? 'tokens' : ''].filter(Boolean).join(' + ');
  log(`${BOLD}${dryRun ? 'Dry run' : 'Instalando'}${RESET} ${what} → ${rel(destRoot)}`);
  log(`${DIM}cwd${RESET} ${projectRoot}`);
  log(`${DIM}pkg${RESET} ${PACKAGE_ROOT}`);
  if (legacy && !isPackageRepo) {
    log(
      `${DIM}Estilos base en ${rel(stylesDir)} (instalación previa). Para moverlos a ${rel(path.join(destRoot, 'styles'))}, pasá --path explícito.${RESET}`,
    );
  }

  /** @type {Record<OpStatus, number>} */
  const counts = { create: 0, update: 0, unchanged: 0, skip: 0 };
  let baseSkipped = false;
  let currentGroup = '';

  for (const op of ops) {
    const status = await classify(op);
    counts[status] += 1;
    if (op.group !== currentGroup) {
      currentGroup = op.group;
      log(`${BOLD}${op.group}${RESET}`);
    }

    const shown = rel(op.dest);
    if (status === 'skip') {
      if (op.base) baseSkipped = true;
      log(
        `  ${YELLOW}⚠ El archivo ${shown} ya existe. Omitido. Usa el flag --overwrite para reemplazarlo.${RESET}`,
      );
      continue;
    }
    if (status === 'unchanged') {
      log(`  ${DIM}= ${shown} (sin cambios)${RESET}`);
      continue;
    }

    if (dryRun) {
      log(`  ${status === 'create' ? '+' : '~'} ${shown} ${DIM}(${status === 'create' ? 'se crearía' : 'se reemplazaría'})${RESET}`);
      continue;
    }
    await mkdir(path.dirname(op.dest), { recursive: true });
    await copyFile(op.source, op.dest);
    log(`  ${GREEN}✔${RESET} ${shown}${status === 'update' ? ` ${DIM}(reemplazado)${RESET}` : ''}`);
  }

  for (const [componentName, deps] of npmDeps) {
    log(
      `${YELLOW}npm deps de ${componentName}:${RESET} ${deps.join(', ')} (instalar manualmente si aplica)`,
    );
  }

  const summary = dryRun
    ? `${counts.create} se crearían, ${counts.update} se reemplazarían`
    : `${counts.create} creados, ${counts.update} reemplazados`;
  log('');
  log(
    `${GREEN}${BOLD}${dryRun ? 'Dry run: no se escribió nada.' : 'Listo.'}${RESET} ${summary}, ${counts.unchanged} sin cambios, ${counts.skip} omitidos.`,
  );
  if (baseSkipped) {
    log(`${DIM}--tokens actualiza solo variables.css, reduced-motion.css y las fuentes.${RESET}`);
  }
  if (!isPackageRepo) {
    log(
      `Orden de carga: ${rel(path.join(stylesDir, 'variables.css'))} → CSS de componentes → ${rel(path.join(stylesDir, 'reduced-motion.css'))}`,
    );
  }

  if (dryRun) return;

  // Hint file for consumers (optional, non-fatal)
  try {
    await writeFile(
      path.join(destRoot, '.rzz-ui'),
      JSON.stringify(
        {
          package: 'rzz-ui',
          installedAt: new Date().toISOString(),
          lastComponent: names[names.length - 1] ?? null,
          styles: rel(stylesDir),
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
