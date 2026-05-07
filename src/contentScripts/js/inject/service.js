// Service detection for content script
// Detects which AI service page is currently loaded

export function detectService() {
  const hostname = window.location.hostname;

  switch (true) {
    case hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com'):
      return 'chatgpt';
    case hostname.includes('claude.ai'):
      return 'claude';
    case hostname.includes('gemini.google.com'):
      return 'gemini';
    default:
      return null;
  }
}
