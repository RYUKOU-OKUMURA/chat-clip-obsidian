// Lightweight logger utility with a configurable scope prefix.
// Usage:
//   import { createLogger } from '../utils/logger.js';
//   const log = createLogger('Chat Clip Obsidian Background');

export function createLogger(scope = 'Chat Clip Obsidian') {
  const prefix = `[${scope}]`;
  return {
    info: (...args) => console.info(prefix, ...args),
    debug: (...args) => console.debug(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}

// Provide a default logger for convenience (content-script default)
const defaultLog = createLogger('Chat Clip Obsidian');
export default defaultLog;
