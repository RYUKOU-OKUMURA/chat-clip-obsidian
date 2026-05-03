// Claude text extraction - DOM-first MVP implementation
import { getSelectors } from './checks.js';
import { toMarkdownIfHtml } from '../../../../utils/markdown.js';
import { createLogger } from '../../../../utils/logger.js';
import { stripServiceTitle } from '../../../../utils/chat/formatting.js';

const log = createLogger('Claude Text DOM');

const DEFAULT_TITLE = 'Claude Chat';
const RENDER_CONTAINER_SELECTOR = '[data-test-render-count]';
const FALLBACK_USER_SELECTOR = '[data-testid="user-message"]';
const FALLBACK_ASSISTANT_SELECTOR = '.font-claude-response';

const NON_CONTENT_SELECTOR = [
  '.chatvault-save-btn',
  '[data-chatvault-ignore]',
  '[data-radix-tooltip-content]',
  '[data-radix-popper-content-wrapper]',
  '[role="tooltip"]',
  '[data-testid="action-bar-copy"]',
  'button',
  'input',
  'select',
  'textarea',
  'svg',
  'script',
  'style',
  'template',
  'noscript'
].join(', ');

function getClaudeSelectors() {
  const selectors = getSelectors() || {};
  const userMessage = selectors.userMessage || FALLBACK_USER_SELECTOR;
  const assistantMessage = selectors.assistantMessage || FALLBACK_ASSISTANT_SELECTOR;

  return {
    renderContainer: RENDER_CONTAINER_SELECTOR,
    userMessage,
    assistantMessage,
    messageContent: `${userMessage}, ${assistantMessage}`,
    candidates: `${RENDER_CONTAINER_SELECTOR}, ${userMessage}, ${assistantMessage}`
  };
}

function safeMatches(element, selector) {
  try {
    return !!(element && element.nodeType === Node.ELEMENT_NODE && element.matches?.(selector));
  } catch (_) {
    return false;
  }
}

function safeQueryAll(root, selector) {
  try {
    return root?.querySelectorAll ? Array.from(root.querySelectorAll(selector)) : [];
  } catch (_) {
    return [];
  }
}

function elementIsHidden(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return true;

  const style = window.getComputedStyle ? window.getComputedStyle(element) : null;
  return !!style && (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.visibility === 'collapse'
  );
}

function isVisibleElement(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;

  let current = element;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    if (elementIsHidden(current)) return false;
    current = current.parentElement;
  }

  return true;
}

function getTitle() {
  return stripServiceTitle(document.title, 'claude', DEFAULT_TITLE);
}

function getTopLevelMessageDescendants(root) {
  const selectors = getClaudeSelectors();
  return safeQueryAll(root, selectors.messageContent)
    .filter(isVisibleElement)
    .filter((element) => {
      const parentMessage = element.parentElement?.closest(selectors.messageContent);
      return !parentMessage || !root.contains(parentMessage);
    });
}

function resolveMessageElement(candidate) {
  if (!candidate || candidate.nodeType !== Node.ELEMENT_NODE || !isVisibleElement(candidate)) {
    return null;
  }

  const selectors = getClaudeSelectors();
  if (
    safeMatches(candidate, selectors.userMessage) ||
    safeMatches(candidate, selectors.assistantMessage)
  ) {
    return candidate;
  }

  const descendants = getTopLevelMessageDescendants(candidate);
  if (descendants.length === 1) {
    return descendants[0];
  }

  if (descendants.length > 1) {
    return null;
  }

  if (safeMatches(candidate, selectors.renderContainer)) {
    const nestedRenderContainer = safeQueryAll(candidate, selectors.renderContainer)
      .find(isVisibleElement);
    return nestedRenderContainer ? null : candidate;
  }

  return candidate;
}

function getContentElement(messageElement) {
  const resolved = resolveMessageElement(messageElement) || messageElement;
  const selectors = getClaudeSelectors();

  if (
    safeMatches(resolved, selectors.userMessage) ||
    safeMatches(resolved, selectors.assistantMessage)
  ) {
    return resolved;
  }

  const descendants = getTopLevelMessageDescendants(resolved);
  return descendants.length === 1 ? descendants[0] : resolved;
}

