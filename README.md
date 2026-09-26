# rzz-ui

Design system agnóstico (sin framework): tokens DTCG, variables CSS `--ds-*`, y componentes HTML/CSS copy-paste estilo shadcn.

## Quick path

1. `npm install`
2. `npm run build:tokens` — genera `dist/css/variables.css` y `dist/ts/tokens.ts`
3. Abrí `docs/index.html` para la documentación / showcase
4. O `index.html` en la raíz para el playground de desarrollo
5. Instalá un componente: `npx rzz-ui add button`

## Qué incluye

| Pieza | Rol |
|-------|-----|
| `tokens/` | Fuentes DTCG 2025.10 (light + dark) |
| `build-tokens.mjs` | Compila a CSS y TypeScript con Style Dictionary |
| `registry/` | Catálogo UI (~35 componentes HTML/CSS BEM) |
| `scripts/rzz-ui.mjs` | CLI público (`npx rzz-ui add …`) |
| `scripts/add.mjs` | Copia un componente a `src/components/ui/` |
| `index.html` | Playground de desarrollo (light/dark) |
| `docs/` | Landing de documentación técnica (catálogo + foundations) |

El índice vivo de componentes está en `registry/registry.json` (formularios avanzados, SaaS Pro, banner, timeline, etc.).

## Capas y motion

Además de color, tipografía y sombra, el build expone:

- **Z-index:** `--ds-z-base` … `--ds-z-tooltip` (banner, dropdown, modal, toast…)
- **Duración:** `--ds-duration-fast` / `--ds-duration-normal` / `--ds-duration-slow`
- **Easing:** `--ds-ease-standard`

Los overlays del registry (dialog, sheet, toast, popover, tooltip) consumen estas variables.

## Temas

El CSS generado define `:root` (light) y `[data-theme="dark"]`. En el playground podés alternar el tema desde la UI.

## Requisitos

- Node.js (Style Dictionary 5 recomienda ≥ 22; en 20 puede instalarse con warning)
- Sin dependencias de runtime en los artefactos de `dist/`
