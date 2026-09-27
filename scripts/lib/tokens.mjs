/**
 * Carga, valida y resuelve tokens DTCG de tokens/*.json sin Style Dictionary.
 * Lo usan build-tokens.mjs (fail-fast antes de compilar) y check-contrast.mjs.
 */
import { readFile } from 'node:fs/promises';

export const TOKEN_FILE_LIGHT = 'tokens/tokens.json';
export const TOKEN_FILE_DARK = 'tokens/tokens.dark.json';

/** Raíces que build-tokens.mjs emite en [data-theme="dark"]; el resto del dark se ignoraría. */
export const DARK_OVERRIDE_ROOTS = ['surface', 'content', 'border', 'action', 'feedback', 'shadow'];

const KNOWN_KEYS = new Set(['$value', '$type', '$description', '$extensions', '$deprecated', '$schema']);
const TYPES = new Set(['color', 'dimension', 'duration', 'number', 'cubicBezier', 'shadow', 'fontFamily', 'fontWeight']);
const DIMENSION_UNITS = new Set(['px', 'rem']);
const DURATION_UNITS = new Set(['ms', 's']);
const REF = /^\{([^{}]+)\}$/;
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * @typedef {{ path: string, type: string | undefined, value: unknown, file: string }} FlatToken
 */

