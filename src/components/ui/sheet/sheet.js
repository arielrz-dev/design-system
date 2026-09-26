/**
 * Sheet / drawer — showModal nativo + triggers declarativos.
 *
 * Uso:
 *   import { openSheet, closeSheet, bindSheetTriggers } from './sheet.js';
 *   openSheet('filters-sheet');
 *   bindSheetTriggers();
 *
 * Markup:
 *   <button data-ds-sheet-open="filters-sheet">…</button>
 *   <dialog id="filters-sheet" class="ds-sheet">…</dialog>
 *   <button data-ds-sheet-close>…</button>
 */

/**
 * @param {string | HTMLDialogElement} target
 * @returns {HTMLDialogElement | null}
 */
function resolveSheet(target) {
  if (typeof target === 'string') {
    const el = document.getElementById(target);
    return el instanceof HTMLDialogElement ? el : null;
  }
  return target instanceof HTMLDialogElement ? target : null;
}

/**
 * @param {string | HTMLDialogElement} target
 * @returns {HTMLDialogElement | null}
 */
export function openSheet(target) {
  const sheet = resolveSheet(target);
  if (!sheet) {
    console.warn('[ds-sheet] No se encontró el sheet:', target);
    return null;
  }

  if (typeof sheet.showModal === 'function') {
    if (!sheet.open) sheet.showModal();
  } else {
    sheet.setAttribute('open', '');
  }

  return sheet;
}

/**
 * @param {string | HTMLDialogElement} target
 * @param {string} [returnValue]
 * @returns {HTMLDialogElement | null}
 */
export function closeSheet(target, returnValue) {
  const sheet = resolveSheet(target);
  if (!sheet) {
    console.warn('[ds-sheet] No se encontró el sheet:', target);
    return null;
  }

  if (typeof returnValue === 'string') {
    sheet.returnValue = returnValue;
  }

  if (typeof sheet.close === 'function') {
    sheet.close(returnValue);
  } else {
    sheet.removeAttribute('open');
  }

  return sheet;
}

/**
 * @param {ParentNode} [root=document]
 */
export function bindSheetTriggers(root = document) {
  root.addEventListener('click', (event) => {
    const openTrigger = event.target.closest?.('[data-ds-sheet-open]');
    if (openTrigger) {
      const id = openTrigger.getAttribute('data-ds-sheet-open');
      if (id) openSheet(id);
      return;
    }

    const closeTrigger = event.target.closest?.('[data-ds-sheet-close]');
    if (closeTrigger) {
      const sheet = closeTrigger.closest('dialog.ds-sheet');
      if (sheet) {
        closeSheet(sheet, closeTrigger.getAttribute('data-ds-sheet-close') || 'cancel');
      }
      return;
    }
  });

  root.addEventListener('click', (event) => {
    const sheet = event.target;
    if (!(sheet instanceof HTMLDialogElement) || !sheet.classList.contains('ds-sheet')) {
      return;
    }
    const rect = sheet.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) closeSheet(sheet, 'backdrop');
  });
}

if (typeof document !== 'undefined') {
  const boot = () => bindSheetTriggers();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

export default { openSheet, closeSheet, bindSheetTriggers };
