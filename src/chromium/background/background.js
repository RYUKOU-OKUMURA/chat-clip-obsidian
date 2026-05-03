/* global chrome */
import { notifyBasic } from '../../utils/notifications/notifications.js';
import { toBase64Utf8 } from '../../utils/data/encoding.js';
import { buildObsidianNewUri } from '../../utils/browser/obsidian.js';
import { sanitizeRelativePath } from '../../utils/data/validation.js';
import { createTab, openUrlWithAutoClose, getSync } from '../../utils/browser/chrome.js';
import {
  loadDirectoryHandle,
  removeDirectoryHandle,
  isDirectoryHandleUsable,
  isMissingDirectoryError,
  writeMarkdownWithDirectoryHandle
} from '../../utils/browser/fileSystemAccess.js';
import {
  formatMessagesAsMarkdown,
  getServiceLabel,
  normalizeChatMode,
  normalizeMarkdown,
  normalizeSaveMethod
} from '../../utils/chat/formatting.js';
import { buildChatSavePath } from '../../utils/chat/savePath.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('Chat Clip Obsidian Background');
const SHORT_URI_CONTENT_LIMIT = 6000;
const DEFAULT_CHAT_NOTE_FORMAT = '# {title}\n\n{content}';
const SPEAKER_HEADING_ONLY_RE = /^#{1,6}\s+(User|Assistant|Selection)\s*$/gim;

function hasSaveableContent(markdown) {
  return Boolean(normalizeMarkdown(markdown || '').replace(SPEAKER_HEADING_ONLY_RE, '').trim());
}

