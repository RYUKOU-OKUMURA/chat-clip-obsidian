/* global chrome */
import { notifyBasic } from '../../utils/notifications/notifications.js';
import { toBase64Utf8 } from '../../utils/data/encoding.js';
import { buildObsidianNewUri } from '../../utils/browser/obsidian.js';
import { sanitizeForFilename, sanitizeRelativePath } from '../../utils/data/validation.js';
import { createTab, openUrlWithAutoClose, getSync } from '../../utils/browser/chrome.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('ChatVault Background');
const SHORT_URI_CONTENT_LIMIT = 6000;
const DEFAULT_CHAT_NOTE_FORMAT = '# {title}\n\n{content}';

const SERVICE_LABELS = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini'
};

function getServiceLabel(service) {
  return SERVICE_LABELS[String(service || '').toLowerCase()] || service || 'ChatVault';
}

function normalizeSaveMethod(method) {
  if (method === 'advanced-uri' || method === 'clipboard') return 'auto';
  return ['filesystem', 'auto', 'downloads'].includes(method) ? method : 'filesystem';
}

function normalizeMode(mode) {
  if (mode === 'last3' || mode === 'last5') return 'recent';
  return ['single', 'selection', 'recent', 'full', 'all'].includes(mode) ? (mode === 'all' ? 'full' : mode) : 'single';
}

