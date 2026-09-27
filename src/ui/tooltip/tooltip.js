/**
 * Tooltip: sincroniza data-rzz-tooltip → aria-describedby + nodo role="tooltip".
 * El chrome visual sigue siendo CSS ([data-rzz-tooltip]::after).
 *
 * WCAG 1.4.13 (contenido en hover/focus):
 * - Hoverable: data-rzz-tooltip-open mantiene la burbuja visible con un período de
 *   gracia al salir, para poder mover el puntero del trigger a la burbuja.
 * - Dismissable: Escape agrega data-rzz-tooltip-dismissed sin mover foco ni puntero.
 *
 * Uso:
 *   import { bindTooltips } from './tooltip.js';
 *   bindTooltips();
 */

const TIP_ATTR = 'data-rzz-tooltip-id';
const BOUND_ATTR = 'data-rzz-tooltip-bound';
const OPEN_ATTR = 'data-rzz-tooltip-open';
const DISMISSED_ATTR = 'data-rzz-tooltip-dismissed';
const CLOSE_GRACE_MS = 150;

/** @type {WeakMap<HTMLElement, number>} */
const closeTimers = new WeakMap();
let escapeBound = false;

/**
 * @param {HTMLElement} trigger
 */
function ensureDescribedBy(trigger) {
  const text = (trigger.getAttribute('data-rzz-tooltip') || '').trim();
  if (!text) return;

  if (!trigger.getAttribute('aria-label') && !trigger.textContent?.trim()) {
    trigger.setAttribute('aria-label', text);
  }

  let tipId = trigger.getAttribute(TIP_ATTR);
  let tip = tipId ? document.getElementById(tipId) : null;

  if (!(tip instanceof HTMLElement)) {
    tip = document.createElement('span');
    tip.id = tipId || `rzz-tip-${Math.random().toString(36).slice(2, 9)}`;
    tip.setAttribute('role', 'tooltip');
    tip.className = 'ds-tooltip-sr';
    tip.hidden = true;
    document.body.appendChild(tip);
    tipId = tip.id;
    trigger.setAttribute(TIP_ATTR, tipId);
  }

  tip.textContent = text;
  const described = (trigger.getAttribute('aria-describedby') || '')
    .split(/\s+/)
    .filter(Boolean);
  if (!described.includes(tipId)) {
    described.push(tipId);
    trigger.setAttribute('aria-describedby', described.join(' '));
  }
}

/**
 * @param {HTMLElement} trigger
 */
function cancelClose(trigger) {
  window.clearTimeout(closeTimers.get(trigger));
  closeTimers.delete(trigger);
}

/**
 * @param {HTMLElement} trigger
 */
function open(trigger) {
  cancelClose(trigger);
  trigger.setAttribute(OPEN_ATTR, '');
}

/**
 * @param {HTMLElement} trigger
 */
function scheduleClose(trigger) {
  cancelClose(trigger);
  closeTimers.set(
    trigger,
    window.setTimeout(() => {
      closeTimers.delete(trigger);
      trigger.removeAttribute(OPEN_ATTR);
      if (!trigger.matches(':focus-visible')) trigger.removeAttribute(DISMISSED_ATTR);
    }, CLOSE_GRACE_MS),
  );
}

/**
 * La burbuja es un pseudo-elemento del trigger: con pointer-events activos,
 * el puntero sobre ella cuenta como hover del trigger (pointerenter/leave).
 * @param {HTMLElement} trigger
 */
function bindPointer(trigger) {
  if (trigger.hasAttribute(BOUND_ATTR)) return;
  trigger.setAttribute(BOUND_ATTR, '');
  trigger.addEventListener('pointerenter', () => open(trigger));
  trigger.addEventListener('pointerleave', () => scheduleClose(trigger));
  trigger.addEventListener('blur', () => {
    if (!trigger.hasAttribute(OPEN_ATTR)) trigger.removeAttribute(DISMISSED_ATTR);
  });
}

function bindEscape() {
  if (escapeBound) return;
  escapeBound = true;
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const visible = document.querySelectorAll(
      `[data-rzz-tooltip][${OPEN_ATTR}]:not([${DISMISSED_ATTR}]), [data-rzz-tooltip]:focus-visible:not([${DISMISSED_ATTR}])`,
    );
    if (visible.length === 0) return;
    visible.forEach((trigger) => trigger.setAttribute(DISMISSED_ATTR, ''));
    // Primer Escape cierra el tooltip; no debe cerrar también un dialog contenedor.
    event.preventDefault();
  });
}

/**
 * @param {ParentNode} [root=document]
 */
export function bindTooltips(root = document) {
  root.querySelectorAll('[data-rzz-tooltip]').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    ensureDescribedBy(node);
    bindPointer(node);
  });
  bindEscape();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bindTooltips(), { once: true });
  } else {
    bindTooltips();
  }
}
