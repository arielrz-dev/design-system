/**
 * Tabs agnóstico — patrón WAI-ARIA Tabs.
 *
 * Uso:
 *   import { initTabs } from './tabs.js';
 *   initTabs('[data-ds-tabs]');
 *   // o
 *   initTabs(document.getElementById('my-tabs'));
 */

/**
 * @param {ParentNode | Element} root
 * @returns {HTMLElement[]}
 */
function getTriggers(root) {
  return Array.from(root.querySelectorAll('[role="tab"].ds-tabs__trigger'));
}

/**
 * @param {HTMLElement} trigger
 * @returns {HTMLElement | null}
 */
function getPanelForTrigger(trigger) {
  const id = trigger.getAttribute('aria-controls');
  if (!id) return null;
  const panel = document.getElementById(id);
  return panel instanceof HTMLElement ? panel : null;
}

/**
 * @param {HTMLElement} root
 * @param {HTMLElement} activeTrigger
 * @param {{ focus?: boolean }} [options]
 */
function activateTab(root, activeTrigger, options = {}) {
  const { focus = false } = options;
  const triggers = getTriggers(root);

  triggers.forEach((trigger) => {
    const selected = trigger === activeTrigger;
    const panel = getPanelForTrigger(trigger);

    trigger.setAttribute('aria-selected', String(selected));
    trigger.tabIndex = selected ? 0 : -1;

    if (panel) {
      if (selected) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    }
  });

  if (focus) activeTrigger.focus();
}

/**
 * @param {HTMLElement} root
 * @param {number} currentIndex
 * @param {1 | -1} delta
 */
function moveFocus(root, currentIndex, delta) {
  const triggers = getTriggers(root).filter(
    (t) => !t.disabled && t.getAttribute('aria-disabled') !== 'true',
  );
  if (triggers.length === 0) return;

  const all = getTriggers(root);
  const current = all[currentIndex];
  const enabledIndex = Math.max(0, triggers.indexOf(current));
  const nextIndex = (enabledIndex + delta + triggers.length) % triggers.length;
  const next = triggers[nextIndex];

  activateTab(root, next, { focus: true });
}

/**
 * @param {string | Element} elementOrSelector
 * @returns {HTMLElement | null}
 */
export function initTabs(elementOrSelector) {
  const root =
    typeof elementOrSelector === 'string'
      ? document.querySelector(elementOrSelector)
      : elementOrSelector;

  if (!(root instanceof HTMLElement) || !root.classList.contains('ds-tabs')) {
    console.warn('[ds-tabs] Contenedor inválido:', elementOrSelector);
    return null;
  }

  if (root.dataset.dsTabsReady === 'true') return root;
  root.dataset.dsTabsReady = 'true';

  const list = root.querySelector('.ds-tabs__list, [role="tablist"]');
  const triggers = getTriggers(root);

  if (!list || triggers.length === 0) {
    console.warn('[ds-tabs] Falta tablist o triggers en', root);
    return root;
  }

  // Estado inicial: respetar aria-selected="true" o activar el primero.
  const initiallySelected =
    triggers.find((t) => t.getAttribute('aria-selected') === 'true') || triggers[0];
  activateTab(root, initiallySelected, { focus: false });

  root.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('.ds-tabs__trigger[role="tab"]');
    if (!trigger || !root.contains(trigger)) return;
    if (trigger.disabled || trigger.getAttribute('aria-disabled') === 'true') return;
    activateTab(root, trigger, { focus: true });
  });

  list.addEventListener('keydown', (event) => {
    const trigger = event.target.closest?.('.ds-tabs__trigger[role="tab"]');
    if (!trigger || !list.contains(trigger)) return;

    const all = getTriggers(root);
    const index = all.indexOf(trigger);
    if (index < 0) return;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        moveFocus(root, index, 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        moveFocus(root, index, -1);
        break;
      case 'Home': {
        event.preventDefault();
        const first = all.find(
          (t) => !t.disabled && t.getAttribute('aria-disabled') !== 'true',
        );
        if (first) activateTab(root, first, { focus: true });
        break;
      }
      case 'End': {
        event.preventDefault();
        const enabled = all.filter(
          (t) => !t.disabled && t.getAttribute('aria-disabled') !== 'true',
        );
        const last = enabled[enabled.length - 1];
        if (last) activateTab(root, last, { focus: true });
        break;
      }
      case 'Enter':
      case ' ':
        event.preventDefault();
        activateTab(root, trigger, { focus: true });
        break;
      default:
        break;
    }
  });

  return root;
}

/**
 * Auto-inicializa todos los `.ds-tabs[data-ds-tabs]`.
 * @param {ParentNode} [scope=document]
 */
export function initAllTabs(scope = document) {
  scope.querySelectorAll('.ds-tabs[data-ds-tabs]').forEach((el) => initTabs(el));
}

if (typeof document !== 'undefined') {
  const boot = () => initAllTabs();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

export default { initTabs, initAllTabs };
