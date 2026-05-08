import {
  buildChatNoteContent,
  DEFAULT_CHAT_NOTE_FORMAT,
  normalizeChatNoteFormat
} from '../chat/noteTemplate';

describe('chat note template utilities', () => {
  test('renders default notes with frontmatter before the readable title', () => {
    const markdown = buildChatNoteContent({
      title: 'Obsidian拡張の保存仕様相談',
      serviceLabel: 'ChatGPT',
      sourceUrl: 'https://chatgpt.com/c/123',
      saved: '2026-05-02T12:00:00.000Z',
      mode: 'full',
      markdown: '### User\n\nQuestion'
    });

    expect(markdown).toBe([
      '---',
      'title: "Obsidian拡張の保存仕様相談"',
      'date: 2026-05-02',
      'saved: "2026-05-02T12:00:00.000Z"',
      'service: "ChatGPT"',
      'source: "https://chatgpt.com/c/123"',
      'type: "full"',
      '---',
      '',
      '# Obsidian拡張の保存仕様相談',
      '',
      '### User',
      '',
      'Question'
    ].join('\n'));
  });

  test('quotes YAML scalar values that contain punctuation', () => {
    const markdown = buildChatNoteContent({
      title: 'A: B "C"',
      serviceLabel: 'Claude',
      sourceUrl: 'https://claude.ai/chat/a:b',
      saved: '2026-05-02T12:00:00.000Z',
      mode: 'single',
      markdown: 'Body'
    });

    expect(markdown).toContain('title: "A: B \\"C\\""');
    expect(markdown).toContain('source: "https://claude.ai/chat/a:b"');
  });

  test('upgrades the old default template to the frontmatter default', () => {
    expect(normalizeChatNoteFormat('# {title}\n\n{content}')).toBe(DEFAULT_CHAT_NOTE_FORMAT);
  });
});
