/**
 * PasswordStrengthInput — toggle visibilidad + medidor 4 niveles.
 */

const LABELS = ['', 'Débil', 'Regular', 'Buena', 'Segura'];

/**
 * @param {string} value
 * @returns {0|1|2|3|4}
 */
export function scorePassword(value) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score += 1;
  return /** @type {0|1|2|3|4} */ (Math.min(4, Math.max(value.length > 0 ? 1 : 0, score)));
}

/**
 * @param {HTMLElement} root
 */
function syncStrength(root) {
  const input = root.querySelector('.ds-password__input');
  const meter = root.querySelector('.ds-password__meter');
  const status = root.querySelector('.ds-password__status');
  if (!(input instanceof HTMLInputElement)) return;

  const level = scorePassword(input.value);
  if (meter instanceof HTMLElement) {
    meter.dataset.strength = String(level);
    meter.setAttribute('aria-valuenow', String(level));
    meter.setAttribute('aria-valuetext', LABELS[level] || 'Vacía');
  }
  if (status instanceof HTMLElement) {
    status.dataset.strength = String(level);
    status.textContent = level === 0 ? 'Ingresá una contraseña' : `Fuerza: ${LABELS[level]}`;
  }
}

/**
 * @param {ParentNode} [root=document]
 */
export function bindPasswordStrength(root = document) {
  root.querySelectorAll('.ds-password').forEach((el) => {
    if (!(el instanceof HTMLElement) || el.dataset.dsPasswordBound === 'true') return;
    el.dataset.dsPasswordBound = 'true';

    const input = el.querySelector('.ds-password__input');
    const toggle = el.querySelector('.ds-password__toggle');
    if (!(input instanceof HTMLInputElement)) return;

    syncStrength(el);
    input.addEventListener('input', () => syncStrength(el));

    if (toggle instanceof HTMLButtonElement) {
      toggle.addEventListener('click', () => {
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        toggle.setAttribute('aria-pressed', showing ? 'false' : 'true');
        toggle.setAttribute(
          'aria-label',
          showing ? 'Mostrar contraseña' : 'Ocultar contraseña'
        );
        input.focus();
      });
    }
  });
}

if (typeof document !== 'undefined') {
  const boot = () => bindPasswordStrength();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

export default { scorePassword, bindPasswordStrength };
