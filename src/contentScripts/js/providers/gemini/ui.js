// Gemini UI-related helpers (button placement, etc.)
import {
  GEMINI_ACTION_CONTAINER_SELECTOR,
  GEMINI_COPY_BUTTON_SELECTOR,
  GEMINI_MESSAGE_CONTENT_SELECTOR,
  GEMINI_RESPONSE_SCOPE_SELECTOR,
  getSelectors
} from './checks.js';
import { createFallbackActionContainer, getDirectChild, isVisibleElement } from '../shared/dom.js';

// グローバル変数
let globalTooltip = null;
let globalObserver = null;
const SAVE_TOOLTIP_TEXT = 'Obsidianに保存する';

function inlineButtonsEnabled() {
  return window.__CHATVAULT_SHOW_SAVE_BUTTON__ !== false;
}

function ensureTooltip() {
  if (globalTooltip?.isConnected) {
    return globalTooltip;
  }

  globalTooltip = document.createElement('div');
  globalTooltip.className = 'chatvault-tooltip';
  globalTooltip.style.cssText = `
    position: fixed;
    left: 0;
    top: 0;
    transform: translate(0, 0);
    min-width: max-content;
    z-index: 2147483647;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.16s ease;
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
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      line-height: 1.4;
    ">${SAVE_TOOLTIP_TEXT}</div>
  `;
  document.body.appendChild(globalTooltip);
  return globalTooltip;
}

function showTooltip(button) {
  const tooltip = ensureTooltip();
  const rect = button.getBoundingClientRect();
  tooltip.style.visibility = 'visible';
  tooltip.style.opacity = '1';

  const tooltipRect = tooltip.getBoundingClientRect();
  const left = rect.left + rect.width / 2 - tooltipRect.width / 2;
  const top = rect.bottom + 8;
  tooltip.style.transform = `translate(${Math.max(8, left)}px, ${top}px)`;
}

function hideTooltip() {
  if (!globalTooltip) return;
  globalTooltip.style.opacity = '0';
  globalTooltip.style.visibility = 'hidden';
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
  button.setAttribute('data-tooltip', SAVE_TOOLTIP_TEXT);
  button.setAttribute('data-state', 'closed');
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

  button.addEventListener('mouseenter', () => {
    setHoverState(true);
    button.setAttribute('data-state', 'delayed-open');
    showTooltip(button);
  });
  button.addEventListener('mouseleave', () => {
    setHoverState(false);
    button.setAttribute('data-state', 'closed');
    hideTooltip();
  });
  button.addEventListener('focus', () => {
    setHoverState(true);
    button.setAttribute('data-state', 'delayed-open');
    showTooltip(button);
  });
  button.addEventListener('blur', () => {
    setHoverState(false);
    button.setAttribute('data-state', 'closed');
    hideTooltip();
  });
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

  const root = resolveMessageRoot(messageElement);
  if (!root) {
    return { added: false, button: null, target: null };
  }

  const buttonContainer = findActionContainer(root);
  const scope = getButtonScope(root);
  const existingButton = findExistingSaveButton(root, buttonContainer, scope);
  if (existingButton) {
    attachMessageRootToButton(existingButton, root);
    if (buttonContainer && !buttonContainer.contains(existingButton)) {
      insertButtonIntoActionContainer(existingButton, buttonContainer);
      cleanupEmptyFallbackContainers(root);
    }
    return { added: false, button: existingButton, target: existingButton.parentElement };
  }

  const button = createSaveButton();
  attachMessageRootToButton(button, root);

  if (buttonContainer) {
    insertButtonIntoActionContainer(button, buttonContainer);
    return { added: true, button: button, target: buttonContainer };
  }

  const wrapper = createFallbackActionContainer(root);
  wrapper.appendChild(button);
  return { added: true, button, target: wrapper };
}

function attachMessageRootToButton(button, root) {
  button.__chatvaultMessageElement = root;
  const responseId = getResponseIdFromMessage(root);
  if (responseId) {
    button.dataset.chatvaultResponseId = responseId;
  }
}

function findExistingSaveButton(root, actionContainer, scope) {
  const responseId = getResponseIdFromMessage(root);
  const rootButtons = Array.from(root.querySelectorAll?.('.chatvault-save-btn') || []);
  const actionButtons = actionContainer
    ? Array.from(actionContainer.querySelectorAll?.('.chatvault-save-btn') || [])
    : [];
  const scopedButtons = scope && responseId
    ? Array.from(scope.querySelectorAll?.('.chatvault-save-btn') || [])
    : [];

  const uniqueCandidates = [...new Set([...rootButtons, ...actionButtons, ...scopedButtons])];
  return uniqueCandidates.find((button) => button.__chatvaultMessageElement === root)
    || uniqueCandidates.find((button) => responseId && button.dataset.chatvaultResponseId === responseId)
    || rootButtons[0]
    || actionButtons[0]
    || null;
}

