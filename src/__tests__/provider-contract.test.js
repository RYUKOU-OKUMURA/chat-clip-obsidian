import { captureMessages as captureChatGPT } from '../contentScripts/js/providers/chatgpt/text.js';
import { captureMessages as captureGemini, extractSingleMessage as extractGeminiSingle } from '../contentScripts/js/providers/gemini/text.js';
import { addSaveButton as addGeminiSaveButton, createSaveButton as createGeminiSaveButton, resolveMessageElementFromButton as resolveGeminiMessageFromButton } from '../contentScripts/js/providers/gemini/ui.js';
import { addSaveButton as addClaudeSaveButton, createSaveButton as createClaudeSaveButton } from '../contentScripts/js/providers/claude/ui.js';

describe('provider capture contract', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('ChatGPT captureMessages returns all and recent messages with service', () => {
    document.title = 'Planning - ChatGPT';
    document.body.innerHTML = `
      <article data-message-author-role="user" data-message-id="u1"><div class="whitespace-pre-wrap">Question</div></article>
      <article data-message-author-role="assistant" data-message-id="a1"><div class="markdown"><p>Answer</p></div></article>
      <article data-message-author-role="user" data-message-id="u2"><div class="whitespace-pre-wrap">Follow up</div></article>
    `;

    const all = captureChatGPT('all');
    const recent = captureChatGPT('recent', 2);

    expect(all.success).toBe(true);
    expect(all.service).toBe('chatgpt');
    expect(all.messages).toEqual([
      { speaker: 'User', content: 'Question' },
      { speaker: 'Assistant', content: 'Answer' },
      { speaker: 'User', content: 'Follow up' }
    ]);
    expect(recent.messages).toEqual(all.messages.slice(-2));
  });

  test('ChatGPT captureMessages deduplicates conversation-turn and role containers', () => {
    document.title = 'Planning - ChatGPT';
    document.body.innerHTML = `
      <article data-testid="conversation-turn-1">
        <div data-message-author-role="assistant" data-message-id="a1">
          <div class="markdown"><p>Final answer</p></div>
        </div>
      </article>
    `;

    const all = captureChatGPT('all');

    expect(all.messages).toEqual([
      { speaker: 'Assistant', content: 'Final answer' }
    ]);
  });

  test('Gemini captureMessages returns all and recent messages with service', () => {
    document.title = 'Research - Gemini';
    document.body.innerHTML = `
      <div class="user-message">Question</div>
      <message-content><div class="markdown"><p>Answer</p></div></message-content>
      <div class="user-message">Follow up</div>
    `;

    const all = captureGemini('all');
    const recent = captureGemini('recent', 1);

    expect(all.success).toBe(true);
    expect(all.service).toBe('gemini');
    expect(all.messages).toEqual([
      { speaker: 'User', content: 'Question' },
      { speaker: 'Assistant', content: 'Answer' },
      { speaker: 'User', content: 'Follow up' }
    ]);
    expect(recent.messages).toEqual([{ speaker: 'User', content: 'Follow up' }]);
  });

  test('Gemini captureMessages deduplicates nested response containers', () => {
    document.title = 'Research - Gemini';
    document.body.innerHTML = `
      <message-content>
        <div class="model-response-text">
          <div class="markdown"><p>Final answer</p></div>
        </div>
        <div class="buttons-container-v2"><button data-test-id="copy-button">Copy</button></div>
      </message-content>
    `;

    const all = captureGemini('all');

    expect(all.success).toBe(true);
    expect(all.messages).toEqual([
      { speaker: 'Assistant', content: 'Final answer' }
    ]);
  });

  test('Gemini extractSingleMessage uses the message-content element itself', () => {
    document.title = 'Research - Gemini';
    document.body.innerHTML = `
      <message-content>
        <p>Saved body</p>
        <div class="buttons-container-v2">
          <button data-test-id="copy-button">Copy</button>
          <button class="chatvault-save-btn">Save</button>
        </div>
      </message-content>
    `;

    const message = document.querySelector('message-content');
    const result = extractGeminiSingle(message);

    expect(result.role).toBe('assistant');
    expect(result.content).toBe('Saved body');
  });

  test('Gemini captureMessages supports current markdown-main-panel response element', () => {
    document.title = 'Research - Gemini';
    document.body.innerHTML = `
      <div
        inline-copy-host
        class="markdown markdown-main-panel stronger"
        id="model-response-message-contentr_8bb3df8eb9b632b2"
      >
        <p>Gemini body</p>
        <h3>Pattern 1</h3>
      </div>
    `;

    const all = captureGemini('all');

    expect(all.success).toBe(true);
    expect(all.messages).toEqual([
      { speaker: 'Assistant', content: 'Gemini body\n\n### Pattern 1' }
    ]);
  });

  test('Gemini save button inserts into native buttons-container before copy-button host', () => {
    document.body.innerHTML = `
      <div class="gemini-response">
        <div
          inline-copy-host
          class="markdown markdown-main-panel stronger"
          id="model-response-message-contentr_8bb3df8eb9b632b2"
        >
          <p>Gemini body</p>
        </div>
        <div class="buttons-container-v2">
          <thumb-up-button>
            <button data-test-id="thumb-up-button"></button>
          </thumb-up-button>
          <copy-button>
            <button
              data-test-id="copy-button"
              jslog="BardVeMetadataKey:[[&quot;r_8bb3df8eb9b632b2&quot;]]"
            ></button>
          </copy-button>
        </div>
      </div>
    `;

    const message = document.querySelector('[id^="model-response-message-content"]');
    const result = addGeminiSaveButton(message, createGeminiSaveButton);
    const buttonsContainer = document.querySelector('.buttons-container-v2');
    const saveButton = buttonsContainer.querySelector('.chatvault-save-btn');

    expect(result.added).toBe(true);
    expect(saveButton).toBe(result.button);
    expect(saveButton.parentElement).toBe(buttonsContainer);
    expect(saveButton.nextElementSibling.tagName.toLowerCase()).toBe('copy-button');
    expect(saveButton.getAttribute('data-tooltip')).toBe('Obsidianに保存する');
    expect(resolveGeminiMessageFromButton(saveButton)).toBe(message);
  });

  test('Claude save button does not inherit the copy tooltip wrapper', () => {
    document.body.innerHTML = `
      <div data-test-render-count>
        <div class="font-claude-response">Claude answer</div>
        <div role="toolbar">
          <span aria-label="コピー" data-copy-tooltip-host>
            <button data-testid="action-bar-copy" aria-label="コピー"></button>
          </span>
        </div>
      </div>
    `;

    const root = document.querySelector('[data-test-render-count]');
    const toolbar = document.querySelector('[role="toolbar"]');
    const copyHost = document.querySelector('[data-copy-tooltip-host]');
    const result = addClaudeSaveButton(root, createClaudeSaveButton);

    expect(result.added).toBe(true);
    expect(result.button.parentElement).toBe(toolbar);
    expect(result.button.nextElementSibling).toBe(copyHost);
    expect(result.button.getAttribute('aria-label')).toBe('Obsidianに保存');
    expect(result.button.getAttribute('data-tooltip')).toBe('Obsidianに保存する');
  });
});
