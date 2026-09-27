/**
 * Compila tokens DTCG → CSS variables + TypeScript (`as const`).
 * Sin dependencias de runtime en los artefactos generados.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import StyleDictionary from 'style-dictionary';
import { formats, transformGroups } from 'style-dictionary/enums';
import { formattedVariables } from 'style-dictionary/utils';

const TOKEN_SOURCE_LIGHT = ['tokens/tokens.json'];
const TOKEN_SOURCE_DARK = ['tokens/tokens.dark.json'];

const CSS_OUT = 'dist/css/variables.css';
const TS_OUT = 'dist/ts/tokens.ts';

/**
 * Inter variable (SIL OFL, ver dist/fonts/OFL.txt), subsets de Google Fonts.
 * Las URLs son relativas a dist/css/: el CLI copia dist/fonts/ al lado.
 */
const FONT_FACES = [
  {
    file: 'inter-latin.woff2',
    range:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  },
  {
    file: 'inter-latin-ext.woff2',
    range:
      'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
  },
];

function buildFontFaces() {
  return FONT_FACES.map(
    ({ file, range }) => `@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('../fonts/${file}') format('woff2');
  unicode-range: ${range};
}`,
  ).join('\n\n');
}

const DARK_OVERRIDE_ROOTS = [
  'surface',
  'content',
  'border',
  'action',
  'feedback',
  'shadow',
];

/** DTCG duration `{ value, unit }` → CSS (`120ms`). SD 5 no lo serializa solo. */
StyleDictionary.registerTransform({
  name: 'rzz/duration/css',
  type: 'value',
  transitive: true,
  filter: (token) => (token.$type ?? token.type) === 'duration',
  transform: (token) => {
    const raw = token.$value ?? token.value;
    if (raw && typeof raw === 'object' && 'value' in raw && 'unit' in raw) {
      return `${raw.value}${raw.unit}`;
    }
    return raw;
  },
});

/**
 * Springs CSS `linear(...)` — strings sin $type cubicBezier.
 * Garantiza que el valor raw sobreviva al pipeline CSS.
 */
StyleDictionary.registerTransform({
  name: 'rzz/ease/linear-spring',
  type: 'value',
  transitive: true,
  filter: (token) => {
    const v = token.$value ?? token.value;
    return typeof v === 'string' && v.trimStart().startsWith('linear(');
  },
  transform: (token) => token.$value ?? token.value,
});

/**
 * @param {object} config
 * @param {'css' | 'js'} platform
 */
async function getTransformedDictionary(config, platform) {
  const transformGroup =
    platform === 'css' ? transformGroups.css : transformGroups.js;

  /** @type {import('style-dictionary/types').PlatformConfig} */
  const platformConfig = {
    transformGroup,
    prefix: 'rzz',
    buildPath: 'dist/',
    files: [
      {
        destination: '_noop',
        format: platform === 'css' ? formats.cssVariables : formats.javascriptEsm,
      },
    ],
  };

  if (platform === 'css') {
    // Append after group: duration objects + spring linear() strings.
    const groupTransforms =
      StyleDictionary.hooks.transformGroups[transformGroups.css] ?? [];
    platformConfig.transforms = [
      ...groupTransforms,
      'rzz/duration/css',
      'rzz/ease/linear-spring',
    ];
    delete platformConfig.transformGroup;
  }

  const sd = new StyleDictionary({
    usesDtcg: true,
    log: { verbosity: 'silent' },
    ...config,
    platforms: {
      [platform]: platformConfig,
    },
  });

  await sd.hasInitialized;
  return sd.getPlatformTokens(platform);
}

/** @param {import('style-dictionary/types').TransformedToken} token */
function tokenValue(token) {
  return token.$value ?? token.value;
}

/**
 * Reconstruye el árbol anidado a partir de allTokens.
 * @param {import('style-dictionary/types').TransformedToken[]} tokens
 */
