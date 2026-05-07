import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OptionsApp from '../OptionsApp';
import { toast } from '../../../utils/notifications/toast';
import { loadDirectoryHandle, removeDirectoryHandle, saveDirectoryHandle } from '../../../utils/browser/fileSystemAccess';

jest.mock('../../../utils/notifications/toast', () => ({
  toast: {
    show: jest.fn()
  }
}));

jest.mock('../../../utils/browser/fileSystemAccess', () => ({
  loadDirectoryHandle: jest.fn(),
  removeDirectoryHandle: jest.fn(),
  saveDirectoryHandle: jest.fn()
}));

const mockStorageGet = (settings = {}) => {
  chrome.storage.sync.get.mockImplementation((_keys, callback) => {
    callback(settings);
  });
};

describe('OptionsApp settings UX', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chrome.runtime.lastError = null;
    chrome.storage.sync.set.mockImplementation((_values, callback) => {
      callback?.();
    });
    chrome.runtime.sendMessage.mockImplementation(() => {});
    loadDirectoryHandle.mockResolvedValue(null);
    removeDirectoryHandle.mockResolvedValue(undefined);
    saveDirectoryHandle.mockResolvedValue(undefined);
    delete window.showDirectoryPicker;
  });

  test('saves filesystem settings without requiring a vault name', async () => {
    const user = userEvent.setup();
    mockStorageGet({
      saveMethod: 'filesystem',
      defaultMessageCount: 120
    });

    render(<OptionsApp />);

    await user.click(await screen.findByRole('button', { name: '設定を保存' }));

    await waitFor(() => {
      expect(chrome.storage.sync.set).toHaveBeenCalled();
    });
    const [savedSettings] = chrome.storage.sync.set.mock.calls[0];
    expect(savedSettings.obsidianVault).toBe('');
    expect(savedSettings.defaultMessageCount).toBe(100);
    expect(savedSettings).not.toHaveProperty('autoTagging');
  });

  test('rejects chat note formats that omit content', async () => {
    const user = userEvent.setup();
    mockStorageGet({
      saveMethod: 'filesystem',
      chatNoteFormat: '# {title}\n\n{content}'
    });

    render(<OptionsApp />);

    await user.click(await screen.findByRole('button', { name: '詳細設定を開く' }));
    const textarea = await screen.findByLabelText(/チャットノートフォーマット/);
    await user.clear(textarea);
    await user.type(textarea, '# {title}');
    await user.click(screen.getByRole('button', { name: '設定を保存' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('{content}');
    expect(toast.show).toHaveBeenCalledWith(
      'チャットノートフォーマットには {content} を含めてください。',
      'error'
    );
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  test('requires vault name for auto save method because URI fallback needs it', async () => {
    const user = userEvent.setup();
    mockStorageGet({ saveMethod: 'auto' });

    render(<OptionsApp />);

    await user.click(await screen.findByRole('button', { name: '設定を保存' }));

    expect(toast.show).toHaveBeenCalledWith(
      '自動選択ではURI fallbackに備えてObsidian Vault名を入力してください。',
      'error'
    );
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  test('saves separate chat and code block folder destinations', async () => {
    const user = userEvent.setup();
    mockStorageGet({ saveMethod: 'filesystem' });

    render(<OptionsApp />);

    const customFolderInputs = await screen.findAllByLabelText(/カスタムフォルダ/);
    fireEvent.change(customFolderInputs[0], { target: { value: 'ChatVault/Chats/{service}' } });
    await user.click(screen.getByRole('button', { name: /CodeBlocks\/言語別/ }));
    await user.click(screen.getByRole('button', { name: '設定を保存' }));

    await waitFor(() => {
      expect(chrome.storage.sync.set).toHaveBeenCalled();
    });
    const [savedSettings] = chrome.storage.sync.set.mock.calls[0];
    expect(savedSettings.saveLocationPreset).toBe('custom');
    expect(savedSettings.chatFolderPath).toBe('ChatVault/Chats/{service}');
    expect(savedSettings.codeBlockFolderPath).toBe('ChatVault/CodeBlocks/{service}/{language}');
  });

  test('sets destination folders from a selected folder inside the vault', async () => {
    const user = userEvent.setup();
    const selectedHandle = { name: 'Snippets' };
    const vaultHandle = {
      name: 'Vault',
      resolve: jest.fn(async (handle) => handle === selectedHandle ? ['ChatVault', 'Snippets'] : null)
    };
    mockStorageGet({ saveMethod: 'filesystem' });
    loadDirectoryHandle.mockResolvedValue(vaultHandle);
    window.showDirectoryPicker = jest.fn(async () => selectedHandle);

    render(<OptionsApp />);

    const folderButtons = await screen.findAllByRole('button', { name: 'フォルダを選択' });
    await user.click(folderButtons[0]);
    await waitFor(() => {
      expect(screen.getAllByLabelText(/カスタムフォルダ/)[0]).toHaveValue('ChatVault/Snippets');
    });
    await user.click(screen.getByRole('button', { name: '設定を保存' }));

    await waitFor(() => {
      expect(chrome.storage.sync.set).toHaveBeenCalled();
    });
    const [savedSettings] = chrome.storage.sync.set.mock.calls[0];
    expect(window.showDirectoryPicker).toHaveBeenCalledWith({
      mode: 'readwrite',
      startIn: vaultHandle
    });
    expect(savedSettings.saveLocationPreset).toBe('custom');
    expect(savedSettings.chatFolderPath).toBe('ChatVault/Snippets');
  });

  test('blocks saving settings when the direct save root looks like a destination folder', async () => {
    const user = userEvent.setup();
    mockStorageGet({
      saveMethod: 'filesystem',
      selectedFolderPath: 'AIchat'
    });

    render(<OptionsApp />);

    expect(await screen.findByText(/保存先フォルダに見えます/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '設定を保存' }));

    expect(toast.show).toHaveBeenCalledWith(
      expect.stringContaining('直接保存用のVaultルートを選び直してください'),
      'error'
    );
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  test('does not store a newly selected root when it looks like a destination folder', async () => {
    const user = userEvent.setup();
    mockStorageGet({
      saveMethod: 'filesystem'
    });
    window.showDirectoryPicker = jest.fn(async () => ({ name: 'AIchat' }));

    render(<OptionsApp />);

    await user.click(await screen.findByRole('button', { name: 'Vaultルートを許可' }));

    expect(saveDirectoryHandle).not.toHaveBeenCalled();
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    expect(toast.show).toHaveBeenCalledWith(
      expect.stringContaining('選択は保存しませんでした'),
      'warning'
    );
  });

  test('resets the stored direct save root permission', async () => {
    const user = userEvent.setup();
    mockStorageGet({
      saveMethod: 'filesystem',
      selectedFolderPath: 'Obsidian Vault'
    });

    render(<OptionsApp />);

    await user.click(await screen.findByRole('button', { name: '許可をリセット' }));

    expect(removeDirectoryHandle).toHaveBeenCalled();
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ selectedFolderPath: '' });
    expect(toast.show).toHaveBeenCalledWith(
      '直接保存用のVaultルート許可をリセットしました。',
      'success'
    );
  });
});
