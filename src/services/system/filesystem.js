/**
 * File System Access API service for direct vault writing
 * Handles saving files directly to the user's Obsidian vault
 */
import {
  loadDirectoryHandle,
  saveDirectoryHandle as persistDirectoryHandle,
  writeMarkdownWithDirectoryHandle
} from '../../utils/browser/fileSystemAccess.js';

class FileSystemService {
  constructor() {
    this.directoryHandle = null;
  }

  /**
   * Initialize the service by loading the stored directory handle
   */
  async init() {
    try {
      const handle = await this.loadDirectoryHandle();
      if (handle) {
        // Verify we still have permission
        const permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
          this.directoryHandle = handle;
          return true;
        } else if (permission === 'prompt') {
          // Request permission again
          const newPermission = await handle.requestPermission({ mode: 'readwrite' });
          if (newPermission === 'granted') {
            this.directoryHandle = handle;
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('[FileSystemService] Error initializing:', error);
      return false;
    }
  }

  /**
   * Load the directory handle from IndexedDB
   */
  async loadDirectoryHandle() {
    try {
      return await loadDirectoryHandle();
    } catch (error) {
      console.error('[FileSystemService] Error loading directory handle:', error);
      return null;
    }
  }

  async saveDirectoryHandle(handle) {
    await persistDirectoryHandle(handle);
    this.directoryHandle = handle;
  }

  /**
   * Save a file to the vault
   * @param {string} relativePath - Path relative to vault root (e.g., "ChatVault/ChatGPT/2024-01-01_Title.md")
   * @param {string} content - File content
   */
  async saveFile(relativePath, content) {
    try {
      if (!this.directoryHandle) {
        throw new Error('No directory handle available. Please select a vault folder first.');
      }

      await writeMarkdownWithDirectoryHandle(this.directoryHandle, content, relativePath);
      console.log(`[FileSystemService] File saved successfully: ${relativePath}`);
      return true;
    } catch (error) {
      console.error('[FileSystemService] Error saving file:', error);
      throw error;
    }
  }

  /**
   * Check if we have a valid directory handle
   */
  hasValidHandle() {
    return this.directoryHandle !== null;
  }

  /**
   * Get the name of the selected directory
   */
  getDirectoryName() {
    return this.directoryHandle ? this.directoryHandle.name : null;
  }
}

// Export singleton instance
export default new FileSystemService();
