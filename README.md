# rzz-ui

Design system agnóstico (sin framework): tokens DTCG, variables CSS `--rzz-*`, y componentes HTML/CSS copy-paste estilo shadcn.

## Quick path

1. `npm install`
2. `npm run build:tokens` — genera `dist/css/variables.css` y `dist/ts/tokens.ts`
3. `npm run docs:dev` — sirve el repo en `http://localhost:4173` (evita límites de `file://`)
4. Abrí `http://localhost:4173/docs/` o el playground en `http://localhost:4173/`
5. Instalá un componente **en el proyecto actual** (cwd):

```bash
npm run rzz-ui -- add button
# o, desde otro proyecto que linkee este paquete:
# rzz-ui add button
# rzz-ui add dialog --path components/ui
```

> El CLI copia al **cwd** (`src/ui/` por defecto). El registry se lee desde este paquete. Aún `private: true` (no hay publish en npm); usalo vía clone/`npm link`/`file:`.

## Qué incluye

| Pieza | Rol |
|-------|-----|
| `tokens/` | Fuentes DTCG 2025.10 (primitive interno + API pública) |
| `build-tokens.mjs` | Compila a CSS/TS con Style Dictionary (`--rzz-*`) |
| `registry/` | **Fuente canónica** del catálogo UI (~35 componentes) |
| `scripts/rzz-ui.mjs` | CLI (`add` → cwd del consumidor) |
| `scripts/add.mjs` | Copia componentes (+ `variables.css` si falta) |
| `src/ui/` | Copia instalada local de ejemplo |
| `index.html` / `docs/` | Playground y docs (cargan desde `registry/ui/`) |

> **Legacy:** `src/components/ui/` puede existir bloqueado por ACL en Windows. Destino activo: `src/ui/`. Limpieza: `npm run cleanup:legacy-ui`.

## API pública de tokens (componentes)

Los componentes **solo** consumen tokens semánticos cortos:

- Superficies: `--rzz-surface-canvas|card|elevated|subtle|scrim`
- Contenido: `--rzz-content-primary|secondary|muted|inverse`
- Bordes: `--rzz-border-subtle|strong|focus`
- Acciones: `--rzz-action-primary-*`, `--rzz-action-danger-*`
- Feedback, espacio, radio, tipografía: `--rzz-feedback-*`, `--rzz-space-*`, `--rzz-radius-*`, `--rzz-font-*`, `--rzz-text-*`, `--rzz-leading-*`
- Motion / capas: `--rzz-shadow-*`, `--rzz-z-*`, `--rzz-duration-*`, `--rzz-ease-*`

`--rzz-primitive-*` existe en `dist/` como fuente interna del build; **no** usarlo en UI.

## CI

```bash
npm run ci   # build:tokens + check:primitives
```

GitHub Actions: `.github/workflows/ci.yml` (push/PR).

## Capas y motion

- **Z-index:** `--rzz-z-base` … `--rzz-z-tooltip`
- **Duración:** `--rzz-duration-fast|normal|slow`
- **Easing:** `--rzz-ease-standard`

## Temas

`:root` (light) y `[data-theme="dark"]`. El playground y docs permiten alternar el tema.

## Requisitos

- Node.js (Style Dictionary 5 recomienda ≥ 22; en 20 puede instalarse con warning)
- Sin dependencias de runtime en los artefactos de `dist/`
