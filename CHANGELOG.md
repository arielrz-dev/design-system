# Changelog

Las versiones anteriores a 0.4.0 están en los tags de git (`v0.1.0` a `v0.3.0`).

## 0.4.0 (2026-09-27)

Incluye cambios incompatibles con 0.3: revisá **Migración** antes de actualizar componentes con `--overwrite`.

### Migración desde 0.3

1. **Tooltip.** Los atributos pasan a llevar prefijo: `data-tooltip` → `data-rzz-tooltip` y `data-tooltip-side` → `data-rzz-tooltip-side`. Reinstalá con `add tooltip --overwrite` y renombrá los atributos en tu HTML.
2. **Ruta de estilos base.** Las instalaciones nuevas dejan `variables.css`, `reduced-motion.css` y las fuentes en `src/ui/styles/` y `src/ui/fonts/` (o bajo `--path`). Si ya tenías `dist/css/variables.css`, el CLI lo sigue usando mientras no pases `--path`. Para mudarte: `add --tokens --path src/ui` y cambiá el `<link>` a `src/ui/styles/variables.css`.
3. **Popover.** El reset de `margin` e `inset` ahora solo aplica a `.ds-popover[popover]`. Si dependías de él para tus propios `[popover]`, agregalo en tu CSS. El menú se posiciona con `popover.js`: sin el script abre en la esquina del viewport.
4. **Banner.** Se quitó el `onclick` inline. Usá `data-banner-close` en el botón y cargá `banner.js`, que emite `ds-banner:close` (cancelable).
5. **Avatar group.** La leyenda de estados usa `.ds-status-legend` en lugar de `.ds-field__hint`.
6. **Toast y copy-button.** Los toasts ya no llevan `role` propio (los anuncia una sola región `aria-live`), y copy-button ya no usa `aria-pressed` (anuncia con un `role="status"` hermano). Ajustá los tests que consulten esos atributos.
7. **CLI.** `add` ya no pisa archivos existentes que difieran: los omite con un aviso. Usá `--overwrite` (`-f`) para reemplazarlos.
8. **Texto oculto.** Se eliminaron `.ds-sr-only` (avatar) y `.ds-tooltip-sr` (tooltip): usá `.visually-hidden`, que ya trae `variables.css`. Si actualizás `avatar.css` sin cambiar tu HTML, el texto para lectores de pantalla queda visible.

### Agregado

- **Posicionamiento de popover:** `popover.js` ancla el menú a su trigger, lo abre hacia arriba si no entra abajo, lo mantiene dentro del viewport y lo sigue con scroll y resize. Con `data-rzz-popover-align="end"` se alinea al borde derecho del trigger.
- **CLI:**
  - Flags `--overwrite`/`-f`, `--dry-run`, `--tokens` y `--path`.
  - Plan por archivo: crea, actualiza, sin cambios u omitido.
  - Aviso cuando `variables.css` está desactualizado.
- **Estilos base:** `reduced-motion.css` se distribuye como ítem foundation y se instala junto a `variables.css`.
- **Tokens:** `variables.css` emite `color-scheme` (light/dark), la utilidad `.visually-hidden` y el token `--rzz-opacity-disabled` (0.5).
- **Alto contraste:** reglas `forced-colors` en data-table, password-strength-input, avatar-group, timeline, banner, sheet, skeleton y popover. Así se conservan la fila seleccionada, el medidor de fuerza, los puntos de estado, la línea del timeline, el contorno de los paneles y el hover del menú. Pasan a ser 19 de 35 componentes; el resto no pierde información porque usa bordes reales, texto o íconos.
- **Banner:** `banner.js` con cierre delegado.
- **Validación en build:** `build:tokens` valida los JSON antes de compilar y falla sin escribir `dist/`. Revisa:
  - colores, dimensiones, duraciones, `cubicBezier` y sombras;
  - referencias rotas o circulares;
  - overrides dark.
- **Tests:**
  - `npm test`, que corre `test:contrast` (100 pares WCAG AA, incluidos los presets de `themes.css`) y `test:registry` (manifiesto, disco y espejo `src/ui`).
  - `check:literals`, que rechaza duraciones en `ms`, `cubic-bezier()`, `transition: all` y opacidades numéricas en reglas de disabled dentro de los CSS de componentes.
  - CI con prueba del CLI en un directorio temporal.

### Cambiado

- **Motion:** los 51 tiempos y 12 curvas escritos a mano pasan a tokens. Las transiciones de 140–160 ms quedan en `--rzz-duration-fast` (120 ms) y las de 180–200 ms en `--rzz-duration-normal`, todas con `--rzz-ease-standard`. Los 7 `transition: all` listan ahora las propiedades que cambian.
- **Deshabilitado:** textarea y select usan el mismo estilo que input (valor legible sobre `surface-muted`, sin borde). Checkbox, switch, radio-card, tabs, pagination y setting-row usan `--rzz-opacity-disabled` (antes 0.45, 0.5, 0.55 o 0.7).

### Corregido

- **Popover:** los menús abrían en la esquina superior izquierda del viewport en lugar de junto a su trigger.
- **Tooltip:** cumple WCAG 1.4.13. Se puede pasar el puntero sobre la burbuja, Escape la descarta y no depende solo de hover.
- **Tabla:** el contenedor con scroll muestra foco visible.
- **Dark:** danger hover y active aclaran en lugar de oscurecer (7.39:1 y 10.52:1 con `content-inverse`).
- **Pagination:** la página activa se distingue en modo alto contraste, sin la placa que Chrome dibuja detrás del texto.
- **Checkbox y setting-row:** el control deshabilitado dentro de un grupo o fila ya no multiplica la opacidad (quedaba en 0.35 y 0.275).
- **Textarea y select:** un campo deshabilitado e inválido ya no conserva el borde rojo, y el select deshabilitado ya no hereda el `opacity: 0.7` de Chrome.
- **Texto:** alert, banner y toast ya no aplican opacidad al texto.
- **Snippets:**
  - apuntan a `../styles/variables.css`;
  - `data-table.html` carga `popover.js`;
  - las referencias a `--rzz-semantic-*` se corrigieron a los nombres reales.
- **Tokens:** `red.100` y `red.200` tenían un hex documentado distinto de sus componentes sRGB (el CSS generado no cambia).
