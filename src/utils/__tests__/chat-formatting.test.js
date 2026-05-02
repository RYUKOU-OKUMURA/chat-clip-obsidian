import {
  formatMessagesAsMarkdown,
  normalizeChatMode,
  normalizeSaveMethod,
  stripServiceTitle
} from '../chat/formatting';

describe('chat formatting utilities', () => {
  test('normalizes legacy save modes and save methods', () => {
    expect(normalizeChatMode('last5')).toBe('recent');
    expect(normalizeChatMode('all')).toBe('full');
    expect(normalizeChatMode('unknown')).toBe('single');
    expect(normalizeSaveMethod('clipboard')).toBe('auto');
    expect(normalizeSaveMethod('downloads')).toBe('downloads');
  });

  test('formats multi-message captures with speaker headings and separators', () => {
    const markdown = formatMessagesAsMarkdown([
      { speaker: 'User', content: 'Question' },
      { role: 'assistant', content: 'Answer' }
    ]);

    expect(markdown).toBe([
      '### User',
      '',
      'Question',
      '',
      '---',
      '',
      '### Assistant',
      '',
      'Answer',
      ''
    ].join('\n'));
  });

  test('strips provider suffixes from conversation titles', () => {
    expect(stripServiceTitle('Planning - ChatGPT', 'chatgpt')).toBe('Planning');
    expect(stripServiceTitle('Research Notes | Claude', 'claude')).toBe('Research Notes');
    expect(stripServiceTitle('Experiment | Gemini', 'gemini')).toBe('Experiment');
  });
});
