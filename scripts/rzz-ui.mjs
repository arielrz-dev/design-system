#!/usr/bin/env node
/**
 * CLI: rzz-ui add <component> [--path <rel>]
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
  rzz-ui add <component> [--path <rel>]

Ejemplos (desde el proyecto consumidor):
  rzz-ui add button
  rzz-ui add dialog --path components/ui

El registro se lee del paquete rzz-ui; los archivos se copian al cwd.
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

if (rest.length === 0 || rest[0]?.startsWith('-')) {
  console.error('Indicá un componente: rzz-ui add button');
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
