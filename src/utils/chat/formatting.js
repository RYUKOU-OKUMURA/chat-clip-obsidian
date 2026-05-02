const SERVICE_LABELS = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini'
};

const SERVICE_TITLE_PATTERNS = {
  chatgpt: [/\s*[-|]\s*ChatGPT\s*$/i],
  claude: [/\s*[|–-]\s*Claude(?:\.ai)?\s*$/i],
  gemini: [/\s*[-|]\s*Gemini\s*$/i]
};

const ALL_SERVICE_TITLE_PATTERNS = Object.values(SERVICE_TITLE_PATTERNS).flat();

export function getServiceLabel(service) {
  const key = String(service || '').toLowerCase();
  return SERVICE_LABELS[key] || service || 'ChatVault';
}

export function normalizeChatMode(mode) {
  if (mode === 'last3' || mode === 'last5') return 'recent';
  if (mode === 'all') return 'full';
  return ['single', 'selection', 'recent', 'full'].includes(mode) ? mode : 'single';
}

export function normalizeSaveMethod(method) {
  if (method === 'advanced-uri' || method === 'clipboard') return 'auto';
  return ['filesystem', 'auto', 'downloads'].includes(method) ? method : 'filesystem';
}

export function normalizeMarkdown(content) {
  return String(content || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .trim();
}

export function formatMessagesAsMarkdown(messages) {
  return [
    ...messages.flatMap((msg, index) => {
      const speaker = msg.speaker || (msg.role === 'user' ? 'User' : 'Assistant');
      const content = normalizeMarkdown(msg.content || '');
      const separator = index < messages.length - 1 ? ['', '---', ''] : [''];
      return [`### ${speaker}`, '', content, ...separator];
    })
  ].join('\n');
}

export function stripServiceTitle(title, service = null, fallback = '') {
  const raw = String(title || '').trim();
  const patterns = service
    ? (SERVICE_TITLE_PATTERNS[String(service).toLowerCase()] || ALL_SERVICE_TITLE_PATTERNS)
    : ALL_SERVICE_TITLE_PATTERNS;

  const stripped = patterns
    .reduce((value, pattern) => value.replace(pattern, ''), raw)
    .trim();

  return stripped || fallback;
}
