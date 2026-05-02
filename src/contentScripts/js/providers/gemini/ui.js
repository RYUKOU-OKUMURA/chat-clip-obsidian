// Gemini UI-related helpers (button placement, etc.)
import { getSelectors } from './checks.js';

// グローバル変数
let globalTooltip = null;
let globalObserver = null;

function inlineButtonsEnabled() {
  return window.__CHATVAULT_SHOW_SAVE_BUTTON__ !== false;
}

/**
 * Obsidian保存ボタンを作成する
 * @returns {HTMLElement} 保存ボタン要素
 */
function createSaveButton() {
  const button = document.createElement('button');
  button.className = 'chatvault-save-btn gemini-chatvault-save-btn';
  button.setAttribute('type', 'button');
  button.setAttribute('aria-label', 'Obsidianに保存');
  button.setAttribute('data-test-id', 'chatvault-save-button');

  button.style.cssText = `
    background-color: transparent;
    color: rgba(232, 234, 237, 0.9);
    border: none;
    border-radius: 9999px;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
    width: 36px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  `;

  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"></path>
      <polyline points="17 21 17 13 7 13 7 21"></polyline>
      <polyline points="7 3 7 8 15 8"></polyline>
    </svg>
  `;

  const setHoverState = (active) => {
    if (active) {
      button.style.backgroundColor = 'rgba(138, 180, 248, 0.16)';
      button.style.color = '#8ab4f8';
    } else {
      button.style.backgroundColor = 'transparent';
      button.style.color = 'rgba(232, 234, 237, 0.9)';
    }
  };

  button.addEventListener('mouseenter', () => setHoverState(true));
  button.addEventListener('mouseleave', () => setHoverState(false));
  button.addEventListener('focus', () => setHoverState(true));
  button.addEventListener('blur', () => setHoverState(false));
  button.addEventListener('mousedown', () => {
    button.style.backgroundColor = 'rgba(138, 180, 248, 0.24)';
  });
  button.addEventListener('mouseup', () => {
    button.style.backgroundColor = 'rgba(138, 180, 248, 0.16)';
  });

  return button;
}

/**
 * 一般チャット用のボタンコンテナを作成
 * @returns {HTMLElement} ボタンコンテナ要素
 */
function createChatButtonsContainer() {
  const container = document.createElement('div');
  container.className = 'buttons-container-v2 ng-tns-c347605925-103 ng-star-inserted';
  container.style.cssText = '';

  // Thumb Up ボタン
  const thumbUpButton = createThumbButton('up', 'thumb_up', '良い回答');
  
  // Thumb Down ボタン
  const thumbDownButton = createThumbButton('down', 'thumb_down', '悪い回答');

  // 再生成ボタン
  const regenerateButton = createRegenerateButton();

  // 共有ボタン
  const shareButton = createShareButton();

  // コピーボタン
  const copyButton = createCopyButton();

  // Obsidian保存ボタン
  const saveButton = createSaveButton();

  // その他メニューボタン
  const moreMenuButton = createMoreMenuButton();

  // スペーサー
  const spacer = document.createElement('div');
  spacer.className = 'spacer ng-tns-c347605925-103 ng-star-inserted';

  // ボタンを追加
  container.appendChild(thumbUpButton);
  container.appendChild(thumbDownButton);
  container.appendChild(regenerateButton);
  container.appendChild(shareButton);
  container.appendChild(copyButton);
  container.appendChild(saveButton);
  container.appendChild(moreMenuButton);
  container.appendChild(spacer);

  return container;
}

/**
 * Thumbボタンを作成
 */
function createThumbButton(type, icon, tooltip) {
  const buttonElement = document.createElement(type === 'up' ? 'thumb-up-button' : 'thumb-down-button');
  buttonElement.className = 'ng-tns-c347605925-103 ng-star-inserted';
  
  const button = document.createElement('button');
  button.className = 'mdc-icon-button mat-mdc-icon-button mat-mdc-button-base mat-mdc-tooltip-trigger icon-button mat-unthemed';
  button.setAttribute('mat-icon-button', '');
  button.setAttribute('mattooltip', tooltip);
  button.setAttribute('aria-label', tooltip);
  button.setAttribute('aria-pressed', 'false');
  
  button.innerHTML = `
    <span class="mat-mdc-button-persistent-ripple mdc-icon-button__ripple"></span>
    <mat-icon role="img" fonticon="${icon}" class="mat-icon notranslate gds-icon-m google-symbols mat-ligature-font mat-icon-no-color ng-star-inserted" aria-hidden="true" data-mat-icon-type="font" data-mat-icon-name="${icon}"></mat-icon>
    <span class="mat-focus-indicator"></span>
    <span class="mat-mdc-button-touch-target"></span>
  `;
  
  buttonElement.appendChild(button);
  return buttonElement;
}

/**
 * 再生成ボタンを作成
 */
function createRegenerateButton() {
  const buttonElement = document.createElement('regenerate-button');
  buttonElement.className = 'ng-tns-c347605925-103 ng-star-inserted';
  
  const button = document.createElement('button');
  button.className = 'mdc-icon-button mat-mdc-icon-button mat-mdc-button-base mat-mdc-tooltip-trigger icon-button mat-unthemed';
  button.setAttribute('mat-icon-button', '');
  button.setAttribute('aria-label', 'やり直す');
  button.setAttribute('mattooltip', 'やり直す');
  
  button.innerHTML = `
    <span class="mat-mdc-button-persistent-ripple mdc-icon-button__ripple"></span>
    <mat-icon role="img" fonticon="refresh" class="mat-icon notranslate refresh-icon gds-icon-m google-symbols mat-ligature-font mat-icon-no-color ng-star-inserted" aria-hidden="true" data-mat-icon-type="font" data-mat-icon-name="refresh"></mat-icon>
    <span class="mat-focus-indicator"></span>
    <span class="mat-mdc-button-touch-target"></span>
  `;
  
  buttonElement.appendChild(button);
  return buttonElement;
}

/**
 * 共有ボタンを作成
 */
function createShareButton() {
  const tooltipAnchor = document.createElement('div');
  tooltipAnchor.className = 'tooltip-anchor-point ng-tns-c347605925-103 ng-star-inserted';
  
  const button = document.createElement('button');
  button.className = 'mdc-button mat-mdc-button-base mat-mdc-menu-trigger mat-mdc-tooltip-trigger icon-button ng-tns-c347605925-103 mat-mdc-button mat-unthemed';
  button.setAttribute('mat-button', '');
  button.setAttribute('aria-label', '共有とエクスポート');
  button.setAttribute('tabindex', '0');
  button.setAttribute('mattooltip', '共有とエクスポート');
  button.setAttribute('data-test-id', 'share-and-export-menu-button');
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  
  button.innerHTML = `
    <span class="mat-mdc-button-persistent-ripple mdc-button__ripple"></span>
    <mat-icon role="img" fonticon="share" class="mat-icon notranslate google-symbols mat-ligature-font mat-icon-no-color" aria-hidden="true" data-mat-icon-type="font" data-mat-icon-name="share"></mat-icon>
    <span class="mdc-button__label"></span>
    <span class="mat-focus-indicator"></span>
    <span class="mat-mdc-button-touch-target"></span>
  `;
  
  tooltipAnchor.appendChild(button);
  return tooltipAnchor;
}

/**
 * コピーボタンを作成
 */
function createCopyButton() {
  const buttonElement = document.createElement('copy-button');
  buttonElement.className = 'ng-tns-c347605925-103 ng-star-inserted';
  
  const button = document.createElement('button');
  button.className = 'mdc-button mat-mdc-button-base mat-mdc-tooltip-trigger icon-button mat-mdc-button mat-unthemed';
  button.setAttribute('mat-button', '');
  button.setAttribute('tabindex', '0');
  button.setAttribute('mattooltip', '回答をコピー');
  button.setAttribute('aria-label', 'コピー');
  button.setAttribute('data-test-id', 'copy-button');
  
  button.innerHTML = `
    <span class="mat-mdc-button-persistent-ripple mdc-button__ripple"></span>
    <mat-icon role="img" fonticon="content_copy" class="mat-icon notranslate embedded-copy-icon gds-icon-l google-symbols mat-ligature-font mat-icon-no-color" aria-hidden="true" data-mat-icon-type="font" data-mat-icon-name="content_copy"></mat-icon>
    <span class="mdc-button__label"></span>
    <span class="mat-focus-indicator"></span>
    <span class="mat-mdc-button-touch-target"></span>
  `;
  
  buttonElement.appendChild(button);
  return buttonElement;
}

/**
 * その他メニューボタンを作成
 */
function createMoreMenuButton() {
  const menuWrapper = document.createElement('div');
  menuWrapper.className = 'menu-button-wrapper ng-tns-c347605925-103 ng-star-inserted';
  
  const menuContainer = document.createElement('div');
  menuContainer.className = 'more-menu-button-container ng-tns-c347605925-103';
  
  const button = document.createElement('button');
  button.className = 'mdc-button mat-mdc-button-base mat-mdc-menu-trigger mat-mdc-tooltip-trigger icon-button more-menu-button ng-tns-c347605925-103 mat-mdc-button mat-unthemed';
  button.setAttribute('mat-button', '');
  button.setAttribute('mattooltip', 'その他');
  button.setAttribute('aria-label', '他のオプションを表示');
  button.setAttribute('tabindex', '0');
  button.setAttribute('data-test-id', 'more-menu-button');
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  
  button.innerHTML = `
    <span class="mat-mdc-button-persistent-ripple mdc-button__ripple"></span>
    <mat-icon role="img" fonticon="more_vert" class="mat-icon notranslate google-symbols mat-ligature-font mat-icon-no-color" aria-hidden="true" data-mat-icon-type="font" data-mat-icon-name="more_vert"></mat-icon>
    <span class="mdc-button__label"></span>
    <span class="mat-focus-indicator"></span>
    <span class="mat-mdc-button-touch-target"></span>
  `;
  
  menuContainer.appendChild(button);
  menuWrapper.appendChild(menuContainer);
  return menuWrapper;
}

/**
 * タスクバー用のツールバーを作成
 */
function createToolbar() {
  const toolbar = document.createElement('toolbar');
  toolbar.className = 'extended-response-toolbar';
  
  const toolbarDiv = document.createElement('div');
  toolbarDiv.className = 'toolbar has-title';
  
  // 左パネル
  const leftPanel = document.createElement('div');
  leftPanel.className = 'left-panel';
  
  const icon = document.createElement('mat-icon');
  icon.setAttribute('role', 'img');
  icon.setAttribute('data-test-id', 'immersive-icon');
  icon.className = 'mat-icon notranslate gds-icon-l google-symbols mat-ligature-font mat-icon-no-color ng-star-inserted';
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('data-mat-icon-type', 'font');
  icon.setAttribute('data-mat-icon-name', 'article');
  icon.setAttribute('fonticon', 'article');
  
  const title = document.createElement('h2');
  title.className = 'title-text gds-title-s ng-star-inserted';
  title.textContent = 'Geminiチャット';
  
  leftPanel.appendChild(icon);
  leftPanel.appendChild(title);
  
  // アクションボタンエリア
  const actionButtons = document.createElement('div');
  actionButtons.className = 'action-buttons';
  
  // 共有ボタン
  const shareButton = createToolbarShareButton();
  
  // 作成ボタン
  const createButton = createToolbarCreateButton();
  
  // 保存ボタン（作成ボタンの右に配置）
  const saveButton = createSaveButton();
  saveButton.style.cssText += `
    margin-left: 8px;
    height: 36px;
    min-width: 36px;
    border-radius: 4px;
  `;
  
  // 閉じるボタン
  const closeButton = createToolbarCloseButton();
  
  actionButtons.appendChild(shareButton);
  actionButtons.appendChild(createButton);
  actionButtons.appendChild(saveButton);
  actionButtons.appendChild(closeButton);
  
  toolbarDiv.appendChild(leftPanel);
  toolbarDiv.appendChild(actionButtons);
  toolbar.appendChild(toolbarDiv);
  
  return toolbar;
}

/**
 * ツールバー用共有ボタンを作成
 */
function createToolbarShareButton() {
  const shareDiv = document.createElement('div');
  shareDiv.setAttribute('mattooltipposition', 'below');
  shareDiv.className = 'mat-mdc-tooltip-trigger mat-mdc-tooltip-disabled ng-star-inserted';
  
  const shareButtonElement = document.createElement('share-button');
  shareButtonElement.setAttribute('data-test-id', 'consolidated-share-button');
  shareButtonElement.className = 'mat-mdc-menu-trigger ng-star-inserted';
  shareButtonElement.setAttribute('aria-haspopup', 'menu');
  shareButtonElement.setAttribute('aria-expanded', 'false');
  
  const button = document.createElement('button');
  button.className = 'mdc-icon-button mat-mdc-icon-button mat-mdc-button-base mat-mdc-tooltip-trigger icon-button share-button mat-unthemed ng-star-inserted';
  button.setAttribute('mat-icon-button', '');
  button.setAttribute('mattooltipposition', 'below');
  button.setAttribute('data-test-id', 'share-button');
  button.setAttribute('aria-label', 'Canvas を共有・エクスポート');
  
  button.innerHTML = `
    <span class="mat-mdc-button-persistent-ripple mdc-icon-button__ripple"></span>
    <mat-icon role="img" data-test-id="share-icon" class="mat-icon notranslate gds-icon-l google-symbols mat-ligature-font mat-icon-no-color" aria-hidden="true" data-mat-icon-type="font" data-mat-icon-name="share" fonticon="share"></mat-icon>
    <span class="mat-focus-indicator"></span>
    <span class="mat-mdc-button-touch-target"></span>
  `;
  
  shareButtonElement.appendChild(button);
  shareDiv.appendChild(shareButtonElement);
  return shareDiv;
}

/**
 * ツールバー用作成ボタンを作成
 */
function createToolbarCreateButton() {
  const createButtonElement = document.createElement('canvas-create-button');
  createButtonElement.setAttribute('data-test-id', 'create-button');
  createButtonElement.className = 'create-button-container ng-star-inserted';
  
  const createDiv = document.createElement('div');
  createDiv.className = 'canvas-create-button-container ng-star-inserted';
  
  const button = document.createElement('button');
  button.className = 'mdc-button mat-mdc-button-base mat-mdc-menu-trigger mat-mdc-tooltip-trigger create-button mdc-button--unelevated mat-mdc-unelevated-button mat-primary';
  button.setAttribute('mat-flat-button', '');
  button.setAttribute('color', 'primary');
  button.setAttribute('aria-label', '[ファイルをアップロード] メニューを開く');
  button.setAttribute('data-test-id', 'canvas-create-task-menu');
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  
  button.innerHTML = `
    <span class="mat-mdc-button-persistent-ripple mdc-button__ripple"></span>
    <span class="mdc-button__label"><span>作成</span></span>
    <mat-icon role="img" iconpositionend="" fonticon="keyboard_arrow_down" class="mat-icon notranslate google-symbols mat-ligature-font mat-icon-no-color" aria-hidden="true" data-mat-icon-type="font" data-mat-icon-name="keyboard_arrow_down"></mat-icon>
    <span class="mat-focus-indicator"></span>
    <span class="mat-mdc-button-touch-target"></span>
  `;
  
  createDiv.appendChild(button);
  createButtonElement.appendChild(createDiv);
  return createButtonElement;
}

/**
 * ツールバー用閉じるボタンを作成
 */
function createToolbarCloseButton() {
  const button = document.createElement('button');
  button.className = 'mdc-icon-button mat-mdc-icon-button mat-mdc-button-base mat-mdc-tooltip-trigger icon-button close-button mat-unthemed ng-star-inserted';
  button.setAttribute('mat-icon-button', '');
  button.setAttribute('mattooltip', '閉じる');
  button.setAttribute('mattooltipposition', 'below');
  button.setAttribute('aria-label', 'パネルを閉じる');
  button.setAttribute('data-test-id', 'close-button');
  
  button.innerHTML = `
    <span class="mat-mdc-button-persistent-ripple mdc-icon-button__ripple"></span>
    <mat-icon role="img" class="mat-icon notranslate gds-icon-l google-symbols mat-ligature-font mat-icon-no-color" aria-hidden="true" data-mat-icon-type="font" data-mat-icon-name="close" fonticon="close"></mat-icon>
    <span class="mat-focus-indicator"></span>
    <span class="mat-mdc-button-touch-target"></span>
  `;
  
  return button;
}

/**
 * ボタンをメッセージ要素に追加
 */
function addSaveButton(messageElement, createSaveButton) {
  if (!inlineButtonsEnabled()) {
    return { added: false, button: null, target: null };
  }

  // 既存のボタンチェック
  const existingButton = messageElement.querySelector('.chatvault-save-btn');
  if (existingButton) {
    return { added: false, button: existingButton, target: existingButton.parentElement };
  }

  const button = createSaveButton();

  // ボタンコンテナを探す
  const buttonContainer = messageElement.querySelector('.buttons-container-v2');
  if (buttonContainer) {
    // コピーボタンの前に挿入
    const copyButton = buttonContainer.querySelector('[data-test-id="copy-button"]');
    if (copyButton) {
      buttonContainer.insertBefore(button, copyButton);
    } else {
      buttonContainer.appendChild(button);
    }
    return { added: true, button: button, target: buttonContainer };
  }

  const wrapper = createFallbackActionContainer(messageElement);
  wrapper.appendChild(button);
  return { added: true, button, target: wrapper };
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
 * Gemini用の初期化処理
 */
function initializeGemini(createSaveButton) {
  // 既存のObserverをクリーンアップ
  if (globalObserver) {
    globalObserver.disconnect();
    globalObserver = null;
  }

  // 既存のボタンをクリーンアップ
  const existingButtons = document.querySelectorAll('.chatvault-save-btn');
  existingButtons.forEach(btn => btn.remove());
  document.querySelectorAll('.chatvault-inline-actions').forEach(el => el.remove());

  if (!inlineButtonsEnabled()) {
    return;
  }

  // 既存メッセージの初期スキャン
  const messages = document.querySelectorAll('.buttons-container-v2');
  messages.forEach(buttonContainer => {
    addSaveButton(buttonContainer.parentElement, createSaveButton);
  });

  // mutation observerを設定
  globalObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const buttonContainers = node.matches && node.matches('.buttons-container-v2')
              ? [node]
              : node.querySelectorAll ? node.querySelectorAll('.buttons-container-v2') : [];

            buttonContainers.forEach(buttonContainer => {
              addSaveButton(buttonContainer.parentElement, createSaveButton);
            });
          }
        });
      }
    });
  });

  globalObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * メッセージ要素を解決する
 */
function resolveMessageElementFromButton(btn) {
  try {
    const selectors = getSelectors();
    
    // extended-response-panel内のツールバーから呼ばれた場合の特別処理
    const extendedPanel = btn.closest('extended-response-panel');
    if (extendedPanel) {
      // response-containerを探す（これが保存対象）
      const responseContainer = extendedPanel.querySelector('response-container') || 
                               extendedPanel.querySelector('.response-container');
      if (responseContainer) {
        return responseContainer;
      }
      
      // フォールバック: scroll-container内のresponse-containerを探す
      const scrollContainer = extendedPanel.querySelector('[data-test-id="scroll-container"]');
      if (scrollContainer) {
        const responseInScroll = scrollContainer.querySelector('response-container') || 
                                 scrollContainer.querySelector('.response-container');
        if (responseInScroll) {
          return responseInScroll;
        }
      }
      
      // さらなるフォールバック: immersive-editorを探す
      const immersiveEditor = extendedPanel.querySelector('immersive-editor') ||
                              extendedPanel.querySelector('[data-test-id="immersive-editor"]');
      if (immersiveEditor) {
        return immersiveEditor;
      }
    }
    
    // 通常のボタンコンテナから開始
    const buttonsContainer = btn.closest('.buttons-container-v2');
    const responseContainer = btn.closest('.response-container');

    if (responseContainer) {
      const msg = responseContainer.querySelector(selectors.container);
      if (msg) return msg;

      const contentScope = responseContainer.querySelector('.response-container-content') || responseContainer;
      const msgAlt = contentScope.querySelector(selectors.container);
      if (msgAlt) return msgAlt;
    }

    if (buttonsContainer) {
      const parent = buttonsContainer.parentElement;
      if (parent) {
        const withinParent = parent.querySelector(selectors.container);
        if (withinParent) return withinParent;
      }
    }

    // グローバルフォールバック
    const all = document.querySelectorAll(selectors.container);
    if (all && all.length) {
      return all[all.length - 1];
    }
  } catch (_) {
    // ignore
  }
  return null;
}

/**
 * 新しいボタンコンテナとツールバーに保存ボタンを追加する初期化処理
 */
function initializeGeminiWithNewButtons() {
  console.info('Gemini用の保存ボタンを追加中...');
  if (globalObserver) {
    globalObserver.disconnect();
    globalObserver = null;
  }

  document.querySelectorAll('.chatvault-save-btn').forEach(btn => btn.remove());
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
  
  // 動的コンテンツの監視
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
    subtree: true
  });
  
  console.info('Gemini用の保存ボタンが追加されました');
}

export { 
  createSaveButton, 
  createChatButtonsContainer,
  createToolbar,
  addSaveButton, 
  initializeGemini, 
  initializeGeminiWithNewButtons,
  resolveMessageElementFromButton 
};
