import {
  buildChatSavePath,
  detectLegacySaveLocationSettings,
  resolveSaveLocationSettings,
  SAVE_LOCATION_PRESETS
} from '../chat/savePath';

const savedAt = '2026-05-02T12:00:00.000Z';

describe('chat save path utilities', () => {
  test('uses vault root for new settings by default', () => {
    const path = buildChatSavePath({
      settings: {},
      service: 'chatgpt',
      title: 'Research Notes',
      mode: 'full',
      savedAt
    });

    expect(path.folderPath).toBe('');
    expect(path.filename).toBe('2026-05-02_Research_Notes.md');
    expect(path.fullFilePath).toBe('2026-05-02_Research_Notes.md');
    expect(path.saveLocationPreset).toBe(SAVE_LOCATION_PRESETS.VAULT_ROOT);
  });

  test('renders the service-folder preset', () => {
    const path = buildChatSavePath({
      settings: { settingsVersion: 2, saveLocationPreset: SAVE_LOCATION_PRESETS.SERVICE_FOLDER },
      service: 'chatgpt',
      title: 'Research Notes',
      mode: 'full',
      savedAt
    });

    expect(path.folderPath).toBe('ChatVault/ChatGPT');
    expect(path.fullFilePath).toBe('ChatVault/ChatGPT/2026-05-02_Research_Notes.md');
  });

  test('keeps legacy chatFolderPath while flagging it', () => {
    const settings = { chatFolderPath: 'ChatVault/{service}/{title}' };
    const path = buildChatSavePath({
      settings,
      service: 'chatgpt',
      title: 'A/B Test',
      mode: 'single',
      savedAt
    });

    expect(detectLegacySaveLocationSettings(settings)).toBe(true);
    expect(path.legacySettingsDetected).toBe(true);
    expect(path.folderPath).toBe('ChatVault/ChatGPT/A-B_Test');
    expect(path.fullFilePath).toBe('ChatVault/ChatGPT/A-B_Test/2026-05-02_A-B_Test.md');
  });

  test('sanitizes custom folders and filenames', () => {
    const path = buildChatSavePath({
      settings: {
        settingsVersion: 2,
        saveLocationPreset: SAVE_LOCATION_PRESETS.CUSTOM,
        chatFolderPath: '/./Notes//../{service}/{type}'
      },
      service: 'claude',
      title: 'Bad/Name: test',
      mode: 'recent',
      savedAt
    });

    expect(path.folderPath).toBe('Notes/Claude/recent');
    expect(path.filename).toBe('2026-05-02_Bad-Name-_test.md');
  });

  test('unknown preset falls back to vault root', () => {
    const location = resolveSaveLocationSettings({
      settingsVersion: 2,
      saveLocationPreset: 'surprise'
    });

    expect(location.preset).toBe(SAVE_LOCATION_PRESETS.VAULT_ROOT);
    expect(location.folderTemplate).toBe('');
  });
});
