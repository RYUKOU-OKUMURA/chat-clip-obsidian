# Chat Clip Obsidian MVP適合性再調査レポート

調査日: 2026-05-02  
対象リポジトリ: `/Users/ryukouokumura/Desktop/boss-workspace/chat-clip-obsidian`

## 前提

今回のMVPスコープは次に限定する。

- 対象ブラウザ: Chromium系デスクトップブラウザ
  - Chrome
  - Edge
  - Brave
  - Arc などChrome拡張を利用できるChromium系ブラウザ
- 対象サービス:
  - Web版ChatGPT: `chatgpt.com`, `chat.openai.com`
  - Web版Claude: `claude.ai`
  - Web版Gemini: `gemini.google.com`
- 保存先:
  - Obsidian DesktopのVault
  - Markdownファイルとして保存
- 今回スコープ外:
  - Firefox
  - Safari
  - モバイルブラウザ
  - Codex
  - NotebookLM
  - Google AI Studio
  - 公開共有ページ専用対応
  - Chrome Web Store公開審査の完全対応

前回レポートは互換性監査として範囲を広く見たが、現時点の開発判断では広すぎた。以降は「Chromium系ブラウザで、Web版ChatGPT/Claude/GeminiのチャットをObsidianへ保存できるか」に絞る。

## 結論

このプロジェクトは、Chromium MV3拡張として対象3サービスのDOMからチャットを抽出し、ObsidianへMarkdown保存する方向性は合っている。ただし、現状のままではMVPとして安定利用できる段階ではない。

MVPの主な失敗要因は次の5点。

1. ポップアップの「保存」ボタンが実保存処理に接続されていない。
2. Claude実装が未公開内部API、Cookie、ポーリングに依存しており、DOM保存として安定していない。
3. 単一保存と複数保存で保存方式が分裂しており、設定された保存方法が一貫して使われない。
4. Manifestとサービス検出にNotebookLM/AI Studioなど対象外サービスが残り、権限・QA範囲・不具合範囲を広げている。
5. Geminiはproviderがあるものの、popup表示・DOMセレクタ・実ページQAが不足している。

優先方針は、FirefoxやCodex対応ではなく、以下に集中すること。

- Manifestを対象3サービスだけに絞る。
- popup保存を `single / selection / recent / full` の実保存へ接続する。
- 保存経路を全モードで共通化する。
- Claudeは内部API主経路をやめ、DOM抽出を主経路にする。
- ChatGPT/Gemini/Claudeの実ログインページで手動QAを行う。

## 推奨MVP保存仕様

失敗要因を減らすには、保存方式を次の優先順に統一するのがよい。

| 優先 | 方式 | 位置づけ | 理由 |
|---:|---|---|---|
| 1 | File System Access API | Chromium desktopでの主経路 | 初回にVaultフォルダを選択すれば、長文でもURI長に依存せず直接Markdownを書ける。 |
| 2 | `obsidian://new?...&clipboard=true` | Obsidian起動 + クリップボード経由fallback | Obsidian公式URIが `clipboard` をサポートしている。長文を `content=` に詰め込むより壊れにくい。 |
| 3 | `obsidian://new?...&content=...` | 短文のみのfallback | 小さい単一メッセージなら動く可能性があるが、URL長・OSプロトコル経由の制約を受ける。 |
| 4 | Downloads API | 最後の退避先 | Downloads配下に保存されるため、Vaultへ直接保存ではない。成功表示の文言を分ける必要がある。 |

File System Access APIは `showDirectoryPicker()` にユーザー操作が必要なので、初回セットアップはオプション画面または保存ボタンクリック直後に行う。保存済みDirectoryHandleはIndexedDBに保持し、毎回 `queryPermission({ mode: "readwrite" })` と必要時の `requestPermission()` を確認する。

Obsidian側は、公式URIの `new` actionで `vault`, `file`, `content`, `clipboard`, `silent`, `append`, `overwrite` が利用できる。現在の実装はクリップボードfallback時に「空ファイルを開いて手動貼り付け」に寄っているため、MVPでは `clipboard=true` を使って自動取り込みに寄せるべき。

