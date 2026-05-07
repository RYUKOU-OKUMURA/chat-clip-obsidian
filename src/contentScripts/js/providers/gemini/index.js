import { getSelectors } from './checks.js';
import { addSaveButton, addCodeBlockSaveButton, createSaveButton, createCodeBlockSaveButton, createChatButtonsContainer, createToolbar, resolveMessageElementFromButton, initializeGeminiWithNewButtons } from './ui.js';
import { extractSingleMessage, extractCodeBlock, captureMessages } from './text.js';
import * as Comm from './comm.js';

const GeminiProvider = {
  getSelectors,
  addSaveButton,
  addCodeBlockSaveButton,
  createSaveButton,
  createCodeBlockSaveButton,
  createChatButtonsContainer,
  createToolbar,
  extractSingleMessage,
  extractCodeBlock,
  captureMessages,
  resolveMessageElementFromButton,
  initialize: initializeGeminiWithNewButtons,
  comm: Comm
};

export default GeminiProvider;
