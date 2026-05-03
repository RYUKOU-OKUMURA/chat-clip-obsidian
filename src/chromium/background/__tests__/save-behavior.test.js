describe('background save behavior', () => {
  let messageListener;
  let writeMarkdownWithDirectoryHandle;
  let downloadsDownload;

  beforeEach(async () => {
    jest.resetModules();
    messageListener = null;
    writeMarkdownWithDirectoryHandle = jest.fn();
    downloadsDownload = jest.fn();

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
          addListener: jest.fn(),
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
      getSync: jest.fn(async () => ({
        saveMethod: 'downloads',
        downloadsFolder: 'ChatVault'
      }))
    }));
    jest.doMock('../../../utils/browser/fileSystemAccess.js', () => ({
      loadDirectoryHandle: jest.fn(),
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

    await Promise.resolve();
    await Promise.resolve();

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

    await Promise.resolve();
    await Promise.resolve();

    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      errorCode: 'EMPTY_CONTENT'
    }));
    expect(writeMarkdownWithDirectoryHandle).not.toHaveBeenCalled();
    expect(downloadsDownload).not.toHaveBeenCalled();
  });
});
