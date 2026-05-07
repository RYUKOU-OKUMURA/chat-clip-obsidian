// Claude checks and selectors - API直接リクエスト型
// data-test-render-countを持つ要素を検出

export function getSelectors() {
  // data-test-render-countを持つメッセージコンテナ
  const container = [
    '[data-test-render-count]',
    '[data-testid="user-message"]',
    '.font-claude-response'
  ].join(', ');

  // ユーザーメッセージ
  const userMessage = '[data-testid="user-message"]';

  // アシスタントメッセージ
  const assistantMessage = '.font-claude-response';

  // コンテンツエリア
  const content = '.font-claude-response';

  // コピーボタン（ボタン配置用）
  const copyButton = '[data-testid="action-bar-copy"]';
  const codeBlock = [
    'div[role="group"][aria-label="コード"]',
    'div[role="group"][aria-label="Code"]',
    'pre.code-block__code',
    'pre > code'
  ].join(', ');

  return { container, userMessage, assistantMessage, content, copyButton, codeBlock };
}
