/**
 * CopyButton — clipboard + estado --copied (2s) + aria-live.
 *
 * Markup:
 *   <button type="button" class="ds-copy-button" data-ds-copy="texto a copiar">…</button>
 *   o data-ds-copy-target="#selector" para leer textContent/value del target.
 */

const COPIED_MS = 2000;

/**
 * @param {HTMLButtonElement} button
 * @param {string} message
 */
function announce(button, message) {
  let live = button.querySelector('.ds-copy-button__status');
  if (!(live instanceof HTMLElement)) {
    live = document.createElement('span');
    live.className = 'ds-copy-button__status';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    button.appendChild(live);
  }
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
    const target = document.querySelector(targetSel);
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
  button.setAttribute('aria-pressed', 'true');
  announce(button, 'Copiado al portapapeles');

  window.clearTimeout(Number(button.dataset.dsCopyTimer || 0));
  const timer = window.setTimeout(() => {
    button.classList.remove('ds-copy-button--copied');
    button.setAttribute('aria-pressed', 'false');
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
    el.setAttribute('aria-pressed', 'false');
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