function getRole(messageElement) {
  const contentElement = getContentElement(messageElement);
  const selectors = getClaudeSelectors();

  if (
    safeMatches(contentElement, selectors.userMessage) ||
    safeQueryAll(contentElement, selectors.userMessage).some(isVisibleElement)
  ) {
    return 'user';
  }

  return 'assistant';
}

function shouldSkipElement(element) {
  return !isVisibleElement(element) || safeMatches(element, NON_CONTENT_SELECTOR);
}

function cloneVisibleContent(node) {
  if (!node) return null;

  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent || '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE || shouldSkipElement(node)) {
    return null;
  }

  const clone = node.cloneNode(false);
  Array.from(node.childNodes || []).forEach((child) => {
    const childClone = cloneVisibleContent(child);
    if (childClone) clone.appendChild(childClone);
  });

  return clone;
}

function normalizeContent(content) {
  return (content || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

function extractContentFromElement(messageElement) {
  const contentElement = getContentElement(messageElement);
  const visibleClone = cloneVisibleContent(contentElement);

  if (!visibleClone) return '';

  const html = (visibleClone.innerHTML || '').trim();
  const text = (visibleClone.textContent || '').trim();
  const content = html ? toMarkdownIfHtml(html) : text;

  return normalizeContent(content || text);
}

function compareDomOrder(a, b) {
  if (a === b) return 0;
  const position = a.compareDocumentPosition(b);
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  return 0;
}

function collectMessageElements() {
  const selectors = getClaudeSelectors();
  const selected = [];
  const seen = new Set();

  safeQueryAll(document, selectors.candidates).forEach((candidate) => {
    const messageElement = resolveMessageElement(candidate);
    if (!messageElement || seen.has(messageElement) || !isVisibleElement(messageElement)) {
      return;
    }

    const hasSelectedAncestor = selected.some((existing) => existing.contains(messageElement));
    if (hasSelectedAncestor) {
      return;
    }

    for (let index = selected.length - 1; index >= 0; index -= 1) {
      if (messageElement.contains(selected[index])) {
        seen.delete(selected[index]);
        selected.splice(index, 1);
      }
    }

    seen.add(messageElement);
    selected.push(messageElement);
  });

  return selected.sort(compareDomOrder);
}

export function extractSingleMessage(messageElement) {
  try {
    const role = getRole(messageElement);
    const content = extractContentFromElement(messageElement);
    const title = getTitle();

    return { role, content, title };
  } catch (error) {
    log.error('Claude DOM message extraction failed:', error);

    const text = normalizeContent(messageElement?.textContent || messageElement?.innerText || '');
    const role = getRole(messageElement);
    const title = getTitle();

    return { role, content: text, title };
  }
}

export function captureMessages(mode = 'all', count = null) {
  try {
    const allMessages = collectMessageElements()
      .map((messageElement) => {
        const extracted = extractSingleMessage(messageElement);
        return {
          speaker: extracted.role === 'user' ? 'User' : 'Assistant',
          content: extracted.content
        };
      })
      .filter((message) => message.content);

    let messages = allMessages;
    if (mode === 'recent' && Number(count) > 0) {
      messages = allMessages.slice(-Number(count));
    } else if (mode === 'selected') {
      messages = allMessages;
    } else if (mode !== 'all' && mode !== 'recent') {
      throw new Error('Invalid capture mode: ' + mode);
    }

    if (!messages.length) {
      return {
        success: false,
        messages: [],
        title: getTitle(),
        service: 'claude',
        error: 'No messages were extracted',
        errorCode: 'EMPTY_CONTENT'
      };
    }

    return {
      success: true,
      messages,
      title: getTitle(),
      service: 'claude'
    };
  } catch (error) {
    log.error('Claude DOM message capture failed:', error);

    return {
      success: false,
      messages: [],
      title: getTitle(),
      service: 'claude',
      error: error.message
    };
  }
}
