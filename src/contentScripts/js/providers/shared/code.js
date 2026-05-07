import { safeMatches } from './dom.js';

export function normalizeCodeText(text, options = {}) {
  const { trimLineEndWhitespace = true } = options;
  let normalized = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n');

  if (trimLineEndWhitespace) {
    normalized = normalized.replace(/[ \t]+\n/g, '\n');
  }

  return normalized
    .replace(/\n{3,}$/g, '\n\n')
    .trim();
}

export function buildFencedCode(text, language = '', options = {}) {
  const { adaptiveFence = true } = options;
  const fenceLanguage = language ? String(language).trim() : '';

  if (!adaptiveFence) {
    return `\`\`\`${fenceLanguage}\n${text}\n\`\`\``;
  }

  const longestBackticks = Math.max(
    2,
    ...Array.from(String(text || '').matchAll(/`+/g), (match) => match[0].length)
  );
  const fence = '`'.repeat(Math.max(3, longestBackticks + 1));
  return `${fence}${fenceLanguage}\n${text}\n${fence}`;
}

export function appendTextWithBreaks(node, chunks, options = {}) {
  const {
    skipSelector = '',
    lineBreakAfterSelector = ''
  } = options;

  if (!node) return;
  if (node.nodeType === Node.TEXT_NODE) {
    chunks.push(node.nodeValue || '');
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node;
  if (skipSelector && safeMatches(element, skipSelector)) {
    return;
  }
  if (element.tagName === 'BR') {
    chunks.push('\n');
    return;
  }

  Array.from(element.childNodes || []).forEach((child) => {
    appendTextWithBreaks(child, chunks, options);
  });

  if (
    lineBreakAfterSelector &&
    safeMatches(element, lineBreakAfterSelector) &&
    chunks[chunks.length - 1] !== '\n'
  ) {
    chunks.push('\n');
  }
}

export function detectCodeLanguageFromClass(element) {
  const candidate = element?.closest?.('[class*="language-"], [class*="lang-"]')
    || element?.querySelector?.('[class*="language-"], [class*="lang-"]')
    || element;
  const className = (candidate?.getAttribute?.('class') || '').toLowerCase();
  const match = className.match(/(?:language|lang)-([a-z0-9+#-]+)/i);
  return match ? match[1] : '';
}
