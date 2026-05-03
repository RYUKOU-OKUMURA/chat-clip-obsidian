# Privacy Policy Draft

Last updated: May 3, 2026

Chat Clip Obsidian is a Chromium extension for saving AI chat conversations from supported web chat services to a user-selected Obsidian vault or local Markdown file.

## Data Collection

Chat Clip Obsidian does not collect, sell, share, or transmit personal data to the developer or to a developer-operated server.

## Data Processed Locally

The extension may read the currently open supported chat page when the user asks it to save a message, selection, recent messages, or the full conversation. This content is processed locally in the browser to produce Markdown.

The extension may store user preferences in browser extension storage, such as save mode settings, folder preferences, or other configuration needed for the extension to work.

## Local File and Obsidian Handling

When available, the extension uses the File System Access API to write Markdown files to a user-selected local folder. If direct writing is not available or fails, the extension may use local fallback mechanisms such as the clipboard, an Obsidian URI, or browser downloads.

Saved Markdown files remain on the user's device or in the user's own synced storage provider if their Obsidian vault is synced by another service.

## Permissions

The extension requests permissions needed to save chat content, store preferences, write to the clipboard for fallback saving, create context menu actions, download Markdown files, and show notifications.

Host permissions are limited to supported AI chat services: ChatGPT, Claude, and Google Gemini.

## Third Parties

Chat Clip Obsidian runs on supported third-party chat websites. Those websites remain governed by their own privacy policies. This extension does not add analytics or developer-operated tracking to those sites.

## Contact

For privacy questions or data handling concerns, contact the project maintainer through the repository or the support channel listed with the extension distribution.
