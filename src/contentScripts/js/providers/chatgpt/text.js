// ChatGPT text extraction
import { getSelectors } from './checks.js';
import { toMarkdownIfHtml } from './markdown.js';

function getContentElement(messageElement) {
  const selectors = getSelectors();
  if (messageElement.matches?.(selectors.content)) return messageElement;
  return messageElement.querySelector?.(selectors.content) || messageElement;
}

function cleanClone(element) {
  const cloned = element.cloneNode(true);
  cloned.querySelectorAll && cloned.querySelectorAll([
    '.chatvault-save-btn',
    '.chatvault-inline-actions',
    '[data-testid="turn-actions"]',
    '[data-testid="copy-turn-action-button"]',
    'button'
  ].join(', ')).forEach(el => el.remove());
  return cloned;
}

function resolveCaptureRoot(element) {
  if (element.matches?.('[data-message-author-role]')) return element;
  return element.querySelector?.('[data-message-author-role]') || element;
}

function getCaptureElements() {
  const selectors = getSelectors();
  const seen = new Set();
  return Array.from(document.querySelectorAll(selectors.container))
    .map(resolveCaptureRoot)
    .filter((element) => {
      if (!element || seen.has(element)) return false;
      seen.add(element);
      return true;
    });
}

export function extractSingleMessage(messageElement) {
  try {
    let contentEl = getContentElement(messageElement);
    const cloned = cleanClone(contentEl);
    const html = (cloned.innerHTML || '').trim();
    const raw = html || (cloned.textContent || '').trim();
    const content = html ? toMarkdownIfHtml(html) : raw;

    // Determine role from self or descendants to support wrapper containers
    let roleAttr = messageElement.getAttribute('data-message-author-role');
    if (!roleAttr) {
      const roleEl = messageElement.querySelector('[data-message-author-role]');
      roleAttr = roleEl ? roleEl.getAttribute('data-message-author-role') : null;
    }
    const isUser = roleAttr === 'user';
    const role = isUser ? 'user' : 'assistant';
    const title = document.title
      .replace(' | Claude', '')
      .replace(' - ChatGPT', '')
      .replace(' | ChatGPT', '');

    return { role, content, title };
  } catch (_) {
    const text = messageElement.textContent || messageElement.innerText || '';
    let roleAttr = messageElement.getAttribute('data-message-author-role');
    if (!roleAttr) {
      const roleEl = messageElement.querySelector('[data-message-author-role]');
      roleAttr = roleEl ? roleEl.getAttribute('data-message-author-role') : null;
    }
    const isUser = roleAttr === 'user';
    const role = isUser ? 'user' : 'assistant';
    const title = document.title.replace(' | ChatGPT', '').replace(' - ChatGPT', '');
    return { role, content: text, title };
  }
}

export function captureMessages(mode, count = null) {
  const selectors = getSelectors();
  const allMessages = getCaptureElements().map((msg) => {
    const contentEl = getContentElement(msg);
    // Determine role by matching self or descendant to handle wrapper containers
    const isUser = msg.matches?.(selectors.userMessage) || !!msg.querySelector?.(selectors.userMessage);
    const cloned = contentEl ? cleanClone(contentEl) : null;
    const html = cloned ? cloned.innerHTML : '';
    return {
      speaker: isUser ? 'User' : 'Assistant',
      content: html ? toMarkdownIfHtml(html) : (cloned?.textContent?.trim() || '')
    };
  });

  let messages = allMessages;
  if (mode === 'recent' && count) {
    messages = allMessages.slice(-count);
  } else if (mode === 'selected') {
    messages = allMessages;
  } else if (mode !== 'all' && mode !== 'recent') {
    throw new Error('無効なキャプチャモード: ' + mode);
  }

  const title = document.title
    .replace(' | Claude', '')
    .replace(' - ChatGPT', '')
    .replace(' | ChatGPT', '');

  return { success: true, messages, title, service: 'chatgpt' };
}