function nestTokens(tokens) {
  const root = {};

  for (const token of tokens) {
    let cursor = root;
    const { path } = token;

    for (let i = 0; i < path.length - 1; i += 1) {
      const segment = path[i];
      if (typeof cursor[segment] !== 'object' || cursor[segment] === null) {
        cursor[segment] = {};
      }
      cursor = cursor[segment];
    }

    cursor[path[path.length - 1]] = tokenValue(token);
  }

  return root;
}

/**
 * Serializa un valor JS a literal TypeScript indentado.
 * @param {unknown} value
 * @param {number} indent
 */
function serializeTs(value, indent = 0) {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';

    const body = entries
      .map(([key, child]) => `${padIn}${JSON.stringify(key)}: ${serializeTs(child, indent + 1)},`)
      .join('\n');

    return `{\n${body}\n${pad}}`;
  }

  return JSON.stringify(value);
}

/**
 * @param {object} lightTree
 * @param {object} darkTree
 */
function buildTsModule(lightTree, darkTree) {
  return `/**
 * Design tokens — generado por \`build-tokens.mjs\`.
 * No editar a mano; ejecutar \`npm run build:tokens\`.
 */

export const tokens = ${serializeTs(lightTree)} as const;

export const tokensDark = ${serializeTs(darkTree)} as const;

export type Tokens = typeof tokens;
export type TokensDark = typeof tokensDark;
`;
}

/**
 * @param {string} lightBlock
 * @param {string} darkBlock
 */
function buildCssFile(lightBlock, darkBlock) {
  return `/**
 * Design tokens CSS variables — generado por \`build-tokens.mjs\`.
 * Prefijo: --rzz- (kebab-case). Light en :root; dark en [data-theme="dark"].
 * API pública: surface/content/border/action/feedback/space/radius/font/text/leading/shadow/z/duration/ease.
 * primitive queda en dist solo como fuente interna del build.
 * Inter se sirve desde ../fonts/ (copiado por el CLI junto a este archivo).
 * Incluye la utilidad global .visually-hidden (texto solo para lectores de pantalla).
 * No editar a mano; ejecutar \`npm run build:tokens\`.
 */

${buildFontFaces()}

:root {
  color-scheme: light;
${lightBlock}
}

[data-theme="dark"] {
  color-scheme: dark;
${darkBlock}
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
`;
}

async function main() {
  const lightCssDict = await getTransformedDictionary(
    { source: TOKEN_SOURCE_LIGHT },
    'css',
  );

  const darkCssDict = await getTransformedDictionary(
    {
      include: TOKEN_SOURCE_LIGHT,
      source: TOKEN_SOURCE_DARK,
    },
    'css',
  );

  const lightJsDict = await getTransformedDictionary(
    { source: TOKEN_SOURCE_LIGHT },
    'js',
  );

  const darkJsDict = await getTransformedDictionary(
    {
      include: TOKEN_SOURCE_LIGHT,
      source: TOKEN_SOURCE_DARK,
    },
    'js',
  );

  const lightVars = formattedVariables({
    format: 'css',
    dictionary: lightCssDict,
    outputReferences: true,
    usesDtcg: true,
  });

  const darkOverrideTokens = darkCssDict.allTokens.filter(
    (token) => token.isSource && DARK_OVERRIDE_ROOTS.includes(token.path[0]),
  );

  const darkVars = formattedVariables({
    format: 'css',
    dictionary: {
      ...darkCssDict,
      allTokens: darkOverrideTokens,
    },
    outputReferences: true,
    usesDtcg: true,
  });

  const lightTree = nestTokens(lightJsDict.allTokens);
  const darkTree = nestTokens(
    darkJsDict.allTokens.filter(
      (token) => token.isSource && DARK_OVERRIDE_ROOTS.includes(token.path[0]),
    ),
  );

  await mkdir('dist/css', { recursive: true });
  await mkdir('dist/ts', { recursive: true });

  await writeFile(CSS_OUT, buildCssFile(lightVars, darkVars), 'utf8');
  await writeFile(TS_OUT, buildTsModule(lightTree, darkTree), 'utf8');

  console.log(`✔ ${CSS_OUT}`);
  console.log(`✔ ${TS_OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
