// ChatGPT UI-related helpers (button placement, etc.)
import { getSelectors } from './checks.js';
import { createFallbackActionContainer, isVisibleElement } from '../shared/dom.js';

const MESSAGE_SAVE_BUTTON_SELECTOR = '.chatvault-save-btn:not([data-chatvault-save-kind="code-block"])';
const CODE_SAVE_BUTTON_SELECTOR = '.chatvault-save-btn[data-chatvault-save-kind="code-block"]';

// グローバルでツールチップを管理
let globalTooltip = null;

function inlineButtonsEnabled() {
  return window.__CHATVAULT_SHOW_SAVE_BUTTON__ !== false;
}

/**
 * ChatGPT用の保存ボタンを作成
 * @returns {HTMLElement} 保存ボタン要素
 */
function createSaveButton() {
  const button = document.createElement('button');
  button.className = 'chatvault-save-btn text-token-text-secondary';
  button.setAttribute('data-chatvault-save-kind', 'message');
  button.style.cssText = `
    background-color: transparent;
    color: rgb(243, 243, 243);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
  `;
  button.setAttribute('aria-label', 'Save to Obsidian');
  button.setAttribute('data-tooltip', 'Save to Obsidian');
  button.setAttribute('data-state', 'closed');
  button.innerHTML = `
      <span class="flex items-center justify-center touch:w-10 h-8 w-8">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
      </span>
    `;
  
  // 既存のツールチップがあれば削除
  if (globalTooltip && globalTooltip.parentNode) {
    globalTooltip.remove();
  }
  
  // ツールチップ要素を作成
  globalTooltip = document.createElement('div');
  globalTooltip.className = 'chatvault-tooltip';
  globalTooltip.setAttribute('data-radix-popper-content-wrapper', '');
  globalTooltip.style.cssText = `
    position: fixed;
    left: 0px;
    top: 0px;
    transform: translate(0px, 0px);
    min-width: max-content;
    --radix-popper-transform-origin: 50% 0px;
    z-index: 50;
    --radix-popper-available-width: 1167px;
    --radix-popper-available-height: 194px;
    --radix-popper-anchor-width: 32px;
    --radix-popper-anchor-height: 32px;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s ease;
    pointer-events: none;
  `;
  globalTooltip.innerHTML = `
    <div style="
      background-color: #000000;
      color: #ffffff;
      padding: 4px 8px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      line-height: 1.4;
      letter-spacing: 0.025em;
    ">
      Obsidianに保存する
    </div>
  `;
  
  // body直下にツールチップを追加
  document.body.appendChild(globalTooltip);
  
  // ホバー時の背景色変更
  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    button.style.color = 'rgb(255, 255, 255)';
    button.setAttribute('data-state', 'delayed-open');
    
    // ツールチップの位置を計算
    const rect = button.getBoundingClientRect();
    const tooltipRect = globalTooltip.getBoundingClientRect();
    
    // ボタンの下に表示
    globalTooltip.style.transform = `translate(${rect.left + rect.width / 2 - tooltipRect.width / 2}px, ${rect.bottom + 8}px)`;
    globalTooltip.style.opacity = '1';
    globalTooltip.style.visibility = 'visible';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = 'transparent';
    button.style.color = 'rgb(243, 243, 243)';
    button.setAttribute('data-state', 'closed');
    if (globalTooltip) {
      globalTooltip.style.opacity = '0';
      globalTooltip.style.visibility = 'hidden';
    }
  });
  
  return button;
}

function createCodeBlockSaveButton() {
  const button = createSaveButton();
  button.className = 'chatvault-save-btn chatvault-code-save-btn';
  button.setAttribute('type', 'button');
  button.setAttribute('data-chatvault-save-kind', 'code-block');
  button.setAttribute('aria-label', 'Save code block to Obsidian');
  button.setAttribute('data-tooltip', 'Save code block to Obsidian');
  button.style.backgroundColor = 'transparent';
  button.style.color = 'rgb(255, 255, 255)';
  button.style.display = 'inline-flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.pointerEvents = 'auto';
  button.style.marginLeft = '0';
  button.style.marginRight = '0';
  button.style.padding = '0';
  button.style.width = '36px';
  button.style.height = '36px';
  button.style.lineHeight = '0';
  button.style.position = 'static';
  button.style.transform = 'none';
  button.innerHTML = `
    <svg class="chatvault-code-save-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" style="display:block;width:20px;height:20px;flex:0 0 auto;pointer-events:none;">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"></path>
      <polyline points="17 21 17 13 7 13 7 21"></polyline>
      <polyline points="7 3 7 8 15 8"></polyline>
    </svg>
  `;
  return button;
}

