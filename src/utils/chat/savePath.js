import { sanitizeForFilename, sanitizeRelativePath } from '../data/validation.js';
import { getServiceLabel, normalizeChatMode } from './formatting.js';

export const SETTINGS_VERSION = 2;

export const SAVE_LOCATION_PRESETS = {
  VAULT_ROOT: 'vault-root',
  SERVICE_FOLDER: 'service-folder',
  DATE_FOLDER: 'date-folder',
  CUSTOM: 'custom'
};

export const DEFAULT_SAVE_LOCATION_PRESET = SAVE_LOCATION_PRESETS.VAULT_ROOT;
export const CODE_BLOCK_CONTENT_KIND = 'code-block';

const PRESET_TEMPLATES = {
  [SAVE_LOCATION_PRESETS.VAULT_ROOT]: '',
  [SAVE_LOCATION_PRESETS.SERVICE_FOLDER]: 'ChatVault/{service}',
  [SAVE_LOCATION_PRESETS.DATE_FOLDER]: 'ChatVault/{date}'
};

const PRESET_LABELS = {
  [SAVE_LOCATION_PRESETS.VAULT_ROOT]: 'Vault直下',
  [SAVE_LOCATION_PRESETS.SERVICE_FOLDER]: 'ChatVault/サービス別',
  [SAVE_LOCATION_PRESETS.DATE_FOLDER]: 'ChatVault/日付別',
  [SAVE_LOCATION_PRESETS.CUSTOM]: 'カスタム'
};

export function normalizeChatFolderTemplate(template) {
  return String(template ?? '').trim();
}

export function normalizeSaveLocationPreset(preset) {
  return Object.values(SAVE_LOCATION_PRESETS).includes(preset)
    ? preset
    : DEFAULT_SAVE_LOCATION_PRESET;
}

export function getSaveLocationPresetLabel(preset) {
  return PRESET_LABELS[normalizeSaveLocationPreset(preset)] || PRESET_LABELS[DEFAULT_SAVE_LOCATION_PRESET];
}

export function detectLegacySaveLocationSettings(settings = {}) {
  return settings.settingsVersion !== SETTINGS_VERSION &&
    Boolean(normalizeChatFolderTemplate(settings.chatFolderPath));
}

export function resolveSaveLocationSettings(settings = {}) {
  const legacySettingsDetected = detectLegacySaveLocationSettings(settings);
  if (legacySettingsDetected) {
    return {
      preset: SAVE_LOCATION_PRESETS.CUSTOM,
      folderTemplate: normalizeChatFolderTemplate(settings.chatFolderPath),
      legacySettingsDetected
    };
  }

  const preset = normalizeSaveLocationPreset(settings.saveLocationPreset);
  if (preset === SAVE_LOCATION_PRESETS.CUSTOM) {
    return {
      preset,
      folderTemplate: normalizeChatFolderTemplate(settings.chatFolderPath),
      legacySettingsDetected: false
    };
  }

  return {
    preset,
    folderTemplate: PRESET_TEMPLATES[preset],
    legacySettingsDetected: false
  };
}

export function resolveCodeBlockSaveLocationSettings(settings = {}) {
  const folderTemplate = normalizeChatFolderTemplate(settings.codeBlockFolderPath);
  if (folderTemplate) {
    return {
      ...resolveSaveLocationSettings(settings),
      folderTemplate,
      codeBlockFolderPathExplicit: true
    };
  }

  return {
    ...resolveSaveLocationSettings(settings),
    codeBlockFolderPathExplicit: false
  };
}

export function renderChatFolderPath(template, { serviceLabel, dateStr, sanitizedTitle, mode, language = '' }) {
  const folderTemplate = normalizeChatFolderTemplate(template);
  if (!folderTemplate) return '';

  const rendered = folderTemplate
    .replace(/\{service\}/g, serviceLabel)
    .replace(/\{date\}/g, dateStr)
    .replace(/\{title\}/g, sanitizedTitle)
    .replace(/\{type\}/g, mode)
    .replace(/\{language\}/g, sanitizeForFilename(language, 'code'))
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');

  return rendered ? sanitizeRelativePath(rendered, 'ChatVault') : '';
}

export function buildChatSavePath({
  settings = {},
  service,
  title,
  mode,
  savedAt = new Date(),
  contentKind = 'chat',
  language = ''
}) {
  const serviceLabel = getServiceLabel(service);
  const normalizedMode = normalizeChatMode(mode);
  const savedDate = savedAt instanceof Date ? savedAt : new Date(savedAt);
  const dateStr = Number.isNaN(savedDate.getTime())
    ? new Date().toISOString().split('T')[0]
    : savedDate.toISOString().split('T')[0];
  const noteTitle = title || `${serviceLabel} Chat - ${dateStr}`;
  const sanitizedTitle = sanitizeForFilename(noteTitle, 'untitled');
  const filename = `${dateStr}_${sanitizedTitle}.md`;
  const isCodeBlock = contentKind === CODE_BLOCK_CONTENT_KIND;
  const location = isCodeBlock
    ? resolveCodeBlockSaveLocationSettings(settings)
    : resolveSaveLocationSettings(settings);
  const folderPath = renderChatFolderPath(location.folderTemplate, {
    serviceLabel,
    dateStr,
    sanitizedTitle,
    mode: isCodeBlock && location.codeBlockFolderPathExplicit ? CODE_BLOCK_CONTENT_KIND : normalizedMode,
    language
  });
  const fullFilePath = folderPath ? `${folderPath}/${filename}` : filename;

  return {
    settingsVersion: SETTINGS_VERSION,
    saveLocationPreset: location.preset,
    folderTemplate: location.folderTemplate,
    legacySettingsDetected: location.legacySettingsDetected,
    serviceLabel,
    mode: normalizedMode,
    dateStr,
    noteTitle,
    sanitizedTitle,
    filename,
    folderPath,
    fullFilePath,
    contentKind: isCodeBlock ? CODE_BLOCK_CONTENT_KIND : 'chat',
    codeBlockFolderPathExplicit: Boolean(location.codeBlockFolderPathExplicit)
  };
}
