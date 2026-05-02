# Claude Provider

Claude (`https://claude.ai/`) 用のMVP providerです。内部API、Cookie、組織ID、pollingには依存せず、ログイン済み通常ページの表示DOMから本文を抽出します。

## 機能概要

- `[data-testid="user-message"]` と `.font-claude-response` を中心にDOM順でメッセージを抽出
- `[data-test-render-count]` はメッセージ範囲の補助として利用
- 各メッセージに `.chatvault-save-btn` を挿入し、共通content scriptの保存処理へ委譲
- `captureMessages('all' | 'recent', count)` は `{ success, service: 'claude', title, messages }` を返す
- Artifactsやtool結果は、MVPでは画面本文として見えている内容だけを保存対象にする

## ファイル構成

- `index.js` — provider export集約
- `checks.js` — DOM selector定義
- `ui.js` — 保存ボタン生成、配置、MutationObserver
- `text.js` — DOM-firstの単一/複数メッセージ抽出

## 重要な制約

- Claudeの未公開APIは使わない。
- `chrome.cookies` permissionは使わない。
- 保存処理は `background.js` の共通 `saveSingleMessage` / `saveMultipleMessages` 経路に通す。
- DOM selectorは実ページQAで壊れやすいため、変更時は `src/__tests__/claude-dom-extractor.test.js` にケースを追加する。