function getContentElement(messageElement) {
  const selectors = getSelectors();
  if (messageElement.matches?.(selectors.content)) return messageElement;
  return messageElement.querySelector?.(selectors.content) || messageElement;
}

function hasMessageContent(messageElement) {
  const contentElement = getContentElement(messageElement);
  return Boolean((contentElement?.textContent || '').trim());
}

function isAssistantMessageRoot(messageElement) {
  return messageElement?.getAttribute?.('data-message-author-role') === 'assistant';
}

function findBestMessageInTurn(turnElement) {
  if (!turnElement) return null;
  const candidates = [];
  if (turnElement.matches?.('[data-message-author-role]')) {
    candidates.push(turnElement);
  }
  candidates.push(...Array.from(turnElement.querySelectorAll?.('[data-message-author-role]') || []));

  const visibleCandidates = candidates.filter((candidate) => isVisibleElement(candidate) && hasMessageContent(candidate));
  const assistantMessages = visibleCandidates.filter((candidate) => candidate.getAttribute('data-message-author-role') === 'assistant');
  return assistantMessages[assistantMessages.length - 1] || visibleCandidates[visibleCandidates.length - 1] || null;
}

function getConversationTurn(element) {
  return element.closest?.('[data-testid^="conversation-turn-"], .conversation-turn') || null;
}

function resolveMessageRoot(messageElement) {
  const selectors = getSelectors();
  const turn = getConversationTurn(messageElement);
  if (turn) {
    return findBestMessageInTurn(turn) || messageElement.closest?.(selectors.container) || messageElement;
  }
  if (messageElement.matches?.(selectors.container)) return messageElement;
  return messageElement.closest?.(selectors.container)
    || messageElement.querySelector?.(selectors.container)
    || messageElement;
}

function getButtonScope(messageRoot) {
  return getConversationTurn(messageRoot) || messageRoot;
}

function findActionContainer(messageRoot) {
  const scope = getButtonScope(messageRoot);
  const copyButton = scope.querySelector?.('[data-testid="copy-turn-action-button"]')
    || messageRoot.querySelector?.('[data-testid="copy-turn-action-button"]');
  return copyButton?.parentElement || null;
}

function getFallbackAnchor(messageRoot) {
  const contentElement = getContentElement(messageRoot);
  return contentElement && contentElement !== messageRoot && messageRoot.contains(contentElement)
    ? contentElement
    : null;
}

function getFallbackActionContainer(messageRoot) {
  return createFallbackActionContainer(messageRoot, getFallbackAnchor(messageRoot), {
    justifyContent: 'flex-start'
  });
}

function cleanupEmptyFallbackContainers(root) {
  root.querySelectorAll?.('.chatvault-inline-actions').forEach((wrapper) => {
    if (!wrapper.querySelector(MESSAGE_SAVE_BUTTON_SELECTOR)) {
      wrapper.remove();
    }
  });
}

function removeCodeActionWrappers() {
  document.querySelectorAll('.chatvault-code-actions').forEach((wrapper) => {
    Array.from(wrapper.children || []).forEach((child) => {
      if (!child.matches?.('.chatvault-save-btn')) {
        wrapper.parentElement?.insertBefore(child, wrapper.nextSibling);
      }
    });
    wrapper.remove();
  });
}

function isRelevantMutationTarget(target) {
  return Boolean(
    target?.matches?.('[data-testid="copy-turn-action-button"], [data-testid="turn-actions"], [data-testid^="conversation-turn-"], [data-message-author-role], #code-block-viewer, .cm-editor, .cm-content, pre, code') ||
    target?.closest?.('[data-testid^="conversation-turn-"], .conversation-turn, [data-message-author-role], #code-block-viewer, .cm-editor, pre')
  );
}

