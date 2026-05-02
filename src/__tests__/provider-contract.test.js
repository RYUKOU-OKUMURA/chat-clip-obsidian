import { captureMessages as captureChatGPT } from '../contentScripts/js/providers/chatgpt/text.js';
import { captureMessages as captureGemini, extractSingleMessage as extractGeminiSingle } from '../contentScripts/js/providers/gemini/text.js';

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
});