function normalizeMarkdown(content) {
  return String(content || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .trim();
}

function renderTemplate(template, values) {
  return String(template || '')
    .replace(/\{title\}/g, values.title)
    .replace(/\{service\}/g, values.service)
    .replace(/\{url\}/g, values.url)
    .replace(/\{date\}/g, values.date)
    .replace(/\{saved\}/g, values.saved)
    .replace(/\{type\}/g, values.type)
    .replace(/\{content\}/g, values.content);
}

function normalizeNoteTemplate(template) {
  const normalized = String(template || DEFAULT_CHAT_NOTE_FORMAT).replace(/\\n/g, '\n');
  const trimmed = normalized.trim();
  if (!trimmed) return DEFAULT_CHAT_NOTE_FORMAT;

  const lower = trimmed.toLowerCase();
  const hasLegacyMetadata = [
    'service: {service}',
    'source: {url}',
    'saved: {saved}',
    'mode: {type}',
    '- **saved**',
    '- **service**',
    '- **mode**',
    '- **url**',
    '- saved:',
    '- service:',
    '- mode:',
    '- url:'
  ].some((marker) => lower.includes(marker));

  return hasLegacyMetadata ? DEFAULT_CHAT_NOTE_FORMAT : normalized;
}

function buildDefaultNote({ title, serviceLabel, sourceUrl, saved, mode, markdown }) {
  return renderTemplate(DEFAULT_CHAT_NOTE_FORMAT, {
    title: title || 'Untitled Conversation',
    service: serviceLabel,
    url: sourceUrl || '',
    date: saved.split('T')[0],
    saved,
    type: mode,
    content: markdown
  });
}

function buildNoteContent({ settings, title, serviceLabel, sourceUrl, saved, mode, markdown }) {
  const template = normalizeNoteTemplate(settings.chatNoteFormat);
  if (!template.includes('{content}')) {
    return buildDefaultNote({ title, serviceLabel, sourceUrl, saved, mode, markdown });
  }

  return renderTemplate(template, {
    title: title || 'Untitled Conversation',
    service: serviceLabel,
    url: sourceUrl || '',
    date: saved.split('T')[0],
    saved,
    type: mode,
    content: markdown
  });
}

function normalizeChatFolderTemplate(template) {
  const raw = String(template ?? '').trim();
  if (!raw || raw.includes('{title}')) return '';
  return raw;
}

function buildFolderPath(template, { serviceLabel, dateStr, sanitizedTitle, mode }) {
  const folderTemplate = normalizeChatFolderTemplate(template);
  if (!folderTemplate) return '';

  const rendered = folderTemplate
    .replace(/\{service\}/g, serviceLabel)
    .replace(/\{date\}/g, dateStr)
    .replace(/\{title\}/g, sanitizedTitle)
    .replace(/\{type\}/g, mode)
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');
  return sanitizeRelativePath(rendered, 'ChatVault');
}

async function openDirectoryHandleDB() {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in the extension service worker');
  }

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

async function loadExtensionDirectoryHandle() {
  const db = await openDirectoryHandleDB();
  const tx = db.transaction(['handles'], 'readonly');
  const store = tx.objectStore('handles');
  const request = store.get('vaultDirectory');

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function ensureExtensionDirectoryPermission(dirHandle) {
  if (!dirHandle) {
    throw new Error('Vaultフォルダが未設定です。OptionsでObsidian Vaultフォルダを選択してください。');
  }

  const current = await dirHandle.queryPermission?.({ mode: 'readwrite' });
  if (current === 'granted') return;
  throw new Error('Vaultフォルダの書き込み権限がありません。PopupまたはOptionsでVaultフォルダを再選択してください。');
}

async function writeMarkdownWithDirectoryHandle(dirHandle, content, relativePath) {
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

async function saveViaExtensionFileSystem(content, relativePath) {
  const dirHandle = await loadExtensionDirectoryHandle();
  await ensureExtensionDirectoryPermission(dirHandle);
  return writeMarkdownWithDirectoryHandle(dirHandle, content, relativePath);
}

function sendToTab(tabId, payload) {
  return new Promise((resolve, reject) => {
    if (!tabId) {
      reject(new Error('No active chat tab is available'));
      return;
    }
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      if (response && response.success === false) {
        reject(new Error(response.error || 'Content script request failed'));
        return;
      }
      resolve(response || { success: true });
    });
  });
}

async function copyToClipboardViaTab(tabId, content) {
  return sendToTab(tabId, { action: 'copyToClipboard', content });
}

async function saveViaFileSystem(tabId, content, relativePath) {
  return sendToTab(tabId, {
    action: 'saveViaFileSystem',
    content,
    relativePath
  });
}

async function saveViaDownloadAPI(content, filename, folderPath) {
  const base64Content = toBase64Utf8(content);
  const dataUrl = `data:text/markdown;charset=utf-8;base64,${base64Content}`;
  const safeFolderPath = folderPath ? sanitizeRelativePath(folderPath, 'ChatVault') : '';
  const downloadPath = safeFolderPath ? `${safeFolderPath}/${filename}` : filename;
  const downloadId = await new Promise((resolve, reject) => {
    chrome.downloads.download({
      url: dataUrl,
      filename: downloadPath,
      saveAs: false,
      conflictAction: 'uniquify'
    }, (id) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(id);
    });
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.downloads.onChanged.removeListener(listener);
      reject(new Error('Download timeout'));
    }, 30000);

    const listener = (delta) => {
      if (delta.id !== downloadId) return;
      if (delta.state?.current === 'complete') {
        clearTimeout(timeout);
        chrome.downloads.onChanged.removeListener(listener);
        resolve({ success: true, downloadId });
      } else if (delta.state?.current === 'interrupted') {
        clearTimeout(timeout);
        chrome.downloads.onChanged.removeListener(listener);
        reject(new Error(delta.error?.current || 'Download interrupted'));
      }
    };

    chrome.downloads.onChanged.addListener(listener);
  });
}

async function prepareMarkdownSave({ markdown, service, title, sourceUrl, mode, metadata = {} }) {
  const settings = await getSync([
    'obsidianVault',
    'chatFolderPath',
    'chatFolderPathExplicit',
    'chatNoteFormat',
    'saveMethod',
    'downloadsFolder'
  ]);

  const serviceLabel = getServiceLabel(service);
  const normalizedMode = normalizeMode(mode || metadata.type);
  const saved = new Date().toISOString();
  const dateStr = saved.split('T')[0];
  const noteTitle = title || `${serviceLabel} Chat - ${dateStr}`;
  const sanitizedTitle = sanitizeForFilename(noteTitle, 'untitled');
  const filename = `${dateStr}_${sanitizedTitle}.md`;
  const folderPath = buildFolderPath(settings.chatFolderPathExplicit === true ? settings.chatFolderPath : '', {
    serviceLabel,
    dateStr,
    sanitizedTitle,
    mode: normalizedMode
  });
  const fullFilePath = folderPath ? `${folderPath}/${filename}` : filename;
  const body = normalizeMarkdown(markdown);
  const fullContent = buildNoteContent({
    settings,
    title: noteTitle,
    serviceLabel,
    sourceUrl,
    saved,
    mode: normalizedMode,
    markdown: body
  });

  const vaultName = settings.obsidianVault || 'MyVault';
  const saveMethod = normalizeSaveMethod(settings.saveMethod);
  const downloadsFolder = settings.downloadsFolder || 'ChatVault';

  return {
    success: true,
    fullContent,
    fullFilePath,
    filename,
    folderPath,
    service: serviceLabel,
    serviceLabel,
    title: noteTitle,
    sourceUrl,
    mode: normalizedMode,
    vaultName,
    saveMethod,
    downloadsFolder
  };
}