## 現行実装のMVP適合状況

| 領域 | 評価 | 内容 |
|---|---:|---|
| Chromium MV3 | 概ね適合 | `manifest_chromium.json` はMV3、content script、service worker構成。MVP対象として妥当。 |
| Host permissions | 要整理 | ChatGPT/Claude/Gemini以外にAI Studio/NotebookLMが残る。MVPでは削るべき。 |
| Obsidian保存 | 部分適合 | File System Access API、Downloads、URI、clipboard fallbackがあるが、単一/複数で分裂している。 |
| ChatGPT | 部分適合 | 抽出selectorは比較的妥当。保存ボタン注入がコピーボタン依存で脆い。 |
| Claude | 低適合 | 内部API、Cookie、組織ID、ポーリング依存。DOM抽出主経路への変更が必要。 |
| Gemini | 部分適合 | providerは存在するが、popup表示と実ページQAが不足。セレクタ依存も強い。 |
| Popup | 不適合 | 「保存」が設定保存のみで、Obsidian保存を起動しない。 |
| Tests | 不適合 | JestはClaude関連テストで13件失敗。 |

## Chromium仕様との照合

### Manifest V3 / Service Worker

Chromium系MVPでMV3を採用する判断は正しい。Chrome拡張のbackgroundはMV3ではservice workerで、永続background pageではない。

注意点:

- service workerは通常30秒の非活動で終了する。
- 5分を超える単一処理や30秒を超えるfetch応答は終了条件になる。
- global変数に保存した状態は失われるため、設定・保存状態・フォルダハンドルは `chrome.storage` やIndexedDBへ置く必要がある。
- service workerはDOMに触れないため、チャット抽出はcontent scriptで行う必要がある。

現行実装は、抽出をcontent script、保存起動をbackgroundに分けており、構成自体は妥当。

### Content Scripts

Chrome公式仕様では、content scriptsはisolated worldで動作する。ページDOMは読めるが、ページ側JavaScriptの変数や内部状態へ直接アクセスする設計には向かない。

MVPへの影響:

- ChatGPT/Claude/GeminiのDOM変更に追従する必要がある。
- `MutationObserver` は必須。
- サービスごとのprovider分割は妥当。
- ただし、Tailwind風classやAngular生成class、コピーボタンだけに依存すると壊れやすい。

### Host permissions / activeTab

現在のManifestは以下を許可している。

- `https://chat.openai.com/*`
- `https://chatgpt.com/*`
- `https://claude.ai/*`
- `https://gemini.google.com/*`
- `https://aistudio.google.com/*`
- `https://notebooklm.google.com/*`

MVPでは `aistudio.google.com` と `notebooklm.google.com` は削除する。host_permissionsとcontent_scripts.matchesを対象3サービスに揃えることで、権限警告、DOM注入範囲、QA範囲を縮められる。

`activeTab` はユーザー操作後の一時的アクセスで、常時hover保存ボタン注入には不足する。現行の静的content script + 限定host_permissionsの方がMVPには合っている。

### Clipboard / Downloads / File System Access

Clipboard:

- 読み取りは不要。
- 長文fallback用に `clipboardWrite` だけあればよい。
- 現行Manifestに `clipboardWrite` があるのはMVP上妥当。

Downloads:

- `chrome.downloads` は宣言済みpermissionが必要。
- 保存先はブラウザのDownloads配下の相対パスであり、Vaultへの直接保存とは言いづらい。
- MVPでは「Vault保存に失敗した時の退避」と明示する。

File System Access API:

- `showDirectoryPicker()` はユーザー操作が必要。
- readwrite permission確認が必要。
- Chromium desktop限定MVPでは、初回セットアップ後の主経路として有力。
- ユーザーがフォルダ権限を取り消した場合の再許可導線が必要。

## Obsidian仕様との照合

ObsidianはVaultをローカルフォルダとして扱い、ノートはMarkdown形式のプレーンテキストファイルとして保存される。したがって、この拡張がMarkdownファイルをVault内へ直接書き込む設計はObsidianのデータモデルと合っている。

