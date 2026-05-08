# CLAUDE.md - Chat Clip Obsidian 開発ガイド

## プロジェクト概要

Chat Clip Obsidianは、Web版LLMチャット（ChatGPT/Claude）の会話をワンクリックでObsidian VaultにMarkdownとして保存するChrome拡張機能です。既存のObsidian Web Clipperをベースに、AI チャット専用機能を追加しています。

## プロジェクト構造

```
Chat Clip Obsidian/
├── src/
│   ├── chromium/              # Chrome/Edge用メインコード
│   │   ├── App.js            # ポップアップUI (React)
│   │   ├── OptionsApp.js     # オプション画面 (React)
│   │   ├── background.js     # バックグラウンドスクリプト
│   │   ├── index.js          # ポップアップエントリーポイント
│   │   └── options.js        # オプションエントリーポイント
│   ├── contentScripts/        # Webページ注入スクリプト
│   │   ├── inject.js         # メインコンテントスクリプト
│   │   └── inject.css        # コンテントスクリプト用CSS
│   ├── services/              # サービス別DOM抽出ロジック
│   │   ├── base.js           # 基底クラス (未実装)
│   │   ├── chatgpt.js        # ChatGPT抽出ロジック (未実装)
│   │   └── claude.js         # Claude抽出ロジック (未実装)
│   └── utils/                 # 共通ユーティリティ
│       └── markdown.js       # Markdown変換ユーティリティ (未実装)
├── manifests/
│   ├── manifest_chromium.json # Chrome拡張機能設定
│   └── manifest_firefox.json  # Firefox拡張機能設定
├── public/                    # 静的ファイル
├── dist-chromium/            # Chrome用ビルド出力 (ビルド時生成)
├── dist-firefox/             # Firefox用ビルド出力 (ビルド時生成)
├── package.json              # プロジェクト設定
├── webpack.config.js         # Webpackビルド設定
├── tailwind.config.js        # TailwindCSS設定
├── 要件定義.md               # プロジェクト要件定義
└── 開発プラン.md             # 開発計画詳細
```

## 開発環境のセットアップ

### 必要な依存関係のインストール
```bash
npm install
```

### 開発モードでのビルド（ファイル監視付き）
```bash
# Chrome/Edge用
npm run dev:chromium

# Firefox用
npm run dev:firefox
```

### プロダクションビルド
```bash
# Chrome/Edge用
npm run build:chromium

# Firefox用
npm run build:firefox
```

### Chrome拡張機能としてのテスト
1. `npm run build:chromium` でビルド
2. Chrome で `chrome://extensions/` を開く
3. 「デベロッパーモード」を有効化
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. `dist-chromium` フォルダを選択

## 現在の実装状況

### ✅ 完了
- **基本プロジェクト構造**: package.json, webpack設定, manifest設定
- **コンテントスクリプト**: inject.js, inject.css - ChatGPT/Claudeページにボタン注入機能

### 🔄 進行中
- **services/chatgpt.js**: ChatGPT DOM抽出ロジック

### ⏳ 未実装
- **utils/markdown.js**: HTML→Markdown変換
- **background.js拡張**: メッセージ通信とObsidian URI処理
- **ポップアップUI拡張**: AIチャット保存機能の追加
- **services/claude.js**: Claude DOM抽出ロジック

## 主要機能の仕様

### 1. コンテントスクリプト (inject.js)
- ChatGPT (`chat.openai.com`) とClaude (`claude.ai`) ページで動作
- メッセージにホバーでSaveボタンを表示
- DOM変更を監視して新しいメッセージにボタンを自動追加
- ポップアップとの通信でメッセージ取得機能提供

### 2. 保存モード
- **単一メッセージ**: 個別メッセージの保存
- **選択範囲**: ユーザーが選択したテキストの保存
- **最新N件**: 直近N件のメッセージを保存
- **全体**: スレッド全体を保存

### 3. Markdown変換
- TurndownライブラリでHTML→Markdown変換
- コードブロックはフェンスド形式で保存
- 数式（KaTeX）は $$ 記法で保存
- スピーカー見出し: `### User` / `### Assistant`

### 4. Obsidian連携
- `obsidian://new` URIでノート作成
- URI長すぎる場合はクリップボード経由でフォールバック
- フォルダ構造: `LLM Chats/{service}/{title}_{YYYY-MM-DD}.md`

## 開発のベストプラクティス

