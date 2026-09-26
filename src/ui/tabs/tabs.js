/**
 * Tabs agnóstico — patrón WAI-ARIA Tabs + píldora deslizante (WAAPI).
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
 * @returns {boolean}
 */
function prefersReducedMotion() {
  if (
    typeof document !== 'undefined' &&
    document.documentElement?.getAttribute('data-rzz-motion') === 'force'
  ) {
    return false;
  }
  return (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Resuelve la curva spring desde tokens CSS (WAAPI no acepta var()).
 * @returns {string}
 */
function getSpringEasing() {
  if (typeof getComputedStyle !== 'function' || !document.documentElement) {
    return 'ease-out';
  }
  const root = getComputedStyle(document.documentElement);
  const spring =
    root.getPropertyValue('--rzz-primitive-motion-easing-spring').trim() ||
    root.getPropertyValue('--rzz-ease-spring').trim();
  return spring || 'ease-out';
}

/**
 * @param {HTMLElement} list
 * @returns {HTMLElement}
 */
function ensureIndicator(list) {
  let indicator = list.querySelector(':scope > .ds-tabs__indicator');
  if (!(indicator instanceof HTMLElement)) {
    indicator = document.createElement('span');
    indicator.className = 'ds-tabs__indicator';
    indicator.setAttribute('aria-hidden', 'true');
    list.prepend(indicator);
  }
  return indicator;
}

/**
 * @param {HTMLElement} indicator
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
function readIndicatorBox(indicator) {
  return {
    x: Number.parseFloat(indicator.dataset.x || '0') || 0,
    y: Number.parseFloat(indicator.dataset.y || '0') || 0,
    width: Number.parseFloat(indicator.dataset.width || '0') || 0,
    height: Number.parseFloat(indicator.dataset.height || '0') || 0,
  };
}

/**
 * @param {HTMLElement} indicator
 * @param {{ x: number, y: number, width: number, height: number }} box
 */
function writeIndicatorBox(indicator, box) {
  indicator.dataset.x = String(box.x);
  indicator.dataset.y = String(box.y);
  indicator.dataset.width = String(box.width);
  indicator.dataset.height = String(box.height);
  indicator.style.width = `${box.width}px`;
  indicator.style.height = `${box.height}px`;
  indicator.style.transform = `translate(${box.x}px, ${box.y}px)`;
}

/**
 * FLIP de la píldora activa con Web Animations API.
 * @param {HTMLElement} list
 * @param {HTMLElement} trigger
 * @param {{ animate?: boolean }} [options]
 */
function syncIndicator(list, trigger, options = {}) {
  const { animate = true } = options;
  const indicator = ensureIndicator(list);
  const next = {
    x: trigger.offsetLeft,
    y: trigger.offsetTop,
    width: trigger.offsetWidth,
    height: trigger.offsetHeight,
  };
  const prev = readIndicatorBox(indicator);
  const hasPrev = prev.width > 0 && prev.height > 0;
  const reduced = prefersReducedMotion();
  const canAnimate =
    animate &&
    hasPrev &&
    !reduced &&
    typeof indicator.animate === 'function';

  if (!canAnimate) {
    writeIndicatorBox(indicator, next);
    return;
  }

  const easing = getSpringEasing();
  const animation = indicator.animate(
    [
      {
        width: `${prev.width}px`,
        height: `${prev.height}px`,
        transform: `translate(${prev.x}px, ${prev.y}px)`,
      },
      {
        width: `${next.width}px`,
        height: `${next.height}px`,
        transform: `translate(${next.x}px, ${next.y}px)`,
      },
    ],
    {
      duration: 250,
      easing,
      fill: 'forwards',
    },
  );

  writeIndicatorBox(indicator, next);

  animation.finished
    .then(() => {
      animation.cancel();
      writeIndicatorBox(indicator, next);
    })
    .catch(() => {
      writeIndicatorBox(indicator, next);
    });
}

/**
 * @param {HTMLElement} root
 * @param {HTMLElement} activeTrigger
 * @param {{ focus?: boolean, animateIndicator?: boolean }} [options]
 */
function activateTab(root, activeTrigger, options = {}) {
  const { focus = false, animateIndicator = true } = options;
  const triggers = getTriggers(root);
  const list = root.querySelector('.ds-tabs__list, [role="tablist"]');

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

  if (list instanceof HTMLElement) {
    syncIndicator(list, activeTrigger, { animate: animateIndicator });
  }

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

  if (!(list instanceof HTMLElement)) return root;

  // Estado inicial: respetar aria-selected="true" o activar el primero.
  const initiallySelected =
    triggers.find((t) => t.getAttribute('aria-selected') === 'true') || triggers[0];
  activateTab(root, initiallySelected, { focus: false, animateIndicator: false });

  const ro =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          const selected =
            triggers.find((t) => t.getAttribute('aria-selected') === 'true') ||
            triggers[0];
          if (selected) syncIndicator(list, selected, { animate: false });
        })
      : null;
  if (ro) {
    ro.observe(list);
    triggers.forEach((t) => ro.observe(t));
  }

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
