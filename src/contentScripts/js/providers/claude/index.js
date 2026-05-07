import { getSelectors } from './checks.js';
import { addSaveButton, addCodeBlockSaveButton, createSaveButton, createCodeBlockSaveButton, resolveMessageElementFromButton, injectObsidianMenuItem, startContentScriptIntegration } from './ui.js';
import { extractSingleMessage, extractCodeBlock, captureMessages } from './text.js';

const ClaudeProvider = {
  // Selectors & UI helpers
  getSelectors,
  addSaveButton,
  addCodeBlockSaveButton,
  createSaveButton,
  createCodeBlockSaveButton,
  resolveMessageElementFromButton,
  injectObsidianMenuItem,
  // Text extraction interface for generic handler
  extractSingleMessage,
  extractCodeBlock,
  captureMessages,
  // Content script integration
  startContentScriptIntegration,
  // 統一初期化メソッド（他のプロバイダーと合わせるため）
  initialize: startContentScriptIntegration,
};

export default ClaudeProvider;