function addSaveButton(messageElement, createSaveButton) {
  if (!inlineButtonsEnabled()) {
    return { added: false, button: null, target: null };
  }

  const root = resolveMessageRoot(messageElement);
  if (!root) {
    return { added: false, button: null, target: null };
  }

  if (!isAssistantMessageRoot(root)) {
    return { added: false, button: null, target: null };
  }

  // 既存のボタンを会話ターン単位でチェックして重複を防ぐ
  const scope = getButtonScope(root);
  const existingButton = scope.querySelector?.(MESSAGE_SAVE_BUTTON_SELECTOR) || root.querySelector(MESSAGE_SAVE_BUTTON_SELECTOR);
  const actionContainer = findActionContainer(root);
  if (existingButton) {
    existingButton.__chatvaultMessageElement = root;
    if (actionContainer && existingButton.parentElement !== actionContainer) {
      const result = addButtonToElement(actionContainer, existingButton);
      cleanupEmptyFallbackContainers(scope);
      return { added: false, button: existingButton, target: result.target };
    }
    return { added: false, button: existingButton, target: existingButton.parentElement };
  }

  const button = createSaveButton();
  button.__chatvaultMessageElement = root;
  const contentElement = actionContainer || getFallbackActionContainer(root);

  return addButtonToElement(contentElement, button);
}

function resolveCodeBlockRoot(element) {
  const selectors = getSelectors();
  const root = element.closest?.('#code-block-viewer')
    || element.closest?.('pre')
    || (element.matches?.(selectors.codeBlock) ? element : null)
    || element.querySelector?.(selectors.codeBlock);
  if (!root) return null;
  if (root.querySelector?.('.cm-content, pre > code') || root.matches?.('.cm-content, pre, code, #code-block-viewer')) {
    return root;
  }
  return null;
}

function getCodeBlockPlacementScopes(codeBlockRoot) {
  const scopes = [];
  let current = codeBlockRoot;
  while (current && current !== document.body && scopes.length < 5) {
    scopes.push(current);
    if (current.matches?.('[data-message-author-role], [data-testid^="conversation-turn-"], .conversation-turn')) {
      break;
    }
    current = current.parentElement;
  }
  return scopes;
}

function findExistingCodeActionWrapper(codeBlockRoot) {
  return getCodeBlockPlacementScopes(codeBlockRoot)
    .map((scope) => scope.querySelector?.('.chatvault-code-actions'))
    .find(Boolean) || null;
}

function isLikelyCodeCopyButton(button) {
  if (!button || button.matches?.('.chatvault-save-btn')) return false;
  if (button.closest?.('[data-testid="turn-actions"]')) return false;

  const attr = (name) => (button.getAttribute?.(name) || '').toLowerCase();
  const text = (button.textContent || '').trim().toLowerCase();
  const label = [
    attr('aria-label'),
    attr('title'),
    attr('data-testid'),
    attr('data-tooltip'),
    text
  ].join(' ');
  if (/copy|コピー/.test(label)) return true;

  // Current ChatGPT code viewer copy button may only expose an SVG sprite icon.
  return Boolean(button.querySelector?.('svg use[href*="sprites-core"], svg.icon-md'));
}

function findCodeBlockCopyButton(codeBlockRoot) {
  for (const scope of getCodeBlockPlacementScopes(codeBlockRoot)) {
    const buttons = Array.from(scope.querySelectorAll?.('button, [role="button"]') || []);
    const candidate = buttons.find(isLikelyCodeCopyButton);
    if (candidate) return candidate;
  }
  return null;
}

function attachCodeActionsBesideCopyButton(wrapper, copyButton) {
  if (copyButton.parentElement === wrapper && wrapper.parentElement) {
    wrapper.parentElement.insertBefore(copyButton, wrapper.nextSibling);
  }

  const host = copyButton.parentElement || wrapper.parentElement;
  if (!host) return false;

  wrapper.style.cssText = `
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    z-index: 30;
    pointer-events: auto;
  `;
  wrapper.setAttribute('data-chatvault-placement', 'copy-parent-left');

  const currentPosition = window.getComputedStyle?.(host)?.position;
  if (!currentPosition || currentPosition === 'static') {
    host.style.position = 'relative';
  }

  if (wrapper.parentElement !== host) {
    host.appendChild(wrapper);
  }

  wrapper.style.left = '-40px';
  wrapper.style.top = '0px';
  copyButton.style.pointerEvents = 'auto';

  return true;
}