Obsidian URIでは `obsidian://new` が新規ノート作成に使える。MVPに関係する主なparameterは次。

- `vault`: Vault名またはVault ID
- `file`: Vault rootからのファイルパス
- `path`: グローバル絶対パス
- `content`: ノート本文
- `clipboard`: `content` の代わりにクリップボード内容を使う
- `silent`: 新規ノートを開かない
- `append` / `overwrite`: 既存ファイル処理

失敗を減らすための判断:

- Vault名だけでなくVault IDにも対応できるようにする。
- 長文は `content=` ではなく `clipboard=true` を使う。
- Obsidianが未起動・未インストール・URI未登録の場合は失敗するため、File System Access API経由の直接保存を主経路にするとこのリスクを避けられる。
- LinuxではURI登録に追加作業が必要になり得るが、今回MVPはChromium系デスクトップ全般であり、最初はmacOS/Windows/主要ChromiumでQAするのが現実的。

公式Obsidian Web ClipperはChrome Web Store上で2026-04-22更新の1.6.1が確認できる。公式Web ClipperはWebページ汎用クリップ向けであり、LLMチャットDOM抽出はこのプロジェクト側の専用providerが必要。ただし「ローカルVaultにMarkdownとして保存する」という体験設計は公式Clipperと整合する。

## 対象サービス別調査

### ChatGPT

現行provider:

- `src/contentScripts/js/providers/chatgpt/checks.js`
- `src/contentScripts/js/providers/chatgpt/ui.js`
- `src/contentScripts/js/providers/chatgpt/text.js`

抽出selector:

- `[data-message-author-role][data-message-id]`
- `[data-message-author-role]`
- `[data-testid^="conversation-turn-"]`
- `.markdown`
- `.prose`

この方針は、DOM階層や装飾classだけに依存するよりは妥当。ただしOpenAIが安定APIとして保証している属性ではない。

実地確認:

- ChatGPT公開共有ページ `https://chatgpt.com/share/...` では `data-message-author-role` と `data-message-id` が存在した。
- 一方で `[data-testid="copy-turn-action-button"]` は存在しなかった。

MVPリスク:

- `src/contentScripts/js/providers/chatgpt/ui.js` は保存ボタン注入を `copy-turn-action-button` 起点にしている。
- コピーボタンが非表示、名称変更、A/Bテスト、共有ページ、画面幅変更で消えると保存ボタンが出ない。

対策:

- ボタン注入はメッセージコンテナ起点にする。
- コピーボタンがあればその近くへ置き、なければメッセージ末尾やprovider共通floating actionへfallbackする。
- popup保存を実装し、インラインボタンが出ない場合でも保存できる導線を残す。

### Claude

現行provider:

- `src/contentScripts/js/providers/claude/checks.js`
- `src/contentScripts/js/providers/claude/ui.js`
- `src/contentScripts/js/providers/claude/text.js`
- `src/contentScripts/js/providers/claude/api.js`

主な問題:

- `claude.ai/api` の未公開内部APIに依存している。
- `chrome.cookies` で `lastActiveOrg` 等を読む。
- URLからchat ID / shared IDを抽出する。
- 5秒間隔でpollingする。
- `extractSingleMessage()` が `async` だが、共通側の `extractMessageData()` は同期的に呼ぶ。
- `extractSingleMessage()` は正常系のreturnが未完に見える。

実地確認:

- Claude公開共有ページはCloudflareのセキュリティ検証に入り、DOM確認ができなかった。
- これはMVP対象であるログイン済み通常ページの失敗証明ではないが、Claude側はbot対策・動的DOM・認証状態の影響を受けやすいことを示す。

MVP判断:

- 内部API主経路は外すべき。
- `chrome.cookies` permissionもClaude内部APIをやめるなら不要になる。
- DOM抽出を主経路にし、取れない場合だけ明示的に失敗表示する。

対策:

- Claude providerは `data-testid="user-message"`、`.font-claude-response`、`[data-test-render-count]` などDOMから抽出する。
- Artifactsやtool結果はまず本文に見えている内容だけを対象にする。
- API pollingはMVPから外す。
- 共通content script側を `await provider.extractSingleMessage()` / `await provider.captureMessages()` 対応にするか、providerを同期DOM抽出へ統一する。

