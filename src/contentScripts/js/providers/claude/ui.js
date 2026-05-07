// Claude UI helpers for DOM-first MVP capture.
import { getSelectors } from './checks.js';
import { createLogger } from '../../../../utils/logger.js';
import { createFallbackActionContainer, getDirectChild } from '../shared/dom.js';

const log = createLogger('Claude UI');

let observer = null;
let globalTooltip = null;
let rescanTimer = null;
const SAVE_TOOLTIP_TEXT = 'Obsidianに保存する';
const CODE_SAVE_TOOLTIP_TEXT = 'コードブロックをObsidianに保存する';
const MESSAGE_SAVE_BUTTON_SELECTOR = '.chatvault-save-btn:not([data-chatvault-save-kind="code-block"])';
const CODE_SAVE_BUTTON_SELECTOR = '.chatvault-save-btn[data-chatvault-save-kind="code-block"]';

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
    "></div>
  `;
  document.body.appendChild(globalTooltip);
  return globalTooltip;
}

function showTooltip(button) {
  const tooltip = ensureTooltip();
  const tooltipBody = tooltip.firstElementChild;
  if (tooltipBody) {
    tooltipBody.textContent = button.getAttribute('data-tooltip') || SAVE_TOOLTIP_TEXT;
  }
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

function createSaveButton() {
  const button = document.createElement('button');
  button.className = 'chatvault-save-btn';
  button.type = 'button';
  button.setAttribute('aria-label', 'Obsidianに保存');
  button.setAttribute('data-tooltip', SAVE_TOOLTIP_TEXT);
  button.setAttribute('data-test-id', 'chatvault-save-button');
  button.setAttribute('data-state', 'closed');
  button.style.cssText = `
    background-color: transparent;
    color: rgb(120, 113, 108);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
    padding: 4px;
    margin: 0 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  `;
  button.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  `;

  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = 'rgba(0, 0, 0, 0.08)';
    button.style.color = 'rgb(68, 64, 60)';
    button.setAttribute('data-state', 'delayed-open');
    showTooltip(button);
  });
  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = 'transparent';
    button.style.color = 'rgb(120, 113, 108)';
    button.setAttribute('data-state', 'closed');
    hideTooltip();
  });
  button.addEventListener('focus', () => {
    button.setAttribute('data-state', 'delayed-open');
    showTooltip(button);
  });
  button.addEventListener('blur', () => {
    button.setAttribute('data-state', 'closed');
    hideTooltip();
  });

  return button;
}

function createCodeBlockSaveButton() {
  const button = document.createElement('button');
  button.className = 'chatvault-save-btn chatvault-claude-code-save-btn';
  button.type = 'button';
  button.setAttribute('aria-label', 'コードブロックをObsidianに保存');
  button.setAttribute('data-tooltip', CODE_SAVE_TOOLTIP_TEXT);
  button.setAttribute('data-test-id', 'chatvault-code-save-button');
  button.setAttribute('data-state', 'closed');
  button.setAttribute('data-chatvault-save-kind', 'code-block');
  button.style.cssText = `
    background-color: transparent;
    color: rgb(234, 236, 240);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
    padding: 0;
    margin: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex: 0 0 auto;
    line-height: 0;
  `;
  button.innerHTML = `
    <svg class="chatvault-code-save-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" style="display:block;width:20px;height:20px;flex:0 0 auto;pointer-events:none;">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"></path>
      <polyline points="17 21 17 13 7 13 7 21"></polyline>
      <polyline points="7 3 7 8 15 8"></polyline>
    </svg>
  `;

  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
    button.style.color = 'rgb(255, 255, 255)';
    button.setAttribute('data-state', 'delayed-open');
    showTooltip(button);
  });
  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = 'transparent';
    button.style.color = 'rgb(234, 236, 240)';
    button.setAttribute('data-state', 'closed');
    hideTooltip();
  });
  button.addEventListener('focus', () => {
    button.setAttribute('data-state', 'delayed-open');
    showTooltip(button);
  });
  button.addEventListener('blur', () => {
    button.setAttribute('data-state', 'closed');
    hideTooltip();
  });

  return button;
}