async function saveMarkdownToObsidian({ markdown, service, title, sourceUrl, mode, metadata = {}, sender }) {
  const prepared = await prepareMarkdownSave({ markdown, service, title, sourceUrl, mode, metadata });
  const {
    fullContent,
    fullFilePath,
    filename,
    folderPath,
    serviceLabel,
    title: noteTitle,
    mode: normalizedMode,
    vaultName,
    saveMethod,
    downloadsFolder
  } = prepared;
  const tabId = sender?.tab?.id;
  const failures = [];

  log.info('Saving markdown', { service: serviceLabel, mode: normalizedMode, saveMethod, fullFilePath });

  if (saveMethod === 'filesystem' || saveMethod === 'auto') {
    try {
      const fsResult = await saveViaExtensionFileSystem(fullContent, fullFilePath);
      const finalName = fsResult.finalFileName || filename;
      const message = fsResult.message || `Saved directly to your Obsidian vault: ${finalName}`;
      notifyBasic({ message });
      return {
        success: true,
        method: 'filesystem',
        message,
        filename: finalName,
        path: fsResult.finalFileName
          ? (folderPath ? `${folderPath}/${fsResult.finalFileName}` : fsResult.finalFileName)
          : fullFilePath,
        service: serviceLabel,
        title: noteTitle
      };
    } catch (error) {
      failures.push(`extension-filesystem: ${error.message}`);
      log.warn('Extension File System Access save failed, trying content tab handle:', error);
    }

    try {
      const fsResult = await saveViaFileSystem(tabId, fullContent, fullFilePath);
      const finalName = fsResult.finalFileName || filename;
      const message = fsResult.message || `Saved directly to your Obsidian vault: ${finalName}`;
      notifyBasic({ message });
      return {
        success: true,
        method: 'filesystem',
        message,
        filename: finalName,
        path: fsResult.finalFileName
          ? (folderPath ? `${folderPath}/${fsResult.finalFileName}` : fsResult.finalFileName)
          : fullFilePath,
        service: serviceLabel,
        title: noteTitle
      };
    } catch (error) {
      failures.push(`tab-filesystem: ${error.message}`);
      log.warn('Content tab File System Access save failed, falling back:', error);
    }
  }

  if (saveMethod !== 'downloads') {
    try {
      await copyToClipboardViaTab(tabId, fullContent);
      const uri = buildObsidianNewUri({ vaultName, filePath: fullFilePath, clipboard: true });
      await openUrlWithAutoClose(uri, 3000, { active: false });
      return {
        success: true,
        method: 'obsidian-clipboard-uri',
        message: `Copied content to clipboard and opened Obsidian: ${filename}`,
        filename,
        path: fullFilePath,
        service: serviceLabel,
        title: noteTitle
      };
    } catch (error) {
      failures.push(`clipboard-uri: ${error.message}`);
      log.warn('Obsidian clipboard URI fallback failed:', error);
    }

    if (fullContent.length <= SHORT_URI_CONTENT_LIMIT) {
      try {
        const uri = buildObsidianNewUri({ vaultName, filePath: fullFilePath, content: fullContent });
        await openUrlWithAutoClose(uri, 3000, { active: false });
        return {
          success: true,
          method: 'obsidian-content-uri',
          message: `Opened Obsidian URI for short note: ${filename}`,
          filename,
          path: fullFilePath,
          service: serviceLabel,
          title: noteTitle
        };
      } catch (error) {
        failures.push(`content-uri: ${error.message}`);
        log.warn('Short content URI fallback failed:', error);
      }
    }
  }

  try {
    const downloadFolder = `${downloadsFolder}/${serviceLabel}`;
    const downloadResult = await saveViaDownloadAPI(fullContent, filename, downloadFolder);
    const message = `Saved to Downloads folder: ${downloadFolder}/${filename}`;
    notifyBasic({ message: `Saved to Downloads: ${filename}` });
    return {
      success: true,
      method: 'downloads',
      message,
      filename,
      path: `${downloadFolder}/${filename}`,
      downloadId: downloadResult.downloadId,
      service: serviceLabel,
      title: noteTitle,
      fallbackReason: failures.join(' | ')
    };
  } catch (error) {
    failures.push(`downloads: ${error.message}`);
    throw new Error(`All save methods failed. ${failures.join(' | ')}`);
  }
}

