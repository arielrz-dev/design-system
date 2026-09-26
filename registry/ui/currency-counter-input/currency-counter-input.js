/**
 * CurrencyCounterInput — contador {current}/{max} con umbral 90%.
 */

const COUNT_SEL = '[data-ds-counter]';

/**
 * @param {HTMLElement} root
 */
function updateCounter(root) {
  const input = root.querySelector('input, textarea');
  const countEl = root.querySelector('[data-ds-counter-value]');
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
  if (!(countEl instanceof HTMLElement)) return;

  const max = Number(input.getAttribute('maxlength') || root.dataset.max || 0);
  const current = input.value.length;
  countEl.textContent = max > 0 ? `${current}/${max}` : String(current);

  countEl.classList.remove('ds-counter__count--warn', 'ds-counter__count--danger');
  if (max > 0) {
    const ratio = current / max;
    if (ratio >= 1) {
      countEl.classList.add('ds-counter__count--danger');
    } else if (ratio >= 0.9) {
      countEl.classList.add('ds-counter__count--danger');
    } else if (ratio >= 0.75) {
      countEl.classList.add('ds-counter__count--warn');
    }
  }
}

/**
 * @param {ParentNode} [root=document]
 */
export function bindCurrencyCounters(root = document) {
  root.querySelectorAll(COUNT_SEL).forEach((el) => {
    if (!(el instanceof HTMLElement) || el.dataset.dsCounterBound === 'true') return;
    el.dataset.dsCounterBound = 'true';

    const input = el.querySelector('input, textarea');
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;

    updateCounter(el);
    input.addEventListener('input', () => updateCounter(el));
  });
}

if (typeof document !== 'undefined') {
  const boot = () => bindCurrencyCounters();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

export default { bindCurrencyCounters };
