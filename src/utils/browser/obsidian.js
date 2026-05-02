/**
 * Utilities to construct Obsidian URIs safely.
 */

export function buildObsidianNewUri({ vaultName, filePath, content, clipboard = false, silent = false }) {
  const v = encodeURIComponent(vaultName || 'MyVault');
  const f = encodeURIComponent(filePath || 'Untitled.md');
  const params = [`vault=${v}`, `file=${f}`];
  if (clipboard) {
    params.push('clipboard=true');
  } else if (content != null) {
    params.push(`content=${encodeURIComponent(content)}`);
  }
  if (silent) {
    params.push('silent=true');
  }
  return `obsidian://new?${params.join('&')}`;
}

