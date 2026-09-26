# Design tokens + UI registry

Design system agnóstico (sin framework): tokens DTCG, variables CSS `--ds-*`, y componentes HTML/CSS copy-paste estilo shadcn.

## Quick path

1. `npm install`
2. `npm run build:tokens` — genera `dist/css/variables.css` y `dist/ts/tokens.ts`
3. Abrí `index.html` en el navegador para ver el playground
4. Instalá un componente: `npm run add -- button`

## Qué incluye

| Pieza | Rol |
|-------|-----|
| `tokens/` | Fuentes DTCG 2025.10 (light + dark) |
| `build-tokens.mjs` | Compila a CSS y TypeScript con Style Dictionary |
| `registry/` | Catálogo de UI (HTML + CSS BEM, tokens `--ds-*`) |
| `scripts/add.mjs` | Copia un componente a `src/components/ui/` |
| `index.html` | Playground visual de tokens y componentes |

## Temas

El CSS generado define `:root` (light) y `[data-theme="dark"]`. En el playground podés alternar el tema desde la UI.

## Requisitos

- Node.js (Style Dictionary 5 recomienda ≥ 22; en 20 puede instalarse con warning)
- Sin dependencias de runtime en los artefactos de `dist/`
