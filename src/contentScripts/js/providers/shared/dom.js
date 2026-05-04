export const CHATVAULT_UI_IGNORE_SELECTORS = [
  '.chatvault-save-btn',
  '.chatvault-inline-actions',
  '[data-chatvault-ignore]'
];

export function safeMatches(element, selector) {
  try {
    return Boolean(element?.nodeType === Node.ELEMENT_NODE && element.matches?.(selector));
  } catch (_) {
    return false;
  }
}

export function safeQueryAll(root, selector) {
  try {
    return root?.querySelectorAll ? Array.from(root.querySelectorAll(selector)) : [];
  } catch (_) {
    return [];
  }
}

export function cloneWithoutSelectors(element, ignoreSelectors = []) {
  const cloned = element.cloneNode(true);
  const selector = [...CHATVAULT_UI_IGNORE_SELECTORS, ...ignoreSelectors].join(', ');
  safeQueryAll(cloned, selector).forEach((el) => el.remove());
  return cloned;
}

export function createFallbackActionContainer(root, anchorElement = null, options = {}) {
  let wrapper = anchorElement
    ? root.querySelector('.chatvault-inline-actions')
    : root.querySelector(':scope > .chatvault-inline-actions');
  const justifyContent = options.justifyContent || 'flex-end';
  const anchorParent = anchorElement?.parentElement;
  const canUseAnchor = anchorElement && anchorParent && root.contains(anchorElement);

  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'chatvault-inline-actions';
    wrapper.style.cssText = `
      display: flex;
      justify-content: ${justifyContent};
      align-items: center;
      gap: 4px;
      margin-top: 6px;
    `;
  }

  wrapper.style.justifyContent = justifyContent;

  if (canUseAnchor) {
    anchorParent.insertBefore(wrapper, anchorElement.nextSibling);
  } else if (wrapper.parentElement !== root) {
    root.appendChild(wrapper);
  }

  return wrapper;
}

export function getDirectChild(container, descendant) {
  let node = descendant;
  while (node && node.parentElement && node.parentElement !== container) {
    node = node.parentElement;
  }
  return node?.parentElement === container ? node : null;
}

export function isVisibleElement(element) {
  if (!element || !(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle ? window.getComputedStyle(element) : null;
  if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  const rect = element.getBoundingClientRect?.();
  if (!rect || rect.width > 0 || rect.height > 0) return true;
  return Boolean((element.textContent || '').trim());
}
