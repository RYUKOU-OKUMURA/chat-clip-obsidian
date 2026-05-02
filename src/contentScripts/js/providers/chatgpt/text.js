// ChatGPT text extraction
import { getSelectors } from './checks.js';
import { toMarkdownIfHtml } from './markdown.js';

export function extractSingleMessage(messageElement) {
  try {
    const selectors = getSelectors();
    let contentEl = messageElement.querySelector(selectors.content) || messageElement;
    const cloned = contentEl.cloneNode(true);
    cloned.querySelectorAll && cloned.querySelectorAll('.chatvault-save-btn').forEach(el => el.remove());
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
  const allMessages = Array.from(document.querySelectorAll(selectors.container)).map((msg) => {
    const contentEl = msg.querySelector(selectors.content) || msg;
    // Determine role by matching self or descendant to handle wrapper containers
    const isUser = msg.matches?.(selectors.userMessage) || !!msg.querySelector?.(selectors.userMessage);
    const html = contentEl ? contentEl.innerHTML : '';
    return {
      speaker: isUser ? 'User' : 'Assistant',
      content: html ? toMarkdownIfHtml(html) : (contentEl?.textContent?.trim() || '')
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
