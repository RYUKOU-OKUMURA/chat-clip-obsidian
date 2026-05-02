/* global chrome */

// Promise-wrapped Chrome APIs for reuse

export function getSync(keys) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, (result) => resolve(result));
  });
}

export function setSync(values) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(values, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  });
}

export function getLocal(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result));
  });
}

export function setLocal(values) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  });
}

export function queryActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs));
  });
}

export function createTab(url, options = {}) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, ...options }, (tab) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(tab);
    });
  });
}

export function removeTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.remove(tabId, () => {
      void chrome.runtime.lastError;
      resolve();
    });
  });
}

export function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(response);
    });
  });
}

export async function openUrlWithAutoClose(url, delayMs = 3000, options = {}) {
  const tab = await createTab(url, options);
  if (tab?.id) {
    setTimeout(() => {
      chrome.tabs.remove(tab.id, () => {
        void chrome.runtime.lastError;
      });
    }, delayMs);
  }
  return tab;
}

