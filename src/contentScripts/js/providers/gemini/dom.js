import { safeMatches } from '../shared/dom.js';

export const GEMINI_CODE_BLOCK_SELECTOR = [
  'code-block',
  '.code-block'
].join(', ');

const GEMINI_CODE_CONTENT_SELECTOR = 'code[data-test-id="code-content"], pre > code';
const GEMINI_CODE_HEADER_SELECTOR = '.code-block-decoration.header-formatted, .code-block-decoration';
const GEMINI_CODE_BUTTONS_SELECTOR = `${GEMINI_CODE_HEADER_SELECTOR} .buttons`;

function hasCodeContent(element) {
  return Boolean(
    safeMatches(element, GEMINI_CODE_CONTENT_SELECTOR) ||
    element?.querySelector?.(GEMINI_CODE_CONTENT_SELECTOR)
  );
}

export function resolveGeminiCodeBlockRoot(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;

  const host = element.closest?.('code-block');
  if (host && hasCodeContent(host)) return host;

  const container = element.closest?.('.code-block');
  if (container && hasCodeContent(container)) return container;

  if (safeMatches(element, GEMINI_CODE_BLOCK_SELECTOR) && hasCodeContent(element)) {
    return element;
  }

  const nested = element.querySelector?.(GEMINI_CODE_BLOCK_SELECTOR);
  return nested ? resolveGeminiCodeBlockRoot(nested) : null;
}

export function getGeminiCodeContentElement(codeBlockElement) {
  const root = resolveGeminiCodeBlockRoot(codeBlockElement) || codeBlockElement;
  if (safeMatches(root, 'code')) return root;
  return root?.querySelector?.(GEMINI_CODE_CONTENT_SELECTOR) || root;
}

export function getGeminiCodeLanguageLabel(codeBlockElement) {
  const root = resolveGeminiCodeBlockRoot(codeBlockElement) || codeBlockElement;
  const header = root?.querySelector?.(GEMINI_CODE_HEADER_SELECTOR);
  const label = header?.querySelector?.('span')?.textContent || '';
  return label.trim();
}

export function normalizeGeminiCodeLanguage(label) {
  const normalized = String(label || '').trim().toLowerCase();
  if (!normalized || normalized === 'plaintext' || normalized === 'plain text') return 'text';

  const languageMap = {
    'c++': 'cpp',
    'c#': 'csharp',
    'f#': 'fsharp',
    'js': 'javascript',
    'md': 'markdown',
    'py': 'python',
    'shell': 'bash',
    'sh': 'bash',
    'ts': 'typescript',
    'yml': 'yaml'
  };

  return languageMap[normalized] || normalized.replace(/\s+/g, '-');
}

export function findGeminiCodeActionContainer(codeBlockRoot) {
  const root = resolveGeminiCodeBlockRoot(codeBlockRoot) || codeBlockRoot;
  const copyButton = findGeminiCodeCopyButton(root);
  const copyButtonsContainer = copyButton?.closest?.('.buttons') || null;
  if (copyButtonsContainer) {
    return { container: copyButtonsContainer, copyButton, native: true };
  }

  const container = root?.querySelector?.(GEMINI_CODE_BUTTONS_SELECTOR);
  if (container) {
    return { container, copyButton: null, native: true };
  }

  return { container: null, copyButton: null, native: false };
}

export function findGeminiCodeCopyButton(codeBlockRoot) {
  const root = resolveGeminiCodeBlockRoot(codeBlockRoot) || codeBlockRoot;
  const candidates = Array.from(root?.querySelectorAll?.('button, [role="button"]') || []);

  return candidates.find((button) => {
    if (button.matches?.('.chatvault-save-btn')) return false;
    if (button.closest?.('pre, code')) return false;
    if (button.matches?.('.copy-button')) return true;
    if (button.querySelector?.('[fonticon="content_copy"], [data-mat-icon-name="content_copy"]')) return true;

    const label = [
      button.getAttribute?.('aria-label') || '',
      button.getAttribute?.('mattooltip') || '',
      button.getAttribute?.('title') || '',
      button.textContent || ''
    ].join(' ');
    return /コードをコピー|コピー|copy/i.test(label);
  }) || null;
}