function getRootMessageElement(messageElement) {
  const selectors = getSelectors();
  return messageElement.closest?.('[data-test-render-count]')
    || messageElement.closest?.(selectors.container)
    || messageElement;
}

function findActionBar(root, copyButton) {
  const nearestToolbar = copyButton?.closest?.('[role="toolbar"]');
  if (nearestToolbar && root.contains(nearestToolbar)) {
    return nearestToolbar;
  }

  const actionBars = Array.from(root.querySelectorAll('.flex.items-stretch.justify-between, [role="toolbar"]'));
  return actionBars.find((bar) => copyButton && bar.contains(copyButton))
    || actionBars[0]
    || null;
}

function addSaveButton(messageElement, createBtn) {
  try {
    if (!inlineButtonsEnabled()) {
      return { added: false, button: null, target: null };
    }

    const root = getRootMessageElement(messageElement);
    if (!root || root.querySelector(MESSAGE_SAVE_BUTTON_SELECTOR)) {
      return { added: false, button: root?.querySelector(MESSAGE_SAVE_BUTTON_SELECTOR) || null, target: root };
    }

    const button = typeof createBtn === 'function' ? createBtn() : createSaveButton();
    const selectors = getSelectors();
    const copyButton = root.querySelector(selectors.copyButton || '[data-testid="action-bar-copy"]');
    if (copyButton) {
      const actionBar = findActionBar(root, copyButton);
      const copyAction = actionBar ? getDirectChild(actionBar, copyButton) : null;
      if (actionBar && copyAction) {
        actionBar.insertBefore(button, copyAction);
        return { added: true, button, target: actionBar };
      }
      if (copyButton.parentElement) {
        copyButton.parentElement.insertBefore(button, copyButton);
        return { added: true, button, target: copyButton.parentElement };
      }
    }

    const actionBar = root.querySelector('.flex.items-stretch.justify-between, [role="toolbar"]');
    if (actionBar) {
      actionBar.insertBefore(button, actionBar.firstElementChild || null);
      return { added: true, button, target: actionBar };
    }

    const wrapper = createFallbackActionContainer(root);
    wrapper.appendChild(button);
    return { added: true, button, target: wrapper };
  } catch (error) {
    log.error('Claude save button injection failed:', error);
    return { added: false, button: null, target: null };
  }
}

function resolveCodeBlockRoot(element) {
  const selectors = getSelectors();
  const root = element.closest?.('div[role="group"][aria-label="コード"], div[role="group"][aria-label="Code"]')
    || element.closest?.('pre')
    || (element.matches?.(selectors.codeBlock) ? element : null)
    || element.querySelector?.(selectors.codeBlock);

  if (!root) return null;
  if (root.matches?.('div[role="group"][aria-label="コード"], div[role="group"][aria-label="Code"], pre, code')) {
    return root.matches?.('code') ? root.closest('pre') || root : root;
  }
  return root.querySelector?.('div[role="group"][aria-label="コード"], div[role="group"][aria-label="Code"], pre') || null;
}

function findCodeBlockCopyButton(codeBlockRoot) {
  const buttons = Array.from(codeBlockRoot.querySelectorAll?.('button, [role="button"]') || []);
  return buttons.find((button) => {
    if (button.matches?.('.chatvault-save-btn')) return false;
    const label = [
      button.getAttribute?.('aria-label') || '',
      button.getAttribute?.('title') || '',
      button.textContent || ''
    ].join(' ');
    return /クリップボードにコピー|コピー|copy/i.test(label);
  }) || null;
}

