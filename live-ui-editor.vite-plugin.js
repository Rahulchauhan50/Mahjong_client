// Live UI Editor Vite plugin.
// Injects stable data-lui attributes into JSX DOM elements before React transform.
// The important part is that the payload file path is resolved against Vite's
// actual project root. Without this, Vite can pass ids like /src/main.jsx and
// Live UI Editor treats the element source as outside the app root, which makes
// Pick CSS fail with: "CSS target must be within the app root folder."

import { Buffer } from 'node:buffer';
import path from 'node:path';

function base64UrlEncode(value) {
  return Buffer.from(String(value), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function normalizeSlashes(value) {
  return String(value || '').replace(/\\/g, '/');
}

function stripViteIdDecorations(id) {
  let clean = normalizeSlashes(String(id || '').split('?')[0]);

  // Vite sometimes prefixes filesystem ids with /@fs/.
  clean = clean.replace(/^\/@fs\//, '');

  // Some tools use file:// URIs.
  clean = clean.replace(/^file:\/\/\//, '');

  // On Windows, Vite ids may be /C:/path/file.jsx. Node's path.resolve on
  // Windows can turn that into C:\C:\path..., so strip the leading slash.
  clean = clean.replace(/^\/([A-Za-z]:\/)/, '$1');

  return clean;
}

function isWindowsAbsolute(value) {
  return /^[A-Za-z]:\//.test(value);
}

function normalizeFile(id, root) {
  const clean = stripViteIdDecorations(id);
  const rootClean = stripViteIdDecorations(root || process.cwd());

  let absolutePath;

  if (isWindowsAbsolute(clean) || path.isAbsolute(clean)) {
    absolutePath = clean;
  } else {
    // Resolve relative/Vite-root ids such as src/App.jsx or /src/App.jsx
    // inside the real project root, not inside C:\src or process cwd.
    absolutePath = path.join(rootClean, clean.replace(/^\/+/, ''));
  }

  return path.normalize(absolutePath);
}

function getLineColumn(code, index) {
  let line = 1;
  let column = 1;

  for (let i = 0; i < index; i += 1) {
    if (code.charCodeAt(i) === 10) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

function isTagStartChar(char) {
  return /[A-Za-z]/.test(char || '');
}

function isTagNameChar(char) {
  return /[A-Za-z0-9:._-]/.test(char || '');
}

function isLowercaseDomTag(tagName) {
  return /^[a-z]/.test(tagName);
}

function findOpeningTagEnd(code, startIndex) {
  let quote = null;
  let braceDepth = 0;

  for (let i = startIndex; i < code.length; i += 1) {
    const char = code[i];
    const prev = code[i - 1];

    if (quote) {
      if (char === quote && prev !== '\\') quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '{') {
      braceDepth += 1;
      continue;
    }

    if (char === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }

    if (char === '>' && braceDepth === 0) return i;
  }

  return -1;
}

function injectStableIds(code, id, root) {
  let output = '';
  let lastCopiedIndex = 0;
  let counter = 0;
  let state = 'normal';

  for (let i = 0; i < code.length; i += 1) {
    const char = code[i];
    const next = code[i + 1];
    const prev = code[i - 1];

    if (state === 'line-comment') {
      if (char === '\n') state = 'normal';
      continue;
    }

    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        state = 'normal';
        i += 1;
      }
      continue;
    }

    if (state === 'single-quote') {
      if (char === "'" && prev !== '\\') state = 'normal';
      continue;
    }

    if (state === 'double-quote') {
      if (char === '"' && prev !== '\\') state = 'normal';
      continue;
    }

    if (state === 'template') {
      if (char === '`' && prev !== '\\') state = 'normal';
      continue;
    }

    if (char === '/' && next === '/') {
      state = 'line-comment';
      i += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      state = 'block-comment';
      i += 1;
      continue;
    }

    if (char === "'") {
      state = 'single-quote';
      continue;
    }

    if (char === '"') {
      state = 'double-quote';
      continue;
    }

    if (char === '`') {
      state = 'template';
      continue;
    }

    if (char !== '<') continue;

    if (next === '/' || next === '>' || next === '!' || next === '?' || !isTagStartChar(next)) continue;

    let tagNameEnd = i + 1;
    while (tagNameEnd < code.length && isTagNameChar(code[tagNameEnd])) tagNameEnd += 1;

    const tagName = code.slice(i + 1, tagNameEnd);
    if (!isLowercaseDomTag(tagName)) continue;

    const tagEnd = findOpeningTagEnd(code, tagNameEnd);
    if (tagEnd === -1) continue;

    const openingTagSource = code.slice(i, tagEnd + 1);
    if (/\sdata-lui\s*=/.test(openingTagSource)) {
      i = tagEnd;
      continue;
    }

    counter += 1;
    const { line, column } = getLineColumn(code, i);
    const payload = JSON.stringify({
      f: normalizeFile(id, root),
      l: line,
      c: column,
      n: counter,
    });
    const attr = ` data-lui="lui:${base64UrlEncode(payload)}"`;

    output += code.slice(lastCopiedIndex, tagNameEnd) + attr;
    lastCopiedIndex = tagNameEnd;
    i = tagEnd;
  }

  if (counter === 0) return null;
  output += code.slice(lastCopiedIndex);
  return output;
}

export default function liveUiEditorStableIds() {
  let root = process.cwd();

  return {
    name: 'live-ui-editor-stable-ids',
    enforce: 'pre',
    configResolved(config) {
      root = config.root || process.cwd();
      console.log(`[live-ui-editor] app root: ${path.normalize(root)}`);
    },
    transform(code, id) {
      const cleanId = stripViteIdDecorations(id);
      if (cleanId.includes('/node_modules/')) return null;
      if (!/\.(jsx|tsx)$/.test(cleanId)) return null;
      if (!code.includes('<')) return null;

      const transformed = injectStableIds(code, id, root);
      if (!transformed) return null;

      return {
        code: transformed,
        map: null,
      };
    },
  };
}
