/* global chrome */
import React, { useState, useEffect } from "react";
import { toast } from "../../utils/notifications/toast.js";
import { getSync } from "../../utils/browser/chrome.js";

const normalizeMode = (mode) => {
  if (mode === "last3" || mode === "last5") return "recent";
  return ["single", "selection", "recent", "full"].includes(mode) ? mode : "single";
};

const normalizeSaveMethod = (method) => {
  if (method === "advanced-uri" || method === "clipboard") return "auto";
  return ["filesystem", "auto", "downloads"].includes(method) ? method : "filesystem";
};

const DEFAULT_CHAT_NOTE_FORMAT = "# {title}\n\n{content}";

const normalizeChatFolderPath = (path) => {
  const raw = String(path ?? "").trim();
  if (!raw || raw.includes("{title}")) return "";
  return raw;
};

const normalizeChatNoteFormat = (format) => {
  const normalized = String(format || DEFAULT_CHAT_NOTE_FORMAT).replace(/\\n/g, "\n");
  const trimmed = normalized.trim();
  if (!trimmed) return DEFAULT_CHAT_NOTE_FORMAT;

  const lower = trimmed.toLowerCase();
  const hasLegacyMetadata = [
    "service: {service}",
    "source: {url}",
    "saved: {saved}",
    "mode: {type}",
    "- **saved**",
    "- **service**",
    "- **mode**",
    "- **url**",
    "- saved:",
    "- service:",
    "- mode:",
    "- url:"
  ].some((marker) => lower.includes(marker));

  return hasLegacyMetadata ? DEFAULT_CHAT_NOTE_FORMAT : normalized;
};

