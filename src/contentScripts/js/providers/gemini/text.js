// Gemini text extraction
import {
  GEMINI_CODE_PANEL_SELECTOR,
  getSelectors
} from './checks.js';
import { toMarkdownIfHtml } from './markdown.js';
import { stripServiceTitle } from '../../../../utils/chat/formatting.js';
import { cloneWithoutSelectors } from '../shared/dom.js';

function getContentElement(messageElement) {
  const selectors = getSelectors();
  if (messageElement.matches?.(selectors.content)) return messageElement;
  return messageElement.querySelector?.(selectors.content) || messageElement;
}

function cleanClone(element) {
  return cloneWithoutSelectors(element, [
    '.buttons-container-v2',
    '[data-test-id="copy-button"]',
    '[data-test-id="share-and-export-menu-button"]',
    '[data-test-id="more-menu-button"]',
    'thumb-up-button',
    'thumb-down-button',
    'regenerate-button',
    'copy-button',
    'button',
    'mat-icon'
  ]);
}

function resolveCaptureRoot(element) {
  if (element.closest?.(GEMINI_CODE_PANEL_SELECTOR)) return element.closest(GEMINI_CODE_PANEL_SELECTOR);
  if (element.matches?.(GEMINI_CODE_PANEL_SELECTOR)) return element;
  const markdownPanel = element.closest?.('[id^="model-response-message-content"], [inline-copy-host].markdown-main-panel');
  if (markdownPanel) return markdownPanel;
  if (element.matches?.('[id^="model-response-message-content"], [inline-copy-host].markdown-main-panel')) return element;
  if (element.closest?.('message-content')) return element.closest('message-content');
  if (element.matches?.('message-content')) return element;
  if (element.closest?.('.user-message')) return element.closest('.user-message');
  if (element.matches?.('.user-message')) return element;
  if (element.closest?.('.model-response-text')) {
    return element.closest('message-content') || element.closest('.model-response-text');
  }
  return element;
}

function getCaptureElements() {
  const selectors = getSelectors();
  const seen = new Set();
  return Array.from(document.querySelectorAll(selectors.container))
    .map(resolveCaptureRoot)
    .filter((element) => {
      if (!element || seen.has(element)) return false;
      seen.add(element);
      return Boolean((element.textContent || '').trim());
    });
}

export function extractSingleMessage(messageElement) {
  const selectors = getSelectors();
  try {
    let contentEl = getContentElement(messageElement);
    const cloned = cleanClone(contentEl);
    const html = (cloned.innerHTML || '').trim();
    const raw = html || (cloned.textContent || '').trim();
    
    // code-immersive-panelの場合は特別な処理
    const codeImmersivePanel = messageElement.closest(GEMINI_CODE_PANEL_SELECTOR);
    if (codeImmersivePanel) {
      return extractCodeImmersivePanelContent(codeImmersivePanel);
    }
    
    const content = html ? toMarkdownIfHtml(html) : raw;

    // Geminiのメッセージ要素からロールを判定
    let role = 'assistant'; // デフォルトはアシスタント（Geminiの応答）
    
    // ユーザーメッセージかどうかを判定
    if (messageElement.matches && messageElement.matches(selectors.userMessage)) {
      role = 'user';
    } else {
      // 子要素にユーザーメッセージがあるかチェック
      const userMessageEl = messageElement.querySelector(selectors.userMessage);
      if (userMessageEl) {
        role = 'user';
      }
    }

    const title = stripServiceTitle(document.title, 'gemini');

    return { role, content, title };
  } catch (_) {
    const text = messageElement.textContent || messageElement.innerText || '';
    let role = 'assistant';
    
    // フォールバックでのロール判定
    if (messageElement.matches && messageElement.matches(selectors.userMessage)) {
      role = 'user';
    } else {
      const userMessageEl = messageElement.querySelector(selectors.userMessage);
      if (userMessageEl) {
        role = 'user';
      }
    }
    
    const title = stripServiceTitle(document.title, 'gemini');
      
    return { role, content: text, title };
  }
}

