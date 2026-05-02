// Clipboard helper isolated from inject.js
export async function copyToClipboard(content) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(content);
      console.log('[Chat Clip Obsidian] navigator.clipboard を使用してコピー');
      return { success: true, method: 'navigator.clipboard' };
    }
    // Fallback: execCommand
    const textArea = document.createElement('textarea');
    textArea.value = content;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) {
      console.log('[Chat Clip Obsidian] execCommand を使用してコピー');
      return { success: true, method: 'execCommand' };
    }
    throw new Error('execCommandコピーに失敗しました');
  } catch (error) {
    console.error('[Chat Clip Obsidian] クリップボードコピー失敗:', error);
    // エラーをログに記録し、失敗結果を返す
    return { success: false, error: error.message };
  }
}

export default { copyToClipboard };
