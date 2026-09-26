/**
 * Button — bloquea la activación de `.ds-button[aria-disabled="true"]`.
 * `aria-disabled` mantiene el foco y el tooltip, pero no cancela click ni teclado.
 *
 * Uso:
 *   import { bindDisabledButtons } from './button.js';
 *   bindDisabledButtons();
 */

const DISABLED_SELECTOR = '.ds-button[aria-disabled="true"]';
const BOUND_KEY = Symbol.for('rzz-ui.button.disabled-guard');

/**
 * @param {Event} event
 * @returns {Element | null}
 */
function getDisabledButton(event) {
  const target = event.target;
  return target instanceof Element ? target.closest(DISABLED_SELECTOR) : null;
}

/**
 * @param {Event} event
 */
function block(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

/**
 * @param {MouseEvent} event
 */
function onClick(event) {
  if (getDisabledButton(event)) block(event);
}

/**
 * @param {KeyboardEvent} event
 */
function onKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (getDisabledButton(event)) block(event);
}

/**
 * @param {Document} [doc=document]
 */
export function bindDisabledButtons(doc = document) {
  if (doc[BOUND_KEY]) return;
  doc[BOUND_KEY] = true;
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('auxclick', onClick, true);
  doc.addEventListener('keydown', onKeydown, true);
}

if (typeof document !== 'undefined') {
  bindDisabledButtons();
}

export default { bindDisabledButtons };
