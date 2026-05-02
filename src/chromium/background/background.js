/* global chrome */
import { notifyBasic } from '../../utils/notifications/notifications.js';
import { toBase64Utf8 } from '../../utils/data/encoding.js';
import { buildObsidianNewUri } from '../../utils/browser/obsidian.js';
import { sanitizeForFilename } from '../../utils/data/validation.js';
import { createTab, openUrlWithAutoClose, getSync } from '../../utils/browser/chrome.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('ChatVault Background');
const SHORT_URI_CONTENT_LIMIT = 6000;

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

function escapeFrontmatterValue(value) {
  const text = String(value || '').replace(/"/g, '\\"');
  return `"${text}"`;
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

function buildDefaultNote({ title, serviceLabel, sourceUrl, saved, mode, markdown }) {
  return [
    '---',
    `title: ${escapeFrontmatterValue(title || 'Untitled Conversation')}`,
    `service: ${escapeFrontmatterValue(serviceLabel)}`,
    `source: ${escapeFrontmatterValue(sourceUrl || '')}`,
    `saved: ${escapeFrontmatterValue(saved)}`,
    `mode: ${escapeFrontmatterValue(mode)}`,
    '---',
    '',
    markdown
  ].join('\n');
}

function buildNoteContent({ settings, title, serviceLabel, sourceUrl, saved, mode, markdown }) {
  const defaultTemplate = '---\ntitle: {title}\nservice: {service}\nsource: {url}\nsaved: {saved}\nmode: {type}\n---\n\n{content}';
  const template = settings.chatNoteFormat || defaultTemplate;
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

function buildFolderPath(template, { serviceLabel, dateStr, sanitizedTitle, mode }) {
  return String(template || 'ChatVault/{service}')
    .replace(/\{service\}/g, serviceLabel)
    .replace(/\{date\}/g, dateStr)
    .replace(/\{title\}/g, sanitizedTitle)
    .replace(/\{type\}/g, mode)
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');
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
  const downloadPath = folderPath ? `${folderPath}/${filename}` : filename;
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

async function saveMarkdownToObsidian({ markdown, service, title, sourceUrl, mode, metadata = {}, sender }) {
  const settings = await getSync([
    'obsidianVault',
    'chatFolderPath',
    'chatNoteFormat',
    'saveMethod',
    'downloadsFolder'
  ]);

  const tabId = sender?.tab?.id;
  const serviceLabel = getServiceLabel(service);
  const normalizedMode = normalizeMode(mode || metadata.type);
  const saved = new Date().toISOString();
  const dateStr = saved.split('T')[0];
  const noteTitle = title || `${serviceLabel} Chat - ${dateStr}`;
  const sanitizedTitle = sanitizeForFilename(noteTitle, 'untitled');
  const filename = `${dateStr}_${sanitizedTitle}.md`;
  const folderPath = buildFolderPath(settings.chatFolderPath, {
    serviceLabel,
    dateStr,
    sanitizedTitle,
    mode: normalizedMode
  });
  const fullFilePath = `${folderPath}/${filename}`;
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
  const failures = [];

  log.info('Saving markdown', { service: serviceLabel, mode: normalizedMode, saveMethod, fullFilePath });

  if (saveMethod === 'filesystem' || saveMethod === 'auto') {
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
        path: fsResult.finalFileName ? `${folderPath}/${fsResult.finalFileName}` : fullFilePath,
        service: serviceLabel,
        title: noteTitle
      };
    } catch (error) {
      failures.push(`filesystem: ${error.message}`);
      log.warn('File System Access save failed, falling back:', error);
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
    const heading = mode === 'recent'
      ? `# Last ${request.count || messages.length} Messages`
      : mode === 'selection'
        ? '# Selected Messages'
        : '# Full Conversation';

    const body = [
      heading,
      '',
      ...messages.flatMap((msg, index) => {
        const speaker = msg.speaker || (msg.role === 'user' ? 'User' : 'Assistant');
        const content = normalizeMarkdown(msg.content || '');
        const separator = index < messages.length - 1 ? ['','---',''] : [''];
        return [`### ${speaker}`, '', content, ...separator];
      })
    ].join('\n');

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
        chrome.tabs.sendMessage(tab.id, { action: 'updateSettings' });
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