### Gemini

現行provider:

- `src/contentScripts/js/providers/gemini/checks.js`
- `src/contentScripts/js/providers/gemini/ui.js`
- `src/contentScripts/js/providers/gemini/text.js`

抽出selector:

- `message-content`
- `[id^="message-content-id-"]`
- `.model-response-text`
- `.user-message`
- `.buttons-container-v2`

実地確認:

- Gemini公開共有URLは未ログイン状態だと `https://gemini.google.com/app` へ遷移し、チャットDOMは確認できなかった。
- Google公式ヘルプではGemini共有リンクは `g.co/gemini/share/...` とされ、公開共有ページは存在する。
- ただしMVP対象はログイン済みWeb版Geminiの通常チャットであり、ログイン状態での手動QAが必須。

MVPリスク:

- Gemini UIはAngular系の独自要素・生成classが多く、DOM変更に弱い。
- `src/contentScripts/js/providers/gemini/ui.js` は `.buttons-container-v2` に強く依存している。
- popupはChatGPT/Claudeしかサービス名表示を考慮しておらず、Geminiは `Unknown` になる。
- 非対応表示にもGeminiが含まれていない。

対策:

- popupのサービス判定に `gemini.google.com` を追加する。
- Geminiの単一保存・最新N件・全体保存をログイン済みページでQAする。
- `.buttons-container-v2` がない場合のfallbackを用意する。
- AI Studioは今回対象外なので `aistudio.google.com` をGemini扱いしない。

## ローカル実装の具体的な指摘

### ManifestがMVPより広い

対象ファイル:

- `manifests/manifest_chromium.json`
- `src/contentScripts/js/inject/service.js`
- `src/contentScripts/js/providers/ProviderFactory.js`

現状:

- `aistudio.google.com` と `notebooklm.google.com` にもcontent scriptを注入している。
- `detectService()` でもAI StudioをGemini扱い、NotebookLMを別provider扱いしている。
- Claude内部API用に `cookies` permissionが入っている。

MVP修正:

- host permissionsを対象3サービスへ限定する。
- content_scripts.matchesも同じく限定する。
- AI Studio / NotebookLMはproviderが残っていてもManifestから外す。
- Claude内部APIをやめるなら `cookies` permissionを削除する。
- context menuの `documentUrlPatterns` にGeminiが含まれていないため、選択保存をcontext menuから使うなら追加する。

### Popup保存が未接続

対象ファイル:

- `src/chromium/popup/App.js`

現状:

- `saveNote()` は `chatMode`、`messageCount`、`savedAt` を `chrome.storage.local` に保存するだけ。
- Obsidian保存処理を開始しない。
- UI上の「保存」ボタンは主導線に見えるため、MVPの最大ブロッカー。

MVP修正:

- active tabを取得する。
- modeごとにcontent scriptへ送る。

対応表:

| popup mode | content script action |
|---|---|
| `single` | `saveActive` |
| `selection` | `saveSelected` |
| `recent` | `saveLastN` |
| `full` | `saveAll` |

Gemini表示修正:

- `pageInfo.url.includes('gemini.google.com') ? 'Gemini'` を追加する。
- 非対応表示を「ChatGPT、Claude、Gemini」に更新する。

### 保存フローが単一/複数で分裂

対象ファイル:

- `src/chromium/background/background.js`

現状:

- `handleSaveMessage()` は `saveMethod` を見て File System Access API / Advanced URI / Downloads / Clipboard fallback を試す。
- `handleSaveMultipleMessages()` は `saveMethod` を見ず、短ければ `obsidian://new?...&content=...`、長ければclipboard + empty noteに落ちる。
- `fallbackToClipboard()` 実行後に古いdebug URI処理へ続く構造が残り、二重応答やクリップボード上書きのリスクがある。

MVP修正:

