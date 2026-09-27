/**
 * Menú accesible sobre Popover API.
 * - Sync aria-expanded / aria-controls en el trigger
 * - Flechas / Home / End / Escape en menuitems
 * - Foco al primer item al abrir
 * - Posiciona el menú junto a su trigger (abajo; arriba si no entra) y lo
 *   mantiene dentro del viewport al hacer scroll o resize
 *
 * Alineación: data-rzz-popover-align="end" en el popover alinea su borde
 * derecho con el del trigger (útil en columnas de acciones). Por defecto, start.
 * El lado elegido queda en data-rzz-popover-side="bottom|top".
 *
 * Uso:
 *   import { bindPopoverMenus } from './popover.js';
 *   bindPopoverMenus();
 */

const TRIGGER_GAP = 4;
const VIEWPORT_MARGIN = 8;

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
 * @param {HTMLElement} trigger
 * @param {HTMLElement} popover
 */
function positionPopover(trigger, popover) {
  const anchor = trigger.getBoundingClientRect();
  // Cerca del borde derecho el ancho disponible encoge el menú: medir desde 0.
  popover.style.left = '0px';
  const width = popover.offsetWidth;
  const height = popover.offsetHeight;
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  const spaceBelow = viewportHeight - anchor.bottom - TRIGGER_GAP - VIEWPORT_MARGIN;
  const spaceAbove = anchor.top - TRIGGER_GAP - VIEWPORT_MARGIN;
  const side = height > spaceBelow && spaceAbove > spaceBelow ? 'top' : 'bottom';
  const top = side === 'bottom' ? anchor.bottom + TRIGGER_GAP : anchor.top - TRIGGER_GAP - height;

  const alignEnd = popover.dataset.rzzPopoverAlign === 'end';
  const preferredLeft = alignEnd ? anchor.right - width : anchor.left;
  const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN);
  const left = Math.min(Math.max(preferredLeft, VIEWPORT_MARGIN), maxLeft);

  popover.style.top = `${Math.round(top)}px`;
  popover.style.left = `${Math.round(left)}px`;
  popover.dataset.rzzPopoverSide = side;
}

/**
 * Mantiene el popover pegado al trigger mientras está abierto.
 * @param {HTMLElement} trigger
 * @param {HTMLElement} popover
 * @returns {() => void} detiene el seguimiento
 */
function trackPosition(trigger, popover) {
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      positionPopover(trigger, popover);
    });
  };
  window.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', schedule, { capture: true });
    window.removeEventListener('resize', schedule);
  };
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

    /** @type {(() => void) | null} */
    let stopTracking = null;

    // Antes de mostrarse todavía no tiene tamaño: se ubica bajo el trigger para
    // no pintar ni un frame en la esquina, y se ajusta en `toggle`.
    node.addEventListener('beforetoggle', (event) => {
      if (!trigger || /** @type {ToggleEvent} */ (event).newState !== 'open') return;
      const anchor = trigger.getBoundingClientRect();
      node.style.top = `${Math.round(anchor.bottom + TRIGGER_GAP)}px`;
      node.style.left = `${Math.round(anchor.left)}px`;
    });

    node.addEventListener('toggle', (event) => {
      const open =
        'newState' in event
          ? /** @type {ToggleEvent} */ (event).newState === 'open'
          : node.matches(':popover-open');
      if (trigger) syncExpanded(trigger, node, open);
      stopTracking?.();
      stopTracking = null;
      if (open && trigger) {
        positionPopover(trigger, node);
        stopTracking = trackPosition(trigger, node);
      }
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