function insertSaveButtonIntoCodeActions(actionContainer, button) {
  if (button.parentElement !== actionContainer) {
    actionContainer.appendChild(button);
  }
}

function getCodeBlockActionContainer(codeBlockRoot) {
  let wrapper = findExistingCodeActionWrapper(codeBlockRoot);
  const copyButton = findCodeBlockCopyButton(codeBlockRoot);
  if (wrapper && copyButton) {
    attachCodeActionsBesideCopyButton(wrapper, copyButton);
    return wrapper;
  }
  if (wrapper) return wrapper;

  wrapper = document.createElement('div');
  wrapper.className = 'chatvault-code-actions';
  wrapper.setAttribute('data-chatvault-ignore', 'true');
  wrapper.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 4px;
    pointer-events: auto;
  `;

  if (copyButton && attachCodeActionsBesideCopyButton(wrapper, copyButton)) {
    return wrapper;
  }

  const currentPosition = window.getComputedStyle?.(codeBlockRoot)?.position;
  if (!currentPosition || currentPosition === 'static') {
    codeBlockRoot.style.position = 'relative';
  }
  codeBlockRoot.appendChild(wrapper);
  return wrapper;
}

function addCodeBlockSaveButton(codeBlockElement, createButton = createCodeBlockSaveButton) {
  if (!inlineButtonsEnabled()) {
    return { added: false, button: null, target: null };
  }

  const root = resolveCodeBlockRoot(codeBlockElement);
  if (!root) {
    return { added: false, button: null, target: null };
  }

  const existingButton = getCodeBlockPlacementScopes(root)
    .map((scope) => scope.querySelector?.(CODE_SAVE_BUTTON_SELECTOR))
    .find(Boolean) || null;
  if (existingButton) {
    existingButton.__chatvaultCodeBlockElement = root;
    const actionContainer = getCodeBlockActionContainer(root);
    if (existingButton.parentElement !== actionContainer) {
      insertSaveButtonIntoCodeActions(actionContainer, existingButton);
    }
    return { added: false, button: existingButton, target: actionContainer };
  }

  const button = createButton();
  button.__chatvaultCodeBlockElement = root;
  const actionContainer = getCodeBlockActionContainer(root);
  insertSaveButtonIntoCodeActions(actionContainer, button);

  return { added: true, button, target: actionContainer };
}

function getCodeBlockScanRoots() {
  const selectors = getSelectors();
  const seen = new Set();
  return Array.from(document.querySelectorAll(selectors.codeBlock))
    .map(resolveCodeBlockRoot)
    .filter((root) => {
      if (!root || seen.has(root)) return false;
      seen.add(root);
      return Boolean((root.textContent || '').trim());
    });
}

// グローバルなObserver管理
let globalObserver = null;
let rescanTimer = null;

/**
 * 初期化処理 - 動的コンテンツに対応（SPA遷移にも対応）
 * @param {Function} createSaveButton - ボタン作成関数
 */
function initializeChatGPT() {
  // 既存のObserverをクリーンアップ
  if (globalObserver) {
    globalObserver.disconnect();
    globalObserver = null;
  }
  if (rescanTimer) {
    clearTimeout(rescanTimer);
    rescanTimer = null;
  }

  // 既存のボタンをクリーンアップ（SPA遷移時の重複防止）
  const existingButtons = document.querySelectorAll('.chatvault-save-btn');
  existingButtons.forEach(btn => btn.remove());
  document.querySelectorAll('.chatvault-inline-actions').forEach(el => el.remove());
  removeCodeActionWrappers();

  if (!inlineButtonsEnabled()) {
    return;
  }

  const scanMessages = () => {
    const selectors = getSelectors();
    document.querySelectorAll(selectors.container).forEach((message) => {
      addSaveButton(message, () => createSaveButton());
    });
    getCodeBlockScanRoots().forEach((codeBlock) => {
      addCodeBlockSaveButton(codeBlock);
    });
  };

  scanMessages();

  // 新しいメッセージ用のmutation observerを設定
  globalObserver = new MutationObserver((mutations) => {
    let shouldScan = false;
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            shouldScan = true;
          }
        });
      } else if (
        mutation.type === 'attributes' &&
        mutation.target?.nodeType === Node.ELEMENT_NODE &&
        ['class', 'data-testid', 'data-message-author-role', 'data-message-id', 'aria-label'].includes(mutation.attributeName)
      ) {
        shouldScan = shouldScan || isRelevantMutationTarget(mutation.target);
      }
    });
    if (shouldScan && inlineButtonsEnabled()) {
      clearTimeout(rescanTimer);
      rescanTimer = setTimeout(() => {
        rescanTimer = null;
        if (inlineButtonsEnabled()) {
          scanMessages();
        }
      }, 150);
    }
  });

  globalObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true
  });
}

/**
 * 要素にボタンを追加するヘルパー関数
 * @param {HTMLElement} contentElement - ボタンを追加する要素
 * @param {HTMLElement} button - 追加するボタン
 * @returns {Object} 追加結果
 */
function addButtonToElement(contentElement, button) {
  const buttonEl = button;
  
  // コピーボタンが存在するかチェック
  const copyButton = contentElement.querySelector('[data-testid="copy-turn-action-button"]');
  
  if (copyButton) {
    // コピーボタンの左側に挿入
    contentElement.insertBefore(buttonEl, copyButton);
  } else {
    // 従来の方法で追加
    contentElement.appendChild(buttonEl);
  }
  
  return { added: true, button: buttonEl, target: contentElement };
}

/**
 * ボタンからメッセージ要素を解決する（ChatGPT固有のレイアウト対応）
 * @param {HTMLElement} btn - 保存ボタン要素
 * @returns {HTMLElement|null} メッセージ要素またはnull
 */
function resolveMessageElementFromButton(btn) {
  try {
    const selectors = getSelectors();
    if (btn.__chatvaultMessageElement?.isConnected) {
      return btn.__chatvaultMessageElement;
    }
    
    // 1) ボタンから最も近いメッセージコンテナを探す
    const turn = getConversationTurn(btn);
    if (turn) {
      const root = findBestMessageInTurn(turn);
      if (root) return root;
    }

    let messageEl = btn.closest(selectors.container);
    if (messageEl) return messageEl;
    
    // 2) コピーボタンの親要素から探す
    const copyButton = btn.closest('[data-testid="copy-turn-action-button"]');
    if (copyButton) {
      const parent = copyButton.parentElement;
      if (parent) {
        messageEl = parent.closest(selectors.container);
        if (messageEl) return messageEl;
      }
    }
    
    // 3) ボタンコンテナの親要素から探す
    const buttonContainer = btn.closest('[data-testid="turn-actions"]');
    if (buttonContainer) {
      messageEl = buttonContainer.closest(selectors.container);
      if (messageEl) return messageEl;
    }
    
    // 4) 会話ターン要素から探す
    const conversationTurn = btn.closest('[data-testid^="conversation-turn-"]');
    if (conversationTurn) {
      messageEl = conversationTurn.querySelector(selectors.container);
      if (messageEl) return messageEl;
    }
    
    // 5) ChatGPT固有のフォールバック: data-message-author-role で探す
    if (!messageEl) {
      messageEl = btn.closest('[data-message-author-role]');
    }
    
    // 6) ChatGPT固有のフォールバック: 会話ターン風の要素
    if (!messageEl) {
      messageEl = btn.closest('[data-testid^="conversation-turn-"], .conversation-turn, .group.w-full');
    }
    
    return messageEl;
  } catch (_) {
    // ignore
  }
  return null;
}

export {
  createSaveButton,
  createCodeBlockSaveButton,
  addSaveButton,
  addCodeBlockSaveButton,
  initializeChatGPT,
  resolveMessageElementFromButton
};
