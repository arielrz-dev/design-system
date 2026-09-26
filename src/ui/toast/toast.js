/**
 * Toast agnóstico (Vanilla JS).
 *
 * Uso:
 *   import { toast } from './toast.js';
 *   toast.show({ title: 'Listo', description: 'Guardado', variant: 'success' });
 */

const VIEWPORT_CLASS = 'ds-toast-viewport';
const TOAST_CLASS = 'ds-toast';
const VISIBLE_CLASS = 'ds-toast--visible';
const LEAVING_CLASS = 'ds-toast--leaving';
const VARIANTS = new Set(['default', 'success', 'danger']);

/**
 * @returns {HTMLElement}
 */
function ensureViewport() {
  let viewport = document.querySelector(`.${VIEWPORT_CLASS}`);
  if (viewport) return viewport;

  viewport = document.createElement('div');
  viewport.className = VIEWPORT_CLASS;
  viewport.setAttribute('role', 'region');
  viewport.setAttribute('aria-live', 'polite');
  viewport.setAttribute('aria-label', 'Notificaciones');
  viewport.setAttribute('aria-relevant', 'additions text');
  document.body.appendChild(viewport);
  return viewport;
}

/**
 * @param {HTMLElement} el
 * @param {() => void} done
 */
function dismissToast(el, done) {
  if (el.dataset.dismissing === 'true') return;
  el.dataset.dismissing = 'true';
  el.classList.remove(VISIBLE_CLASS);
  el.classList.add(LEAVING_CLASS);

  const finish = () => {
    el.removeEventListener('transitionend', onEnd);
    el.remove();
    done?.();
  };

  const onEnd = (event) => {
    if (event.target !== el || event.propertyName !== 'opacity') return;
    finish();
  };

  el.addEventListener('transitionend', onEnd);
  // Fallback si no hay transición (navegadores / reduced-motion).
  window.setTimeout(finish, 280);
}

/**
 * @param {{
 *   title: string,
 *   description?: string,
 *   variant?: 'default' | 'success' | 'danger',
 *   duration?: number,
 * }} options
 */
function show(options = {}) {
  const {
    title = '',
    description = '',
    variant: rawVariant = 'default',
    duration = 4000,
  } = options;

  const variant = VARIANTS.has(rawVariant) ? rawVariant : 'default';
  const viewport = ensureViewport();

  const toastEl = document.createElement('div');
  toastEl.className = `${TOAST_CLASS} ${TOAST_CLASS}--${variant}`;
  toastEl.setAttribute('role', variant === 'danger' ? 'alert' : 'status');

  const body = document.createElement('div');
  body.className = 'ds-toast__body';

  const titleEl = document.createElement('p');
  titleEl.className = 'ds-toast__title';
  titleEl.textContent = title;
  body.appendChild(titleEl);

  if (description) {
    const descEl = document.createElement('p');
    descEl.className = 'ds-toast__description';
    descEl.textContent = description;
    body.appendChild(descEl);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'ds-toast__close';
  closeBtn.setAttribute('aria-label', 'Cerrar notificación');
  closeBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  toastEl.appendChild(body);
  toastEl.appendChild(closeBtn);
  viewport.appendChild(toastEl);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toastEl.classList.add(VISIBLE_CLASS);
    });
  });

  let remaining = Math.max(0, Number(duration) || 0);
  let timerId = null;
  let startedAt = 0;
  let paused = false;

  const clearTimer = () => {
    if (timerId != null) {
      window.clearTimeout(timerId);
      timerId = null;
    }
  };

  const schedule = () => {
    clearTimer();
    if (remaining <= 0) {
      dismissToast(toastEl);
      return;
    }
    startedAt = Date.now();
    timerId = window.setTimeout(() => dismissToast(toastEl), remaining);
  };

  const pause = () => {
    if (paused || remaining <= 0) return;
    paused = true;
    remaining = Math.max(0, remaining - (Date.now() - startedAt));
    clearTimer();
  };

  const resume = () => {
    if (!paused) return;
    paused = false;
    schedule();
  };

  closeBtn.addEventListener('click', () => {
    clearTimer();
    dismissToast(toastEl);
  });

  toastEl.addEventListener('mouseenter', pause);
  toastEl.addEventListener('mouseleave', resume);
  toastEl.addEventListener('focusin', pause);
  toastEl.addEventListener('focusout', (event) => {
    if (!toastEl.contains(event.relatedTarget)) resume();
  });

  if (remaining > 0) schedule();

  return {
    element: toastEl,
    dismiss: () => {
      clearTimer();
      dismissToast(toastEl);
    },
  };
}

export const toast = { show, ensureViewport };

export default toast;
