/* global chrome */
import "./App.css";
import React, { useState, useEffect, useRef, Suspense, useCallback, useMemo } from "react";
import { sanitizeTitle } from "../../utils/data/validation.js";
import { queryActiveTab, getSync } from "../../utils/browser/chrome.js";
import {
  loadDirectoryHandle,
  saveDirectoryHandle,
  removeDirectoryHandle,
  isDirectoryHandleUsable
} from "../../utils/browser/fileSystemAccess.js";
import { normalizeChatMode, normalizeSaveMethod, stripServiceTitle } from "../../utils/chat/formatting.js";
import { getVaultRootWarning } from "../../utils/chat/vaultRoot.js";
import { buildChatSavePath, SETTINGS_VERSION } from "../../utils/chat/savePath.js";
import { toast } from "../../utils/notifications/toast.js";
import ChatModeSelector from "./components/ChatModeSelector";
import { clampRecentCount } from "./components/recentCount";

// Lazy load MarkdownPreview to reduce initial bundle size
const MarkdownPreview = React.lazy(() => import("./components/MarkdownPreview"));

const getChatServiceName = (url = "") => {
  if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) return "ChatGPT";
  if (url.includes("claude.ai")) return "Claude";
  if (url.includes("gemini.google.com")) return "Gemini";
  return "Unknown";
};

const getChatServiceKey = (url = "") => {
  if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) return "chatgpt";
  if (url.includes("claude.ai")) return "claude";
  if (url.includes("gemini.google.com")) return "gemini";
  return "chatvault";
};

const ensurePopupDirectoryHandleIfNeeded = async (method) => {
  const normalizedMethod = normalizeSaveMethod(method);
  if (normalizedMethod === "downloads") return;

  const existing = await loadDirectoryHandle().catch(() => null);
  if (existing) {
    const warning = getVaultRootWarning(existing.name);
    if (warning) {
      await removeDirectoryHandle().catch(() => {});
      chrome.storage.sync.set({ selectedFolderPath: "" });
    } else {
      const current = await existing.queryPermission?.({ mode: "readwrite" });
      if (current === "granted" && await isDirectoryHandleUsable(existing)) return existing;

      const requested = await existing.requestPermission?.({ mode: "readwrite" });
      if (requested === "granted" && await isDirectoryHandleUsable(existing)) return existing;

      await removeDirectoryHandle().catch(() => {});
    }
  }

  if (typeof window.showDirectoryPicker !== "function") {
    if (normalizedMethod === "filesystem") {
      throw new Error("File System Access APIが利用できません。ChromeまたはEdgeで試してください。");
    }
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({
      mode: "readwrite",
      startIn: "documents"
    });
    const warning = getVaultRootWarning(handle.name);
    if (warning) {
      throw new Error(`${warning} OptionsでObsidianのVaultルートを選び直してください。`);
    }
    await saveDirectoryHandle(handle);
    chrome.storage.sync.set({ selectedFolderPath: handle.name });
    return handle;
  } catch (error) {
    if (normalizedMethod === "filesystem") {
      throw error;
    }
  }
};

const sendTabMessage = (tabId, payload) => new Promise((resolve, reject) => {
  chrome.tabs.sendMessage(tabId, payload, (response) => {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      reject(lastError);
      return;
    }
    resolve(response);
  });
});

