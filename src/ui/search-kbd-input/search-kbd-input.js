/**
 * SearchKbdInput — focus global con Cmd/Ctrl+K y botón clear.
 *
 * Uso:
 *   import { bindSearchKbdInputs } from './search-kbd-input.js';
 *   bindSearchKbdInputs();
 */

const ROOT_SEL = '.ds-search-kbd';
const INPUT_SEL = '.ds-search-kbd__input';
const CLEAR_SEL = '.ds-search-kbd__clear';

/**
 * @param {HTMLElement} root
 */
function syncHasValue(root) {
  const input = root.querySelector(INPUT_SEL);
  if (!(input instanceof HTMLInputElement)) return;
  root.classList.toggle('ds-search-kbd--has-value', input.value.length > 0);
}

/**
 * @param {ParentNode} [root=document]
 */
export function bindSearchKbdInputs(root = document) {
  const nodes = root.querySelectorAll(ROOT_SEL);
  nodes.forEach((el) => {
    if (!(el instanceof HTMLElement) || el.dataset.dsSearchKbdBound === 'true') return;
    el.dataset.dsSearchKbdBound = 'true';

    const input = el.querySelector(INPUT_SEL);
    const clear = el.querySelector(CLEAR_SEL);
    if (!(input instanceof HTMLInputElement)) return;

    syncHasValue(el);
    input.addEventListener('input', () => syncHasValue(el));
    input.addEventListener('change', () => syncHasValue(el));

    if (clear instanceof HTMLButtonElement) {
      clear.addEventListener('click', () => {
        input.value = '';
        syncHasValue(el);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      });
    }
  });
}

/**
 * Listener global Cmd/Ctrl+K → focus en el primer [data-ds-search-kbd] o .ds-search-kbd__input.
 * @param {ParentNode} [root=document]
 */
export function bindSearchKbdHotkey(root = document) {
  if (typeof document === 'undefined') return;
  if (document.documentElement.dataset.dsSearchKbdHotkey === 'true') return;
  document.documentElement.dataset.dsSearchKbdHotkey = 'true';

  document.addEventListener('keydown', (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
    if (event.altKey || event.shiftKey) return;

    const target =
      root.querySelector('[data-ds-search-kbd] .ds-search-kbd__input') ||
      root.querySelector('.ds-search-kbd__input');

    if (!(target instanceof HTMLInputElement)) return;

    event.preventDefault();
    target.focus();
    target.select();
  });
}

/**
 * Ajusta el badge ⌘K / Ctrl+K según plataforma.
 * @param {ParentNode} [root=document]
 */
export function syncSearchKbdLabels(root = document) {
  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
  root.querySelectorAll('.ds-search-kbd__shortcut').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.innerHTML = isMac ? '<kbd>⌘</kbd><kbd>K</kbd>' : '<kbd>Ctrl</kbd><kbd>K</kbd>';
  });
}

export function initSearchKbd(root = document) {
  bindSearchKbdInputs(root);
  bindSearchKbdHotkey(root);
  syncSearchKbdLabels(root);
}

if (typeof document !== 'undefined') {
  const boot = () => initSearchKbd();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

export default { bindSearchKbdInputs, bindSearchKbdHotkey, initSearchKbd };
