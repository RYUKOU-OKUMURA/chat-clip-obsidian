import { writeMarkdownWithDirectoryHandle } from '../fileSystemAccess';

function createDirectoryHandle(name = 'Obsidian Vault') {
  const fileHandle = {
    createWritable: jest.fn(async () => ({
      write: jest.fn(),
      close: jest.fn()
    }))
  };

  return {
    name,
    getFileHandle: jest.fn(async (_name, options) => {
      if (options?.create === false) {
        throw new Error('not found');
      }
      return fileHandle;
    }),
    getDirectoryHandle: jest.fn(async () => createDirectoryHandle('child'))
  };
}

describe('File System Access helpers', () => {
  test('rejects suspicious direct save roots before writing', async () => {
    const handle = createDirectoryHandle('AIchat');

    await expect(writeMarkdownWithDirectoryHandle(
      handle,
      '# Test',
      'Xポスト/素材/test.md'
    )).rejects.toMatchObject({
      code: 'INVALID_VAULT_ROOT'
    });
    expect(handle.getDirectoryHandle).not.toHaveBeenCalled();
    expect(handle.getFileHandle).not.toHaveBeenCalled();
  });
});
