import { sanitizeRelativePath } from '../data/validation.js';

const DB_NAME = 'ChatVaultDB';
const STORE_NAME = 'handles';
const VAULT_HANDLE_KEY = 'vaultDirectory';

export function openDirectoryHandleDB() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this context'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadDirectoryHandle() {
  const db = await openDirectoryHandleDB();
  try {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return await promisifyRequest(store.get(VAULT_HANDLE_KEY));
  } finally {
    db.close();
  }
}

export async function saveDirectoryHandle(handle) {
  const db = await openDirectoryHandleDB();
  try {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await promisifyRequest(store.put(handle, VAULT_HANDLE_KEY));
  } finally {
    db.close();
  }
}

export async function removeDirectoryHandle() {
  const db = await openDirectoryHandleDB();
  try {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await promisifyRequest(store.delete(VAULT_HANDLE_KEY));
  } finally {
    db.close();
  }
}

export function isMissingDirectoryError(error) {
  const message = error?.message || '';
  return error?.name === 'NotFoundError' ||
    message.includes('could not be found') ||
    message.includes('not be found');
}

export async function isDirectoryHandleUsable(handle) {
  if (!handle) return false;

  try {
    if (typeof handle.values === 'function') {
      for await (const _entry of handle.values()) {
        break;
      }
    }
    return true;
  } catch (error) {
    if (isMissingDirectoryError(error)) return false;
    throw error;
  }
}

export async function writeMarkdownWithDirectoryHandle(dirHandle, content, relativePath) {
  if (!dirHandle) {
    throw new Error('Vaultフォルダが未選択です。');
  }

  const safeRelativePath = sanitizeRelativePath(relativePath, 'ChatVault');
  const pathSegments = safeRelativePath.split('/').filter(Boolean);
  const requestedFileName = pathSegments.pop();

  if (!requestedFileName) {
    throw new Error('保存ファイル名を生成できませんでした。');
  }

  let currentDir = dirHandle;
  for (const segment of pathSegments) {
    currentDir = await currentDir.getDirectoryHandle(segment, { create: true });
  }

  let finalFileName = requestedFileName;
  let wasRenamed = false;

  try {
    const existingHandle = await currentDir.getFileHandle(finalFileName, { create: false });
    const existingFile = await existingHandle.getFile();
    const existingContent = await existingFile.text();

    if (existingContent === content) {
      return {
        success: true,
        method: 'filesystem',
        finalFileName,
        originalFileName: requestedFileName,
        isDuplicate: true,
        skipped: true,
        message: `既存ファイル「${finalFileName}」と同じ内容のため、保存をスキップしました。`
      };
    }

    const baseName = requestedFileName.replace(/\.md$/, '');
    let counter = 1;
    while (true) {
      const candidate = `${baseName}_${counter}.md`;
      try {
        await currentDir.getFileHandle(candidate, { create: false });
        counter += 1;
      } catch (_) {
        finalFileName = candidate;
        wasRenamed = true;
        break;
      }
    }
  } catch (_) {
    // Original file does not exist.
  }

  const fileHandle = await currentDir.getFileHandle(finalFileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();

  const result = {
    success: true,
    method: 'filesystem',
    finalFileName,
    originalFileName: requestedFileName
  };

  if (wasRenamed) {
    result.wasRenamed = true;
    result.message = `「${finalFileName}」として保存しました（重複回避のため名前を変更）`;
  }

  return result;
}