function formatMessagesAsMarkdown(messages) {
  return [
    ...messages.flatMap((msg, index) => {
      const speaker = msg.speaker || (msg.role === 'user' ? 'User' : 'Assistant');
      const content = normalizeMarkdown(msg.content || '');
      const separator = index < messages.length - 1 ? ['','---',''] : [''];
      return [`### ${speaker}`, '', content, ...separator];
    })
  ].join('\n');
}

async function handleSaveMessage(request, sender, sendResponse) {
  try {
    const isSelection = request.metadata?.type === 'selection' || request.messageType === 'selection';
    const mode = normalizeMode(isSelection ? 'selection' : request.messageType || 'single');
    const response = await saveMarkdownToObsidian({
      markdown: request.messageContent || '',
      service: request.service,
      title: request.conversationTitle,
      sourceUrl: request.metadata?.url || sender.tab?.url || '',
      mode,
      metadata: request.metadata || {},
      sender
    });
    sendResponse(response);
  } catch (error) {
    log.error('Error saving message:', error);
    sendResponse({ success: false, error: error.message, errorCode: 'SAVE_FAILED' });
  }
}

async function handleSaveMultipleMessages(request, sender, sendResponse) {
  try {
    const messages = Array.isArray(request.messages) ? request.messages : [];
    if (!messages.length) {
      sendResponse({ success: false, error: 'No messages to save' });
      return;
    }

    const mode = normalizeMode(request.messageType || request.mode || 'full');
    const body = formatMessagesAsMarkdown(messages);

    const response = await saveMarkdownToObsidian({
      markdown: body,
      service: request.service,
      title: request.conversationTitle,
      sourceUrl: request.sourceUrl || sender.tab?.url || '',
      mode,
      metadata: { count: request.count },
      sender
    });
    sendResponse(response);
  } catch (error) {
    log.error('Error saving multiple messages:', error);
    sendResponse({ success: false, error: error.message, errorCode: 'SAVE_FAILED' });
  }
}

async function handleSaveSelection(request, sender, sendResponse) {
  return handleSaveMessage({
    ...request,
    messageType: 'selection',
    metadata: {
      ...(request.metadata || {}),
      type: 'selection',
      url: sender.tab?.url,
      title: request.title || 'Text Selection',
      timestamp: new Date().toISOString()
    }
  }, sender, sendResponse);
}

async function handlePrepareMessage(request, sender, sendResponse) {
  try {
    const isSelection = request.metadata?.type === 'selection' || request.messageType === 'selection';
    const mode = normalizeMode(isSelection ? 'selection' : request.messageType || 'single');
    const response = await prepareMarkdownSave({
      markdown: request.messageContent || '',
      service: request.service,
      title: request.conversationTitle,
      sourceUrl: request.sourceUrl || request.metadata?.url || sender.tab?.url || '',
      mode,
      metadata: request.metadata || {}
    });
    sendResponse(response);
  } catch (error) {
    log.error('Error preparing message:', error);
    sendResponse({ success: false, error: error.message, errorCode: 'PREPARE_FAILED' });
  }
}

