import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OptionsApp from '../OptionsApp';
import { toast } from '../../../utils/notifications/toast';

jest.mock('../../../utils/notifications/toast', () => ({
  toast: {
    show: jest.fn()
  }
}));

jest.mock('../../../utils/browser/fileSystemAccess', () => ({
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
});
