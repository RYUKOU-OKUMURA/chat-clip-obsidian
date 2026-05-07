import { safeMatches } from '../shared/dom.js';

const CLAUDE_CODE_BLOCK_GROUP_SELECTOR = '[role="group"]';
const CLAUDE_LABELED_CODE_BLOCK_GROUP_SELECTOR = 'div[role="group"][aria-label="コード"], div[role="group"][aria-label="Code"]';
const CLAUDE_CODE_PRE_SELECTOR = 'pre.code-block__code, pre';
const CLAUDE_BLOCK_CODE_CONTENT_SELECTOR = 'pre.code-block__code code, pre > code';
const CLAUDE_CODE_CONTENT_SELECTOR = `${CLAUDE_BLOCK_CODE_CONTENT_SELECTOR}, code`;

export const CLAUDE_CODE_BLOCK_SELECTOR = [
  CLAUDE_LABELED_CODE_BLOCK_GROUP_SELECTOR,
  'pre.code-block__code',
  'pre > code'
].join(', ');

function hasCodeContent(element) {
  return Boolean(
    safeMatches(element, CLAUDE_BLOCK_CODE_CONTENT_SELECTOR) ||
    safeMatches(element, CLAUDE_CODE_PRE_SELECTOR) ||
    element?.querySelector?.(CLAUDE_BLOCK_CODE_CONTENT_SELECTOR)
  );
}

function findClosestCodeGroup(element) {
  let group = element?.closest?.(CLAUDE_CODE_BLOCK_GROUP_SELECTOR) || null;
  while (group) {
    if (hasCodeContent(group)) return group;
    group = group.parentElement?.closest?.(CLAUDE_CODE_BLOCK_GROUP_SELECTOR) || null;
  }
  return null;
}

export function resolveClaudeCodeBlockRoot(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;

  const group = findClosestCodeGroup(element);
  if (group) return group;

  if (safeMatches(element, CLAUDE_BLOCK_CODE_CONTENT_SELECTOR)) {
    return element.closest?.('pre') || element;
  }
  if (safeMatches(element, CLAUDE_CODE_PRE_SELECTOR)) {
    return element;
  }

  const nestedCode = element.querySelector?.(CLAUDE_CODE_BLOCK_SELECTOR);
  return nestedCode ? resolveClaudeCodeBlockRoot(nestedCode) : null;
}

export function getClaudeCodeContentElement(codeBlockElement) {
  const root = resolveClaudeCodeBlockRoot(codeBlockElement) || codeBlockElement;
  if (safeMatches(root, 'code')) return root;
  if (safeMatches(root, 'pre')) return root.querySelector?.('code') || root;
  return root.querySelector?.(CLAUDE_CODE_CONTENT_SELECTOR) || root;
}

function isLikelyCodeCopyButton(button) {
  if (!button || button.matches?.('.chatvault-save-btn')) return false;
  if (button.closest?.('pre, code')) return false;

  const label = [
    button.getAttribute?.('aria-label') || '',
    button.getAttribute?.('title') || '',
    button.textContent || ''
  ].join(' ');
  return /クリップボードにコピー|コピー|copy/i.test(label);
}

function isPreferredCodeActionButton(button) {
  const parentClass = button.parentElement?.getAttribute?.('class') || '';
  return Boolean(
    button.closest?.('.sticky') ||
    /(^|\s)absolute(\s|$)/.test(parentClass) ||
    /(^|\s)inline-flex(\s|$)/.test(parentClass)
  );
}

export function findClaudeCodeCopyButton(codeBlockRoot) {
  const root = resolveClaudeCodeBlockRoot(codeBlockRoot) || codeBlockRoot;
  const candidates = Array.from(root.querySelectorAll?.('button, [role="button"]') || [])
    .filter(isLikelyCodeCopyButton);

  return candidates.find(isPreferredCodeActionButton) || candidates[0] || null;
}
