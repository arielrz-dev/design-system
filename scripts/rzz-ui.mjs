#!/usr/bin/env node
/**
 * CLI: rzz-ui add <component...> [--path <rel>] [--overwrite] [--dry-run] | add --tokens
 * Delega en add.mjs preservando process.cwd() del consumidor.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const addScript = path.join(__dirname, 'add.mjs');

const args = process.argv.slice(2);
const [command, ...rest] = args;

function printHelp() {
  console.log(`rzz-ui — CLI

Uso:
  rzz-ui add <component...> [--path <rel>] [--overwrite | -f] [--dry-run]
  rzz-ui add --tokens [--path <rel>] [--dry-run]

Ejemplos (desde el proyecto consumidor):
  npx github:arielrz-dev/design-system add button
  npx github:arielrz-dev/design-system add button dialog --path components/ui
  npx github:arielrz-dev/design-system add button --dry-run
  npx github:arielrz-dev/design-system add --tokens

El registro se lee del paquete rzz-ui; los archivos se copian al cwd.
Los archivos existentes que difieran no se reemplazan sin --overwrite
(o --tokens para variables.css, reduced-motion.css y fuentes).
`);
}

if (!command || command === '-h' || command === '--help') {
  printHelp();
  process.exit(command ? 0 : 1);
}

if (command !== 'add') {
  console.error(`Comando desconocido: ${command}`);
  printHelp();
  process.exit(1);
}

const child = spawn(process.execPath, [addScript, ...rest], {
  stdio: 'inherit',
  // Importante: cwd del consumidor, no la raíz del paquete
  cwd: process.cwd(),
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
