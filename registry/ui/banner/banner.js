/**
 * Banner: cierre vía [data-banner-close] con delegación en document.
 * Sin handlers inline (compatible con Content-Security-Policy estricta).
 *
 * Markup:
 *   <aside class="ds-banner" …>
 *     <button type="button" class="ds-banner__close" data-banner-close aria-label="Cerrar anuncio">…</button>
 *   </aside>
 *
 * Emite `ds-banner:close` (cancelable, burbujea) antes de ocultar el banner,
 * por ejemplo para recordar el cierre en localStorage.
 */

let bound = false;

/**
 * @param {MouseEvent} event
 */
function onClick(event) {
  const trigger = event.target instanceof Element ? event.target.closest('[data-banner-close]') : null;
  const banner = trigger?.closest('.ds-banner');
  if (!(banner instanceof HTMLElement)) return;

  const proceed = banner.dispatchEvent(
    new CustomEvent('ds-banner:close', { bubbles: true, cancelable: true }),
  );
  if (proceed) banner.hidden = true;
}

export function bindBanners() {
  if (bound || typeof document === 'undefined') return;
  bound = true;
  document.addEventListener('click', onClick);
}

bindBanners();

export default { bindBanners };