const OptionsApp = () => {

  // Original settings
  const [vault, setVault] = useState("");
  const [folder, setFolder] = useState("ChatVault");

  // ChatVault settings
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [defaultMode, setDefaultMode] = useState("single");
  const [showSaveButton, setShowSaveButton] = useState(true);
  const [chatFolderPath, setChatFolderPath] = useState("");
  const [chatNoteFormat, setChatNoteFormat] = useState(DEFAULT_CHAT_NOTE_FORMAT);
  const [showPreview, setShowPreview] = useState(true);
  const [defaultMessageCount, setDefaultMessageCount] = useState(30);
  const [autoTagging, setAutoTagging] = useState(true);

  // Save method settings
  const [saveMethod, setSaveMethod] = useState("filesystem");
  const [downloadsFolder, setDownloadsFolder] = useState("ChatVault");
  const [folderPath, setFolderPath] = useState("");


  useEffect(() => {
    console.info('[ChatVault Options] Loading settings from storage...');

    // Load the settings from browser storage
    getSync(
      [
        "obsidianVault",
        "folderPath",
        "showChatSettings",
        "defaultMode",
        "showSaveButton",
        "chatFolderPath",
        "chatFolderPathExplicit",
        "chatNoteFormat",
        "showPreview",
        "defaultMessageCount",
        "autoTagging",
        "saveMethod",
        "downloadsFolder",
        "selectedFolderPath"
      ]
    ).then((result) => {
        console.debug('[ChatVault Options] Loaded settings:', result);
        if (result.obsidianVault) {
          console.debug('[ChatVault Options] Setting vault:', result.obsidianVault);
          setVault(result.obsidianVault);
        } else {
          console.warn('[ChatVault Options] No vault found in storage');
        }
        if (result.folderPath) {
          setFolder(result.folderPath);
        }
        // ChatVault settings
        if (result.showChatSettings !== undefined) {
          setShowChatSettings(result.showChatSettings);
        }
        if (result.defaultMode) {
          setDefaultMode(normalizeMode(result.defaultMode));
        }
        if (result.showSaveButton !== undefined) {
          setShowSaveButton(result.showSaveButton);
        }
        if (result.chatFolderPathExplicit === true && result.chatFolderPath !== undefined) {
          setChatFolderPath(normalizeChatFolderPath(result.chatFolderPath));
        } else {
          setChatFolderPath("");
        }
        if (result.chatNoteFormat !== undefined) {
          setChatNoteFormat(normalizeChatNoteFormat(result.chatNoteFormat));
        }
        if (result.showPreview !== undefined) {
          setShowPreview(result.showPreview);
        }
        if (result.defaultMessageCount) {
          setDefaultMessageCount(result.defaultMessageCount);
        }
        if (result.autoTagging !== undefined) {
          setAutoTagging(result.autoTagging);
        }
        if (result.saveMethod) {
          setSaveMethod(normalizeSaveMethod(result.saveMethod));
        }
        if (result.downloadsFolder) {
          setDownloadsFolder(result.downloadsFolder);
        }
        if (result.selectedFolderPath) {
          setFolderPath(result.selectedFolderPath);
        }
    });
  }, []);

  const handleSelectFolder = async () => {
    try {
      console.info('[ChatVault Options] Opening folder picker...');
      // Check if File System Access API is available
      if (!('showDirectoryPicker' in window)) {
        alert('File System Access APIはサポートされていません。Chrome 86+またはEdge 86+を使用してください。');
        return;
      }

      // Open folder picker
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });

      console.info('[ChatVault Options] Folder selected:', dirHandle.name);
      setFolderPath(dirHandle.name);

      // Store folder path in chrome storage
      chrome.storage.sync.set({ selectedFolderPath: dirHandle.name }, () => {
        console.debug('[ChatVault Options] Folder path saved to storage');
      });

      // Store the directory handle in IndexedDB for persistence
      const db = await openDB();
      await saveDirectoryHandle(db, dirHandle);

    } catch (err) {
      if (err.name === 'AbortError') {
        console.info('[ChatVault Options] Folder selection cancelled');
      } else {
        console.error('[ChatVault Options] Error selecting folder:', err);
        toast.show('フォルダ選択エラー: ' + err.message, 'error');
      }
    }
  };

  // IndexedDB functions for storing directory handle
  const openDB = () => {
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
  };

  const saveDirectoryHandle = async (db, handle) => {
    const tx = db.transaction(['handles'], 'readwrite');
    const store = tx.objectStore('handles');
    await new Promise((resolve, reject) => {
      const request = store.put(handle, 'vaultDirectory');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
  };

  const handleSave = () => {
    console.info('[ChatVault Options] handleSave called');
    console.debug('[ChatVault Options] Current state:', {
      vault: vault,
      folder: folder,
      showChatSettings: showChatSettings,
      chatFolderPath: chatFolderPath
    });

    // Check if the required fields are empty
    if (vault.trim() === "" || folder.trim() === "") {
      console.warn('[ChatVault Options] Required fields empty');
      toast.show('Obsidian Vault名と基本フォルダ名の両方を入力してください。', 'error');
      return;
    }

    const invalidCharacterPattern = /[\\:*?"<>|]/;

    if (invalidCharacterPattern.test(vault)) {
      toast.show('無効な文字が検出されました。Vault名には次の文字を使用しないでください: /, \\, :, *, ?, \", <, >, |', 'error');
      return;
    }

    const normalizedChatFolderPath = normalizeChatFolderPath(chatFolderPath);
    const normalizedChatNoteFormat = normalizeChatNoteFormat(chatNoteFormat);

    // Save the settings to browser storage
    chrome.storage.sync.set(
      {
        obsidianVault: vault,
        folderPath: folder,
        // ChatVault settings
        showChatSettings: showChatSettings,
        defaultMode: normalizeMode(defaultMode),
        showSaveButton: showSaveButton,
        chatFolderPath: normalizedChatFolderPath,
        chatFolderPathExplicit: Boolean(normalizedChatFolderPath),
        chatNoteFormat: normalizedChatNoteFormat,
        showPreview: showPreview,
        defaultMessageCount: defaultMessageCount,
        autoTagging: autoTagging,
        saveMethod: normalizeSaveMethod(saveMethod),
        downloadsFolder: downloadsFolder.trim() || "ChatVault",
        selectedFolderPath: folderPath
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error('[ChatVault Options] Error saving settings:', chrome.runtime.lastError);
          toast.show('設定の保存に失敗しました: ' + chrome.runtime.lastError.message, 'error');
        } else {
          setChatFolderPath(normalizedChatFolderPath);
          setChatNoteFormat(normalizedChatNoteFormat);
          toast.show(`設定を保存しました。保存先: ${normalizedChatFolderPath || 'Vault直下'}`, 'success');
          // Notify content scripts to update
          chrome.runtime.sendMessage({ action: 'saveSettings', settings: {} });
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <div className="container mx-auto p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-purple-400 mb-2">
            Chat Clip Obsidian 設定
          </h1>
          <p className="text-gray-400">
            コンテンツとチャットをObsidianに保存する方法を設定します。
          </p>
        </header>

        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
          <h2 className="text-2xl font-semibold mb-4 border-b border-gray-700 pb-2 text-purple-300">
            基本設定
          </h2>

          <div className="mb-4">
            <label htmlFor="vault" className="block text-lg font-medium mb-1">
              Obsidian Vault名
            </label>
            <p className="text-sm text-gray-400 mb-2">
              ( Obsidianで使用しているVault名を入力してください )
            </p>
            <input
              type="text"
              id="vault"
              className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
              value={vault}
              onChange={(e) => setVault(e.target.value)}
              placeholder="My Obsidian Vault"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="folder"
              className="block text-lg font-medium mb-1"
            >
              基本フォルダ名
            </label>
            <p className="text-sm text-gray-400 mb-2">
              ( Webページをクリップするデフォルトのフォルダー LLM Chats/{'{'}service{'}'}/{'{'}title{'}'} )
            </p>
            <input
              type="text"
              id="folder"
              className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="Clippings"
            />
          </div>
        </div>

        {/* AI Chat Capture Settings */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-purple-300">
              AIチャット機能を有効化
            </h2>
            <label className="switch">
              <input
                type="checkbox"
                checked={showChatSettings}
                onChange={() => setShowChatSettings(!showChatSettings)}
              />
              <span className="slider round"></span>
            </label>
          </div>

          {showChatSettings && (
            <div className="border-t border-gray-700 pt-4">
              <div className="mb-4">
                <label htmlFor="chatFolderPath" className="block text-lg font-medium mb-1">
                  チャットメッセージの保存先サブフォルダ（任意）
                </label>
                <p className="text-sm text-gray-400 mb-2">
                  ( 空欄ならVault直下に保存します。使用可能なプレースホルダー: {'{service}'}, {'{date}'} )
                </p>
                <input
                  type="text"
                  id="chatFolderPath"
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  value={chatFolderPath}
                  onChange={(e) => setChatFolderPath(normalizeChatFolderPath(e.target.value))}
                  placeholder="空欄ならVault直下"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="saveMethod" className="block text-lg font-medium mb-1">
                  保存方法
                </label>
                <p className="text-sm text-gray-400 mb-2">
                  ( Obsidianへのファイル保存方法を選択してください )
                </p>
                <select
                  id="saveMethod"
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  value={saveMethod}
                  onChange={(e) => setSaveMethod(e.target.value)}
                >
                  <option value="filesystem">File System API (推奨)</option>
                  <option value="auto">自動選択</option>
                  <option value="downloads">ダウンロードフォルダ経由</option>
                </select>
              </div>

              {saveMethod === 'filesystem' && (
                <div className="mb-4 p-4 bg-gray-700 rounded">
                  <label className="block text-lg font-medium mb-1">
                    Obsidian Vaultフォルダ
                  </label>
                  <p className="text-sm text-gray-400 mb-2">
                    ( Obsidian Vaultのルートディレクトリを選択してください )
                  </p>
                  <button
                    onClick={handleSelectFolder}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
                  >
                    {folderPath ? `${folderPath} (変更)` : 'Vault フォルダを選択'}
                  </button>
                   <p className="text-sm text-gray-400 mt-2">
                    このフォルダはObsidian Vaultのルートディレクトリである必要があります。ファイルは直接ここに保存されます。
                  </p>
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="defaultMode" className="block text-lg font-medium mb-1">
                  デフォルトキャプチャモード
                </label>
                <select
                  id="defaultMode"
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  value={defaultMode}
                  onChange={(e) => setDefaultMode(e.target.value)}
                >
                  <option value="single">単一メッセージ</option>
                  <option value="recent">最新N件</option>
                  <option value="full">会話全体</option>
                  <option value="selection">選択範囲</option>
                </select>
              </div>

              {/* More settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                  <label htmlFor="defaultMessageCount" className="block text-lg font-medium mb-1">
                    デフォルトメッセージ数
                  </label>
                  <p className="text-sm text-gray-400 mb-2">
                    ( 「最新N件」モードで保存するメッセージ数 )
                  </p>
                  <input
                    type="number"
                    id="defaultMessageCount"
                    min="1"
                    max="100"
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    value={defaultMessageCount}
                    onChange={(e) => setDefaultMessageCount(parseInt(e.target.value, 10))}
                  />
                </div>
                <div>
                  <label className="block text-lg font-medium mb-1">保存ボタン設定</label>
                  <div className="flex items-center mt-2 bg-gray-700 p-2 rounded">
                    <input
                      type="checkbox"
                      id="showSaveButton"
                      className="form-checkbox h-5 w-5 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                      checked={showSaveButton}
                      onChange={(e) => setShowSaveButton(e.target.checked)}
                    />
                    <label htmlFor="showSaveButton" className="ml-3 text-white">
                      チャットページに保存ボタンを表示
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <div>
                    <label className="block text-lg font-medium mb-1">自動タグ付け</label>
                     <div className="flex items-center mt-2 bg-gray-700 p-2 rounded">
                        <input
                          type="checkbox"
                          id="autoTagging"
                          className="form-checkbox h-5 w-5 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                          checked={autoTagging}
                          onChange={(e) => setAutoTagging(e.target.checked)}
                        />
                        <label htmlFor="autoTagging" className="ml-3 text-white">
                          サービス名を自動的にタグとして追加
                        </label>
                      </div>
                  </div>
                   <div>
                    <label className="block text-lg font-medium mb-1">プレビュー設定</label>
                     <div className="flex items-center mt-2 bg-gray-700 p-2 rounded">
                        <input
                          type="checkbox"
                          id="showPreview"
                          className="form-checkbox h-5 w-5 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                          checked={showPreview}
                          onChange={(e) => setShowPreview(e.target.checked)}
                        />
                        <label htmlFor="showPreview" className="ml-3 text-white">
                          保存前にMarkdownプレビューを表示
                        </label>
                      </div>
                  </div>
              </div>

              <div className="mb-4 mt-6">
                <label htmlFor="chatNoteFormat" className="block text-lg font-medium mb-1">
                  チャットノートフォーマット
                </label>
                <p className="text-sm text-gray-400 mb-2">
                  ( 標準はタイトルの直後に本文だけを保存します )
                </p>
                <div className="flex gap-2 my-2">
                    <button onClick={() => setChatNoteFormat(DEFAULT_CHAT_NOTE_FORMAT)} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md">タイトル+本文</button>
                    <button onClick={() => setChatNoteFormat('{content}')} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md">本文のみ</button>
                </div>
                <textarea
                  id="chatNoteFormat"
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono"
                  rows="8"
                  value={chatNoteFormat}
                  onChange={(e) => setChatNoteFormat(e.target.value)}
                />
              </div>

            </div>
          )}
        </div>

        <div className="mt-8 flex justify-end space-x-4">
          <button
            onClick={handleSave}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-200 text-lg"
          >
            設定を保存
          </button>
        </div>

      </div>
    </div>
  );
};

export default OptionsApp;