### ファイル編集時の注意点
1. **既存機能の保持**: Obsidian Web Clipperの元機能は必ず維持
2. **コード規約**: 既存ファイルのスタイルに合わせる
3. **エラーハンドリング**: 必ずtry-catchでエラーをキャッチ
4. **CSS変数**: 可能な限りCSS変数を使用してテーマ対応

### テスト方法
1. **手動テスト**: 
   - ChatGPTとClaudeで実際にメッセージ保存を試す
   - 各ブラウザでの動作確認
2. **エラーログ確認**:
   - Chrome DevTools Consoleでエラーチェック
   - Background page consoleも確認

### 重要なファイルの役割

#### contentScripts/inject.js
- Webページに注入されるメインスクリプト
- DOM監視とボタン注入を担当
- background.jsとの通信で保存処理をトリガー

#### chromium/background.js
- 拡張機能のバックグラウンド処理
- コンテントスクリプトとポップアップ間の通信ハブ
- Obsidian URI実行とクリップボード操作

#### chromium/App.js
- ポップアップUIのメインコンポーネント
- Web Clipper機能 + AIチャット保存機能の統合UI

## 次に実装すべきファイル優先度

1. **services/chatgpt.js** (HIGH) - DOM抽出ロジック
2. **utils/markdown.js** (HIGH) - Markdown変換
3. **background.js拡張** (HIGH) - メッセージハンドリング
4. **App.js更新** (MEDIUM) - UI機能追加
5. **services/claude.js** (MEDIUM) - Claude対応

## デバッグ時のポイント

### Content Script
- `chrome://extensions/` → Chat Clip Obsidian → 詳細 → 「コンテンツスクリプトを検査」
- Console.logでDOM要素の取得状況を確認

### Background Script  
- `chrome://extensions/` → Chat Clip Obsidian → 詳細 → 「サービスワーカーを検査」
- メッセージ通信のログを確認

### ポップアップ
- 拡張機能アイコンを右クリック → 「ポップアップを検査」

## 🐛 バグ修正・デバッグワークフロー

### 最優先実行プロセス
エラー対応やデバッグ作業の際は、以下のプロセスを**優先的に実行**してください：

#### 1. バグの理解と根本原因の特定 🔍
- **バグ記述の理解**: ユーザー提供のバグ記述を詳細に分析
- **根本原因の推測**: 考えられる原因を技術的に特定
- **問題の再現**: 可能な限りバグを再現して実際の動作を確認

#### 2. 修正の実装 🔧
以下のツールを**複数サブエージェント**を使用して並行実行：
- **`context7` MCPツール**: エラーの文脈理解
- **`brave-search` MCPツール**: 類似問題の検索
- **ネイティブWeb検索サブエージェント**: 問題調査

#### 3. 継続的デバッグ 🔄
- 他のエラーが発生した場合は**必ず1-2を繰り返す**
- 完全に解決するまで継続
- 解決過程を詳細にログに記録

### 実装例
```javascript
// バグ修正プロセスの実装
async function debugWorkflow(bugDescription) {
  // 1. バグの理解
  const analysis = await analyzeBug(bugDescription);
  
  // 2. 並行調査（複数サブエージェント）
  const [contextResult, searchResult, webResult] = await Promise.all([
    context7Search(analysis.keywords),
    braveSearch(analysis.errorPattern),
    webSearchAgent(analysis.symptoms)
  ]);
  
  // 3. 修正実装
  const fix = await implementFix(analysis, contextResult, searchResult, webResult);
  
  // 4. 検証と継続
  if (!fix.success) {
    return debugWorkflow(fix.newErrors); // 再帰的に実行
  }
  
  return fix;
}
```

### デバッグ時の注意点
1. **段階的アプローチ**: 一度に複数の変更を行わない
2. **ログの詳細化**: 各ステップでの状況を詳細に記録
3. **並行調査**: 複数のサブエージェントを同時に活用
4. **継続的検証**: 修正後も関連する機能の動作確認

### エラーログの記録
- `DEBUG_LOG.md` にすべてのエラーと解決過程を記録
- 再発防止のための対策も合わせて記載
- 類似エラーの参考資料として活用

## 外部依存関係

- **React**: UI構築
- **Tailwind CSS**: スタイリング  
- **Turndown**: HTML→Markdown変換
- **Webpack**: ビルドツール

## ライセンスと著作権

- MIT License
- 元のObsidian Web Clipper作者への謝辞を維持
- 新機能追加時も元ライセンス表示を保持

---

このファイルは開発中の参考として使用し、実装進捗に応じて更新してください。
