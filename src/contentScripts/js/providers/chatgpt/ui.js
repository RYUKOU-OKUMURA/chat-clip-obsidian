// ChatGPT UI-related helpers (button placement, etc.)
import { getSelectors } from './checks.js';

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


function addSaveButton(messageElement, createSaveButton) {
  if (!inlineButtonsEnabled()) {
    return { added: false, button: null, target: null };
  }

  const selectors = getSelectors();
  const root = messageElement.matches?.(selectors.container)
    ? messageElement
    : (messageElement.closest?.(selectors.container) || messageElement.querySelector?.(selectors.container) || messageElement);

  // 既存のボタンをチェックして重複を防ぐ
  const existingButton = root.querySelector('.chatvault-save-btn');
  if (existingButton) {
    return { added: false, button: existingButton, target: existingButton.parentElement };
  }

  const button = createSaveButton();
  const contentElement = findContentElement(root) || createFallbackActionContainer(root);

  return addButtonToElement(contentElement, button);
}

// グローバルなObserver管理
let globalObserver = null;

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

  // 既存のボタンをクリーンアップ（SPA遷移時の重複防止）
  const existingButtons = document.querySelectorAll('.chatvault-save-btn');
  existingButtons.forEach(btn => btn.remove());
  document.querySelectorAll('.chatvault-inline-actions').forEach(el => el.remove());

  if (!inlineButtonsEnabled()) {
    return;
  }

  const scanMessages = () => {
    const selectors = getSelectors();
    document.querySelectorAll(selectors.container).forEach((message) => {
      addSaveButton(message, () => createSaveButton());
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
      }
    });
    if (shouldScan && inlineButtonsEnabled()) {
      scanMessages();
    }
  });

  globalObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true
  });
}


/**
 * コンテンツ要素を探す
 * @param {HTMLElement} messageElement - メッセージ要素
 * @returns {HTMLElement|null} コンテンツ要素またはnull
 */
function findContentElement(messageElement) {
  // コピーボタンを含むボタンコンテナを探す
  const copyButton = messageElement.querySelector('[data-testid="copy-turn-action-button"]');
  if (copyButton) {
    // コピーボタンの親要素（ボタンコンテナ）を返す
    return copyButton.parentElement;
  }
  
  // メッセージ要素自体にコピーボタンがある場合
  if (messageElement.matches && messageElement.matches('[data-testid="copy-turn-action-button"]')) {
    return messageElement.parentElement;
  }
  
  return null;
}

function createFallbackActionContainer(messageElement) {
  let wrapper = messageElement.querySelector(':scope > .chatvault-inline-actions');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'chatvault-inline-actions';
    wrapper.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 4px;
      margin-top: 6px;
    `;
    messageElement.appendChild(wrapper);
  }
  return wrapper;
}

/**
 * 動的更新を監視するオブザーバーを設定
 * @param {HTMLElement} messageElement - メッセージ要素
 * @param {HTMLElement} button - 追加するボタン
 */
function setupDynamicObserver(messageElement, button) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;
      
      const addedNode = findAddedContentNode(mutation.addedNodes);
      if (addedNode) {
        addButtonToElement(addedNode, button);
        observer.disconnect();
        return;
      }
    }
  });

  observer.observe(messageElement, {
    childList: true,
    subtree: true
  });

  setTimeout(() => {
    observer.disconnect();
    retryAddButton(messageElement, button);
  }, 500);
}

/**
 * 追加されたノードからコンテンツ要素を探す
 * @param {NodeList} addedNodes - 追加されたノード
 * @returns {HTMLElement|null} コンテンツ要素またはnull
 */
function findAddedContentNode(addedNodes) {
  for (const node of addedNodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    
    // ノード自体がコピーボタンかチェック
    if (node.matches && node.matches('[data-testid="copy-turn-action-button"]')) {
      return node.parentElement;
    }
    
    // ノード内にコピーボタンがあるかチェック
    const copyButton = node.querySelector('[data-testid="copy-turn-action-button"]');
    if (copyButton) {
      return copyButton.parentElement;
    }
  }
  
  return null;
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
 * タイムアウト後の再試行関数
 * @param {HTMLElement} messageElement - メッセージ要素
 * @param {HTMLElement} button - 追加するボタン
 */
function retryAddButton(messageElement, button) {
  // 最後の手段として、メッセージ要素自体にボタンを追加
  if (messageElement && messageElement.isConnected) {
    const buttonEl = button;
    
    // コピーボタンが存在するかチェック
    const copyButton = messageElement.querySelector('[data-testid="copy-turn-action-button"]');
    
    if (copyButton) {
      // コピーボタンの左側に挿入
      copyButton.parentElement.insertBefore(buttonEl, copyButton);
    } else if (messageElement.matches('[data-testid="copy-turn-action-button"]')) {
      // メッセージ要素自体がコピーボタンの場合
      messageElement.parentElement.insertBefore(buttonEl, messageElement);
    } else {
      // 従来の方法で追加
      messageElement.appendChild(buttonEl);
    }
  }
}

/**
 * ボタンからメッセージ要素を解決する（ChatGPT固有のレイアウト対応）
 * @param {HTMLElement} btn - 保存ボタン要素
 * @returns {HTMLElement|null} メッセージ要素またはnull
 */
function resolveMessageElementFromButton(btn) {
  try {
    const selectors = getSelectors();
    
    // 1) ボタンから最も近いメッセージコンテナを探す
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
    
    // 7) グローバルフォールバック: ページ内の最後のメッセージコンテナ
    if (!messageEl) {
      const allMessages = document.querySelectorAll(selectors.container);
      if (allMessages && allMessages.length) {
        return allMessages[allMessages.length - 1];
      }
    }
    
    return messageEl;
  } catch (_) {
    // ignore
  }
  return null;
}

export { createSaveButton, addSaveButton, initializeChatGPT, resolveMessageElementFromButton };
