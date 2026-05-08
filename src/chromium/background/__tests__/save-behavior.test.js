describe('background save behavior', () => {
  let messageListener;
  let loadDirectoryHandle;
  let writeMarkdownWithDirectoryHandle;
  let downloadsDownload;
  let downloadsChangedListener;
  let getSyncMock;

  beforeEach(async () => {
    jest.resetModules();
    messageListener = null;
    loadDirectoryHandle = jest.fn();
    writeMarkdownWithDirectoryHandle = jest.fn();
    downloadsDownload = jest.fn();
    downloadsChangedListener = null;
    getSyncMock = jest.fn(async () => ({
      saveMethod: 'downloads',
      downloadsFolder: 'ChatVault'
    }));

    global.chrome = {
      runtime: {
        getManifest: jest.fn(() => ({ host_permissions: [] })),
        openOptionsPage: jest.fn(),
        lastError: null,
        onInstalled: {
          addListener: jest.fn()
        },
        onMessage: {
          addListener: jest.fn((listener) => {
            messageListener = listener;
          })
        }
      },
      contextMenus: {
        removeAll: jest.fn((callback) => callback?.()),
        create: jest.fn(),
        onClicked: {
          addListener: jest.fn()
        }
      },
      storage: {
        sync: {
          get: jest.fn(),
          set: jest.fn()
        }
      },
      tabs: {
        query: jest.fn((_, callback) => callback([])),
        sendMessage: jest.fn(),
        create: jest.fn(),
        remove: jest.fn()
      },
      downloads: {
        download: downloadsDownload,
        onChanged: {
          addListener: jest.fn((listener) => {
            downloadsChangedListener = listener;
          }),
          removeListener: jest.fn()
        }
      },
      notifications: {
        create: jest.fn()
      }
    };

    jest.doMock('../../../utils/browser/chrome.js', () => ({
      createTab: jest.fn(),
      openUrlWithAutoClose: jest.fn(),
      getSync: getSyncMock
    }));
    jest.doMock('../../../utils/browser/fileSystemAccess.js', () => ({
      loadDirectoryHandle,
      removeDirectoryHandle: jest.fn(),
      isDirectoryHandleUsable: jest.fn(),
      isMissingDirectoryError: jest.fn(),
      writeMarkdownWithDirectoryHandle
    }));
    jest.doMock('../../../utils/notifications/notifications.js', () => ({
      notifyBasic: jest.fn()
    }));

    await import('../background.js');
  });

  test('saveSingleMessage rejects empty single content before any write path', async () => {
    const sendResponse = jest.fn();

    messageListener({
      action: 'saveSingleMessage',
      messageType: 'single',
      messageContent: '### Assistant\n\n  ',
      service: 'chatgpt',
      conversationTitle: 'Empty'
    }, { tab: { id: 1, url: 'https://chatgpt.com/c/1' } }, sendResponse);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      errorCode: 'EMPTY_CONTENT'
    }));
    expect(writeMarkdownWithDirectoryHandle).not.toHaveBeenCalled();
    expect(downloadsDownload).not.toHaveBeenCalled();
  });

  test('saveSelection rejects empty selection content before any write path', async () => {
    const sendResponse = jest.fn();

    messageListener({
      action: 'saveSelection',
      messageContent: '### Selection\n\n\t',
      service: 'chatgpt',
      title: 'Empty selection'
    }, { tab: { id: 1, url: 'https://chatgpt.com/c/1' } }, sendResponse);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      errorCode: 'EMPTY_CONTENT'
    }));
    expect(writeMarkdownWithDirectoryHandle).not.toHaveBeenCalled();
    expect(downloadsDownload).not.toHaveBeenCalled();
  });

  test('saveSingleMessage blocks direct filesystem save when vault root looks like a destination folder', async () => {
    getSyncMock.mockResolvedValueOnce({
      saveMethod: 'filesystem',
      downloadsFolder: 'ChatVault',
      selectedFolderPath: 'AIchat'
    });
    const sendResponse = jest.fn();

    messageListener({
      action: 'saveSingleMessage',
      messageType: 'single',
      messageContent: '### Assistant\n\nhello',
      service: 'chatgpt',
      conversationTitle: 'Root warning'
    }, { tab: { id: 1, url: 'https://chatgpt.com/c/1' } }, sendResponse);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      errorCode: 'INVALID_VAULT_ROOT'
    }));
    expect(writeMarkdownWithDirectoryHandle).not.toHaveBeenCalled();
    expect(downloadsDownload).not.toHaveBeenCalled();
  });

  test('saveSingleMessage blocks direct filesystem save when the stored handle itself is a destination folder', async () => {
    getSyncMock.mockResolvedValueOnce({
      saveMethod: 'filesystem',
      downloadsFolder: 'ChatVault',
      selectedFolderPath: 'Obsidian Vault'
    });
    loadDirectoryHandle.mockResolvedValueOnce({ name: 'AIchat' });
    const sendResponse = jest.fn();

    messageListener({
      action: 'saveSingleMessage',
      messageType: 'single',
      messageContent: '### Assistant\n\nhello',
      service: 'chatgpt',
      conversationTitle: 'Stored handle warning'
    }, { tab: { id: 1, url: 'https://chatgpt.com/c/1' } }, sendResponse);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      errorCode: 'INVALID_VAULT_ROOT'
    }));
    expect(writeMarkdownWithDirectoryHandle).not.toHaveBeenCalled();
    expect(downloadsDownload).not.toHaveBeenCalled();
  });

  test('saveSingleMessage sends title-date filename and frontmatter content to downloads fallback', async () => {
    downloadsDownload.mockImplementation((_options, callback) => {
      callback(7);
      setTimeout(() => {
        downloadsChangedListener?.({ id: 7, state: { current: 'complete' } });
      }, 0);
    });
    const sendResponse = jest.fn();

    messageListener({
      action: 'saveSingleMessage',
      messageType: 'single',
      messageContent: '### Assistant\n\nhello',
      service: 'chatgpt',
      conversationTitle: 'Save spec'
    }, { tab: { id: 1, url: 'https://chatgpt.com/c/1' } }, sendResponse);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const [downloadOptions] = downloadsDownload.mock.calls[0];
    expect(downloadOptions.filename).toMatch(/^ChatVault\/Save_spec_\d{4}-\d{2}-\d{2}\.md$/);

    const encodedContent = downloadOptions.url.split(',')[1];
    const decodedContent = Buffer.from(encodedContent, 'base64').toString('utf8');
    expect(decodedContent).toContain('title: "Save spec"');
    expect(decodedContent).toContain('service: "ChatGPT"');
    expect(decodedContent).toContain('source: "https://chatgpt.com/c/1"');
    expect(decodedContent).toContain('type: "single"');
    expect(decodedContent).toContain('# Save spec');
    expect(decodedContent).toContain('### Assistant\n\nhello');
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      method: 'downloads',
      filename: expect.stringMatching(/^Save_spec_\d{4}-\d{2}-\d{2}\.md$/)
    }));
  });
});
