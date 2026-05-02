// File System Access API helpers isolated from inject.js
import { sanitizeRelativePath } from '../../../utils/data/validation.js';
import {
  loadDirectoryHandle as loadStoredDirectoryHandle,
  saveDirectoryHandle as saveStoredDirectoryHandle,
  removeDirectoryHandle,
  isDirectoryHandleUsable,
  isMissingDirectoryError,
  writeMarkdownWithDirectoryHandle
} from '../../../utils/browser/fileSystemAccess.js';

export async function loadDirectoryHandle() {
  try {
    return await loadStoredDirectoryHandle();
  } catch (error) {
    console.error('[Chat Clip Obsidian] ディレクトリハンドル読み込みエラー:', error);
    return null;
  }
}

export async function saveDirectoryHandle(handle) {
  try {
    await saveStoredDirectoryHandle(handle);
  } catch (error) {
    console.error('[Chat Clip Obsidian] ディレクトリハンドル保存エラー:', error);
  }
}

export async function ensureDirectoryHandleIfNeeded(options = {}) {
  const {
    promptForAuto = false,
    requireForFilesystem = false
  } = options;

  try {
    // Guard against missing chrome or storage API (e.g., context invalidated)
    const hasStorageGet = typeof chrome === 'object' && chrome && chrome.storage && chrome.storage.sync && typeof chrome.storage.sync.get === 'function';

    let method;
    if (hasStorageGet) {
      const prefs = await new Promise((resolve) => {
        chrome.storage.sync.get(['saveMethod'], resolve);
      });
      method = prefs?.saveMethod || 'filesystem';
      if (method === 'advanced-uri' || method === 'clipboard') method = 'auto';
    } else {
      // If we cannot read settings, avoid prompting the directory picker here
      // and let background fall back to other methods.
      method = 'auto';
    }

    if (method !== 'filesystem' && method !== 'auto') return;
    const shouldPrompt = method === 'filesystem' || (method === 'auto' && promptForAuto);

    const existing = await loadDirectoryHandle();
    if (existing) {
      const perm = await existing.queryPermission?.({ mode: 'readwrite' });
      if (perm === 'granted') {
        if (await isDirectoryHandleUsable(existing)) {
          return { success: true, handleReady: true, method };
        }
        await removeDirectoryHandle();
      }
      const req = await existing.requestPermission?.({ mode: 'readwrite' });
      if (req === 'granted') {
        if (await isDirectoryHandleUsable(existing)) {
          return { success: true, handleReady: true, method };
        }
        await removeDirectoryHandle();
      }
    }

    if (typeof window.showDirectoryPicker === 'function' && shouldPrompt) {
      const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
      await saveDirectoryHandle(dir);
      return { success: true, handleReady: true, method, selected: true };
    }

    if (requireForFilesystem && method === 'filesystem') {
      throw new Error('Vaultフォルダが未選択です。このページで保存ボタンを押してフォルダ選択を許可するか、OptionsでVaultフォルダを選択してください。');
    }

    return { success: false, handleReady: false, method };
  } catch (e) {
    const message = e?.message || String(e);
    console.warn('[Chat Clip Obsidian] ensureDirectoryHandleIfNeeded failed:', message);
    if (requireForFilesystem) {
      throw e;
    }
    return { success: false, handleReady: false, error: message };
  }
}

export async function handleFileSystemSave(content, relativePath) {
  try {
    const safeRelativePath = sanitizeRelativePath(relativePath, 'ChatVault');
    console.log('[Chat Clip Obsidian] File System Access API保存を試行中:', safeRelativePath);

    let dirHandle = await loadDirectoryHandle();
    if (!dirHandle) {
      throw new Error('Vaultフォルダが未設定です。オプション画面でObsidian Vaultフォルダを選択してください。');
    }

    const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      const newPermission = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (newPermission !== 'granted') {
        throw new Error('ファイルシステム権限が拒否されました');
      }
    }

    if (!(await isDirectoryHandleUsable(dirHandle))) {
      await removeDirectoryHandle();
      throw new Error('保存先フォルダが見つかりません。Vaultフォルダを再選択してください。');
    }

    const result = await writeMarkdownWithDirectoryHandle(dirHandle, content, safeRelativePath);
    console.log('[Chat Clip Obsidian] File System Access API経由でファイルを保存しました:', result.finalFileName);
    return result;
    
  } catch (error) {
    if (isMissingDirectoryError(error)) {
      await removeDirectoryHandle();
    }
    console.error('[Chat Clip Obsidian] File System Access APIエラー:', error);
    return { success: false, error: error.message };
  }
}

export default {
  loadDirectoryHandle,
  saveDirectoryHandle,
  ensureDirectoryHandleIfNeeded,
  handleFileSystemSave,
};
