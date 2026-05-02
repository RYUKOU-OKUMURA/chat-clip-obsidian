// UI helpers for content script
// Button factory for the save button used across providers

// プロバイダーを直接インポート
import ChatGPTProvider from '../providers/chatgpt/index.js';
import GeminiProvider from '../providers/gemini/index.js';
import ClaudeProvider from '../providers/claude/index.js';

// サービスに応じて適切なボタン作成関数を返す
export function createSaveButton(service) {
  switch (service) {
    case 'chatgpt':
      return ChatGPTProvider.createSaveButton();
    case 'gemini':
      return GeminiProvider.createSaveButton();
    case 'claude':
      return ClaudeProvider.createSaveButton();
    default:
      throw new Error(`未対応のサービスです: ${service}`);
  }
}
