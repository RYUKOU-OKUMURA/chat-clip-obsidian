// Gemini checks and selectors
export const GEMINI_MESSAGE_CONTENT_SELECTOR = [
  'message-content',
  '[id^="message-content-id-"]',
  '[id^="model-response-message-content"]',
  '[inline-copy-host].markdown-main-panel',
  '.model-response-text'
].join(', ');

export const GEMINI_RESPONSE_SCOPE_SELECTOR = [
  'model-response',
  'response-container',
  '.response-container',
  '.conversation-container',
  '.conversation-turn',
  '.response-container-content'
].join(', ');

export const GEMINI_ACTION_CONTAINER_SELECTOR = '.buttons-container-v2';
export const GEMINI_COPY_BUTTON_SELECTOR = '[data-test-id="copy-button"]';
export const GEMINI_CODE_PANEL_SELECTOR = 'code-immersive-panel';

export function getSelectors() {
  // Geminiのメッセージコンテナ
  const container = [
    GEMINI_MESSAGE_CONTENT_SELECTOR,
    GEMINI_CODE_PANEL_SELECTOR,
    '.user-message'
  ].join(', ');

  // ユーザーメッセージ
  const userMessage = [
    '.user-message',
    '[data-role="user"]'
  ].join(', ');

  // アシスタントメッセージ（Geminiの応答）
  const assistantMessage = [
    GEMINI_MESSAGE_CONTENT_SELECTOR,
    GEMINI_CODE_PANEL_SELECTOR
  ].join(', ');

  // メッセージコンテンツ
  const content = [
    GEMINI_MESSAGE_CONTENT_SELECTOR,
    '.markdown',
    '.markdown-main-panel',
    '.response-container-content',
    '[class*="markdown"]'
  ].join(', ');

  return {
    container,
    userMessage,
    assistantMessage,
    content,
    messageContent: GEMINI_MESSAGE_CONTENT_SELECTOR,
    responseScope: GEMINI_RESPONSE_SCOPE_SELECTOR,
    actionContainer: GEMINI_ACTION_CONTAINER_SELECTOR,
    copyButton: GEMINI_COPY_BUTTON_SELECTOR,
    codePanel: GEMINI_CODE_PANEL_SELECTOR
  };
}