function emptyContentResponse() {
  return {
    success: false,
    error: 'No content to save',
    errorCode: 'EMPTY_CONTENT'
  };
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

async function ensureExtensionDirectoryPermission(dirHandle) {
  if (!dirHandle) {
    throw new Error('Vaultフォルダが未設定です。OptionsでObsidian Vaultフォルダを選択してください。');
  }

  const current = await dirHandle.queryPermission?.({ mode: 'readwrite' });
  if (current === 'granted') return;
  throw new Error('Vaultフォルダの書き込み権限がありません。PopupまたはOptionsでVaultフォルダを再選択してください。');
}

async function saveViaExtensionFileSystem(content, relativePath) {
  const dirHandle = await loadDirectoryHandle();
  try {
    await ensureExtensionDirectoryPermission(dirHandle);
    if (!(await isDirectoryHandleUsable(dirHandle))) {
      await removeDirectoryHandle();
      throw new Error('保存先フォルダが見つかりません。Vaultフォルダを再選択してください。');
    }
    return await writeMarkdownWithDirectoryHandle(dirHandle, content, relativePath);
  } catch (error) {
    if (isMissingDirectoryError(error)) {
      await removeDirectoryHandle();
    }
    throw error;
  }
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

  return new Promise((resolve, reject) => {
    let downloadId = null;
    let settled = false;
    const completedById = new Map();

    const cleanup = () => {
      clearTimeout(timeout);
      chrome.downloads.onChanged.removeListener(listener);
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (result.success) {
        resolve({ success: true, downloadId: result.downloadId });
      } else {
        reject(result.error);
      }
    };

    const listener = (delta) => {
      const state = delta.state?.current;
      if (state !== 'complete' && state !== 'interrupted') return;

      const result = state === 'complete'
        ? { success: true, downloadId: delta.id }
        : { success: false, error: new Error(delta.error?.current || 'Download interrupted') };

      if (downloadId === null) {
        completedById.set(delta.id, result);
        return;
      }

      if (delta.id === downloadId) {
        finish(result);
      }
    };

    const timeout = setTimeout(() => {
      finish({ success: false, error: new Error('Download timeout') });
    }, 30000);

    chrome.downloads.onChanged.addListener(listener);
    chrome.downloads.download({
      url: dataUrl,
      filename: downloadPath,
      saveAs: false,
      conflictAction: 'uniquify'
    }, (id) => {
      if (chrome.runtime.lastError) {
        finish({ success: false, error: new Error(chrome.runtime.lastError.message) });
        return;
      }
      downloadId = id;
      if (completedById.has(downloadId)) {
        finish(completedById.get(downloadId));
      }
    });
  });
}

function buildDownloadFolderPath(downloadsFolder, folderPath) {
  const baseFolder = downloadsFolder ? sanitizeRelativePath(downloadsFolder, 'ChatVault') : '';
  const preparedFolder = folderPath ? sanitizeRelativePath(folderPath, 'ChatVault') : '';

  if (!preparedFolder) return baseFolder || 'ChatVault';
  if (!baseFolder || preparedFolder === baseFolder || preparedFolder.startsWith(`${baseFolder}/`)) {
    return preparedFolder;
  }
  return `${baseFolder}/${preparedFolder}`;
}

async function prepareMarkdownSave({ markdown, service, title, sourceUrl, mode, metadata = {} }) {
  if (!hasSaveableContent(markdown)) {
    return emptyContentResponse();
  }

  const settings = await getSync([
    'obsidianVault',
    'settingsVersion',
    'saveLocationPreset',
    'chatFolderPath',
    'chatFolderPathExplicit',
    'chatNoteFormat',
    'saveMethod',
    'downloadsFolder'
  ]);

  const serviceLabel = getServiceLabel(service);
  const normalizedMode = normalizeChatMode(mode || metadata.type);
  const saved = new Date().toISOString();
  const pathInfo = buildChatSavePath({
    settings,
    service,
    title,
    mode: normalizedMode,
    savedAt: saved
  });
  const {
    noteTitle,
    filename,
    folderPath,
    fullFilePath,
    saveLocationPreset,
    folderTemplate,
    legacySettingsDetected
  } = pathInfo;
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

  const vaultName = String(settings.obsidianVault || '').trim();
  const saveMethod = normalizeSaveMethod(settings.saveMethod);
  const downloadsFolder = settings.downloadsFolder || 'ChatVault';

  return {
    success: true,
    fullContent,
    fullFilePath,
    filename,
    folderPath,
    saveLocationPreset,
    folderTemplate,
    legacySettingsDetected,
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
  if (!prepared.success) {
    return prepared;
  }
  const {
    fullContent,
    fullFilePath,
    filename,
    folderPath,
    saveLocationPreset,
    folderTemplate,
    legacySettingsDetected,
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
        folderPath,
        fullFilePath,
        saveLocationPreset,
        folderTemplate,
        legacySettingsDetected,
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
        folderPath,
        fullFilePath,
        saveLocationPreset,
        folderTemplate,
        legacySettingsDetected,
        service: serviceLabel,
        title: noteTitle
      };
    } catch (error) {
      failures.push(`tab-filesystem: ${error.message}`);
      log.warn('Content tab File System Access save failed, falling back:', error);
    }
  }

  if (saveMethod !== 'downloads' && vaultName) {
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
        folderPath,
        fullFilePath,
        saveLocationPreset,
        folderTemplate,
        legacySettingsDetected,
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
          folderPath,
          fullFilePath,
          saveLocationPreset,
          folderTemplate,
          legacySettingsDetected,
          service: serviceLabel,
          title: noteTitle
        };
      } catch (error) {
        failures.push(`content-uri: ${error.message}`);
        log.warn('Short content URI fallback failed:', error);
      }
    }
  } else if (saveMethod !== 'downloads') {
    failures.push('obsidian-uri: vault name is not configured');
  }

  try {
    const downloadFolder = buildDownloadFolderPath(downloadsFolder, folderPath);
    const downloadResult = await saveViaDownloadAPI(fullContent, filename, downloadFolder);
    const message = `Saved to Downloads folder: ${downloadFolder}/${filename}`;
    notifyBasic({ message: `Saved to Downloads: ${filename}` });
    return {
      success: true,
      method: 'downloads',
      message,
      filename,
      path: `${downloadFolder}/${filename}`,
      folderPath,
      fullFilePath,
      saveLocationPreset,
      folderTemplate,
      legacySettingsDetected,
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

async function handleSaveMessage(request, sender, sendResponse) {
  try {
    const isSelection = request.metadata?.type === 'selection' || request.messageType === 'selection';
    const mode = normalizeChatMode(isSelection ? 'selection' : request.messageType || 'single');
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
    const nonEmptyMessages = messages.filter((message) => (message?.content || '').trim());
    if (!nonEmptyMessages.length) {
      sendResponse(emptyContentResponse());
      return;
    }

    const mode = normalizeChatMode(request.messageType || request.mode || 'full');
    const body = formatMessagesAsMarkdown(nonEmptyMessages);

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
    const mode = normalizeChatMode(isSelection ? 'selection' : request.messageType || 'single');
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
    const nonEmptyMessages = messages.filter((message) => (message?.content || '').trim());
    if (!nonEmptyMessages.length) {
      sendResponse(emptyContentResponse());
      return;
    }

    const mode = normalizeChatMode(request.messageType || request.mode || 'full');
    const response = await prepareMarkdownSave({
      markdown: formatMessagesAsMarkdown(nonEmptyMessages),
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
          'settingsVersion',
          'saveLocationPreset',
          'folderPath',
          'noteContentFormat',
          'showSaveButton',
          'chatFolderPath',
          'chatFolderPathExplicit',
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
