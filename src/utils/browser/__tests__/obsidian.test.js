import { buildObsidianNewUri } from '../obsidian';

describe('obsidian URI utilities', () => {
  test('builds a native clipboard import URI', () => {
    const uri = buildObsidianNewUri({
      vaultName: 'My Vault',
      filePath: 'ChatVault/ChatGPT/2026-05-02_Test.md',
      clipboard: true
    });

    expect(uri).toBe('obsidian://new?vault=My%20Vault&file=ChatVault%2FChatGPT%2F2026-05-02_Test.md&clipboard=true');
  });

  test('builds a short content URI when content is provided', () => {
    const uri = buildObsidianNewUri({
      vaultName: 'Vault',
      filePath: 'ChatVault/Gemini/Test.md',
      content: 'hello world'
    });

    expect(uri).toBe('obsidian://new?vault=Vault&file=ChatVault%2FGemini%2FTest.md&content=hello%20world');
  });

  test('encodes path characters safely', () => {
    const uri = buildObsidianNewUri({
      vaultName: '仕事',
      filePath: 'ChatVault/Claude/a b.md',
      clipboard: true
    });

    expect(uri).toContain('vault=%E4%BB%95%E4%BA%8B');
    expect(uri).toContain('file=ChatVault%2FClaude%2Fa%20b.md');
  });
});