async function handlePrepareMultipleMessages(request, sender, sendResponse) {
  try {
    const messages = Array.isArray(request.messages) ? request.messages : [];
    if (!messages.length) {
      sendResponse({ success: false, error: 'No messages to save' });
      return;
    }

    const mode = normalizeMode(request.messageType || request.mode || 'full');
    const response = await prepareMarkdownSave({
      markdown: formatMessagesAsMarkdown(messages),
      service: request.service,
      title: request.conversationTitle,
      sourceUrl: request.sourceUrl || sender.tab?.url || '',
      mode,
      metadata: { count: request.count }
    });
    sendResponse(response);
  } catch (error) {
    log.error('Error preparing multiple messages:', error);
    sendResponse({ success: false, error: error.message, errorCode: 'PREPARE_FAILED' });
  }
}

function getSupportedHostnames() {
  const manifest = chrome.runtime.getManifest();
  return (manifest.host_permissions || [])
    .map((pattern) => {
      try {
        return new URL(pattern.replace('*', '')).hostname;
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

function notifySupportedTabsOfSettings() {
  const supportedHosts = getSupportedHostnames();
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.id || !tab.url) return;
      let shouldNotify = false;
      try {
        const tabHost = new URL(tab.url).hostname;
        shouldNotify = supportedHosts.some((host) => tabHost === host || tabHost.endsWith(`.${host}`));
      } catch (_) {
        shouldNotify = supportedHosts.some((host) => tab.url.includes(host));
      }
      if (shouldNotify) {
        chrome.tabs.sendMessage(tab.id, { action: 'updateSettings' }, () => {
          // Consume lastError for supported hosts where the content script is not currently injected.
          void chrome.runtime.lastError;
        });
      }
    });
  });
}

async function requestMessagesFromTab(request, sender, sendResponse) {
  try {
    const response = await sendToTab(sender.tab?.id, {
      action: request.mode === 'recent' ? 'captureRecentMessages' : 'captureAllMessages',
      count: request.count
    });
    if (!response?.success) {
      sendResponse({ success: false, error: response?.error || 'Failed to capture messages' });
      return;
    }
    await handleSaveMultipleMessages({
      messages: response.messages,
      service: response.service,
      conversationTitle: response.title,
      mode: request.mode,
      count: request.count
    }, sender, sendResponse);
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'saveToObsidian',
      title: 'Save to Obsidian',
      contexts: ['selection'],
      documentUrlPatterns: [
        'https://chat.openai.com/*',
        'https://chatgpt.com/*',
        'https://claude.ai/*',
        'https://gemini.google.com/*'
      ]
    });
  });

  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'saveToObsidian' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'saveSelected',
      selectionText: info.selectionText
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'openOptions':
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
      return false;

    case 'getSettings':
      (async () => {
        const settings = await getSync([
          'obsidianVault',
          'folderPath',
          'noteContentFormat',
          'showSaveButton',
          'chatFolderPath',
          'chatNoteFormat',
          'saveMethod',
          'downloadsFolder',
          'defaultMode',
          'defaultMessageCount'
        ]);
        sendResponse(settings);
      })();
      return true;

    case 'saveSettings':
      chrome.storage.sync.set(request.settings || {}, () => {
        sendResponse({ success: !chrome.runtime.lastError, error: chrome.runtime.lastError?.message });
        notifySupportedTabsOfSettings();
      });
      return true;

    case 'getCurrentTab':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        sendResponse(tabs[0]);
      });
      return true;

    case 'saveSingleMessage':
      handleSaveMessage(request, sender, sendResponse);
      return true;

    case 'saveMultipleMessages':
      handleSaveMultipleMessages(request, sender, sendResponse);
      return true;

    case 'prepareSingleMessage':
      handlePrepareMessage(request, sender, sendResponse);
      return true;

    case 'prepareMultipleMessages':
      handlePrepareMultipleMessages(request, sender, sendResponse);
      return true;

    case 'saveSelection':
      handleSaveSelection(request, sender, sendResponse);
      return true;

    case 'requestMessages':
      requestMessagesFromTab(request, sender, sendResponse);
      return true;

    case 'openObsidianTab':
      (async () => {
        try {
          if (!request.url) throw new Error('URL is required');
          const tab = request.autoClose === false
            ? await createTab(request.url, { active: false })
            : await openUrlWithAutoClose(request.url, request.delayMs || 2000, { active: false });
          sendResponse({ success: true, tabId: tab?.id });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action', action: request.action });
      return false;
  }
});
