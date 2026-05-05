// ChatGPT checks and selectors
// Broadened selectors to work across SPA navigations and UI variants without reload
export function getSelectors() {
  // Primary containers in various ChatGPT UIs:
  // - [data-message-author-role][data-message-id]: stable identifier when present
  // - [data-message-author-role]: sometimes appears without data-message-id during streaming/initial render
  // - [data-testid^="conversation-turn-"]: container wrapper used in some builds
  // - .conversation-turn, .group.w-full: fallback containers seen in older/new variants
  const container = [
    '[data-message-author-role][data-message-id]',
    '[data-message-author-role]:not([data-testid])',
    '[data-testid^="conversation-turn-"]',
    '.conversation-turn',
    '.group.w-full [data-message-author-role]'
  ].join(', ');

  const userMessage = [
    '[data-message-author-role="user"][data-message-id]',
    '[data-message-author-role="user"]:not([data-testid])',
    '.conversation-turn [data-message-author-role="user"]'
  ].join(', ');

  const assistantMessage = [
    '[data-message-author-role="assistant"][data-message-id]',
    '[data-message-author-role="assistant"]:not([data-testid])',
    '.conversation-turn [data-message-author-role="assistant"]'
  ].join(', ');

  const content = '.markdown, [class*="markdown"], .prose, [class*="prose"], .whitespace-pre-wrap';
  const codeBlock = [
    '#code-block-viewer',
    '.cm-editor .cm-content',
    'pre > code',
    'pre.cm-content'
  ].join(', ');

  return { container, userMessage, assistantMessage, content, codeBlock };
}
