/**
 * CopyButton — clipboard + estado --copied (2s) + anuncio en role="status".
 *
 * Markup:
 *   <button type="button" class="ds-copy-button" data-ds-copy="texto a copiar">…</button>
 *   <span class="ds-copy-button__status visually-hidden" role="status"></span>
 *   o data-ds-copy-target="#selector" para leer textContent/value del target.
 *
 * El status va como hermano inmediato del botón (si falta, se crea): una live
 * region dentro de un botón con aria-label no se anuncia de forma fiable.
 */

const COPIED_MS = 2000;
const STATUS_CLASS = 'ds-copy-button__status';

/**
 * @param {HTMLButtonElement} button
 * @returns {HTMLElement}
 */
function ensureStatus(button) {
  const next = button.nextElementSibling;
  if (next instanceof HTMLElement && next.classList.contains(STATUS_CLASS)) return next;

  const live = document.createElement('span');
  live.className = `${STATUS_CLASS} visually-hidden`;
  live.setAttribute('role', 'status');
  button.insertAdjacentElement('afterend', live);
  return live;
}

/**
 * @param {HTMLButtonElement} button
 * @param {string} message
 */
function announce(button, message) {
  const live = ensureStatus(button);
  live.textContent = '';
  // Forzar anuncio en lecturas consecutivas
  requestAnimationFrame(() => {
    live.textContent = message;
  });
}

/**
 * @param {HTMLButtonElement} button
 * @returns {string}
 */
function resolveCopyText(button) {
  const direct = button.getAttribute('data-ds-copy');
  if (direct != null && direct !== '') return direct;

  const targetSel = button.getAttribute('data-ds-copy-target');
  if (targetSel) {
    let target = null;
    try {
      target = document.querySelector(targetSel);
    } catch {
      console.warn(`[ds-copy-button] Selector inválido en data-ds-copy-target: "${targetSel}"`);
    }
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return target.value;
    }
    if (target) return (target.textContent || '').trim();
  }

  return (button.getAttribute('aria-label') || button.textContent || '').trim();
}

/**
 * @param {HTMLButtonElement} button
 */
async function handleCopy(button) {
  const text = resolveCopyText(button);
  if (!text) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  } catch (error) {
    console.warn('[ds-copy-button] No se pudo copiar:', error);
    announce(button, 'No se pudo copiar');
    return;
  }

  button.classList.add('ds-copy-button--copied');
  announce(button, 'Copiado al portapapeles');

  window.clearTimeout(Number(button.dataset.dsCopyTimer || 0));
  const timer = window.setTimeout(() => {
    button.classList.remove('ds-copy-button--copied');
    announce(button, '');
  }, COPIED_MS);
  button.dataset.dsCopyTimer = String(timer);
}

/**
 * @param {ParentNode} [root=document]
 */
export function bindCopyButtons(root = document) {
  root.querySelectorAll('.ds-copy-button').forEach((el) => {
    if (!(el instanceof HTMLButtonElement) || el.dataset.dsCopyBound === 'true') return;
    el.dataset.dsCopyBound = 'true';
    ensureStatus(el);
    el.addEventListener('click', () => {
      void handleCopy(el);
    });
  });
}

if (typeof document !== 'undefined') {
  const boot = () => bindCopyButtons();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

export default { bindCopyButtons };
