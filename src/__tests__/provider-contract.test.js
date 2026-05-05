import { captureMessages as captureChatGPT, extractCodeBlock as extractChatGPTCodeBlock } from '../contentScripts/js/providers/chatgpt/text.js';
import { addSaveButton as addChatGPTSaveButton, addCodeBlockSaveButton as addChatGPTCodeBlockSaveButton, createSaveButton as createChatGPTSaveButton, createCodeBlockSaveButton as createChatGPTCodeBlockSaveButton, initializeChatGPT, resolveMessageElementFromButton as resolveChatGPTMessageFromButton } from '../contentScripts/js/providers/chatgpt/ui.js';
import { captureMessages as captureGemini, extractSingleMessage as extractGeminiSingle } from '../contentScripts/js/providers/gemini/text.js';
import { addSaveButton as addGeminiSaveButton, createSaveButton as createGeminiSaveButton, resolveMessageElementFromButton as resolveGeminiMessageFromButton } from '../contentScripts/js/providers/gemini/ui.js';
import { captureMessages as captureClaude } from '../contentScripts/js/providers/claude/text.js';
import { addSaveButton as addClaudeSaveButton, createSaveButton as createClaudeSaveButton } from '../contentScripts/js/providers/claude/ui.js';

describe('provider capture contract', () => {
  afterEach(() => {
    jest.useRealTimers();
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

  test('ChatGPT captureMessages fails with EMPTY_CONTENT when no messages are extracted', () => {
    document.body.innerHTML = '<main><p>No chat turns here</p></main>';

    const result = captureChatGPT('all');

    expect(result).toMatchObject({
      success: false,
      service: 'chatgpt',
      messages: [],
      errorCode: 'EMPTY_CONTENT'
    });
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

  test('ChatGPT captureMessages removes action buttons and preserves code blocks', () => {
    document.title = 'Code Review - ChatGPT';
    document.body.innerHTML = `
      <article data-message-author-role="assistant" data-message-id="a1">
        <div class="markdown">
          <p>Use this helper.</p>
          <pre><code class="language-js">console.log("ok");</code></pre>
          <div data-testid="turn-actions">
            <button data-testid="copy-turn-action-button">Copy</button>
            <button class="chatvault-save-btn">Save</button>
          </div>
        </div>
      </article>
    `;

    const all = captureChatGPT('all');

    expect(all.messages).toHaveLength(1);
    expect(all.messages[0].content).toContain('Use this helper.');
    expect(all.messages[0].content).toContain('```js');
    expect(all.messages[0].content).toContain('console.log("ok");');
    expect(all.messages[0].content).not.toContain('Copy');
    expect(all.messages[0].content).not.toContain('Save');
  });

  test('ChatGPT extractCodeBlock preserves CodeMirror viewer line breaks', () => {
    document.title = 'Model Notes - ChatGPT';
    document.body.innerHTML = `
      <div id="code-block-viewer" class="q9tKkq_viewer cm-editor">
        <div class="cm-scroller">
          <pre class="cm-content q9tKkq_readonly m-0"><code><span>現時点の体感では、</span><br><br><span>「目的地まで早く、正確に、快適に辿り着く」</span><br><span>という手段として見ると、</span></code></pre>
        </div>
      </div>
    `;

    const result = extractChatGPTCodeBlock(document.querySelector('#code-block-viewer'));

    expect(result.title).toBe('Model Notes');
    expect(result.content).toContain('```');
    expect(result.content).toContain('現時点の体感では、\n\n「目的地まで早く、正確に、快適に辿り着く」\nという手段として見ると、');
  });

  test('ChatGPT save button binds to assistant message inside a conversation turn wrapper', () => {
    document.body.innerHTML = `
      <article data-testid="conversation-turn-1">
        <div data-message-author-role="user" data-message-id="u1">
          <div class="whitespace-pre-wrap">Question</div>
        </div>
        <div data-message-author-role="assistant" data-message-id="a1">
          <div class="markdown"><p>Answer</p></div>
          <div data-testid="turn-actions">
            <button data-testid="copy-turn-action-button">Copy</button>
          </div>
        </div>
      </article>
    `;

    const turn = document.querySelector('[data-testid="conversation-turn-1"]');
    const assistant = document.querySelector('[data-message-author-role="assistant"]');
    const result = addChatGPTSaveButton(turn, createChatGPTSaveButton);

    expect(result.added).toBe(true);
    expect(result.button.__chatvaultMessageElement).toBe(assistant);
    expect(resolveChatGPTMessageFromButton(result.button)).toBe(assistant);
  });

  test('ChatGPT code block save button coexists with message save button', () => {
    document.body.innerHTML = `
      <article data-message-author-role="assistant" data-message-id="a1">
        <div class="markdown">
          <p>Use this helper.</p>
          <pre><code class="language-js">console.log("ok");</code></pre>
        </div>
        <div data-testid="turn-actions">
          <button data-testid="copy-turn-action-button">Copy</button>
        </div>
      </article>
    `;

    const assistant = document.querySelector('[data-message-author-role="assistant"]');
    const code = document.querySelector('pre > code');
    const codeResult = addChatGPTCodeBlockSaveButton(code, createChatGPTCodeBlockSaveButton);
    const messageResult = addChatGPTSaveButton(assistant, createChatGPTSaveButton);

    expect(codeResult.added).toBe(true);
    expect(codeResult.button.dataset.chatvaultSaveKind).toBe('code-block');
    expect(codeResult.button.__chatvaultCodeBlockElement).toBe(document.querySelector('pre'));
    expect(messageResult.added).toBe(true);
    expect(messageResult.button.dataset.chatvaultSaveKind).toBe('message');
    expect(document.querySelectorAll('.chatvault-save-btn')).toHaveLength(2);
    expect(resolveChatGPTMessageFromButton(messageResult.button)).toBe(assistant);
  });

  test('ChatGPT code block save button anchors beside the native copy button', () => {
    document.body.innerHTML = `
      <article data-message-author-role="assistant" data-message-id="a1">
        <div class="code-shell pointer-events-none">
          <button class="flex gap-1 items-center pointer-events-auto size-9" aria-label="コピーする"><svg class="icon-md"><use href="/cdn/assets/sprites-core.svg#ce3544"></use></svg></button>
          <div id="code-block-viewer" class="cm-editor">
            <pre class="cm-content"><code>console.log("ok");</code></pre>
          </div>
        </div>
      </article>
    `;

    const codeViewer = document.querySelector('#code-block-viewer');
    const shell = document.querySelector('.code-shell');
    const copyButton = document.querySelector('[aria-label="コピーする"]');
    const result = addChatGPTCodeBlockSaveButton(codeViewer, createChatGPTCodeBlockSaveButton);

    expect(result.added).toBe(true);
    expect(result.target).toHaveClass('chatvault-code-actions');
    expect(result.target.parentElement).toBe(shell);
    expect(result.target.dataset.chatvaultPlacement).toBe('copy-parent-left');
    expect(result.target.children[0]).toBe(result.button);
    expect(copyButton.parentElement).toBe(shell);
    expect(result.target.style.pointerEvents).toBe('auto');
    expect(result.target.style.display).toBe('flex');
    expect(result.target.style.position).toBe('absolute');
    expect(result.target.style.left).toBe('-40px');
    expect(result.target.style.top).toBe('0px');
    expect(shell.style.position).toBe('relative');
    expect(result.button.style.pointerEvents).toBe('auto');
    expect(result.button.querySelector('span')).toBeNull();
    expect(result.button.querySelector('.chatvault-code-save-icon')).not.toBeNull();
    expect(result.target.querySelector('[data-chatvault-save-kind="code-block"]')).toBe(result.button);
  });

  test('ChatGPT save button falls back under assistant content while actions are missing', () => {
    document.body.innerHTML = `
      <article data-message-author-role="assistant" data-message-id="a1">
        <div class="markdown"><p>Streaming answer</p></div>
      </article>
    `;

    const assistant = document.querySelector('[data-message-author-role="assistant"]');
    const content = document.querySelector('.markdown');
    const result = addChatGPTSaveButton(assistant, createChatGPTSaveButton);
    const fallback = assistant.querySelector('.chatvault-inline-actions');

    expect(result.added).toBe(true);
    expect(fallback).not.toBeNull();
    expect(fallback.previousElementSibling).toBe(content);
    expect(fallback.style.justifyContent).toBe('flex-start');
    expect(fallback.querySelector('.chatvault-save-btn')).toBe(result.button);
    expect(resolveChatGPTMessageFromButton(result.button)).toBe(assistant);
  });

  test('ChatGPT save button moves from fallback into turn actions when copy appears', () => {
    document.body.innerHTML = `
      <article data-message-author-role="assistant" data-message-id="a1">
        <div class="markdown"><p>Final answer</p></div>
      </article>
    `;

    const assistant = document.querySelector('[data-message-author-role="assistant"]');
    const first = addChatGPTSaveButton(assistant, createChatGPTSaveButton);
    const actions = document.createElement('div');
    actions.setAttribute('data-testid', 'turn-actions');
    actions.innerHTML = '<button data-testid="copy-turn-action-button">Copy</button>';
    assistant.appendChild(actions);

    const createButton = jest.fn(createChatGPTSaveButton);
    const second = addChatGPTSaveButton(assistant, createButton);
    const copy = actions.querySelector('[data-testid="copy-turn-action-button"]');

    expect(second.added).toBe(false);
    expect(second.button).toBe(first.button);
    expect(createButton).not.toHaveBeenCalled();
    expect(actions.querySelector('.chatvault-save-btn')).toBe(first.button);
    expect(first.button.nextElementSibling).toBe(copy);
    expect(assistant.querySelectorAll('.chatvault-save-btn')).toHaveLength(1);
    expect(assistant.querySelector('.chatvault-inline-actions')).toBeNull();
  });

  test('ChatGPT save button is not added to user messages', () => {
    document.body.innerHTML = `
      <article data-message-author-role="user" data-message-id="u1">
        <div class="whitespace-pre-wrap">Question</div>
      </article>
    `;

    const user = document.querySelector('[data-message-author-role="user"]');
    const result = addChatGPTSaveButton(user, createChatGPTSaveButton);

    expect(result).toEqual({ added: false, button: null, target: null });
    expect(document.querySelector('.chatvault-save-btn')).toBeNull();
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

  test('Gemini captureMessages fails with EMPTY_CONTENT when no messages are extracted', () => {
    document.body.innerHTML = '<main><p>Unrelated page content</p></main>';

    const result = captureGemini('all');

    expect(result).toMatchObject({
      success: false,
      service: 'gemini',
      messages: [],
      errorCode: 'EMPTY_CONTENT'
    });
  });

  test('Gemini button resolution does not fall back to document.body content', () => {
    document.body.innerHTML = `
      <main>
        <p>Unrelated body content</p>
        <button class="chatvault-save-btn">Save</button>
      </main>
    `;

    const button = document.querySelector('.chatvault-save-btn');

    expect(resolveGeminiMessageFromButton(button)).toBeNull();
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

  test('Gemini captureMessages preserves DOM order for code immersive panels', () => {
    document.title = 'Research - Gemini';
    document.body.innerHTML = `
      <div class="user-message">Question</div>
      <code-immersive-panel>
        <h2 class="title-text">JavaScript</h2>
        <div data-test-id="code-editor">
          <textarea>const value = 1;</textarea>
        </div>
      </code-immersive-panel>
      <message-content><div class="markdown"><p>Follow up answer</p></div></message-content>
    `;

    const all = captureGemini('all');

    expect(all.success).toBe(true);
    expect(all.messages).toHaveLength(3);
    expect(all.messages[0]).toEqual({ speaker: 'User', content: 'Question' });
    expect(all.messages[1].speaker).toBe('Assistant');
    expect(all.messages[1].content).toContain('```javascript');
    expect(all.messages[1].content).toContain('const value = 1;');
    expect(all.messages[2]).toEqual({ speaker: 'Assistant', content: 'Follow up answer' });
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

  test('Claude captureMessages fails with EMPTY_CONTENT when no messages are extracted', () => {
    document.body.innerHTML = '<main><p>No Claude messages here</p></main>';

    const result = captureClaude('all');

    expect(result).toMatchObject({
      success: false,
      service: 'claude',
      messages: [],
      errorCode: 'EMPTY_CONTENT'
    });
  });

  test('ChatGPT MutationObserver debounces rescans', async () => {
    jest.useFakeTimers();
    document.body.innerHTML = `
      <article data-message-author-role="assistant" data-message-id="a1">
        <div class="markdown"><p>Initial</p></div>
      </article>
    `;

    initializeChatGPT();
    expect(document.querySelectorAll('.chatvault-save-btn')).toHaveLength(1);

    const next = document.createElement('article');
    next.setAttribute('data-message-author-role', 'assistant');
    next.setAttribute('data-message-id', 'a2');
    next.innerHTML = '<div class="markdown"><p>Later</p></div>';
    document.body.appendChild(next);
    await Promise.resolve();

    expect(document.querySelectorAll('.chatvault-save-btn')).toHaveLength(1);
    jest.advanceTimersByTime(149);
    expect(document.querySelectorAll('.chatvault-save-btn')).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(document.querySelectorAll('.chatvault-save-btn')).toHaveLength(2);
    jest.useRealTimers();
  });

  test('ChatGPT MutationObserver rescans when copy action appears by attribute change', async () => {
    jest.useFakeTimers();
    document.body.innerHTML = `
      <article data-message-author-role="assistant" data-message-id="a1">
        <div class="markdown"><p>Initial</p></div>
        <div data-testid="turn-actions">
          <button id="copy-action">Copy</button>
        </div>
      </article>
    `;

    initializeChatGPT();
    const button = document.querySelector('.chatvault-save-btn');
    const fallback = document.querySelector('.chatvault-inline-actions');
    const actions = document.querySelector('[data-testid="turn-actions"]');
    const copy = document.getElementById('copy-action');

    expect(fallback.querySelector('.chatvault-save-btn')).toBe(button);

    copy.setAttribute('data-testid', 'copy-turn-action-button');
    await Promise.resolve();
    jest.advanceTimersByTime(150);

    expect(actions.querySelector('.chatvault-save-btn')).toBe(button);
    expect(button.nextElementSibling).toBe(copy);
    expect(document.querySelector('.chatvault-inline-actions')).toBeNull();
    expect(document.querySelectorAll('.chatvault-save-btn')).toHaveLength(1);
    jest.useRealTimers();
  });
});