function insertButtonIntoActionContainer(button, buttonContainer) {
  const copyButton = buttonContainer.querySelector(GEMINI_COPY_BUTTON_SELECTOR);
  const copyHost = copyButton?.closest?.('copy-button') || copyButton;
  const anchor = copyHost ? getDirectChild(buttonContainer, copyHost) : null;

  if (anchor && anchor !== button) {
    buttonContainer.insertBefore(button, anchor);
  } else if (button.parentElement !== buttonContainer) {
    buttonContainer.appendChild(button);
  }
}

function cleanupEmptyFallbackContainers(root) {
  root.querySelectorAll?.('.chatvault-inline-actions').forEach((wrapper) => {
    if (!wrapper.querySelector('.chatvault-save-btn')) {
      wrapper.remove();
    }
  });
}

function hasContent(element) {
  return Boolean((element?.textContent || '').replace(/\s+/g, ' ').trim());
}

function extractGeminiResponseId(text) {
  const match = String(text || '').match(/\b(r_[A-Za-z0-9_-]+)\b/);
  return match ? match[1] : null;
}

function getResponseIdFromMessage(element) {
  if (!element) return null;
  const ownId = extractGeminiResponseId(element.id);
  if (ownId) return ownId;

  const contentElement = element.matches?.(GEMINI_MESSAGE_CONTENT_SELECTOR)
    ? element
    : element.querySelector?.(GEMINI_MESSAGE_CONTENT_SELECTOR);
  return extractGeminiResponseId(contentElement?.id);
}

function getResponseIdFromActionContainer(element) {
  if (!element) return null;
  const ownJslog = element.getAttribute?.('jslog');
  const ownId = extractGeminiResponseId(ownJslog);
  if (ownId) return ownId;

  const jslogElement = element.querySelector?.('[jslog*="r_"]');
  return extractGeminiResponseId(jslogElement?.getAttribute('jslog'));
}

function findMessageByResponseId(responseId) {
  if (!responseId) return null;
  const selectors = getSelectors();
  const candidates = Array.from(document.querySelectorAll(selectors.container));
  return candidates.find((candidate) => (
    getResponseIdFromMessage(candidate) === responseId &&
    hasContent(candidate)
  )) || null;
}

function findActionContainerByResponseId(responseId) {
  if (!responseId) return null;
  return Array.from(document.querySelectorAll(GEMINI_ACTION_CONTAINER_SELECTOR))
    .find((container) => getResponseIdFromActionContainer(container) === responseId) || null;
}

function isActionContainerForMessage(container, messageRoot) {
  if (!container) return false;
  const messageResponseId = getResponseIdFromMessage(messageRoot);
  const containerResponseId = getResponseIdFromActionContainer(container);
  return !messageResponseId || !containerResponseId || messageResponseId === containerResponseId;
}

function findActionContainerInElement(element, messageRoot) {
  if (!element) return null;
  const container = element.matches?.(GEMINI_ACTION_CONTAINER_SELECTOR)
    ? element
    : element.querySelector?.(GEMINI_ACTION_CONTAINER_SELECTOR);
  return isActionContainerForMessage(container, messageRoot) ? container : null;
}

function findNearbyActionContainerFromMessage(messageRoot) {
  let node = messageRoot;
  let depth = 0;

  while (node && node !== document.body && depth < 8) {
    const nested = findActionContainerInElement(node, messageRoot);
    if (nested) return nested;

    let sibling = node.nextElementSibling;
    let siblingCount = 0;
    while (sibling && siblingCount < 8) {
      const found = findActionContainerInElement(sibling, messageRoot);
      if (found) return found;
      sibling = sibling.nextElementSibling;
      siblingCount += 1;
    }

    sibling = node.previousElementSibling;
    siblingCount = 0;
    while (sibling && siblingCount < 8) {
      const found = findActionContainerInElement(sibling, messageRoot);
      if (found) return found;
      sibling = sibling.previousElementSibling;
      siblingCount += 1;
    }

    node = node.parentElement;
    depth += 1;
  }

  return null;
}

function findMessageInScope(scope) {
  if (!scope) return null;
  const selectors = getSelectors();
  const candidates = [];
  if (scope.matches?.(selectors.container)) {
    candidates.push(scope);
  }
  candidates.push(...Array.from(scope.querySelectorAll?.(selectors.container) || []));
  return candidates.find((candidate) => (
    candidate.matches?.(GEMINI_MESSAGE_CONTENT_SELECTOR) &&
    isVisibleElement(candidate) &&
    hasContent(candidate)
  ))
    || candidates.find((candidate) => (
      candidate.matches?.(GEMINI_MESSAGE_CONTENT_SELECTOR) &&
      hasContent(candidate)
    ))
    || candidates.find((candidate) => isVisibleElement(candidate) && hasContent(candidate))
    || candidates.find((candidate) => hasContent(candidate))
    || null;
}

