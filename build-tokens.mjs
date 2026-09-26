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
    // Append after group so DTCG duration objects become `120ms`.
    const groupTransforms =
      StyleDictionary.hooks.transformGroups[transformGroups.css] ?? [];
    platformConfig.transforms = [...groupTransforms, 'rzz/duration/css'];
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
 * No editar a mano; ejecutar \`npm run build:tokens\`.
 */

:root {
${lightBlock}
}

[data-theme="dark"] {
${darkBlock}
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
