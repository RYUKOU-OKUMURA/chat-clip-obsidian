/* global chrome */
import React, { useMemo, useState, useEffect } from "react";
import { toast } from "../../utils/notifications/toast.js";
import { getSync } from "../../utils/browser/chrome.js";
import { loadDirectoryHandle, saveDirectoryHandle } from "../../utils/browser/fileSystemAccess.js";
import { normalizeChatMode, normalizeSaveMethod } from "../../utils/chat/formatting.js";
import { clampRecentCount } from "../popup/components/recentCount.js";
import {
  buildChatSavePath,
  CODE_BLOCK_CONTENT_KIND,
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
const SAMPLE_CODE_LANGUAGE = "js";

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

const CODE_BLOCK_LOCATION_OPTIONS = [
  {
    id: "same",
    title: "チャット保存先と同じ",
    description: "コードブロックだけを分けない場合はこちらです。",
    template: ""
  },
  {
    id: "service",
    title: "CodeBlocks/サービス別",
    description: "コードだけをサービスごとにまとめます。",
    template: "ChatVault/CodeBlocks/{service}"
  },
  {
    id: "language",
    title: "CodeBlocks/言語別",
    description: "サービスとプログラミング言語で整理します。",
    template: "ChatVault/CodeBlocks/{service}/{language}"
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

const chatNoteFormatHasContent = (format) => /\{content\}/i.test(String(format || ""));

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

const PreviewPath = ({ path, label = "今回の保存先プレビュー" }) => (
  <div className="mt-4 rounded-lg border border-purple-500/40 bg-purple-950/30 p-4">
    <div className="text-sm font-semibold text-purple-200">{label}</div>
    <code className="mt-2 block break-all text-sm text-purple-50">{path}</code>
  </div>
);

const DestinationPanel = ({ title, description, children, previewLabel, previewPath }) => (
  <div className="rounded-lg border border-gray-700 bg-gray-900/25 p-4">
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm text-gray-400 mt-1">{description}</p>
    </div>
    {children}
    <PreviewPath path={previewPath} label={previewLabel} />
  </div>
);

const OptionsApp = () => {
  const [vault, setVault] = useState("");
  const [folder, setFolder] = useState("ChatVault");
  const [defaultMode, setDefaultMode] = useState("single");
  const [showSaveButton, setShowSaveButton] = useState(true);
  const [saveLocationPreset, setSaveLocationPreset] = useState(DEFAULT_SAVE_LOCATION_PRESET);
  const [chatFolderPath, setChatFolderPath] = useState("");
  const [codeBlockFolderPath, setCodeBlockFolderPath] = useState("");
  const [chatNoteFormat, setChatNoteFormat] = useState(DEFAULT_CHAT_NOTE_FORMAT);
  const [chatNoteFormatError, setChatNoteFormatError] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const [defaultMessageCount, setDefaultMessageCount] = useState(30);
  const [saveMethod, setSaveMethod] = useState("filesystem");
  const [downloadsFolder, setDownloadsFolder] = useState("ChatVault");
  const [folderPath, setFolderPath] = useState("");
  const [legacySettingsDetected, setLegacySettingsDetected] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const previewSettings = useMemo(() => ({
    settingsVersion: legacySettingsDetected ? undefined : SETTINGS_VERSION,
    saveLocationPreset,
    chatFolderPath,
    codeBlockFolderPath,
    chatFolderPathExplicit: saveLocationPreset === SAVE_LOCATION_PRESETS.CUSTOM && Boolean(chatFolderPath)
  }), [chatFolderPath, codeBlockFolderPath, legacySettingsDetected, saveLocationPreset]);

  const previewPath = useMemo(() => buildChatSavePath({
    settings: previewSettings,
    service: SAMPLE_SERVICE,
    title: SAMPLE_TITLE,
    mode: 'full'
  }), [previewSettings]);

  const previewCodeBlockPath = useMemo(() => buildChatSavePath({
    settings: previewSettings,
    service: SAMPLE_SERVICE,
    title: SAMPLE_TITLE,
    mode: 'single',
    contentKind: CODE_BLOCK_CONTENT_KIND,
    language: SAMPLE_CODE_LANGUAGE
  }), [previewSettings]);

  const activeCodeBlockLocationOption = useMemo(() => {
    const normalized = normalizeChatFolderTemplate(codeBlockFolderPath);
    return CODE_BLOCK_LOCATION_OPTIONS.find((option) => option.template === normalized)?.id || "custom";
  }, [codeBlockFolderPath]);

  const diagnostics = useMemo(() => JSON.stringify({
    settingsVersion: SETTINGS_VERSION,
    obsidianVault: vault || "(未設定)",
    selectedFolderPath: folderPath || "(未選択)",
    saveLocationPreset,
    saveLocationLabel: getSaveLocationPresetLabel(saveLocationPreset),
    chatFolderPath: saveLocationPreset === SAVE_LOCATION_PRESETS.CUSTOM ? chatFolderPath : "",
    codeBlockFolderPath: codeBlockFolderPath || "(チャット保存先と同じ)",
    legacySettingsDetected,
    saveMethod,
    downloadsFolder,
    previewPath: previewPath.fullFilePath,
    previewCodeBlockPath: previewCodeBlockPath.fullFilePath
  }, null, 2), [
    chatFolderPath,
    codeBlockFolderPath,
    downloadsFolder,
    folderPath,
    legacySettingsDetected,
    previewCodeBlockPath.fullFilePath,
    previewPath.fullFilePath,
    saveLocationPreset,
    saveMethod,
    vault
  ]);

  useEffect(() => {
    console.info('[Chat Clip Obsidian Options] Loading settings from storage...');
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
      "codeBlockFolderPath",
      "chatNoteFormat",
      "showPreview",
      "defaultMessageCount",
      "saveMethod",
      "downloadsFolder",
      "selectedFolderPath"
    ]).then((result) => {
      console.debug('[Chat Clip Obsidian Options] Loaded settings:', result);
      const location = resolveSaveLocationSettings(result);

      setVault(result.obsidianVault || "");
      setFolder(result.folderPath || "ChatVault");
      setSaveLocationPreset(location.preset);
      setChatFolderPath(location.preset === SAVE_LOCATION_PRESETS.CUSTOM
        ? location.folderTemplate
        : normalizeChatFolderTemplate(result.chatFolderPath));
      setCodeBlockFolderPath(normalizeChatFolderTemplate(result.codeBlockFolderPath));
      setLegacySettingsDetected(location.legacySettingsDetected);
      if (location.legacySettingsDetected || location.preset === SAVE_LOCATION_PRESETS.CUSTOM) {
        setShowAdvancedSettings(true);
      }
      if (result.defaultMode) setDefaultMode(normalizeChatMode(result.defaultMode));
      if (result.showSaveButton !== undefined) setShowSaveButton(result.showSaveButton);
      if (result.chatNoteFormat !== undefined) setChatNoteFormat(normalizeChatNoteFormat(result.chatNoteFormat));
      if (result.showPreview !== undefined) setShowPreview(result.showPreview);
      if (result.defaultMessageCount) setDefaultMessageCount(clampRecentCount(result.defaultMessageCount));
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
      console.error('[Chat Clip Obsidian Options] Error selecting folder:', err);
      toast.show('フォルダ選択エラー: ' + err.message, 'error');
    }
  };

  const handlePresetChange = (preset) => {
    setSaveLocationPreset(preset);
    setLegacySettingsDetected(false);
    if (preset !== SAVE_LOCATION_PRESETS.CUSTOM) {
      setChatFolderPath('');
    }
    if (preset === SAVE_LOCATION_PRESETS.CUSTOM && !chatFolderPath) {
      setChatFolderPath('ChatVault/{service}');
      setShowAdvancedSettings(true);
    }
  };

  const handleChatFolderInputChange = (value) => {
    setChatFolderPath(value);
    setSaveLocationPreset(SAVE_LOCATION_PRESETS.CUSTOM);
    setLegacySettingsDetected(false);
  };

  const handleSelectDestinationFolder = async (target) => {
    try {
      if (!('showDirectoryPicker' in window)) {
        toast.show('File System Access APIはサポートされていません。Chrome 86+またはEdge 86+を使用してください。', 'error');
        return;
      }

      const vaultHandle = await loadDirectoryHandle().catch(() => null);
      if (!vaultHandle) {
        toast.show('先にObsidian Vaultフォルダを選択してください。', 'error');
        return;
      }

      const selectedHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: vaultHandle
      });
      const relativeSegments = await vaultHandle.resolve?.(selectedHandle);
      if (!Array.isArray(relativeSegments)) {
        toast.show('保存先には、選択済みVaultフォルダ内のフォルダを選んでください。', 'error');
        return;
      }

      const relativePath = normalizeChatFolderTemplate(relativeSegments.join('/'));
      if (target === 'chat') {
        setChatFolderPath(relativePath);
        setSaveLocationPreset(relativePath ? SAVE_LOCATION_PRESETS.CUSTOM : SAVE_LOCATION_PRESETS.VAULT_ROOT);
        setLegacySettingsDetected(false);
      } else {
        setCodeBlockFolderPath(relativePath);
      }
      toast.show(`保存先フォルダを設定しました: ${relativePath || 'Vault直下'}`, 'success');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.error('[Chat Clip Obsidian Options] Error selecting destination folder:', error);
      toast.show('保存先フォルダの選択に失敗しました: ' + (error?.message || error), 'error');
    }
  };

  const handleSaveTest = () => {
    if (normalizeSaveMethod(saveMethod) === 'auto' && !vault.trim()) {
      toast.show('自動選択ではURI fallbackに備えてObsidian Vault名を入力してください。', 'error');
      return;
    }
    if (!chatNoteFormatHasContent(normalizeChatNoteFormat(chatNoteFormat))) {
      const message = 'チャットノートフォーマットには {content} を含めてください。';
      setChatNoteFormatError(message);
      toast.show(message, 'error');
      return;
    }
    toast.show(`保存先プレビュー: チャット ${previewPath.fullFilePath} / コード ${previewCodeBlockPath.fullFilePath}`, 'success');
  };

  const handleResetDefaults = () => {
    setSaveLocationPreset(DEFAULT_SAVE_LOCATION_PRESET);
    setChatFolderPath("");
    setCodeBlockFolderPath("");
    setChatNoteFormat(DEFAULT_CHAT_NOTE_FORMAT);
    setChatNoteFormatError("");
    setDefaultMode("single");
    setDefaultMessageCount(30);
    setShowSaveButton(true);
    setShowPreview(true);
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
    const normalizedSaveMethod = normalizeSaveMethod(saveMethod);
    if (normalizedSaveMethod === 'auto' && vault.trim() === "") {
      toast.show('自動選択ではURI fallbackに備えてObsidian Vault名を入力してください。', 'error');
      return;
    }

    const invalidCharacterPattern = /[\\:*?"<>|]/;
    if (vault.trim() && invalidCharacterPattern.test(vault)) {
      toast.show('無効な文字が検出されました。Vault名には次の文字を使用しないでください: /, \\, :, *, ?, ", <, >, |', 'error');
      return;
    }

    const normalizedPreset = saveLocationPreset;
    const normalizedChatFolderPath = normalizedPreset === SAVE_LOCATION_PRESETS.CUSTOM
      ? normalizeChatFolderTemplate(chatFolderPath)
      : '';
    const normalizedCodeBlockFolderPath = normalizeChatFolderTemplate(codeBlockFolderPath);
    const normalizedChatNoteFormat = normalizeChatNoteFormat(chatNoteFormat);
    if (!chatNoteFormatHasContent(normalizedChatNoteFormat)) {
      const message = 'チャットノートフォーマットには {content} を含めてください。';
      setChatNoteFormatError(message);
      toast.show(message, 'error');
      return;
    }

    const normalizedMessageCount = clampRecentCount(defaultMessageCount);

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
        codeBlockFolderPath: normalizedCodeBlockFolderPath,
        chatNoteFormat: normalizedChatNoteFormat,
        showPreview,
        defaultMessageCount: normalizedMessageCount,
        saveMethod: normalizedSaveMethod,
        downloadsFolder: downloadsFolder.trim() || "ChatVault",
        selectedFolderPath: folderPath
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error('[Chat Clip Obsidian Options] Error saving settings:', chrome.runtime.lastError);
          toast.show('設定の保存に失敗しました: ' + chrome.runtime.lastError.message, 'error');
          return;
        }

        setLegacySettingsDetected(false);
        setChatFolderPath(normalizedChatFolderPath);
        setCodeBlockFolderPath(normalizedCodeBlockFolderPath);
        setChatNoteFormat(normalizedChatNoteFormat);
        setChatNoteFormatError("");
        setDefaultMessageCount(normalizedMessageCount);
        toast.show(`設定を保存しました。チャット保存先: ${previewPath.fullFilePath}`, 'success');
        chrome.runtime.sendMessage({ action: 'saveSettings', settings: {} });
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <div className="container mx-auto p-8 max-w-5xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-purple-400 mb-2">
            Chat Clip Obsidian 設定
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
          description="保存方法に合わせて、保存先と必要な連携情報だけを設定します。"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <FieldLabel
                htmlFor="vault"
                help="Obsidianで表示されているVault名です。URI fallbackで使います。"
              >
                Obsidian Vault名（自動選択時のみ必須）
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

          <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-5">
            <DestinationPanel
              title="チャット全文の保存先"
              description="ポップアップの会話全体保存と通常のチャット保存で使うVault内フォルダです。"
              previewLabel="チャット保存先プレビュー"
              previewPath={previewPath.fullFilePath}
            >
              <div className="grid grid-cols-1 gap-3">
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
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <FieldLabel
                    htmlFor="customChatFolderPath"
                    help="Vault内の相対フォルダです。使用可能: {service}, {date}, {title}, {type}"
                  >
                    カスタムフォルダ
                  </FieldLabel>
                  <button
                    type="button"
                    onClick={() => handleSelectDestinationFolder('chat')}
                    className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors"
                  >
                    フォルダを選択
                  </button>
                </div>
                <input
                  type="text"
                  id="customChatFolderPath"
                  className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono"
                  value={chatFolderPath}
                  onChange={(e) => handleChatFolderInputChange(e.target.value)}
                  onFocus={() => {
                    if (saveLocationPreset !== SAVE_LOCATION_PRESETS.CUSTOM && !chatFolderPath) {
                      setChatFolderPath('ChatVault/{service}');
                    }
                    setSaveLocationPreset(SAVE_LOCATION_PRESETS.CUSTOM);
                    setLegacySettingsDetected(false);
                  }}
                  placeholder="ChatVault/{service}"
                />
              </div>
            </DestinationPanel>

            <DestinationPanel
              title="コードブロックの保存先"
              description="コードブロック内に表示される保存ボタンから単体保存した時だけ使います。"
              previewLabel="コードブロック保存先プレビュー"
              previewPath={previewCodeBlockPath.fullFilePath}
            >
              <div className="grid grid-cols-1 gap-3">
                {CODE_BLOCK_LOCATION_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    onClick={() => setCodeBlockFolderPath(option.template)}
                    className={`block rounded-lg border p-4 text-left transition-colors ${
                      activeCodeBlockLocationOption === option.id
                        ? 'border-purple-400 bg-purple-950/50'
                        : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <span className="block font-semibold text-white">{option.title}</span>
                    {option.id === "service" && (
                      <span className="mt-1 inline-block rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200">
                        おすすめ
                      </span>
                    )}
                    <span className="block text-sm text-gray-300 mt-2">{option.description}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <FieldLabel
                    htmlFor="codeBlockFolderPath"
                    help="Vault内の相対フォルダです。使用可能: {service}, {date}, {title}, {type}, {language}"
                  >
                    カスタムフォルダ
                  </FieldLabel>
                  <button
                    type="button"
                    onClick={() => handleSelectDestinationFolder('code')}
                    className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors"
                  >
                    フォルダを選択
                  </button>
                </div>
                <input
                  type="text"
                  id="codeBlockFolderPath"
                  className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono"
                  value={codeBlockFolderPath}
                  onChange={(e) => setCodeBlockFolderPath(e.target.value)}
                  placeholder="ChatVault/CodeBlocks/{service}"
                />
              </div>
            </DestinationPanel>
          </div>

          <button
            type="button"
            onClick={handleSaveTest}
            className="mt-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            保存先プレビュー確認
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
                <option value="single">最新メッセージ</option>
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
                onChange={(e) => setDefaultMessageCount(clampRecentCount(e.target.value))}
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

              <div>
                <FieldLabel htmlFor="chatNoteFormat" help="標準はタイトルの直後に本文だけを保存します。">
                  チャットノートフォーマット
                </FieldLabel>
                <div className="flex flex-wrap gap-2 my-2">
                  <button
                    type="button"
                    onClick={() => {
                      setChatNoteFormat(DEFAULT_CHAT_NOTE_FORMAT);
                      setChatNoteFormatError("");
                    }}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg"
                  >
                    タイトル+本文
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChatNoteFormat('{content}');
                      setChatNoteFormatError("");
                    }}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg"
                  >
                    本文のみ
                  </button>
                </div>
                <textarea
                  id="chatNoteFormat"
                  className={`w-full p-3 bg-gray-700 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono ${
                    chatNoteFormatError ? 'border-red-500' : 'border-gray-600'
                  }`}
                  rows="8"
                  value={chatNoteFormat}
                  onChange={(e) => {
                    setChatNoteFormat(e.target.value);
                    if (chatNoteFormatError && chatNoteFormatHasContent(e.target.value)) {
                      setChatNoteFormatError("");
                    }
                  }}
                  aria-invalid={Boolean(chatNoteFormatError)}
                  aria-describedby={chatNoteFormatError ? "chatNoteFormat-error" : undefined}
                />
                {chatNoteFormatError && (
                  <p id="chatNoteFormat-error" className="mt-2 text-sm text-red-300" role="alert">
                    {chatNoteFormatError}
                  </p>
                )}
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
