export const DEFAULT_CHAT_NOTE_FORMAT = '# {title}\n\n{content}';

const LEGACY_METADATA_MARKERS = [
  'service: {service}',
  'source: {url}',
  'saved: {saved}',
  'mode: {type}',
  '- **saved**',
  '- **service**',
  '- **mode**',
  '- **url**',
  '- saved:',
  '- service:',
  '- mode:',
  '- url:'
];

export function normalizeChatNoteFormat(format) {
  const normalized = String(format || DEFAULT_CHAT_NOTE_FORMAT).replace(/\\n/g, '\n');
  const trimmed = normalized.trim();
  if (!trimmed) return DEFAULT_CHAT_NOTE_FORMAT;

  const lower = trimmed.toLowerCase();
  const hasLegacyMetadata = LEGACY_METADATA_MARKERS.some((marker) => lower.includes(marker));
  return hasLegacyMetadata ? DEFAULT_CHAT_NOTE_FORMAT : normalized;
}

export function chatNoteFormatHasContent(format) {
  return /\{content\}/i.test(String(format || ''));
}

export function renderChatNoteTemplate(template, values) {
  return String(template || '')
    .replace(/\{title\}/g, values.title)
    .replace(/\{service\}/g, values.service)
    .replace(/\{url\}/g, values.url)
    .replace(/\{date\}/g, values.date)
    .replace(/\{saved\}/g, values.saved)
    .replace(/\{type\}/g, values.type)
    .replace(/\{content\}/g, values.content);
}

export function buildChatNoteContent({ settings = {}, title, serviceLabel, sourceUrl, saved, mode, markdown }) {
  const template = normalizeChatNoteFormat(settings.chatNoteFormat);
  const values = {
    title: title || 'Untitled Conversation',
    service: serviceLabel,
    url: sourceUrl || '',
    date: String(saved || '').split('T')[0],
    saved,
    type: mode,
    content: markdown
  };

  return renderChatNoteTemplate(
    chatNoteFormatHasContent(template) ? template : DEFAULT_CHAT_NOTE_FORMAT,
    values
  );
}
