#!/usr/bin/env node
/**
 * CLI público: npx rzz-ui add <component>
 * Delega en scripts/add.mjs
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
  npx rzz-ui add <component>

Ejemplos:
  npx rzz-ui add button
  npx rzz-ui add dialog
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

if (rest.length === 0) {
  console.error('Indicá un componente: npx rzz-ui add button');
  process.exit(1);
}

const child = spawn(process.execPath, [addScript, ...rest], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
