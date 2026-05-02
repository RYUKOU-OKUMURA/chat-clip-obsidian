/* global chrome */
import React, { useMemo, useState, useEffect } from "react";
import { toast } from "../../utils/notifications/toast.js";
import { getSync } from "../../utils/browser/chrome.js";
import { saveDirectoryHandle } from "../../utils/browser/fileSystemAccess.js";
import { normalizeChatMode, normalizeSaveMethod } from "../../utils/chat/formatting.js";
import {
  buildChatSavePath,
  DEFAULT_SAVE_LOCATION_PRESET,
  getSaveLocationPresetLabel,
  normalizeChatFolderTemplate,
  resolveSaveLocationSettings,
  SAVE_LOCATION_PRESETS,
  SETTINGS_VERSION
} from "../../utils/chat/savePath.js";

const DEFAULT_CHAT_NOTE_FORMAT = "# {title}\n\n{content}";
const SAMPLE_TITLE = "Title";
const SAMPLE_SERVICE = "chatgpt";

const SAVE_LOCATION_OPTIONS = [
  {
    id: SAVE_LOCATION_PRESETS.VAULT_ROOT,
    title: "Vault直下",
    description: "フォルダを増やさず、Vaultの直下に保存します。初回はこちらが安全です。"
  },
  {
    id: SAVE_LOCATION_PRESETS.SERVICE_FOLDER,
    title: "ChatVault/サービス別",
    description: "ChatGPT、Claude、Geminiごとに整理します。おすすめの整理方法です。"
  },
  {
    id: SAVE_LOCATION_PRESETS.DATE_FOLDER,
    title: "ChatVault/日付別",
    description: "保存日ごとにまとめます。日次ログとして扱いたい場合に向いています。"
  }
];

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