export function captureMessages(mode, count = null) {
  const selectors = getSelectors();
  
  const allMessages = getCaptureElements().map((msg) => {
    if (msg.matches?.(selectors.codePanel || GEMINI_CODE_PANEL_SELECTOR)) {
      const result = extractCodeImmersivePanelContent(msg);
      return {
        speaker: 'Assistant',
        content: result.content
      };
    }

    const contentEl = getContentElement(msg);
    
    // ロールを判定
    let role = 'assistant';
    if (msg.matches && msg.matches(selectors.userMessage)) {
      role = 'user';
    } else {
      const userMessageEl = msg.querySelector(selectors.userMessage);
      if (userMessageEl) {
        role = 'user';
      }
    }
    
    const cloned = contentEl ? cleanClone(contentEl) : null;
    const html = cloned ? cloned.innerHTML : '';
    return {
      speaker: role === 'user' ? 'User' : 'Assistant',
      content: html ? toMarkdownIfHtml(html) : (cloned?.textContent?.trim() || '')
    };
  });

  let messages = allMessages;
  if (mode === 'recent' && count) {
    messages = allMessages.slice(-count);
  } else if (mode === 'selected') {
    messages = allMessages;
  } else if (mode !== 'all' && mode !== 'recent') {
    throw new Error('無効なキャプチャモード: ' + mode);
  }

  const title = stripServiceTitle(document.title, 'gemini');

  return { success: true, messages, title, service: 'gemini' };
}

/**
 * code-immersive-panelからコードコンテンツを抽出する特別な処理
 * @param {HTMLElement} codeImmersivePanel - code-immersive-panel要素
 * @returns {Object} 抽出されたコンテンツ情報
 */
