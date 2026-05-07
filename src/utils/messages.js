// User-facing message helpers shared across background and content scripts
import { ErrorCodes } from './errors.js';

/**
 * Convert error code to user-friendly message
 * @param {string} code
 * @param {string} detail
 * @returns {string}
 */
export function toUserMessage(code, detail) {
  switch (code) {
    case ErrorCodes.NoServiceDetected:
      // Keep message simple and consistent for both scripts
      return '対応サイトではありません（ChatGPT、Claude、Geminiで使用してください）';
    case ErrorCodes.MissingVaultHandle:
      return '直接保存用のVaultルートが未設定です。オプションからVaultルートを許可してください。';
    case ErrorCodes.ClipboardFailed:
      return 'クリップボードへのコピーに失敗しました。再度お試しください。';
    case ErrorCodes.FilesystemPermission:
      return 'ファイル保存の権限がありません。直接保存用のVaultルートを再許可してください。';
    case ErrorCodes.ObsidianUriTooLong:
      return 'コンテンツが大きすぎてURIに載せられません。クリップボード保存に切り替えます。';
    case ErrorCodes.BackgroundNoTabId:
      return '有効なタブが見つかりません。ページをリロードして再試行してください。';
    case ErrorCodes.SaveFailed:
      return '保存に失敗しました。コンソールのログを確認してください。';
    default:
      return detail || '不明なエラーが発生しました。';
  }
}

export default toUserMessage;
