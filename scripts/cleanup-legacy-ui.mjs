#!/usr/bin/env node
/**
 * Intenta eliminar el árbol legacy src/components/ui (ACL zombie en Windows).
 * Si falla, reporta y sale 0 — no bloquea CI local.
 */
import { rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY = path.join(ROOT, 'src', 'components', 'ui');

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(LEGACY))) {
    console.log('✔ No hay src/components/ui legacy');
    return;
  }

  try {
    await rm(LEGACY, { recursive: true, force: true });
    console.log('✔ Eliminado src/components/ui');
    return;
  } catch (error) {
    console.warn(`⚠ No se pudo borrar vía Node: ${error.message}`);
  }

  // Intento WSL (a menudo puede borrar locks de Win32)
  try {
    const wslPath = LEGACY.replace(/^([A-Za-z]):\\/, (_, d) => `/mnt/${d.toLowerCase()}/`).replace(
      /\\/g,
      '/',
    );
    execFileSync('wsl', ['-e', 'rm', '-rf', wslPath], { stdio: 'inherit' });
    if (!(await exists(LEGACY))) {
      console.log('✔ Eliminado src/components/ui (vía WSL)');
      return;
    }
  } catch {
    /* no WSL or still locked */
  }

  console.warn(
    '⚠ src/components/ui sigue bloqueado (ACL/proceso). Reiniciá Windows o cerrá handles y corré: npm run cleanup:legacy-ui',
  );
  console.warn('  El destino activo de add es src/ui/.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