- 単一/複数/選択を共通の `saveMarkdownToObsidian()` のような関数へ集約する。
- `saveMethod` を全モードで尊重する。
- 長文fallbackでは公式 `clipboard=true` を使う。
- Downloads成功時は「Vault保存」ではなく「Downloadsに保存」と表示する。
- `fallbackToClipboard()` 後の到達不能debug処理を削除する。

### Providerの同期/非同期契約が不一致

対象ファイル:

- `src/contentScripts/js/inject.js`
- `src/contentScripts/js/providers/claude/text.js`

現状:

- `extractMessageData()` は `provider.extractSingleMessage()` を同期関数として扱う。
- Claudeの `extractSingleMessage()` と `captureMessages()` は `async`。
- `handleCaptureMessages()` も同期的に戻り値を扱う。

MVP修正:

- 共通側をasync対応にする。
- もしくはClaudeをDOM同期抽出へ寄せる。
- 方針を混在させない。

### Optionsの設定がcontent scriptへ反映されていない

対象ファイル:

- `src/chromium/options/OptionsApp.js`
- `src/chromium/background/background.js`
- `src/contentScripts/js/inject.js`

現状:

- `showSaveButton` / `buttonPosition` は保存される。
- backgroundは `updateSettings` をtabsへ送る。
- content script側に `updateSettings` handlerがない。

MVP修正:

- `updateSettings` を受けて保存ボタン表示/非表示を反映する。
- 最低限、MVPでは設定項目をUIから隠すか、実際に効くようにする。

## 検証結果

### ローカルコマンド

`npm run build:chromium`

- 成功。
- `dist-chromium` が生成される。
- Browserslist/caniuse-liteが古い警告あり。

`npx jest --runInBand`

- 失敗。
- 2 test suites中1 failed。
- 20 tests中13 failed。
- 失敗は `src/__tests__/claude-ai-news-extractor.test.js` が現在の `src/contentScripts/js/providers/claude/api.js` に存在しない関数を期待しているため。

不足している期待関数:

- `collectMessageElementsByRenderCount`
- `detectMessageType`
- `calculateApiIndexFromRenderCount`
- `extractSpecialContent`

MVP判断:

- 古いClaude内部API前提のテストなら整理する。
- DOM抽出に切り替えるなら、Claude DOM抽出の新テストへ差し替える。
- `package.json` に `test` scriptを追加する。

### 実ページDOMの簡易確認

Playwright + headless Chromiumで公開/未ログインページを確認した。

| サービス | 結果 | 解釈 |
|---|---|---|
| ChatGPT共有ページ | `data-message-author-role` と `data-message-id` は存在。`copy-turn-action-button` は0件。 | 抽出selectorは可能性あり。ボタン注入selectorは脆い。 |
| Claude共有ページ | Cloudflareセキュリティ検証画面。チャットDOMは0件。 | 公開/未ログイン自動検証は難しい。ログイン済み手動QA必須。 |
| Gemini共有ページ | 未ログイン状態で `/app` へ遷移。チャットDOMは0件。 | ログイン済み手動QA必須。 |

この結果は公開共有ページ専用対応の結論ではない。MVP対象はログイン済み通常Webチャットであるため、最終判断は手動QAで行う。

## MVP QAチェックリスト

### 共通セットアップ

- Chrome stableで `dist-chromium` を読み込む。
- Edge stableで読み込む。
- BraveまたはArcのどちらかで読み込む。
- Obsidian Desktopを一度起動し、Vaultを作成済みにする。
- オプション画面でVault名またはVault IDを設定する。
- File System Access API用にVaultフォルダを選択し、readwrite permissionを許可する。
- 保存先テンプレートを `ChatVault/{service}/{date}` などシンプルな形にする。

### ChatGPT

- 通常チャットで保存ボタンが表示される。
- 新しい返信生成後に保存ボタンが追加される。
- 別スレッドへSPA遷移後にも保存ボタンが追加される。
- 単一メッセージ保存。
- 選択範囲保存。
- 最新N件保存。
- 全体保存。
- コードブロック、箇条書き、表、リンクがMarkdownとして崩れない。

### Claude

