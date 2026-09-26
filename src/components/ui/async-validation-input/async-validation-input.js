/**
 * AsyncValidationInput — debounce 400ms + estados validating/success/error.
 *
 * Demo: valida usernames (min 3, no "admin"/"taken").
 * Personalizá con data-ds-async-validate="username" o pasando validateFn.
 */

/**
 * @param {(...args: any[]) => void} fn
 * @param {number} wait
 */
function debounce(fn, wait) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/**
 * @param {string} value
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
async function defaultValidateUsername(value) {
  await new Promise((r) => setTimeout(r, 450));
  const v = value.trim().toLowerCase();
  if (v.length < 3) {
    return { ok: false, message: 'Mínimo 3 caracteres.' };
  }
  if (v === 'admin' || v === 'taken') {
    return { ok: false, message: 'Ese usuario ya está en uso.' };
  }
  if (!/^[a-z0-9_-]+$/.test(v)) {
    return { ok: false, message: 'Solo letras, números, _ y -.' };
  }
  return { ok: true, message: 'Usuario disponible.' };
}

/**
 * @param {HTMLElement} root
 * @param {'idle'|'validating'|'success'|'error'} state
 * @param {string} [message]
 */
function setState(root, state, message = '') {
  root.dataset.state = state;
  const input = root.querySelector('.ds-async__input');
  const msg = root.querySelector('.ds-async__message-text');
  if (input instanceof HTMLInputElement) {
    if (state === 'error') input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
  if (msg instanceof HTMLElement) {
    msg.textContent = message;
  }
}

/**
 * @param {ParentNode} [root=document]
 * @param {{ validate?: (value: string) => Promise<{ ok: boolean, message: string }>, wait?: number }} [options]
 */
export function bindAsyncValidation(root = document, options = {}) {
  const wait = options.wait ?? 400;
  const validate = options.validate ?? defaultValidateUsername;

  root.querySelectorAll('.ds-async').forEach((el) => {
    if (!(el instanceof HTMLElement) || el.dataset.dsAsyncBound === 'true') return;
    el.dataset.dsAsyncBound = 'true';

    const input = el.querySelector('.ds-async__input');
    if (!(input instanceof HTMLInputElement)) return;

    let seq = 0;
    const run = debounce(async () => {
      const value = input.value;
      if (!value.trim()) {
        setState(el, 'idle', '');
        return;
      }
      const id = ++seq;
      setState(el, 'validating', 'Comprobando…');
      try {
        const result = await validate(value);
        if (id !== seq) return;
        setState(el, result.ok ? 'success' : 'error', result.message);
      } catch {
        if (id !== seq) return;
        setState(el, 'error', 'No se pudo validar. Reintentá.');
      }
    }, wait);

    input.addEventListener('input', run);
  });
}

if (typeof document !== 'undefined') {
  const boot = () => bindAsyncValidation();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

export default { bindAsyncValidation, defaultValidateUsername };
