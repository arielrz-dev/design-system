# rzz-ui

Design system agnóstico (sin framework): tokens DTCG, variables CSS `--rzz-*`, y componentes HTML/CSS copy-paste estilo shadcn.

## Usar en tu proyecto

Se distribuye desde GitHub (no está publicado en npm). Desde la raíz de tu proyecto:

```bash
npx github:arielrz-dev/design-system add button
npx github:arielrz-dev/design-system add button dialog --path components/ui
```

Para fijar una versión, instalalo como dependencia de desarrollo y usá el bin:

```bash
npm i -D github:arielrz-dev/design-system#v0.4.0
npx rzz-ui add button
```

El CLI copia cada componente (y sus dependencias) a `src/ui/<componente>/`, los estilos base (`variables.css` y `reduced-motion.css`) a `src/ui/styles/` y la fuente Inter a `src/ui/fonts/`. Cargá los estilos en este orden:

```html
<link rel="stylesheet" href="src/ui/styles/variables.css" />
<link rel="stylesheet" href="src/ui/button/button.css" />
<link rel="stylesheet" href="src/ui/styles/reduced-motion.css" />
<script type="module" src="src/ui/button/button.js"></script>
```

Solo algunos componentes traen `.js`. Requiere Node ≥ 18.

| Flag | Efecto |
|------|--------|
| `--path <rel>` (`-p`) | Carpeta base en vez de `src/ui` (componentes, `styles/` y `fonts/` quedan debajo) |
| `--overwrite` (`-f`) | Reemplaza archivos existentes que difieran del paquete |
| `--tokens` | Actualiza solo `variables.css`, `reduced-motion.css` y las fuentes (`add --tokens` funciona sin componentes) |
| `--dry-run` | Lista qué se crearía o reemplazaría, sin escribir nada |

Por defecto el CLI **no pisa** archivos existentes que hayas editado: los omite con un aviso. Los que son idénticos al paquete figuran como "sin cambios". Si instalaste con una versión ≤ 0.3, tus estilos base están en `dist/css/` y el CLI los sigue usando ahí mientras no pases `--path`. Los cambios incompatibles entre versiones y cómo migrar están en [CHANGELOG.md](CHANGELOG.md).

`variables.css` ya carga Inter (variable, licencia SIL OFL en `fonts/OFL.txt`) desde `../fonts/`, así que mantené `styles/` y `fonts/` como carpetas hermanas. Para usar otra fuente, redefiní `--rzz-font-sans` después de `variables.css`; Inter deja de descargarse.

Si el tema elegido en el personalizador de las docs no es el default, usá "Copiar CSS" y pegalo después de `variables.css`.

## Desarrollar este repo

1. `npm install` (Node ≥ 22: lo exige Style Dictionary 5; el CLI para consumidores sigue funcionando con Node ≥ 18)
2. `npm run build:tokens`: valida los JSON (colores, duraciones, referencias) y genera `dist/css/variables.css` y `dist/ts/tokens.ts`
3. `npm run docs:dev`: sirve el repo en `http://localhost:4173` (evita límites de `file://`)
4. Abrí `http://localhost:4173/docs/` o el playground en `http://localhost:4173/`
5. `npm run rzz-ui -- add button` instala en el `src/ui/` de este mismo repo
6. `npm test` antes de commitear: compila tokens, exige `dist/` commiteado, valida el registry (incluida la paridad con `src/ui/`), el contraste WCAG AA de tokens y presets, y que no haya primitivos en los CSS de componentes. Es lo mismo que corre el CI (`.github/workflows/ci.yml`) en cada push a `master` y en cada PR.

## Qué incluye

| Pieza | Rol |
|-------|-----|
| `tokens/` | Fuentes DTCG 2025.10 (primitive interno + API pública) |
| `build-tokens.mjs` | Compila a CSS/TS con Style Dictionary (`--rzz-*`) |
| `registry/` | **Fuente canónica** del catálogo UI (~35 componentes) |
| `scripts/rzz-ui.mjs` | CLI (`add` → cwd del consumidor) |
| `scripts/add.mjs` | Copia componentes, estilos base y fuentes sin pisar archivos editados |
| `scripts/check-contrast.mjs` | Contraste WCAG AA de pares críticos y presets (`npm run test:contrast`) |
| `scripts/validate-registry.mjs` | Integridad de `registry.json`, disco y `src/ui/` (`npm run test:registry`) |
| `scripts/check-css-literals.mjs` | Motion y disabled de componentes solo vía tokens (`npm run check:literals`) |
| `scripts/lib/tokens.mjs` | Validación y resolución de tokens compartida por el build y los tests |
| `src/ui/` | Copia instalada local de ejemplo |
| `index.html` / `docs/` | Playground y docs (cargan desde `registry/ui/`) |

> **Legacy:** `src/components/ui/` puede existir bloqueado por ACL en Windows. Destino activo: `src/ui/`. Limpieza: `npm run cleanup:legacy-ui`.

## API pública de tokens (componentes)

Los componentes **solo** consumen tokens semánticos cortos:

- Superficies: `--rzz-surface-canvas|card|elevated|subtle|muted|scrim`
- Contenido: `--rzz-content-primary|secondary|muted|inverse`
- Bordes: `--rzz-border-subtle|strong|control|focus`
- Acciones: `--rzz-action-primary-default|hover|active|foreground`, `--rzz-action-danger-*`
- Feedback, espacio, radio, tipografía: `--rzz-feedback-*`, `--rzz-space-*`, `--rzz-radius-*`, `--rzz-font-*`, `--rzz-text-*`, `--rzz-leading-*`
- Motion / capas: `--rzz-shadow-*`, `--rzz-z-*`, `--rzz-duration-*`, `--rzz-ease-*`
- Estados: `--rzz-opacity-disabled`

`--rzz-primitive-*` existe en `dist/` como fuente interna del build; **no** usarlo en UI. Tampoco duraciones en `ms`, `cubic-bezier()` ni `transition: all`: la CI lo rechaza (`check:literals`).

### Estados deshabilitados

- **Campos de texto** (input, textarea, select) y botones: valor legible sobre `--rzz-surface-muted`, texto `--rzz-content-muted`, sin borde ni opacidad.
- **Controles de selección y navegación** (checkbox, switch, radio-card, tabs, pagination, setting-row): `opacity: var(--rzz-opacity-disabled)` una sola vez; si el contenedor ya atenúa, el control interno no vuelve a hacerlo.
- En alto contraste (`forced-colors`), campos, botones, checkbox, switch, radio-card y tabs marcan el deshabilitado con `GrayText`; la opacidad del resto se mantiene.

## CI

```bash
npm run ci   # build:tokens + check:primitives
```

GitHub Actions: `.github/workflows/ci.yml` (push/PR).

## Capas y motion

- **Z-index:** `--rzz-z-base` … `--rzz-z-tooltip`
- **Duración:** `--rzz-duration-fast` (hover, color, borde), `--rzz-duration-normal` (despliegues, toasts), `--rzz-duration-slow`, `--rzz-duration-enter` (overlays)
- **Easing:** `--rzz-ease-standard` para transiciones; `--rzz-ease-spring` y `--rzz-ease-bounce` para entradas con rebote

## Temas

`:root` (light) y `[data-theme="dark"]`. El playground y docs permiten alternar el tema.

## Requisitos

- Consumir: Node.js ≥ 18
- Desarrollar: Node.js ≥ 22 (Style Dictionary 5; en 20 puede instalarse con warning)
- Sin dependencias de runtime en los artefactos de `dist/`
