// File System Access API helpers isolated from inject.js

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

export async function ensureDirectoryHandleIfNeeded() {
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

    const existing = await loadDirectoryHandle();
    if (existing) {
      const perm = await existing.queryPermission?.({ mode: 'readwrite' });
      if (perm === 'granted') return;
      const req = await existing.requestPermission?.({ mode: 'readwrite' });
      if (req === 'granted') return;
    }

    if (typeof window.showDirectoryPicker === 'function' && method !== 'auto') {
      const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
      await saveDirectoryHandle(dir);
    }
  } catch (e) {
    // Non-fatal: background will fall back to other save methods
    console.warn('[ChatVault] ensureDirectoryHandleIfNeeded skipped quietly:', e?.message || e);
  }
}

export async function handleFileSystemSave(content, relativePath) {
  try {
    console.log('[ChatVault] File System Access API保存を試行中:', relativePath);

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

    const pathSegments = relativePath.split('/').filter(segment => segment);
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
