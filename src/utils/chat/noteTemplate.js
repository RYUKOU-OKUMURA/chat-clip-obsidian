import { formatLocalDateString } from './date.js';

export const DEFAULT_CHAT_NOTE_FORMAT = [
  '---',
  'title: {yamlTitle}',
  'date: {date}',
  'saved: {yamlSaved}',
  'service: {yamlService}',
  'source: {yamlUrl}',
  'type: {yamlType}',
  '---',
  '',
  '# {title}',
  '',
  '{content}'
].join('\n');

const LEGACY_DEFAULT_CHAT_NOTE_FORMAT = '# {title}\n\n{content}';

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
  if (trimmed === LEGACY_DEFAULT_CHAT_NOTE_FORMAT) return DEFAULT_CHAT_NOTE_FORMAT;

  const lower = trimmed.toLowerCase();
  const hasLegacyMetadata = LEGACY_METADATA_MARKERS.some((marker) => lower.includes(marker));
  return hasLegacyMetadata ? DEFAULT_CHAT_NOTE_FORMAT : normalized;
}

export function chatNoteFormatHasContent(format) {
  return /\{content\}/i.test(String(format || ''));
}

export function renderChatNoteTemplate(template, values) {
  return String(template || '')
    .replace(/\{yamlTitle\}/g, values.yamlTitle)
    .replace(/\{yamlService\}/g, values.yamlService)
    .replace(/\{yamlUrl\}/g, values.yamlUrl)
    .replace(/\{yamlSaved\}/g, values.yamlSaved)
    .replace(/\{yamlType\}/g, values.yamlType)
    .replace(/\{title\}/g, values.title)
    .replace(/\{service\}/g, values.service)
    .replace(/\{url\}/g, values.url)
    .replace(/\{date\}/g, values.date)
    .replace(/\{saved\}/g, values.saved)
    .replace(/\{type\}/g, values.type)
    .replace(/\{content\}/g, values.content);
}

export function formatYamlScalar(value) {
  return JSON.stringify(String(value ?? ''));
}

export function buildChatNoteContent({ settings = {}, title, serviceLabel, sourceUrl, saved, mode, markdown }) {
  const template = normalizeChatNoteFormat(settings.chatNoteFormat);
  const safeTitle = title || 'Untitled Conversation';
  const safeService = serviceLabel || '';
  const safeUrl = sourceUrl || '';
  const safeSaved = saved || '';
  const safeMode = mode || '';
  const values = {
    title: safeTitle,
    service: safeService,
    url: safeUrl,
    date: formatLocalDateString(safeSaved),
    saved: safeSaved,
    type: safeMode,
    content: markdown,
    yamlTitle: formatYamlScalar(safeTitle),
    yamlService: formatYamlScalar(safeService),
    yamlUrl: formatYamlScalar(safeUrl),
    yamlSaved: formatYamlScalar(safeSaved),
    yamlType: formatYamlScalar(safeMode)
  };

  return renderChatNoteTemplate(
    chatNoteFormatHasContent(template) ? template : DEFAULT_CHAT_NOTE_FORMAT,
    values
  );
}