function extractCodeImmersivePanelContent(codeImmersivePanel) {
  try {
    // タイトルを取得（ツールバーのタイトルから）
    const titleElement = codeImmersivePanel.querySelector('.title-text');
    const title = titleElement ? titleElement.textContent.trim() : 'Code';
    
    // コードエディタからコードを取得
    const codeEditor = codeImmersivePanel.querySelector('[data-test-id="code-editor"]');
    let codeContent = '';
    
    if (codeEditor) {
      // Monacoエディタのtextareaからコードを取得（最優先）
      const textarea = codeEditor.querySelector('textarea');
      if (textarea && textarea.value) {
        codeContent = textarea.value;
      } else {
        // Monacoエディタのview-linesからコードを取得（重複を避ける）
        const viewLines = codeEditor.querySelector('.view-lines');
        if (viewLines) {
          // 各行のテキストを取得して結合
          const lines = Array.from(viewLines.querySelectorAll('.view-line'));
          const extractedLines = [];
          
          for (const line of lines) {
            // 行内のテキストコンテンツを取得
            const textContent = line.textContent || '';
            // 空行でない場合のみ追加
            if (textContent.trim()) {
              extractedLines.push(textContent);
            }
          }
          
          codeContent = extractedLines.join('\n');
          
          // 重複チェックと除去
          if (codeContent) {
            codeContent = removeDuplicateLines(codeContent);
          }
        } else {
          // 最後のフォールバック: Monacoエディタのモデルから取得を試行
          const monacoEditor = codeEditor.querySelector('.monaco-editor');
          if (monacoEditor) {
            // Monacoエディタのモデルから直接取得を試行
            try {
              // Monacoエディタのグローバルオブジェクトからモデルを取得
              if (window.monaco && window.monaco.editor) {
                const editors = window.monaco.editor.getEditors();
                for (const editor of editors) {
                  const model = editor.getModel();
                  if (model && model.getValue) {
                    codeContent = model.getValue();
                    break;
                  }
                }
              }
            } catch (e) {
              console.warn('Monaco editor model access failed:', e);
            }
          }
          
          // それでも取得できない場合は、コードエディタ全体のテキストから重複を除去
          if (!codeContent) {
            const fullText = codeEditor.textContent || '';
            // 重複した行を除去する処理
            codeContent = removeDuplicateLines(fullText);
          }
        }
      }
    }
    
    // 言語を判定（タイトルから推測）
    let language = '';
    if (title.toLowerCase().includes('python')) {
      language = 'python';
    } else if (title.toLowerCase().includes('javascript') || title.toLowerCase().includes('js')) {
      language = 'javascript';
    } else if (title.toLowerCase().includes('typescript') || title.toLowerCase().includes('ts')) {
      language = 'typescript';
    } else if (title.toLowerCase().includes('html')) {
      language = 'html';
    } else if (title.toLowerCase().includes('css')) {
      language = 'css';
    } else if (title.toLowerCase().includes('java')) {
      language = 'java';
    } else if (title.toLowerCase().includes('c++') || title.toLowerCase().includes('cpp')) {
      language = 'cpp';
    } else if (title.toLowerCase().includes('c#')) {
      language = 'csharp';
    } else if (title.toLowerCase().includes('go')) {
      language = 'go';
    } else if (title.toLowerCase().includes('rust')) {
      language = 'rust';
    } else if (title.toLowerCase().includes('php')) {
      language = 'php';
    } else if (title.toLowerCase().includes('ruby')) {
      language = 'ruby';
    } else if (title.toLowerCase().includes('swift')) {
      language = 'swift';
    } else if (title.toLowerCase().includes('kotlin')) {
      language = 'kotlin';
    } else if (title.toLowerCase().includes('scala')) {
      language = 'scala';
    } else if (title.toLowerCase().includes('r')) {
      language = 'r';
    } else if (title.toLowerCase().includes('matlab')) {
      language = 'matlab';
    } else if (title.toLowerCase().includes('sql')) {
      language = 'sql';
    } else if (title.toLowerCase().includes('bash') || title.toLowerCase().includes('shell')) {
      language = 'bash';
    } else if (title.toLowerCase().includes('yaml') || title.toLowerCase().includes('yml')) {
      language = 'yaml';
    } else if (title.toLowerCase().includes('json')) {
      language = 'json';
    } else if (title.toLowerCase().includes('xml')) {
      language = 'xml';
    } else if (title.toLowerCase().includes('markdown') || title.toLowerCase().includes('md')) {
      language = 'markdown';
    }
    
    // コードの前処理（重複除去と整形）
    if (codeContent) {
      // 重複行を除去
      codeContent = removeDuplicateLines(codeContent);
      // 前後の空白を除去
      codeContent = codeContent.trim();
    }
    
    // コードをMarkdown形式で整形
    const formattedCode = `\`\`\`${language}\n${codeContent}\n\`\`\``;
    
    // ページタイトルを取得
    const pageTitle = stripServiceTitle(document.title, 'gemini');
    
    return {
      role: 'assistant',
      content: formattedCode,
      title: pageTitle
    };
  } catch (error) {
    console.error('Error extracting code-immersive-panel content:', error);
    
    // フォールバック: 基本的なテキスト抽出
    const fallbackContent = codeImmersivePanel.textContent || '';
    const pageTitle = stripServiceTitle(document.title, 'gemini');
    
    return {
      role: 'assistant',
      content: fallbackContent,
      title: pageTitle
    };
  }
}

/**
 * 重複した行を除去する関数
 * @param {string} text - 重複が含まれる可能性のあるテキスト
 * @returns {string} 重複を除去したテキスト
 */
function removeDuplicateLines(text) {
  if (!text) return '';
  
  // テキストを行に分割
  const lines = text.split('\n');
  const uniqueLines = [];
  const seenLines = new Set();
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    // 空行や重複行をスキップ
    if (trimmedLine && !seenLines.has(trimmedLine)) {
      uniqueLines.push(line);
      seenLines.add(trimmedLine);
    }
  }
  
  return uniqueLines.join('\n');
}

// 関数をエクスポート
export { extractCodeImmersivePanelContent };
