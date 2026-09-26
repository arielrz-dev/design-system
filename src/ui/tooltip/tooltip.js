/**
 * Tooltip: sincroniza data-tooltip → aria-describedby + nodo role="tooltip".
 * El chrome visual sigue siendo CSS ([data-tooltip]::after).
 *
 * Uso:
 *   import { bindTooltips } from './tooltip.js';
 *   bindTooltips();
 */

const TIP_ATTR = 'data-rzz-tooltip-id';

/**
 * @param {HTMLElement} trigger
 */
function ensureDescribedBy(trigger) {
  const text = (trigger.getAttribute('data-tooltip') || '').trim();
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
 * @param {ParentNode} [root=document]
 */
export function bindTooltips(root = document) {
  root.querySelectorAll('[data-tooltip]').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    ensureDescribedBy(node);
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bindTooltips(), { once: true });
  } else {
    bindTooltips();
  }
}
