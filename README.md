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
npm i -D github:arielrz-dev/design-system#v0.2.0
npx rzz-ui add button
```

El CLI copia cada componente (y sus dependencias) a `src/ui/`, y agrega `dist/css/variables.css` y la fuente Inter en `dist/fonts/` si no existen. Cargá los estilos en este orden:

```html
<link rel="stylesheet" href="dist/css/variables.css" />
<link rel="stylesheet" href="src/ui/button/button.css" />
<script type="module" src="src/ui/button/button.js"></script>
```

Solo algunos componentes traen `.js`. Requiere Node ≥ 18.

`variables.css` ya carga Inter (variable, licencia SIL OFL en `dist/fonts/OFL.txt`) desde `../fonts/`, así que mantené `dist/css/` y `dist/fonts/` juntos. Para usar otra fuente, redefiní `--rzz-font-sans` después de `variables.css`; Inter deja de descargarse.

Si el tema elegido en el personalizador de las docs no es el default, usá "Copiar CSS" y pegalo después de `variables.css`.

## Desarrollar este repo

1. `npm install`
2. `npm run build:tokens`: genera `dist/css/variables.css` y `dist/ts/tokens.ts`
3. `npm run docs:dev`: sirve el repo en `http://localhost:4173` (evita límites de `file://`)
4. Abrí `http://localhost:4173/docs/` o el playground en `http://localhost:4173/`
5. `npm run rzz-ui -- add button` instala en el `src/ui/` de este mismo repo

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

- Superficies: `--rzz-surface-canvas|card|elevated|subtle|muted|scrim`
- Contenido: `--rzz-content-primary|secondary|muted|inverse`
- Bordes: `--rzz-border-subtle|strong|control|focus`
- Acciones: `--rzz-action-primary-default|hover|active|foreground`, `--rzz-action-danger-*`
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

- Consumir: Node.js ≥ 18
- Desarrollar: Node.js ≥ 22 (Style Dictionary 5; en 20 puede instalarse con warning)
- Sin dependencias de runtime en los artefactos de `dist/`
