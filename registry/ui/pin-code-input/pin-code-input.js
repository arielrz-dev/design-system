/**
 * PinCodeInput — celdas OTP con avance, backspace y paste masivo.
 */

/**
 * @param {HTMLElement} root
 * @returns {HTMLInputElement[]}
 */
function getCells(root) {
  return Array.from(root.querySelectorAll('.ds-pin__cell')).filter(
    (el) => el instanceof HTMLInputElement
  );
}

/**
 * @param {HTMLInputElement[]} cells
 * @returns {string}
 */
function readValue(cells) {
  return cells.map((c) => c.value).join('');
}

/**
 * @param {HTMLElement} root
 * @param {HTMLInputElement[]} cells
 */
function emitComplete(root, cells) {
  const value = readValue(cells);
  root.dispatchEvent(
    new CustomEvent('ds-pin:change', { bubbles: true, detail: { value, complete: value.length === cells.length } })
  );
}

/**
 * @param {ParentNode} [root=document]
 */
export function bindPinCodeInputs(root = document) {
  root.querySelectorAll('.ds-pin').forEach((el) => {
    if (!(el instanceof HTMLElement) || el.dataset.dsPinBound === 'true') return;
    el.dataset.dsPinBound = 'true';

    const cells = getCells(el);
    if (cells.length === 0) return;

    /**
     * @param {string} digits
     * @param {number} start
     */
    const fill = (digits, start) => {
      const chars = digits.slice(0, cells.length - start).split('');
      chars.forEach((d, i) => {
        cells[start + i].value = d;
      });
      const next = Math.min(start + chars.length, cells.length - 1);
      cells[next].focus();
      cells[next].select();
      emitComplete(el, cells);
    };

    cells.forEach((cell, index) => {
      cell.addEventListener('input', (event) => {
        // SMS autofill (one-time-code) y teclados predictivos insertan el código entero en una celda.
        const inserted = event instanceof InputEvent && event.data != null ? event.data : cell.value;
        const incoming = inserted.replace(/\D/g, '');
        if (incoming.length > 1) {
          fill(incoming, incoming.length >= cells.length ? 0 : index);
          return;
        }
        const digit = incoming || cell.value.replace(/\D/g, '').slice(-1);
        cell.value = digit;
        if (digit && index < cells.length - 1) {
          cells[index + 1].focus();
          cells[index + 1].select();
        }
        emitComplete(el, cells);
      });

      cell.addEventListener('keydown', (event) => {
        if (event.key === 'Backspace' && !cell.value && index > 0) {
          event.preventDefault();
          cells[index - 1].focus();
          cells[index - 1].value = '';
          emitComplete(el, cells);
          return;
        }
        if (event.key === 'ArrowLeft' && index > 0) {
          event.preventDefault();
          cells[index - 1].focus();
        }
        if (event.key === 'ArrowRight' && index < cells.length - 1) {
          event.preventDefault();
          cells[index + 1].focus();
        }
      });

      cell.addEventListener('paste', (event) => {
        event.preventDefault();
        const text = (event.clipboardData || window.clipboardData)?.getData('text') || '';
        const digits = text.replace(/\D/g, '');
        if (!digits) return;
        fill(digits, digits.length >= cells.length ? 0 : index);
      });
    });
  });
}

if (typeof document !== 'undefined') {
  const boot = () => bindPinCodeInputs();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

export default { bindPinCodeInputs };
