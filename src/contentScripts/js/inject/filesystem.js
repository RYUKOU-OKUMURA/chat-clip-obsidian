// File System Access API helpers isolated from inject.js
import { sanitizeRelativePath } from '../../../utils/data/validation.js';

async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ChatVaultDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
    };
  });
}

export async function loadDirectoryHandle() {
  try {
    const db = await openDB();
    const tx = db.transaction(['handles'], 'readonly');
    const store = tx.objectStore('handles');
    const request = store.get('vaultDirectory');

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[ChatVault] ディレクトリハンドル読み込みエラー:', error);
    return null;
  }
}

export async function saveDirectoryHandle(handle) {
  try {
    const db = await openDB();
    const tx = db.transaction(['handles'], 'readwrite');
    const store = tx.objectStore('handles');
    await new Promise((resolve, reject) => {
      const req = store.put(handle, 'vaultDirectory');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch (error) {
    console.error('[ChatVault] ディレクトリハンドル保存エラー:', error);
  }
}

async function removeDirectoryHandle() {
  try {
    const db = await openDB();
    const tx = db.transaction(['handles'], 'readwrite');
    const store = tx.objectStore('handles');
    await new Promise((resolve, reject) => {
      const req = store.delete('vaultDirectory');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch (error) {
    console.error('[ChatVault] ディレクトリハンドル削除エラー:', error);
  }
}

async function isDirectoryHandleUsable(handle) {
  if (!handle) return false;

  try {
    if (typeof handle.values === 'function') {
      for await (const _entry of handle.values()) {
        break;
      }
    }
    return true;
  } catch (error) {
    const message = error?.message || '';
    if (
      error?.name === 'NotFoundError' ||
      message.includes('could not be found') ||
      message.includes('not be found')
    ) {
      return false;
    }
    throw error;
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
    console.warn('[ChatVault] ensureDirectoryHandleIfNeeded failed:', message);
    if (requireForFilesystem) {
      throw e;
    }
    return { success: false, handleReady: false, error: message };
  }
}

export async function handleFileSystemSave(content, relativePath) {
  try {
    const safeRelativePath = sanitizeRelativePath(relativePath, 'ChatVault');
    console.log('[ChatVault] File System Access API保存を試行中:', safeRelativePath);

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

    const pathSegments = safeRelativePath.split('/').filter(segment => segment);
    let fileName = pathSegments.pop();

    let currentDir = dirHandle;
    for (const segment of pathSegments) {
      currentDir = await currentDir.getDirectoryHandle(segment, { create: true });
    }

    // Enhanced duplicate prevention logic
    let finalFileName = fileName;
    let counter = 1;
    let isDuplicate = false;
    let wasRenamed = false;

    try {
      // Check if file already exists
      const existingHandle = await currentDir.getFileHandle(finalFileName, { create: false });
      const existingFile = await existingHandle.getFile();
      const existingContent = await existingFile.text();
      
      // Check if content is identical
      if (existingContent === content) {
        console.log('[ChatVault] 同じ内容のファイルが既に存在します:', finalFileName);
        return { 
          success: true, 
          method: 'filesystem', 
          message: `既存ファイル「${finalFileName}」と同じ内容のため、保存をスキップしました。`,
          isDuplicate: true,
          skipped: true
        };
      }
      
      // Content is different, generate unique filename
      const baseName = fileName.replace(/\.md$/, '');
      let tryFileName;
      while (true) {
        try {
          tryFileName = `${baseName}_${counter}.md`;
          await currentDir.getFileHandle(tryFileName, { create: false });
          counter++;
        } catch (e) {
          // File doesn't exist, use this name
          finalFileName = tryFileName;
          wasRenamed = true;
          break;
        }
      }
      
    } catch (e) {
      // Original file doesn't exist, proceed with original name
      console.log('[ChatVault] ファイルが存在しないため、元のファイル名で保存します');
    }

    // Create and write the file
    const fileHandle = await currentDir.getFileHandle(finalFileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    console.log('[ChatVault] File System Access API経由でファイルを保存しました:', finalFileName);
    
    const result = { 
      success: true, 
      method: 'filesystem',
      finalFileName,
      originalFileName: fileName
    };
    
    if (wasRenamed) {
      result.message = `「${finalFileName}」として保存しました（重複回避のため名前を変更）`;
      result.wasRenamed = true;
    }
    
    return result;
    
  } catch (error) {
    const message = error?.message || '';
    if (
      error?.name === 'NotFoundError' ||
      message.includes('could not be found') ||
      message.includes('not be found')
    ) {
      await removeDirectoryHandle();
    }
    console.error('[ChatVault] File System Access APIエラー:', error);
    return { success: false, error: error.message };
  }
}

export default {
  loadDirectoryHandle,
  saveDirectoryHandle,
  ensureDirectoryHandleIfNeeded,
  handleFileSystemSave,
};
