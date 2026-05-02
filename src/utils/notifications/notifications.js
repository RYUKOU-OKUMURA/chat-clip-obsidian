/* global chrome */

export function notifyBasic({ title = 'Chat Clip Obsidian', message, iconUrl = 'logo48.png', priority = 1 }) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl,
    title,
    message,
    priority
  });
}