- 通常チャットで保存ボタンが表示される。
- user messageとassistant messageを区別できる。
- 単一メッセージ保存。
- 最新N件保存。
- 全体保存。
- Artifactsがある会話で、本文に見えている内容だけでも保存できる。
- 内部API失敗や認証状態に保存成否が依存しない。

### Gemini

- 通常チャットで保存ボタンが表示される。
- 返信生成後に保存ボタンが追加される。
- user messageとmodel responseを区別できる。
- 単一メッセージ保存。
- 最新N件保存。
- 全体保存。
- コード/Canvas/拡張パネルがある場合、最低限本文保存が破綻しない。
- popup上でサービス名がGeminiとして表示される。

### 保存失敗ケース

- Vaultフォルダ未選択時に明確な案内が出る。
- File System Access permissionが拒否された時にURI/clipboardへfallbackする。
- Obsidianが未起動でも保存または明確な案内が出る。
- Obsidian URIが開けない場合Downloads fallbackへ落ちる。
- 長文チャットで `content=` URIを使わず `clipboard=true` または直接ファイル保存になる。
- Downloads fallback時はVault保存済みと誤表示しない。

## 優先実装順

1. ManifestをChatGPT/Claude/Geminiだけに絞る。
2. popupの保存ボタンを実保存処理に接続する。
3. `handleSaveMessage()` と `handleSaveMultipleMessages()` の保存処理を共通化する。
4. Obsidian fallbackで公式 `clipboard=true` を使う。
5. `fallbackToClipboard()` 後の古いdebug URI処理を削除する。
6. Claude内部API/Cookie/polling依存をMVPから外し、DOM抽出を主経路にする。
7. content script/providerの同期/非同期契約を統一する。
8. ChatGPTボタン注入をコピーボタン依存からメッセージコンテナ起点へ変更する。
9. Gemini popup表示とDOM fallbackを補強する。
10. `showSaveButton` / `buttonPosition` 設定を効かせるか、MVP UIから外す。
11. Claudeの古いテストをDOM抽出テストへ更新し、`package.json` に `test` scriptを追加する。
12. README/AGENTS/要件定義をMVPスコープに合わせて更新する。

## 参照した公式ソース

- Chrome Extensions / Declare permissions: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- Chrome Extensions / Content scripts: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- Chrome Extensions / Manifest content scripts: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
- Chrome Extensions / Service worker lifecycle: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- Chrome Extensions / activeTab: https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- Chrome Extensions / Downloads API: https://developer.chrome.com/docs/extensions/reference/api/downloads
- Chrome Extensions / Offscreen API: https://developer.chrome.com/docs/extensions/reference/api/offscreen
- Chrome / File System Access API: https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
- MDN / showDirectoryPicker: https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
- Microsoft Edge / MV3 migration: https://learn.microsoft.com/en-gb/microsoft-edge/extensions/developer-guide/migrate-your-extension-from-manifest-v2-to-v3
- Obsidian URI: https://obsidian.md/help/uri
- Obsidian data storage: https://obsidian.md/help/data-storage
- Obsidian Web Clipper help: https://obsidian.md/help/web-clipper
- Obsidian Web Clipper product page: https://obsidian.md/clipper
- Obsidian Web Clipper Chrome Web Store: https://chromewebstore.google.com/detail/obsidian-web-clipper/cnjifjpddelmedmihgijeibhnjfabmlf
- OpenAI ChatGPT Shared Links FAQ: https://help.openai.com/en/articles/7925741-chatgpt-shared-links-faq
- Anthropic Claude sharing help: https://support.claude.com/en/articles/10593882-sharing-and-unsharing-chats
- Google Gemini share chats help: https://support.google.com/gemini/answer/13743730

## 最終判断

MVPの範囲は、Chromium系ブラウザ + ChatGPT/Claude/Gemini + Obsidian保存で十分。Firefox、Codex、NotebookLM、AI Studio、公開共有ページ専用対応は今は追わない。

現状で最も重要なのは「保存できる導線」を実際に通すこと。popup保存、保存処理共通化、Claude DOM抽出、対象ホスト整理を先に片付ければ、MVPの失敗要因は大きく減らせる。
