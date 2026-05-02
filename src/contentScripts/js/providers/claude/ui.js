// Claude UI helpers for DOM-first MVP capture.
import { getSelectors } from './checks.js';
import { createLogger } from '../../../../utils/logger.js';

const log = createLogger('Claude UI');

let observer = null;
let globalTooltip = null;
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

function getRootMessageElement(messageElement) {
  const selectors = getSelectors();
  return messageElement.closest?.('[data-test-render-count]')
    || messageElement.closest?.(selectors.container)
    || messageElement;
}

function createFallbackActionContainer(root) {
  let wrapper = root.querySelector(':scope > .chatvault-inline-actions');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'chatvault-inline-actions';
    wrapper.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 4px;
      margin-top: 6px;
    `;
    root.appendChild(wrapper);
  }
  return wrapper;
}

function getDirectChild(container, descendant) {
  let node = descendant;
  while (node && node.parentElement && node.parentElement !== container) {
    node = node.parentElement;
  }
  return node?.parentElement === container ? node : null;
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
    if (!root || root.querySelector('.chatvault-save-btn')) {
      return { added: false, button: root?.querySelector('.chatvault-save-btn') || null, target: root };
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
}

function startContentScriptIntegration() {
  try {
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    document.querySelectorAll('.chatvault-save-btn, .chatvault-inline-actions').forEach((el) => el.remove());
    if (!inlineButtonsEnabled()) {
      return true;
    }

    scanMessages();

    observer = new MutationObserver((mutations) => {
      const hasElementChanges = mutations.some((mutation) =>
        mutation.type === 'childList' && Array.from(mutation.addedNodes).some((node) => node.nodeType === Node.ELEMENT_NODE)
      );
      if (hasElementChanges) {
        scanMessages();
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
  addSaveButton,
  resolveMessageElementFromButton,
  injectObsidianMenuItem,
  startContentScriptIntegration
};
