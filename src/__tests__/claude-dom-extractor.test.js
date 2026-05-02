jest.mock('../contentScripts/js/providers/claude/api.js', () => {
  throw new Error('claude/api.js must not be loaded by the DOM extractor');
}, { virtual: true });

import {
  extractSingleMessage,
  captureMessages
} from '../contentScripts/js/providers/claude/text.js';

describe('Claude DOM extractor', () => {
  beforeEach(() => {
    document.title = 'Research Notes | Claude';
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  test('extractSingleMessage reads a user message from the visible DOM', async () => {
    document.body.innerHTML = `
      <div data-test-render-count="1">
        <div data-testid="user-message">
          <p>Summarize this thread.</p>
          <button class="chatvault-save-btn">Save</button>
        </div>
      </div>
    `;

    const result = await extractSingleMessage(document.querySelector('[data-test-render-count="1"]'));

    expect(result).toEqual({
      role: 'user',
      content: 'Summarize this thread.',
      title: 'Research Notes'
    });
  });

  test('extractSingleMessage reads an assistant response and keeps markdown structure', async () => {
    document.body.innerHTML = `
      <div data-test-render-count="2">
        <div class="font-claude-response">
          <p>Use the DOM first.</p>
          <pre><code class="language-js">console.log("ok");</code></pre>
        </div>
      </div>
    `;

    const result = await extractSingleMessage(document.querySelector('.font-claude-response'));

    expect(result.role).toBe('assistant');
    expect(result.title).toBe('Research Notes');
    expect(result.content).toContain('Use the DOM first.');
    expect(result.content).toContain('```js');
    expect(result.content).toContain('console.log("ok");');
  });

  test('captureMessages returns the shared Claude contract in DOM order', async () => {
    document.body.innerHTML = `
      <section data-test-render-count="1">
        <div data-testid="user-message">First question</div>
      </section>
      <section data-test-render-count="2">
        <div class="font-claude-response"><p>First answer</p></div>
      </section>
      <section data-test-render-count="3">
        <div data-testid="user-message">Follow up</div>
      </section>
    `;

    const result = await captureMessages('all');

    expect(result).toEqual({
      success: true,
      service: 'claude',
      title: 'Research Notes',
      messages: [
        { speaker: 'User', content: 'First question' },
        { speaker: 'Assistant', content: 'First answer' },
        { speaker: 'User', content: 'Follow up' }
      ]
    });
  });

  test('captureMessages supports recent mode', async () => {
    document.body.innerHTML = `
      <div data-test-render-count="1"><div data-testid="user-message">One</div></div>
      <div data-test-render-count="2"><div class="font-claude-response">Two</div></div>
      <div data-test-render-count="3"><div data-testid="user-message">Three</div></div>
    `;

    const result = await captureMessages('recent', 2);

    expect(result.success).toBe(true);
    expect(result.service).toBe('claude');
    expect(result.messages).toEqual([
      { speaker: 'Assistant', content: 'Two' },
      { speaker: 'User', content: 'Three' }
    ]);
  });

  test('captureMessages ignores hidden DOM and hidden descendants', async () => {
    document.body.innerHTML = `
      <div data-test-render-count="1" style="display: none">
        <div data-testid="user-message">Hidden message</div>
      </div>
      <div data-test-render-count="2">
        <div class="font-claude-response">
          Visible answer
          <span style="display: none">secret</span>
        </div>
      </div>
    `;

    const result = await captureMessages('all');

    expect(result.messages).toEqual([
      { speaker: 'Assistant', content: 'Visible answer' }
    ]);
  });

  test('captureMessages does not duplicate nested render or content containers', async () => {
    document.body.innerHTML = `
      <div data-test-render-count="outer">
        <div data-test-render-count="inner">
          <div class="font-claude-response">
            <p>Nested response appears once.</p>
            <div class="font-claude-response">Nested markdown wrapper</div>
          </div>
        </div>
      </div>
      <div data-test-render-count="3">
        <div data-testid="user-message">Next question</div>
      </div>
    `;

    const result = await captureMessages('all');

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toEqual({
      speaker: 'Assistant',
      content: expect.stringContaining('Nested response appears once.')
    });
    expect(result.messages[1]).toEqual({
      speaker: 'User',
      content: 'Next question'
    });
  });
});
