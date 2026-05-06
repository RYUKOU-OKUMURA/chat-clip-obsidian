const SUSPICIOUS_VAULT_ROOT_NAMES = new Set([
  'aichat',
  'chatvault',
  'clips',
  'inbox',
  'notes',
  'snippets',
  'materials',
  '素材',
  'メモ',
  'ノート',
  'xポスト'
]);

export function getVaultRootWarning(folderName) {
  const normalized = String(folderName || '').trim().toLowerCase();
  if (!normalized || !SUSPICIOUS_VAULT_ROOT_NAMES.has(normalized)) return '';
  return '選択したフォルダはVault内の保存先フォルダに見えます。Obsidianで開いているVaultの一番上のフォルダを選んでください。';
}

export function isSuspiciousVaultRoot(folderName) {
  return Boolean(getVaultRootWarning(folderName));
}

export function createInvalidVaultRootError(folderName) {
  const warning = getVaultRootWarning(folderName);
  if (!warning) return null;
  const error = new Error(`${warning} 現在の直接保存用のVaultルート: ${folderName || '未許可'}`);
  error.code = 'INVALID_VAULT_ROOT';
  return error;
}
