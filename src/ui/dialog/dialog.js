/**
 * Helper agnóstico para `<dialog class="ds-dialog">`.
 * Usa la API nativa `showModal()` / `close()` (foco, Escape, inert backdrop).
 *
 * Uso:
 *   import { openDialog, closeDialog, bindDialogTriggers } from './dialog.js';
 *   openDialog('confirm-delete');
 *   bindDialogTriggers(); // cablea [data-ds-dialog-open] / [data-ds-dialog-close]
 */

/**
 * @param {string | HTMLDialogElement} target
 * @returns {HTMLDialogElement | null}
 */
function resolveDialog(target) {
  if (typeof target === 'string') {
    const el = document.getElementById(target);
    return el instanceof HTMLDialogElement ? el : null;
  }
  return target instanceof HTMLDialogElement ? target : null;
}

/**
 * Abre un diálogo en modo modal (atrapa foco + backdrop).
 * @param {string | HTMLDialogElement} target
 * @returns {HTMLDialogElement | null}
 */
export function openDialog(target) {
  const dialog = resolveDialog(target);
  if (!dialog) {
    console.warn('[ds-dialog] No se encontró el diálogo:', target);
    return null;
  }

  if (typeof dialog.showModal === 'function') {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }

  return dialog;
}

/**
 * Cierra un diálogo abierto.
 * @param {string | HTMLDialogElement} target
 * @param {string} [returnValue]
 * @returns {HTMLDialogElement | null}
 */
export function closeDialog(target, returnValue) {
  const dialog = resolveDialog(target);
  if (!dialog) {
    console.warn('[ds-dialog] No se encontró el diálogo:', target);
    return null;
  }

  if (typeof returnValue === 'string') {
    dialog.returnValue = returnValue;
  }

  if (typeof dialog.close === 'function') {
    dialog.close(returnValue);
  } else {
    dialog.removeAttribute('open');
  }

  return dialog;
}

/**
 * Cablea triggers declarativos en el documento:
 * - `[data-ds-dialog-open="<id>"]` → openDialog(id)
 * - `[data-ds-dialog-close]` dentro de un dialog → closeDialog(dialog)
 * - click en backdrop → close (comportamiento nativo no cierra; lo añadimos)
 * @param {ParentNode} [root=document]
 */
export function bindDialogTriggers(root = document) {
  root.addEventListener('click', (event) => {
    const openTrigger = event.target.closest?.('[data-ds-dialog-open]');
    if (openTrigger) {
      const id = openTrigger.getAttribute('data-ds-dialog-open');
      if (id) openDialog(id);
      return;
    }

    const closeTrigger = event.target.closest?.('[data-ds-dialog-close]');
    if (closeTrigger) {
      const dialog = closeTrigger.closest('dialog.ds-dialog');
      if (dialog) closeDialog(dialog, closeTrigger.getAttribute('data-ds-dialog-close') || 'cancel');
      return;
    }

    const confirmTrigger = event.target.closest?.('[data-ds-dialog-confirm]');
    if (confirmTrigger) {
      const dialog = confirmTrigger.closest('dialog.ds-dialog');
      if (dialog) closeDialog(dialog, 'confirm');
    }
  });

  root.addEventListener('click', (event) => {
    const dialog = event.target;
    if (!(dialog instanceof HTMLDialogElement) || !dialog.classList.contains('ds-dialog')) {
      return;
    }
    // Clic en el backdrop: el target es el propio <dialog>
    const rect = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) closeDialog(dialog, 'backdrop');
  });
}

// Auto-bind si se carga como script de página (type=module).
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bindDialogTriggers());
  } else {
    bindDialogTriggers();
  }
}

export default { openDialog, closeDialog, bindDialogTriggers };