export async function readTokenFile(file) {
  const raw = await readFile(file, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${file}: JSON inválido (${error.message})`);
  }
}

/**
 * Aplana el árbol DTCG a Map<path, token>, heredando $type de los grupos.
 * @param {object} tree
 * @param {string} file
 * @param {string[]} errors
 * @returns {Map<string, FlatToken>}
 */
export function flattenTokens(tree, file, errors = []) {
  /** @type {Map<string, FlatToken>} */
  const out = new Map();

  const walk = (node, segments, inheritedType) => {
    const where = segments.join('.') || '(raíz)';
    for (const key of Object.keys(node)) {
      if (key.startsWith('$') && !KNOWN_KEYS.has(key)) {
        errors.push(`${file} › ${where}: propiedad desconocida "${key}" (¿$value/$type mal escrito?)`);
      }
    }
    const type = node.$type ?? inheritedType;
    if (node.$type !== undefined && !TYPES.has(node.$type)) {
      errors.push(`${file} › ${where}: $type "${node.$type}" no soportado`);
    }

    if ('$value' in node) {
      out.set(where, { path: where, type, value: node.$value, file });
      return;
    }

    const children = Object.entries(node).filter(
      ([key, child]) => !key.startsWith('$') && child !== null && typeof child === 'object',
    );
    if (segments.length > 0 && children.length === 0) {
      errors.push(`${file} › ${where}: grupo vacío o token sin $value`);
    }
    for (const [key, child] of children) walk(child, [...segments, key], type);
  };

  walk(tree, [], undefined);
  return out;
}

/** Todas las referencias {a.b.c} dentro de un valor (strings, arrays, objetos). */
function collectRefs(value, refs = []) {
  if (typeof value === 'string') {
    const match = value.match(REF);
    if (match) refs.push(match[1]);
    else if (value.includes('{') && /\{[^}]*\}/.test(value)) refs.push(...[...value.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]));
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectRefs(item, refs));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectRefs(item, refs));
  }
  return refs;
}

const isRef = (value) => typeof value === 'string' && REF.test(value);
const isNum = (value) => typeof value === 'number' && Number.isFinite(value);

/**
 * @param {unknown} value
 * @returns {string | null} motivo del error o null si es válido
 */
function checkColor(value) {
  if (isRef(value)) return null;
  if (typeof value === 'string') return HEX.test(value) ? null : `color "${value}" no es un HEX válido (#rgb, #rrggbb o #rrggbbaa)`;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'color debe ser objeto DTCG, HEX o referencia';
  const { colorSpace, components, alpha, hex } = /** @type {any} */ (value);
  if (colorSpace !== 'srgb') return `colorSpace "${colorSpace}" no soportado (solo srgb)`;
  if (!Array.isArray(components) || components.length !== 3 || !components.every((c) => isNum(c) && c >= 0 && c <= 1)) {
    return `components ${JSON.stringify(components)} deben ser 3 números entre 0 y 1`;
  }
  if (alpha !== undefined && !(isNum(alpha) && alpha >= 0 && alpha <= 1)) return `alpha ${JSON.stringify(alpha)} debe estar entre 0 y 1`;
  if (hex !== undefined) {
    if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return `hex "${hex}" mal formado (se esperaba #rrggbb)`;
    const bytes = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    if (bytes.some((byte, i) => Math.abs(byte - components[i] * 255) > 1)) {
      return `hex ${hex} no coincide con components ${JSON.stringify(components)}`;
    }
  }
  return null;
}

function checkUnitValue(value, units, label) {
  if (isRef(value)) return null;
  if (typeof value === 'string') return `${label} "${value}" es un string suelto; DTCG exige { "value": número, "unit": ${[...units].map((u) => `"${u}"`).join(' | ')} }`;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return `${label} debe ser { value, unit } o referencia`;
  const { value: amount, unit } = /** @type {any} */ (value);
  if (!isNum(amount)) return `${label}.value ${JSON.stringify(amount)} debe ser número`;
  if (!units.has(unit)) return `${label}.unit ${JSON.stringify(unit)} no válido (${[...units].join(', ')})`;
  return null;
}

function checkShadowLayer(layer) {
  if (isRef(layer)) return null;
  if (!layer || typeof layer !== 'object' || Array.isArray(layer)) return 'cada sombra debe ser objeto';
  const color = checkColor(layer.color);
  if (color) return `color: ${color}`;
  for (const key of ['offsetX', 'offsetY', 'blur', 'spread']) {
    const problem = checkUnitValue(layer[key], DIMENSION_UNITS, key);
    if (problem) return problem;
  }
  if (layer.inset !== undefined && typeof layer.inset !== 'boolean') return 'inset debe ser boolean';
  return null;
}

/**
 * @param {FlatToken} token
 * @returns {string | null}
 */
function checkValue(token) {
  const { type, value } = token;
  switch (type) {
    case 'color':
      return checkColor(value);
    case 'dimension':
      return checkUnitValue(value, DIMENSION_UNITS, 'dimension');
    case 'duration':
      return checkUnitValue(value, DURATION_UNITS, 'duration');
    case 'number':
    case 'fontWeight':
      return isRef(value) || isNum(value) ? null : `${type} ${JSON.stringify(value)} debe ser número`;
    case 'cubicBezier':
      if (isRef(value)) return null;
      return Array.isArray(value) && value.length === 4 && value.every(isNum) && value[0] >= 0 && value[0] <= 1 && value[2] >= 0 && value[2] <= 1
        ? null
        : `cubicBezier ${JSON.stringify(value)} debe ser [x1, y1, x2, y2] con x en [0, 1]`;
    case 'shadow':
      if (isRef(value)) return null;
      for (const layer of Array.isArray(value) ? value : [value]) {
        const problem = checkShadowLayer(layer);
        if (problem) return `shadow ${problem}`;
      }
      return null;
    case 'fontFamily':
      return isRef(value) || typeof value === 'string' || (Array.isArray(value) && value.every((f) => typeof f === 'string'))
        ? null
        : 'fontFamily debe ser string o array de strings';
    case undefined:
      return typeof value === 'string' ? null : 'token sin $type: solo se admiten strings (p. ej. linear()) o referencias';
    default:
      return null;
  }
}

/**
 * Valida un set de tokens: valores por tipo, referencias rotas, ciclos y tipo del destino.
 * @param {Map<string, FlatToken>} tokens  set completo visible (light, o light + dark)
 * @param {Iterable<FlatToken>} [subject]  tokens a revisar (default: todos)
 * @param {string[]} errors
 */
export function validateTokenSet(tokens, subject = tokens.values(), errors = []) {
  for (const token of subject) {
    const where = `${token.file} › ${token.path}`;
    const problem = checkValue(token);
    if (problem) errors.push(`${where}: ${problem}`);

    for (const ref of collectRefs(token.value)) {
      const target = tokens.get(ref);
      if (!target) {
        errors.push(`${where}: referencia rota {${ref}} (no existe ese token)`);
        continue;
      }
      if (token.type && target.type && token.type !== target.type && isRef(token.value)) {
        errors.push(`${where}: es ${token.type} pero {${ref}} es ${target.type}`);
      }
      const chain = [token.path];
      let cursor = target;
      while (cursor && isRef(cursor.value)) {
        if (chain.includes(cursor.path)) {
          errors.push(`${where}: referencia circular ${[...chain, cursor.path].join(' → ')}`);
          break;
        }
        chain.push(cursor.path);
        cursor = tokens.get(cursor.value.match(REF)[1]);
      }
    }
  }
  return errors;
}

/**
 * Lee y valida light + dark. Devuelve los sets aplanados y la lista de errores.
 */
export async function loadAndValidateTokens(lightFile = TOKEN_FILE_LIGHT, darkFile = TOKEN_FILE_DARK) {
  const errors = [];
  const light = flattenTokens(await readTokenFile(lightFile), lightFile, errors);
  const darkOnly = flattenTokens(await readTokenFile(darkFile), darkFile, errors);

  validateTokenSet(light, light.values(), errors);

  for (const token of darkOnly.values()) {
    const root = token.path.split('.')[0];
    if (!DARK_OVERRIDE_ROOTS.includes(root)) {
      errors.push(`${darkFile} › ${token.path}: "${root}" no es una raíz con override dark (${DARK_OVERRIDE_ROOTS.join(', ')}); el build lo ignoraría`);
    } else if (!light.has(token.path)) {
      errors.push(`${darkFile} › ${token.path}: no existe en ${lightFile}; un override dark debe pisar un token light`);
    }
  }
  const dark = new Map([...light, ...darkOnly]);
  validateTokenSet(dark, darkOnly.values(), errors);

  return { light, dark, errors };
}

/**
 * Resuelve un token de color a { r, g, b, a } (0-255, alpha 0-1) siguiendo referencias.
 * @param {Map<string, FlatToken>} tokens
 * @param {string} path
 */
export function resolveColor(tokens, path) {
  let token = tokens.get(path);
  const seen = new Set();
  while (token && isRef(token.value)) {
    if (seen.has(token.path)) throw new Error(`referencia circular en ${path}`);
    seen.add(token.path);
    token = tokens.get(token.value.match(REF)[1]);
  }
  if (!token) throw new Error(`token de color inexistente: ${path}`);
  return parseColor(token.value, path);
}

/**
 * @param {unknown} value  objeto DTCG srgb o string HEX
 * @param {string} [label]
 */
export function parseColor(value, label = 'color') {
  if (typeof value === 'string') {
    if (!HEX.test(value)) throw new Error(`${label}: "${value}" no es HEX válido`);
    let hex = value.slice(1);
    if (hex.length <= 4) hex = [...hex].map((c) => c + c).join('');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  const { components, alpha = 1 } = /** @type {any} */ (value);
  const [r, g, b] = components.map((c) => Math.round(c * 255));
  return { r, g, b, a: alpha };
}