function findNearbyMessageFromActions(actionsElement) {
  const byResponseId = findMessageByResponseId(getResponseIdFromActionContainer(actionsElement));
  if (byResponseId) return byResponseId;

  let node = actionsElement;
  while (node && node !== document.body) {
    let sibling = node.previousElementSibling;
    while (sibling) {
      const found = findMessageInScope(sibling);
      if (found) return found;
      sibling = sibling.previousElementSibling;
    }

    const scope = node.closest?.('model-response, response-container, .response-container, .conversation-container, .conversation-turn');
    const scopedMessage = findMessageInScope(scope);
    if (scopedMessage) return scopedMessage;

    node = node.parentElement;
  }
  return null;
}

function resolveMessageRoot(element) {
  if (!element) return null;
  if (element.__chatvaultMessageElement?.isConnected) return element.__chatvaultMessageElement;

  const selectors = getSelectors();

  if (element.matches?.(GEMINI_ACTION_CONTAINER_SELECTOR) || element.querySelector?.(GEMINI_ACTION_CONTAINER_SELECTOR)) {
    const actions = element.matches?.(GEMINI_ACTION_CONTAINER_SELECTOR)
      ? element
      : element.querySelector(GEMINI_ACTION_CONTAINER_SELECTOR);
    const nearby = findNearbyMessageFromActions(actions);
    if (nearby) return nearby;
  }

  const geminiMarkdownPanel = element.closest?.('[id^="model-response-message-content"], [inline-copy-host].markdown-main-panel')
    || element.querySelector?.('[id^="model-response-message-content"], [inline-copy-host].markdown-main-panel');
  if (geminiMarkdownPanel && hasContent(geminiMarkdownPanel)) return geminiMarkdownPanel;

  const messageContent = element.closest?.('message-content') || element.querySelector?.('message-content');
  if (messageContent && hasContent(messageContent)) return messageContent;

  const modelResponseText = element.closest?.('.model-response-text') || element.querySelector?.('.model-response-text');
  if (modelResponseText && hasContent(modelResponseText)) {
    return modelResponseText.closest?.('message-content') || modelResponseText;
  }

  const userMessage = element.closest?.('.user-message') || element.querySelector?.('.user-message');
  if (userMessage && hasContent(userMessage)) return userMessage;

  if (element.matches?.(selectors.container) && hasContent(element)) return element;

  const scoped = findMessageInScope(element.closest?.('model-response, response-container, .response-container, .conversation-container, .conversation-turn') || element);
  if (scoped) return scoped;

  return findMessageInScope(document.body);
}

function getButtonScope(messageRoot) {
  return messageRoot.closest?.(GEMINI_RESPONSE_SCOPE_SELECTOR)
    || messageRoot;
}

function findActionContainer(messageRoot) {
  const responseId = getResponseIdFromMessage(messageRoot);
  const byResponseId = findActionContainerByResponseId(responseId);
  if (byResponseId) return byResponseId;

  const scope = getButtonScope(messageRoot);
  const scopedContainer = findActionContainerInElement(scope, messageRoot);
  if (scopedContainer) return scopedContainer;

  const nearbyContainer = findNearbyActionContainerFromMessage(messageRoot);
  if (nearbyContainer) return nearbyContainer;

  return findActionContainerInElement(messageRoot, messageRoot);
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
  const messages = document.querySelectorAll(GEMINI_ACTION_CONTAINER_SELECTOR);
  messages.forEach(buttonContainer => {
    addSaveButton(buttonContainer.parentElement, createSaveButton);
  });

  // mutation observerを設定
  globalObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const buttonContainers = node.matches && node.matches(GEMINI_ACTION_CONTAINER_SELECTOR)
              ? [node]
              : node.querySelectorAll ? node.querySelectorAll(GEMINI_ACTION_CONTAINER_SELECTOR) : [];

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
    if (btn.__chatvaultMessageElement?.isConnected) {
      return btn.__chatvaultMessageElement;
    }

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
    const buttonsContainer = btn.closest(GEMINI_ACTION_CONTAINER_SELECTOR);
    const responseContainer = btn.closest('.response-container');

    if (responseContainer) {
      const msg = responseContainer.querySelector(selectors.container);
      if (msg) return msg;

      const contentScope = responseContainer.querySelector('.response-container-content') || responseContainer;
      const msgAlt = contentScope.querySelector(selectors.container);
      if (msgAlt) return msgAlt;
    }

    if (buttonsContainer) {
      const nearby = findNearbyMessageFromActions(buttonsContainer);
      if (nearby) return nearby;

      const parent = buttonsContainer.parentElement;
      if (parent) {
        const withinParent = parent.querySelector(selectors.container);
        if (withinParent) return withinParent;
      }
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
