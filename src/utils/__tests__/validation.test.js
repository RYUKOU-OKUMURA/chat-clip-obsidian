import { sanitizeForFilename, sanitizePathSegment, sanitizeRelativePath } from '../data/validation';

describe('validation utilities', () => {
  test('sanitizes a single filesystem segment', () => {
    expect(sanitizePathSegment('bad/name:with*chars?')).toBe('bad-name-with-chars-');
    expect(sanitizePathSegment('..', 'fallback')).toBe('fallback');
    expect(sanitizePathSegment('   ', 'fallback')).toBe('fallback');
  });

  test('sanitizes relative paths while preserving folder separators', () => {
    expect(sanitizeRelativePath('ChatVault/Claude/my:chat?.md')).toBe('ChatVault/Claude/my-chat-.md');
    expect(sanitizeRelativePath('ChatVault\\\\Gemini\\\\title')).toBe('ChatVault/Gemini/title');
    expect(sanitizeRelativePath('/./ChatVault//../ChatGPT/')).toBe('ChatVault/ChatGPT');
  });

  test('sanitizes filenames without path separators', () => {
    expect(sanitizeForFilename('Chat/GPT: test title')).toBe('Chat-GPT-_test_title');
    expect(sanitizeForFilename('..', 'untitled')).toBe('untitled');
  });
});