function createFallbackCodeActionContainer(codeBlockRoot) {
  const wrapper = document.createElement('div');
  wrapper.className = 'chatvault-code-actions';
  wrapper.setAttribute('data-chatvault-ignore', 'true');
  wrapper.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 20;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    pointer-events: auto;
  `;

  const currentPosition = window.getComputedStyle?.(codeBlockRoot)?.position;
  if (!currentPosition || currentPosition === 'static') {
    codeBlockRoot.style.position = 'relative';
  }
  codeBlockRoot.appendChild(wrapper);
  return wrapper;
}

function getCodeBlockActionContainer(codeBlockRoot) {
  const copyButton = findCodeBlockCopyButton(codeBlockRoot);
  if (copyButton?.parentElement) {
    return { container: copyButton.parentElement, copyButton, native: true };
  }

  const existingFallback = codeBlockRoot.querySelector?.('.chatvault-code-actions');
  if (existingFallback) {
    return { container: existingFallback, copyButton: null, native: false };
  }

  return { container: createFallbackCodeActionContainer(codeBlockRoot), copyButton: null, native: false };
}

function addCodeBlockSaveButton(codeBlockElement, createBtn = createCodeBlockSaveButton) {
  try {
    if (!inlineButtonsEnabled()) {
      return { added: false, button: null, target: null };
    }

    const root = resolveCodeBlockRoot(codeBlockElement);
    if (!root) {
      return { added: false, button: null, target: null };
    }

    const existingButton = root.querySelector(CODE_SAVE_BUTTON_SELECTOR);
    const { container, copyButton } = getCodeBlockActionContainer(root);
    if (existingButton) {
      existingButton.__chatvaultCodeBlockElement = root;
      if (existingButton.parentElement !== container) {
        if (copyButton) {
          container.insertBefore(existingButton, copyButton);
        } else {
          container.appendChild(existingButton);
        }
      }
      return { added: false, button: existingButton, target: container };
    }

    const button = typeof createBtn === 'function' ? createBtn() : createCodeBlockSaveButton();
    button.__chatvaultCodeBlockElement = root;
    if (copyButton) {
      container.insertBefore(button, copyButton);
    } else {
      container.appendChild(button);
    }

    return { added: true, button, target: container };
  } catch (error) {
    log.error('Claude code block save button injection failed:', error);
    return { added: false, button: null, target: null };
  }
}

function resolveMessageElementFromButton(btn) {
  const selectors = getSelectors();
  return btn.closest('[data-test-render-count]')
    || btn.closest(selectors.container)
    || btn.closest('[data-testid="user-message"]')
    || btn.closest('.font-claude-response')
    || null;
}

function scanMessages() {
  if (!inlineButtonsEnabled()) return;
  const selectors = getSelectors();
  document.querySelectorAll(selectors.container).forEach((message) => {
    addSaveButton(message, () => createSaveButton());
  });
  document.querySelectorAll(selectors.codeBlock).forEach((codeBlock) => {
    addCodeBlockSaveButton(codeBlock, () => createCodeBlockSaveButton());
  });
}

function startContentScriptIntegration() {
  try {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (rescanTimer) {
      clearTimeout(rescanTimer);
      rescanTimer = null;
    }

    document.querySelectorAll('.chatvault-save-btn, .chatvault-inline-actions, .chatvault-code-actions').forEach((el) => el.remove());
    if (!inlineButtonsEnabled()) {
      return true;
    }

    scanMessages();

    observer = new MutationObserver((mutations) => {
      const hasElementChanges = mutations.some((mutation) =>
        mutation.type === 'childList' && Array.from(mutation.addedNodes).some((node) => node.nodeType === Node.ELEMENT_NODE)
      );
      if (hasElementChanges) {
        clearTimeout(rescanTimer);
        rescanTimer = setTimeout(() => {
          rescanTimer = null;
          scanMessages();
        }, 150);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    log.info('Claude DOM integration initialized');
    return true;
  } catch (error) {
    log.error('Claude integration initialization failed:', error);
    return false;
  }
}

function injectObsidianMenuItem() {
  return false;
}

export {
  createSaveButton,
  createCodeBlockSaveButton,
  addSaveButton,
  addCodeBlockSaveButton,
  resolveMessageElementFromButton,
  injectObsidianMenuItem,
  startContentScriptIntegration
};
