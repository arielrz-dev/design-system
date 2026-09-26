/**
 * Menú accesible sobre Popover API.
 * - Sync aria-expanded / aria-controls en el trigger
 * - Flechas / Home / End / Escape en menuitems
 * - Foco al primer item al abrir
 *
 * Uso:
 *   import { bindPopoverMenus } from './popover.js';
 *   bindPopoverMenus();
 */

/**
 * @param {HTMLElement} popover
 * @returns {HTMLElement[]}
 */
function menuItems(popover) {
  return Array.from(
    popover.querySelectorAll('[role="menuitem"]:not([disabled]):not([aria-disabled="true"])'),
  ).filter((el) => el instanceof HTMLElement);
}

/**
 * @param {HTMLElement} popover
 * @returns {HTMLElement | null}
 */
function findTrigger(popover) {
  const id = popover.id;
  if (!id) return null;
  const trigger = document.querySelector(
    `[popovertarget="${CSS.escape(id)}"], [aria-controls="${CSS.escape(id)}"]`,
  );
  return trigger instanceof HTMLElement ? trigger : null;
}

/**
 * @param {HTMLElement} trigger
 * @param {HTMLElement} popover
 * @param {boolean} open
 */
function syncExpanded(trigger, popover, open) {
  trigger.setAttribute('aria-expanded', String(open));
  if (!trigger.hasAttribute('aria-haspopup')) {
    trigger.setAttribute('aria-haspopup', 'menu');
  }
  if (!trigger.hasAttribute('aria-controls') && popover.id) {
    trigger.setAttribute('aria-controls', popover.id);
  }
}

/**
 * @param {HTMLElement} popover
 */
function focusFirstItem(popover) {
  const items = menuItems(popover);
  items[0]?.focus();
}

/**
 * @param {HTMLElement} popover
 * @param {KeyboardEvent} event
 */
function onMenuKeydown(popover, event) {
  const items = menuItems(popover);
  if (items.length === 0) return;

  const currentIndex = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));
  let next = currentIndex;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      next = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
      items[next]?.focus();
      break;
    case 'ArrowUp':
      event.preventDefault();
      next = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
      items[next]?.focus();
      break;
    case 'Home':
      event.preventDefault();
      items[0]?.focus();
      break;
    case 'End':
      event.preventDefault();
      items[items.length - 1]?.focus();
      break;
    case 'Escape':
      event.preventDefault();
      if (typeof popover.hidePopover === 'function') popover.hidePopover();
      findTrigger(popover)?.focus();
      break;
    case 'Tab':
      if (typeof popover.hidePopover === 'function') popover.hidePopover();
      break;
    default:
      break;
  }
}

/**
 * @param {ParentNode} [root=document]
 */
export function bindPopoverMenus(root = document) {
  const popovers = root.querySelectorAll('.ds-popover[popover], [popover].ds-popover');

  popovers.forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    if (node.dataset.rzzPopoverBound === 'true') return;
    node.dataset.rzzPopoverBound = 'true';

    const trigger = findTrigger(node);
    if (trigger) {
      syncExpanded(trigger, node, node.matches(':popover-open'));
      if (!trigger.hasAttribute('aria-haspopup')) {
        trigger.setAttribute('aria-haspopup', 'menu');
      }
    }

    node.addEventListener('toggle', (event) => {
      const open =
        'newState' in event
          ? /** @type {ToggleEvent} */ (event).newState === 'open'
          : node.matches(':popover-open');
      if (trigger) syncExpanded(trigger, node, open);
      if (open) {
        // Esperar a que el popover esté en top layer antes de enfocar
        requestAnimationFrame(() => focusFirstItem(node));
      }
    });

    node.addEventListener('keydown', (event) => {
      if (!(event instanceof KeyboardEvent)) return;
      onMenuKeydown(node, event);
    });

    // Cerrar al activar un menuitem (navegación típica de menú)
    node.addEventListener('click', (event) => {
      const item = /** @type {HTMLElement | null} */ (
        event.target instanceof Element ? event.target.closest('[role="menuitem"]') : null
      );
      if (!item || !node.contains(item)) return;
      if (typeof node.hidePopover === 'function') node.hidePopover();
      trigger?.focus();
    });
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bindPopoverMenus(), { once: true });
  } else {
    bindPopoverMenus();
  }
}