function App() {
  // Original state
  const [pageInfo, setPageInfo] = useState({ title: "", url: "" });
  const [title, setTitle] = useState("");
  const [saveButtonDisabled, setSaveButtonDisabled] = useState(true);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);

  const [loading, setLoading] = useState(true);

  // New chat-save state
  const [mode, setMode] = useState('single');
  const [isOnChatPage, setIsOnChatPage] = useState(false);
  const [messageCount, setMessageCount] = useState(30);
  const [showPreview, setShowPreview] = useState(false);
  const [chatPreviewContent, setChatPreviewContent] = useState('');
  const [saveHistory, setSaveHistory] = useState([]);
  const [notification, setNotification] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [saveMethod, setSaveMethod] = useState("filesystem");
  const [pathSettings, setPathSettings] = useState({ settingsVersion: SETTINGS_VERSION });
  const [isMessageCountValid, setIsMessageCountValid] = useState(true);

  const containerRef = useRef();
  const menuRef = useRef();
  const hamburgerMenuButtonRef = useRef(null);

  const savePathPreview = useMemo(() => {
    const serviceKey = getChatServiceKey(pageInfo.url);
    const conversationTitle = stripServiceTitle(pageInfo.title || title, serviceKey, title);
    return buildChatSavePath({
      settings: pathSettings,
      service: serviceKey,
      title: conversationTitle,
      mode
    });
  }, [mode, pageInfo.title, pageInfo.url, pathSettings, title]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        hamburgerMenuButtonRef.current &&
        !hamburgerMenuButtonRef.current.contains(e.target)
      ) {
        setShowHamburgerMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isOnChatPage) {
      setSaveButtonDisabled(true);
    } else if (mode === 'recent' && !isMessageCountValid) {
      setSaveButtonDisabled(true);
    } else {
      setSaveButtonDisabled(false);
    }
  }, [mode, isOnChatPage, isMessageCountValid]);


  useEffect(() => {
    const getPageInfo = async () => {
      setLoading(true);
      try {
        const tabs = await queryActiveTab();
        const tab = tabs[0];
        setPageInfo({ title: tab.title, url: tab.url });
        setTitle(sanitizeTitle(tab.title));

        // Determine if we're on a supported chat page using manifest host_permissions
        const manifest = chrome.runtime.getManifest();
        const hostPerms = (manifest && manifest.host_permissions) ? manifest.host_permissions : [];
        const supportedHosts = hostPerms
          .map((pattern) => {
            try {
              const urlLike = pattern.replace('*', '');
              return new URL(urlLike).hostname;
            } catch (e) {
              return null;
            }
          })
          .filter(Boolean);

        let isChat = false;
        try {
          const tabHost = new URL(tab.url).hostname;
          isChat = supportedHosts.some((host) => tabHost === host || tabHost.endsWith('.' + host));
        } catch (e) {
          // Fallback when URL parsing fails
          isChat = supportedHosts.some((host) => tab.url.includes(host));
        }
        setIsOnChatPage(isChat);

        // Auto-switch to chat mode if on chat page
        if (isChat && mode === 'webpage') {
          setMode('single');
        }
      } catch (error) {
        console.error("[Chat Clip Obsidian Popup] Error getting page info: ", error);
      } finally {
        setLoading(false);
      }
    };

    getPageInfo();
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const result = await getSync([
          "settingsVersion",
          "saveLocationPreset",
          "chatFolderPath",
          "defaultMode",
          "showPreview",
          "defaultMessageCount",
          "saveMethod"
        ]);
        setPathSettings({
          settingsVersion: result.settingsVersion,
          saveLocationPreset: result.saveLocationPreset,
          chatFolderPath: result.chatFolderPath
        });
        if (result.defaultMode && isOnChatPage) {
          setMode(normalizeChatMode(result.defaultMode));
        }
        if (result.showPreview !== undefined) {
          setShowPreview(result.showPreview);
        }
        if (result.defaultMessageCount) {
          setMessageCount(clampRecentCount(result.defaultMessageCount));
        }
        if (result.saveMethod) {
          setSaveMethod(normalizeSaveMethod(result.saveMethod));
        }
        // Load save history and theme
        chrome.storage.local.get(['saveHistory', 'darkMode'], (result) => {
          if (result.saveHistory) {
            setSaveHistory(result.saveHistory.slice(0, 5)); // Keep only last 5
          }
          if (result.darkMode !== undefined) {
            setDarkMode(result.darkMode);
          }
        });
      } catch (error) {
        console.error("[Chat Clip Obsidian Popup] Error loading settings: ", error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [isOnChatPage]);

  // Generate chat preview content
  useEffect(() => {
    if (isOnChatPage) {
      const service = getChatServiceName(pageInfo.url);
      const date = new Date().toISOString().split('T')[0];
      const chatTitle = title || `${service} Chat - ${date}`;

      let preview = `# ${chatTitle}\n\n`;

      if (mode === 'single') {
        preview += '### Latest Message\n\nLatest message will be saved here.';
      } else if (mode === 'selection') {
        preview += '### Selected Text\n\nSelected text will be saved here.';
      } else if (mode === 'recent') {
        preview += `### Recent Messages\n\nLast ${messageCount} messages will be saved here.`;
      } else if (mode === 'full') {
        preview += '### Full Conversation\n\nFull conversation will be saved here.';
      }

      setChatPreviewContent(preview);
    }
  }, [mode, isOnChatPage, pageInfo.url, title, messageCount]);

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Apply dark mode theme
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.setAttribute('data-theme', darkMode ? 'dark' : 'light');
      container.classList.add('theme-transition');
    }
  }, [darkMode]);

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setDarkMode((currentDarkMode) => {
      const newDarkMode = !currentDarkMode;
      chrome.storage.local.set({ darkMode: newDarkMode });
      return newDarkMode;
    });
  }, []);

  const saveNote = useCallback(async () => {
    const actionByMode = {
      single: 'saveActive',
      selection: 'saveSelected',
      recent: 'saveLastN',
      full: 'saveAll'
    };

    const selectedMode = normalizeChatMode(mode);
    const action = actionByMode[selectedMode];
    const normalizedSaveMethod = normalizeSaveMethod(saveMethod);
    const shouldEnsureFolder = normalizedSaveMethod === 'filesystem';

    try {
      if (selectedMode === 'recent' && !isMessageCountValid) {
        throw new Error('保存するメッセージ数は1から100の範囲で入力してください');
      }

      setSaveButtonDisabled(true);
      setNotification({ type: 'info', message: '保存中です...' });

      if (shouldEnsureFolder) {
        await ensurePopupDirectoryHandleIfNeeded(normalizedSaveMethod);
      }

      const tabs = await queryActiveTab();
      const tab = tabs[0];
      if (!tab?.id || !action) {
        throw new Error('保存対象のタブを取得できませんでした');
      }

      const response = await sendTabMessage(tab.id, {
        action,
        count: selectedMode === 'recent' ? messageCount : undefined
      });

      if (!response || !response.success) {
        throw new Error(response?.userMessage || response?.error || '保存に失敗しました');
      }

      const service = response.service || getChatServiceName(tab.url || pageInfo.url);
      const historyItem = {
        service,
        title: response.title || title || tab.title || 'Untitled',
        filename: response.filename,
        path: response.fullFilePath || response.path || response.filename,
        method: response.method,
        timestamp: Date.now()
      };

      chrome.storage.local.get(['saveHistory'], (stored) => {
        const nextHistory = [historyItem, ...(stored.saveHistory || [])].slice(0, 10);
        chrome.storage.local.set({
          chatMode: selectedMode,
          messageCount: selectedMode === 'recent' ? messageCount : undefined,
          savedAt: Date.now(),
          saveHistory: nextHistory
        });
      });

      const message = response.message || '保存しました';
      setNotification({ type: 'success', message });
      toast.show(message, 'success');
      setTimeout(() => window.close(), 900);
    } catch (error) {
      const message = error?.message || '保存に失敗しました';
      setNotification({ type: 'error', message });
      toast.show(message, 'error');
      setSaveButtonDisabled(false);
    }
  }, [
    isMessageCountValid,
    messageCount,
    mode,
    pageInfo.url,
    saveMethod,
    title
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e) => {
      // Alt+S: Save
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        if (!saveButtonDisabled) {
          saveNote();
        }
      }
      // Alt+P: Toggle Preview
      else if (e.altKey && e.key === 'p') {
        e.preventDefault();
        setShowPreview((current) => !current);
      }
      // Alt+D: Toggle Dark Mode
      else if (e.altKey && e.key === 'd') {
        e.preventDefault();
        toggleDarkMode();
      }
      // Escape: Close popup
      else if (e.key === 'Escape') {
        e.preventDefault();
        window.close();
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    return () => document.removeEventListener('keydown', handleKeyboard);
  }, [saveButtonDisabled, saveNote, toggleDarkMode]);

  if (loading) {
    return (
      <div className="h-44 flex items-center justify-center">
        <div className="my-spinner w-5 h-5 border-t-2 border-zinc-700 border-solid rounded-full"></div>
      </div>
    );
  }

  const handleCancel = () => {
    window.close();
  };

  const donateRedirect = () => {
    chrome.tabs.create({
      url: "https://www.paypal.com/donate/?hosted_button_id=M8RTMTXKV46EC",
    });
  };

  const optionsRedirect = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <div
      ref={containerRef}
      className={`relative max-w-lg mx-auto border-2 shadow-xl theme-transition ${
        darkMode 
          ? 'border-zinc-600 bg-zinc-800 text-white' 
          : 'border-zinc-700 bg-zinc-50 text-black'
      }`}
    >
      {/* Header */}
      <div className={`px-4 py-3 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Chat Clip Obsidian
          </h1>
          <div className="flex items-center space-x-2">
            <span className={`text-xs px-2 py-1 rounded-full ${
              isOnChatPage 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-gray-500/20 text-gray-400'
            }`}>
              {isOnChatPage ? '準備完了' : 'チャットページではありません'}
            </span>
          </div>
        </div>
      </div>

      {isOnChatPage && (
        <div className="p-4">
          <ChatModeSelector
            onModeChange={setMode}
            onCountChange={setMessageCount}
            onCountValidityChange={setIsMessageCountValid}
            defaultMode={mode}
            defaultCount={messageCount}
            darkMode={darkMode}
          />
        </div>
      )}

      <div className="p-4">
          <div className="text-center">
            <div className="text-sm text-zinc-600 mb-2">
              {mode === 'single' && "「保存」をクリックして最新メッセージを取得します"}
              {mode === 'selection' && "ページ上のテキストを選択してから「保存」をクリックしてください"}
              {mode === 'recent' && (
                isMessageCountValid
                  ? `最新の${messageCount}件のメッセージを保存します`
                  : '保存するメッセージ数を1から100の範囲で入力してください'
              )}
              {mode === 'full' && "会話全体を保存します"}
            </div>
            {!isOnChatPage && (
              <div className="text-xs text-red-500">
                この機能はサポートされているチャットページでのみ動作します（ChatGPT、Claude、Gemini）
              </div>
            )}
          </div>

          {isOnChatPage && (
            <div className={`mt-4 rounded-lg border px-3 py-2 text-left ${
              darkMode
                ? 'border-blue-500/40 bg-blue-950/30'
                : 'border-blue-200 bg-blue-50'
            }`}>
              <div className={`text-xs font-semibold ${darkMode ? 'text-blue-200' : 'text-blue-700'}`}>
                今回の保存先
              </div>
              <code className={`mt-1 block break-all text-xs ${darkMode ? 'text-blue-50' : 'text-blue-900'}`}>
                {savePathPreview.fullFilePath}
              </code>
            </div>
          )}

          {isOnChatPage && savePathPreview.legacySettingsDetected && (
            <div className={`mt-3 rounded-lg border px-3 py-2 text-left text-xs ${
              darkMode
                ? 'border-amber-500/50 bg-amber-950/30 text-amber-100'
                : 'border-amber-300 bg-amber-50 text-amber-800'
            }`}>
              以前の保存設定が見つかりました。現在の保存先: {savePathPreview.fullFilePath}
            </div>
          )}

          {saveHistory.length > 0 && (
            <div className={`mt-4 pt-3 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className={`text-xs mb-2 font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                最近の保存
              </div>
              <div className="space-y-1">
                {saveHistory.map((item, index) => (
                  <div key={index} className={`text-xs rounded-lg px-3 py-2 flex items-center justify-between ${
                    darkMode ? 'bg-gray-700/50' : 'bg-gray-100'
                  }`}>
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        item.service === 'ChatGPT'
                          ? 'bg-green-500/20 text-green-400'
                          : item.service === 'Gemini'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {item.service}
                      </span>
                      <span className="truncate flex-1">{item.title}</span>
                    </div>
                    <span className={`text-xs ml-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      {showPreview && isOnChatPage && (
        <div className="p-4 pt-0">
          <Suspense fallback={
            <div className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            </div>
          }>
            <MarkdownPreview
              content={chatPreviewContent}
              isLoading={loading}
              maxHeight="300px"
              darkMode={darkMode}
            />
          </Suspense>
        </div>
      )}

      {notification && (
        <div className={`notification fixed top-2 right-2 px-4 py-2 rounded-md text-white z-50 ${
          notification.type === 'success' ? 'bg-green-500' : notification.type === 'info' ? 'bg-blue-500' : 'bg-red-500'
        }`}>
          {notification.message}
        </div>
      )}

      <div className={`flex justify-between w-full px-4 py-3 items-center border-t ${
        darkMode ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
      }`}>
        <div>
          <button
            ref={hamburgerMenuButtonRef}
            className={`p-2 rounded-lg transition-colors ${
              darkMode 
                ? 'hover:bg-gray-700 active:bg-gray-600' 
                : 'hover:bg-gray-200 active:bg-gray-300'
            } ${showHamburgerMenu ? (darkMode ? 'bg-gray-700' : 'bg-gray-200') : ''}`}
            onClick={() => setShowHamburgerMenu(!showHamburgerMenu)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
          {showHamburgerMenu && (
            <div
              ref={menuRef}
              className={`fixed bottom-14 left-4 rounded-lg shadow-xl min-w-[200px] ${
                darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
              }`}
            >
              <button
                className={`block w-full text-left py-3 px-4 rounded-t-lg transition-colors ${
                  darkMode 
                    ? 'hover:bg-gray-700 text-gray-200' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                onClick={optionsRedirect}
              >
                <div className="flex items-center space-x-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>オプション</span>
                </div>
              </button>
              <button
                className={`block w-full text-left py-3 px-4 transition-colors ${
                  darkMode 
                    ? 'hover:bg-gray-700 text-gray-200' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                onClick={() => setShowPreview(!showPreview)}
              >
                <div className="flex items-center space-x-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>プレビューを{showPreview ? '非表示' : '表示'}</span>
                </div>
              </button>
              <button
                className={`block w-full text-left py-3 px-4 transition-colors ${
                  darkMode 
                    ? 'hover:bg-gray-700 text-gray-200' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                onClick={toggleDarkMode}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{darkMode ? '☀️' : '🌙'}</span>
                  <span>{darkMode ? 'ライトモード' : 'ダークモード'}</span>
                </div>
              </button>
              <button
                className={`block w-full text-left py-3 px-4 rounded-b-lg transition-colors ${
                  darkMode 
                    ? 'hover:bg-gray-700 text-gray-200' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                onClick={donateRedirect}
              >
                <div className="flex items-center space-x-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span>サポート</span>
                </div>
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
              darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
            onClick={handleCancel}
          >
            キャンセル
          </button>
          <button
            className={`py-2 px-5 rounded-lg font-medium transition-all relative ${
              saveButtonDisabled
                ? darkMode 
                  ? "opacity-50 cursor-not-allowed bg-gray-700 text-gray-500"
                  : "opacity-50 cursor-not-allowed bg-gray-200 text-gray-400"
                : darkMode
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl"
                  : "bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl"
            }`}
            onClick={saveNote}
            disabled={saveButtonDisabled}
            title="保存 (Alt+S)"
          >
            <span className="flex items-center space-x-2">
              <span>保存</span>
              <span className="text-xs opacity-75">⌥S</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