const Section = ({ title, description, children }) => (
  <section className="bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
    <div className="mb-5">
      <h2 className="text-2xl font-semibold text-purple-300">{title}</h2>
      {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
    </div>
    {children}
  </section>
);

const FieldLabel = ({ htmlFor, children, help }) => (
  <label htmlFor={htmlFor} className="block mb-2">
    <span className="block text-base font-medium text-white">{children}</span>
    {help && <span className="block text-sm text-gray-400 mt-1">{help}</span>}
  </label>
);

const PreviewPath = ({ path }) => (
  <div className="mt-4 rounded-lg border border-purple-500/40 bg-purple-950/30 p-4">
    <div className="text-sm font-semibold text-purple-200">今回の保存先プレビュー</div>
    <code className="mt-2 block break-all text-sm text-purple-50">{path}</code>
  </div>
);

const OptionsApp = () => {
  const [vault, setVault] = useState("");
  const [folder, setFolder] = useState("ChatVault");
  const [defaultMode, setDefaultMode] = useState("single");
  const [showSaveButton, setShowSaveButton] = useState(true);
  const [saveLocationPreset, setSaveLocationPreset] = useState(DEFAULT_SAVE_LOCATION_PRESET);
  const [chatFolderPath, setChatFolderPath] = useState("");
  const [chatNoteFormat, setChatNoteFormat] = useState(DEFAULT_CHAT_NOTE_FORMAT);
  const [showPreview, setShowPreview] = useState(true);
  const [defaultMessageCount, setDefaultMessageCount] = useState(30);
  const [autoTagging, setAutoTagging] = useState(true);
  const [saveMethod, setSaveMethod] = useState("filesystem");
  const [downloadsFolder, setDownloadsFolder] = useState("ChatVault");
  const [folderPath, setFolderPath] = useState("");
  const [legacySettingsDetected, setLegacySettingsDetected] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const previewSettings = useMemo(() => ({
    settingsVersion: legacySettingsDetected ? undefined : SETTINGS_VERSION,
    saveLocationPreset,
    chatFolderPath,
    chatFolderPathExplicit: saveLocationPreset === SAVE_LOCATION_PRESETS.CUSTOM && Boolean(chatFolderPath)
  }), [chatFolderPath, legacySettingsDetected, saveLocationPreset]);

  const previewPath = useMemo(() => buildChatSavePath({
    settings: previewSettings,
    service: SAMPLE_SERVICE,
    title: SAMPLE_TITLE,
    mode: defaultMode
  }), [defaultMode, previewSettings]);

  const diagnostics = useMemo(() => JSON.stringify({
    settingsVersion: SETTINGS_VERSION,
    obsidianVault: vault || "(未設定)",
    selectedFolderPath: folderPath || "(未選択)",
    saveLocationPreset,
    saveLocationLabel: getSaveLocationPresetLabel(saveLocationPreset),
    chatFolderPath: saveLocationPreset === SAVE_LOCATION_PRESETS.CUSTOM ? chatFolderPath : "",
    legacySettingsDetected,
    saveMethod,
    downloadsFolder,
    previewPath: previewPath.fullFilePath
  }, null, 2), [
    chatFolderPath,
    downloadsFolder,
    folderPath,
    legacySettingsDetected,
    previewPath.fullFilePath,
    saveLocationPreset,
    saveMethod,
    vault
  ]);

  useEffect(() => {
    console.info('[ChatVault Options] Loading settings from storage...');
    getSync([
      "obsidianVault",
      "folderPath",
      "settingsVersion",
      "saveLocationPreset",
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
    ]).then((result) => {
      console.debug('[ChatVault Options] Loaded settings:', result);
      const location = resolveSaveLocationSettings(result);

      setVault(result.obsidianVault || "");
      setFolder(result.folderPath || "ChatVault");
      setSaveLocationPreset(location.preset);
      setChatFolderPath(location.preset === SAVE_LOCATION_PRESETS.CUSTOM
        ? location.folderTemplate
        : normalizeChatFolderTemplate(result.chatFolderPath));
      setLegacySettingsDetected(location.legacySettingsDetected);
      if (location.legacySettingsDetected || location.preset === SAVE_LOCATION_PRESETS.CUSTOM) {
        setShowAdvancedSettings(true);
      }
      if (result.defaultMode) setDefaultMode(normalizeChatMode(result.defaultMode));
      if (result.showSaveButton !== undefined) setShowSaveButton(result.showSaveButton);
      if (result.chatNoteFormat !== undefined) setChatNoteFormat(normalizeChatNoteFormat(result.chatNoteFormat));
      if (result.showPreview !== undefined) setShowPreview(result.showPreview);
      if (result.defaultMessageCount) setDefaultMessageCount(result.defaultMessageCount);
      if (result.autoTagging !== undefined) setAutoTagging(result.autoTagging);
      if (result.saveMethod) setSaveMethod(normalizeSaveMethod(result.saveMethod));
      if (result.downloadsFolder) setDownloadsFolder(result.downloadsFolder);
      if (result.selectedFolderPath) setFolderPath(result.selectedFolderPath);
    });
  }, []);

  const handleSelectFolder = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        alert('File System Access APIはサポートされていません。Chrome 86+またはEdge 86+を使用してください。');
        return;
      }

      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });

      setFolderPath(dirHandle.name);
      chrome.storage.sync.set({ selectedFolderPath: dirHandle.name });
      await saveDirectoryHandle(dirHandle);
      toast.show(`Vaultフォルダを選択しました: ${dirHandle.name}`, 'success');
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[ChatVault Options] Error selecting folder:', err);
      toast.show('フォルダ選択エラー: ' + err.message, 'error');
    }
  };

  const handlePresetChange = (preset) => {
    setSaveLocationPreset(preset);
    setLegacySettingsDetected(false);
    if (preset === SAVE_LOCATION_PRESETS.CUSTOM && !chatFolderPath) {
      setChatFolderPath('ChatVault/{service}');
      setShowAdvancedSettings(true);
    }
  };

  const handleSaveTest = () => {
    if (!vault.trim()) {
      toast.show('Obsidian Vault名を入力してください。', 'error');
      return;
    }
    if ((saveMethod === 'filesystem' || saveMethod === 'auto') && !folderPath) {
      toast.show('File System APIで保存する場合はVaultフォルダを選択してください。', 'error');
      return;
    }
    toast.show(`保存先テスト: ${previewPath.fullFilePath}`, 'success');
  };

  const handleResetDefaults = () => {
    setSaveLocationPreset(DEFAULT_SAVE_LOCATION_PRESET);
    setChatFolderPath("");
    setChatNoteFormat(DEFAULT_CHAT_NOTE_FORMAT);
    setDefaultMode("single");
    setDefaultMessageCount(30);
    setShowSaveButton(true);
    setShowPreview(true);
    setAutoTagging(true);
    setSaveMethod("filesystem");
    setDownloadsFolder("ChatVault");
    setLegacySettingsDetected(false);
    toast.show('画面上の設定を既定値に戻しました。保存すると反映されます。', 'info');
  };

  const handleCopyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(diagnostics);
      toast.show('診断情報をコピーしました。', 'success');
    } catch (error) {
      toast.show('診断情報のコピーに失敗しました: ' + error.message, 'error');
    }
  };

  const handleSave = () => {
    if (vault.trim() === "" || folder.trim() === "") {
      toast.show('Obsidian Vault名とWebクリップ用フォルダ名を入力してください。', 'error');
      return;
    }

    const invalidCharacterPattern = /[\\:*?"<>|]/;
    if (invalidCharacterPattern.test(vault)) {
      toast.show('無効な文字が検出されました。Vault名には次の文字を使用しないでください: /, \\, :, *, ?, ", <, >, |', 'error');
      return;
    }

    const normalizedPreset = saveLocationPreset;
    const normalizedChatFolderPath = normalizedPreset === SAVE_LOCATION_PRESETS.CUSTOM
      ? normalizeChatFolderTemplate(chatFolderPath)
      : '';
    const normalizedChatNoteFormat = normalizeChatNoteFormat(chatNoteFormat);

    chrome.storage.sync.set(
      {
        settingsVersion: SETTINGS_VERSION,
        obsidianVault: vault.trim(),
        folderPath: folder.trim() || "ChatVault",
        showChatSettings: true,
        defaultMode: normalizeChatMode(defaultMode),
        showSaveButton,
        saveLocationPreset: normalizedPreset,
        chatFolderPath: normalizedChatFolderPath,
        chatFolderPathExplicit: normalizedPreset === SAVE_LOCATION_PRESETS.CUSTOM && Boolean(normalizedChatFolderPath),
        chatNoteFormat: normalizedChatNoteFormat,
        showPreview,
        defaultMessageCount,
        autoTagging,
        saveMethod: normalizeSaveMethod(saveMethod),
        downloadsFolder: downloadsFolder.trim() || "ChatVault",
        selectedFolderPath: folderPath
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error('[ChatVault Options] Error saving settings:', chrome.runtime.lastError);
          toast.show('設定の保存に失敗しました: ' + chrome.runtime.lastError.message, 'error');
          return;
        }

        setLegacySettingsDetected(false);
        setChatFolderPath(normalizedChatFolderPath);
        setChatNoteFormat(normalizedChatNoteFormat);
        toast.show(`設定を保存しました。保存先: ${previewPath.fullFilePath}`, 'success');
        chrome.runtime.sendMessage({ action: 'saveSettings', settings: {} });
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <div className="container mx-auto p-8 max-w-5xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-purple-400 mb-2">
            ChatVault Clip 設定
          </h1>
          <p className="text-gray-400">
            チャットをどこへ保存するかを先に確認してから保存できます。
          </p>
        </header>

        {legacySettingsDetected && (
          <div className="mb-6 rounded-lg border border-amber-500/60 bg-amber-950/40 p-4">
            <div className="text-base font-semibold text-amber-200">以前の保存設定が見つかりました。</div>
            <p className="text-sm text-amber-100 mt-1">
              既存の保存先は変更せず保持しています。現在の保存先は以下です。
            </p>
            <code className="mt-2 block break-all text-sm text-amber-50">{previewPath.fullFilePath}</code>
          </div>
        )}

        <Section
          title="かんたん設定"
          description="まずはVault名、Vaultフォルダ、保存先だけ決めれば使えます。"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <FieldLabel
                htmlFor="vault"
                help="Obsidianで表示されているVault名です。URI fallbackで使います。"
              >
                Obsidian Vault名
              </FieldLabel>
              <input
                type="text"
                id="vault"
                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
                value={vault}
                onChange={(e) => setVault(e.target.value)}
                placeholder="My Obsidian Vault"
              />
            </div>

            <div>
              <FieldLabel help="File System APIで直接保存するVaultのルートフォルダです。">
                Obsidian Vaultフォルダ
              </FieldLabel>
              <button
                type="button"
                onClick={handleSelectFolder}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
              >
                {folderPath ? `${folderPath} (変更)` : 'Vaultフォルダを選択'}
              </button>
              <p className="text-sm text-gray-400 mt-2">
                選ぶのはVaultのルートです。親フォルダを選ぶと、その下に保存フォルダが作られます。
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-base font-medium text-white mb-3">保存先プリセット</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {SAVE_LOCATION_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className={`block cursor-pointer rounded-lg border p-4 transition-colors ${
                    saveLocationPreset === option.id
                      ? 'border-purple-400 bg-purple-950/50'
                      : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="saveLocationPreset"
                    value={option.id}
                    checked={saveLocationPreset === option.id}
                    onChange={() => handlePresetChange(option.id)}
                    className="sr-only"
                  />
                  <span className="block font-semibold text-white">{option.title}</span>
                  {option.id === SAVE_LOCATION_PRESETS.SERVICE_FOLDER && (
                    <span className="mt-1 inline-block rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200">
                      おすすめ
                    </span>
                  )}
                  <span className="block text-sm text-gray-300 mt-2">{option.description}</span>
                </label>
              ))}
            </div>
          </div>

          <PreviewPath path={previewPath.fullFilePath} />

          <button
            type="button"
            onClick={handleSaveTest}
            className="mt-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            保存テスト
          </button>
        </Section>

        <Section
          title="通常設定"
          description="普段の保存操作に関わる設定です。"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <FieldLabel htmlFor="defaultMode">デフォルトキャプチャモード</FieldLabel>
              <select
                id="defaultMode"
                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
                value={defaultMode}
                onChange={(e) => setDefaultMode(e.target.value)}
              >
                <option value="single">単一メッセージ</option>
                <option value="recent">最新N件</option>
                <option value="full">会話全体</option>
                <option value="selection">選択範囲</option>
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="defaultMessageCount" help="「最新N件」モードで保存する件数です。">
                デフォルトメッセージ数
              </FieldLabel>
              <input
                type="number"
                id="defaultMessageCount"
                min="1"
                max="100"
                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
                value={defaultMessageCount}
                onChange={(e) => setDefaultMessageCount(parseInt(e.target.value, 10) || 30)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
            <label className="flex items-center gap-3 bg-gray-700 p-3 rounded-lg">
              <input
                type="checkbox"
                className="form-checkbox h-5 w-5 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                checked={showSaveButton}
                onChange={(e) => setShowSaveButton(e.target.checked)}
              />
              <span>チャットページに保存ボタンを表示</span>
            </label>

            <label className="flex items-center gap-3 bg-gray-700 p-3 rounded-lg">
              <input
                type="checkbox"
                className="form-checkbox h-5 w-5 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                checked={showPreview}
                onChange={(e) => setShowPreview(e.target.checked)}
              />
              <span>ポップアップにMarkdownプレビューを表示</span>
            </label>
          </div>
        </Section>

        <Section
          title="詳細設定"
          description="保存方法やテンプレートを細かく調整したい場合だけ開いてください。"
        >
          <button
            type="button"
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            {showAdvancedSettings ? '詳細設定を閉じる' : '詳細設定を開く'}
          </button>

          {showAdvancedSettings && (
            <div className="mt-5 space-y-6">
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <FieldLabel
                    htmlFor="customChatFolderPath"
                    help="必要な場合だけ使います。使用可能: {service}, {date}, {title}, {type}"
                  >
                    カスタム保存先テンプレート
                  </FieldLabel>
                  <button
                    type="button"
                    onClick={() => handlePresetChange(SAVE_LOCATION_PRESETS.CUSTOM)}
                    className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors"
                  >
                    カスタムを使う
                  </button>
                </div>
                <input
                  type="text"
                  id="customChatFolderPath"
                  className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono"
                  value={chatFolderPath}
                  onChange={(e) => {
                    setChatFolderPath(e.target.value);
                    setSaveLocationPreset(SAVE_LOCATION_PRESETS.CUSTOM);
                    setLegacySettingsDetected(false);
                  }}
                  placeholder="ChatVault/{service}"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <FieldLabel htmlFor="saveMethod">保存方法</FieldLabel>
                  <select
                    id="saveMethod"
                    className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    value={saveMethod}
                    onChange={(e) => setSaveMethod(e.target.value)}
                  >
                    <option value="filesystem">File System API (推奨)</option>
                    <option value="auto">自動選択</option>
                    <option value="downloads">ダウンロードフォルダ経由</option>
                  </select>
                </div>

                <div>
                  <FieldLabel htmlFor="downloadsFolder" help="Downloads fallback時に使います。">
                    Downloads内フォルダ
                  </FieldLabel>
                  <input
                    type="text"
                    id="downloadsFolder"
                    className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    value={downloadsFolder}
                    onChange={(e) => setDownloadsFolder(e.target.value)}
                    placeholder="ChatVault"
                  />
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="folder" help="既存Web Clipper互換の設定です。チャット保存先とは別です。">
                  Webクリップ用フォルダ名
                </FieldLabel>
                <input
                  type="text"
                  id="folder"
                  className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  placeholder="ChatVault"
                />
              </div>

              <label className="flex items-center gap-3 bg-gray-700 p-3 rounded-lg">
                <input
                  type="checkbox"
                  className="form-checkbox h-5 w-5 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                  checked={autoTagging}
                  onChange={(e) => setAutoTagging(e.target.checked)}
                />
                <span>サービス名を自動的にタグとして追加</span>
              </label>

              <div>
                <FieldLabel htmlFor="chatNoteFormat" help="標準はタイトルの直後に本文だけを保存します。">
                  チャットノートフォーマット
                </FieldLabel>
                <div className="flex flex-wrap gap-2 my-2">
                  <button
                    type="button"
                    onClick={() => setChatNoteFormat(DEFAULT_CHAT_NOTE_FORMAT)}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg"
                  >
                    タイトル+本文
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatNoteFormat('{content}')}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg"
                  >
                    本文のみ
                  </button>
                </div>
                <textarea
                  id="chatNoteFormat"
                  className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono"
                  rows="8"
                  value={chatNoteFormat}
                  onChange={(e) => setChatNoteFormat(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-base font-medium text-white">診断情報</div>
                  <button
                    type="button"
                    onClick={handleCopyDiagnostics}
                    className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-3 rounded-lg transition-colors"
                  >
                    コピー
                  </button>
                </div>
                <pre className="max-h-64 overflow-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-200 whitespace-pre-wrap">
                  {diagnostics}
                </pre>
              </div>

              <button
                type="button"
                onClick={handleResetDefaults}
                className="bg-red-700 hover:bg-red-800 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                画面上の設定を既定値に戻す
              </button>
            </div>
          )}
        </Section>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 text-lg"
          >
            設定を保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default OptionsApp;
