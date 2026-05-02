// Validation and sanitization helpers

const invalidPathCharacterPattern = /[\u0000-\u001F\u007F-\u009F\\/:*?"<>|]/g;
const reservedPathSegments = new Set(['.', '..']);

/**
 * Sanitize free-form title text for UI input fields.
 * Replaces filesystem-invalid characters with hyphen, keeps spaces.
 * @param {string} title
 * @returns {string}
 */
export function sanitizeTitle(title) {
  const invalidCharacterPattern = /[\\:*?"<>|/]/g;
  return String(title || '').replace(invalidCharacterPattern, '-');
}

/**
 * Sanitize a single filesystem path segment for File System Access,
 * Downloads, and Obsidian file paths.
 * @param {string} raw
 * @param {string} [fallback="untitled"]
 * @returns {string}
 */
export function sanitizePathSegment(raw, fallback = 'untitled') {
  const sanitized = String(raw || '')
    .replace(invalidPathCharacterPattern, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');

  if (!sanitized || reservedPathSegments.has(sanitized)) {
    return fallback;
  }

  return sanitized.slice(0, 150);
}

/**
 * Sanitize a relative path while preserving folder separators.
 * @param {string} rawPath
 * @param {string} [fallbackSegment="ChatVault"]
 * @returns {string}
 */
export function sanitizeRelativePath(rawPath, fallbackSegment = 'ChatVault') {
  const segments = String(rawPath || '')
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => sanitizePathSegment(segment, ''))
    .filter(Boolean);

  return segments.length ? segments.join('/') : sanitizePathSegment(fallbackSegment, 'ChatVault');
}

/**
 * Sanitize a string for safe use in filenames.
 * - Removes filesystem-invalid characters
 * - Collapses whitespace to underscore
 * - Trims and falls back to a default when empty
 * @param {string} raw
 * @param {string} [fallback="untitled"]
 * @returns {string}
 */
export function sanitizeForFilename(raw, fallback = 'untitled') {
  const sanitized = sanitizePathSegment(raw, fallback)
    .replace(/\s+/g, '_')
    .trim();
  return sanitized || fallback;
}

