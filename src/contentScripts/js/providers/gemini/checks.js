// Gemini checks and selectors
export function getSelectors() {
  // Geminiのメッセージコンテナ
  const container = [
    'message-content',
    '[id^="message-content-id-"]',
    '.model-response-text',
    '.user-message'
  ].join(', ');

  // ユーザーメッセージ
  const userMessage = [
    '.user-message',
    '[data-role="user"]'
  ].join(', ');

  // アシスタントメッセージ（Geminiの応答）
  const assistantMessage = [
    'message-content',
    '[id^="message-content-id-"]',
    '.model-response-text'
  ].join(', ');

  // メッセージコンテンツ
  const content = [
    'message-content',
    '[id^="message-content-id-"]',
    '.markdown',
    '.markdown-main-panel',
    '.model-response-text',
    '.response-container-content',
    '[class*="markdown"]'
  ].join(', ');

  return { container, userMessage, assistantMessage, content };
}
