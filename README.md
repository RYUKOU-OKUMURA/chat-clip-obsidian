# Chat Clip Obsidian

ChatGPT、Claude、Google Geminiのチャット会話を、Chromium系ブラウザからObsidian VaultへMarkdownとして保存するChrome拡張機能。

## 概要

Chat Clip Obsidianは、Web版生成AIチャットサービスの会話を効率的にObsidianに保存するためのブラウザ拡張機能です。研究、学習、開発におけるAIとの対話を体系的に記録し、ナレッジベースとして活用できます。

### 主な特徴

- 🤖 **AIチャット専用**: ChatGPT、Claude、Geminiに特化
- 📝 **複数の保存モード**: 最新メッセージ、選択範囲、最新N件、会話全体
- 🎯 **ワンクリック保存**: ポップアップ保存とメッセージ横の保存ボタン
- 📁 **保存先を分離**: チャット全文とコードブロック単体保存のフォルダを個別設定
- 🧭 **迷いにくいVault設定**: 直接保存用のVaultルートとVault内の保存先フォルダを分けて設定
- ✨ **きれいなMarkdown**: コードブロック、数式、定義リスト、ネストされたリスト、画像キャプションなどを適切に変換
- 💾 **直接保存機能**: File System Access APIによるVaultへの直接書き込み
- 🔗 **Fallback連携**: Obsidian公式URIの `clipboard=true` とDownloads API
- 🔔 **保存通知**: ファイル保存成功時の通知表示

## 対応サービス

### 現在対応済み
- ✅ **ChatGPT** (`chat.openai.com`, `chatgpt.com`)
- ✅ **Claude** (`claude.ai`)
- ✅ **Google Gemini** (`gemini.google.com`)

### MVP対象外
- Firefox / Safari / モバイルブラウザ
- Codex / NotebookLM / Google AI Studio / Perplexity AI
- 共有ページ専用対応

## 保存モード

| モード | 説明 | 用途 |
|--------|------|------|
| **最新メッセージ** | ポップアップから最新の1件を保存 | 直近の回答やアイデアをすばやく記録 |
| **メッセージ横の保存ボタン** | 押した個別メッセージを保存 | 重要な回答やアイデアをピンポイントで記録 |
| **選択範囲** | ハイライトしたテキストを保存 | 長いメッセージから必要な部分だけ抜粋 |
| **最新N件** | 直近のメッセージをまとめて保存 | 一連の議論や問答を記録 |
| **会話全体** | スレッド全体を保存 | 完全な対話ログとして保管 |

## インストール

### 手動インストール（開発版）

1. **リポジトリをクローン**:
```bash
git clone https://github.com/yourusername/chat-clip-obsidian.git
cd chat-clip-obsidian
```

2. **依存関係をインストール**:
```bash
npm install
```

3. **拡張機能をビルド**:
```bash
npm run build:chromium
```

4. **Chromeに拡張機能を読み込み**:
   - `chrome://extensions/` にアクセス
   - 「デベロッパーモード」を有効化
   - 「パッケージ化されていない拡張機能を読み込む」をクリック
   - `dist-chromium` フォルダを選択

### Chrome Web Store（公開予定）
近日中にChrome Web Storeで公開予定です。

## 設定

1. **拡張機能アイコン**をクリックして**オプション**を選択
2. **Obsidian連携**を設定
   - **Obsidian Vault名**: URI fallbackでObsidianを開くためのVault名。File System APIの直接保存だけなら空欄でも保存できます。
   - **直接保存用のVaultルート**: Chromeに書き込み権限を与えるフォルダです。Obsidianで開いているVaultの一番上のフォルダを選びます。
   - `AIchat`、`ChatVault`、`素材`、`Xポスト` などの保存先サブフォルダをVaultルートとして選ぶと警告し、直接保存では使いません。
   - 許可が古いフォルダを指している場合は、**許可をリセット**してからVaultルートを選び直します。
3. **保存先**を設定
   - **チャット全文の保存先**: ポップアップ保存、会話全体保存、通常のメッセージ保存で使うVault内フォルダです。
   - **コードブロックの保存先**: コードブロック内に表示される保存ボタンから単体保存した場合だけ使うVault内フォルダです。
   - 既定はチャット全文がVault直下、コードブロックはチャット保存先と同じです。
   - `フォルダを選択` ボタンから、許可済みVaultルート内の既存フォルダを選べます。
4. **通常設定**
   - デフォルト保存モード、最新N件の件数、チャットページ上の保存ボタン表示、ポップアッププレビュー表示を調整できます。
5. **詳細設定**
   - 保存方法、Downloads fallback用フォルダ、Markdownテンプレート、診断情報を調整できます。
6. **旧設定の扱い**
   - 以前の `ChatVault/{service}/{title}` などの保存先が見つかった場合は、勝手に変更せず警告と保存先プレビューを表示します。

## 推奨保存方法

**File System API**
- Optionsで**直接保存用のVaultルート**を許可します。
- 通常保存はVaultへMarkdownファイルを直接書き込みます。
- File System APIが失敗した場合は、`obsidian://new?...&clipboard=true`、短文URI、Downloads APIの順にfallbackします。

## 使用方法

### 基本的な使い方

1. **ChatGPT・Claude・Gemini**のいずれかにアクセス
2. 拡張機能ポップアップで保存モードを選び、「保存」をクリック
3. 個別メッセージを保存したい場合は、メッセージ横の保存ボタンも利用できます

### コードブロック単体保存

コードブロック内に表示される保存ボタンを押した場合だけ、オプションの**コードブロックの保存先**を使います。会話全体保存の中に含まれるコードブロックを自動で別ファイル化する仕様ではありません。

### その他の保存方法

- **右クリックメニュー**: 対応チャットページで選択テキストを保存
- **キーボードショートカット**: ポップアップ内で Alt+S

## 保存されるMarkdown形式

既定のノートテンプレートは `# {title}\n\n{content}` です。本文には取得モードに応じたメッセージがMarkdownとして入ります。

````markdown
# AI Chat - 2026-05-06

### User
ここにユーザーの質問が入ります。

### Assistant
ここにAIの回答が入ります。

```javascript
// コードブロックも適切に保持されます
function example() {
  return "Hello, World!";
}
```

数式も適切に変換されます：
$$E = mc^2$$
````

Markdownテンプレートでは `{title} {url} {date} {saved} {service} {type} {content}` を利用できます。`{content}` を含まないテンプレートは保存時に既定テンプレートへ戻します。

## HTML→Markdown変換機能

Chat Clip Obsidianは、[Turndown](https://github.com/mixmark-io/turndown)ライブラリを使用して、AIチャットのHTML要素を高品質なMarkdownに変換します。以下の要素を適切に処理します：

- **コードブロック**: 言語指定を保持し、フェンスド形式で出力
- **インラインコード**: バッククォートで適切に囲む
- **数式表現**: KaTeXやMathJax形式の数式を保持
- **定義リスト**: 用語と説明を適切なフォーマットで変換
- **ネストされたリスト**: 複数階層のリストを適切なインデントで保持
- **画像とキャプション**: 画像とその説明文を適切に変換
- **HTMLコメント**: コメントを保持
- **特殊要素の保持**: iframe、canvas、SVGなどの特殊要素をHTML形式で保持

これにより、AIチャットの複雑なフォーマットやコンテンツを失うことなく、Obsidianで活用できます。

## 開発・カスタマイズ

### 開発環境

```bash
# プロダクションビルド
npm run build:chromium
```

配布や手動読み込みに使うフォルダは必ず再ビルド後の `dist-chromium` です。`src` を変更しただけではブラウザに読み込まれる拡張機能は更新されません。

### プロジェクト構造

```
src/
├── contentScripts/     # AIチャットページに注入されるスクリプト
├── services/           # サービス別のメッセージ抽出ロジック
├── utils/              # Markdown変換などのユーティリティ
└── chromium/           # 拡張機能のUI・バックグラウンド処理
```

## ロードマップ

### 近日実装予定
- [ ] 一括エクスポート機能
- [ ] Chromium以外のブラウザ検証

### 将来的な構想
- [ ] Perplexity AI対応
- [ ] モバイル対応
- [ ] 他のノートアプリ対応
- [ ] チームでの共有機能

## トラブルシューティング

### よくある問題

**Q: 保存ボタンが表示されない**
- ページを再読み込みしてください
- 拡張機能が有効になっているか確認してください

**Q: Obsidianにノートが作成されない**
- URI fallbackを使う場合は、Vault名が正しく設定されているか確認してください
- Optionsで直接保存用のVaultルートを許可しているか確認してください
- 直接保存用のVaultルートには、保存先サブフォルダではなくObsidian Vaultの一番上のフォルダを選んでください
- URI fallbackを使う場合はObsidianが起動しているか確認してください

**Q: `/Obsidian Vault/AIchat/Xポスト/素材` のように余計な階層へ保存される**
- 直接保存用のVaultルートに `AIchat` などの保存先サブフォルダを許可している可能性があります
- Optionsで**許可をリセット**し、`/Users/.../Obsidian Vault` のようなVaultルートを選び直してください
- その上で、コードブロックの保存先に `Xポスト/素材` を設定します

**Q: 長い会話が保存できない**
- File System API保存を推奨します。Vaultルート未許可や権限拒否時は、自動選択でURI fallbackまたはDownloads fallbackを使えます。

## 開発への貢献

このプロジェクトへの貢献を歓迎します！

- **バグ報告**: [Issues](https://github.com/yourusername/chat-clip-obsidian/issues)でお知らせください
- **機能リクエスト**: 新しいAIサービス対応やUI改善のご提案
- **プルリクエスト**: コードの改善や新機能の実装

## 技術仕様

- **対応ブラウザ**: Chrome 121+, Edge 121+, Brave
- **File System Access API**: Chrome 86+, Edge 86+（Direct Save機能）
- **Manifest**: Version 3
- **フレームワーク**: React, Tailwind CSS
- **ビルドツール**: Webpack
- **ライブラリ**: Turndown（HTML→Markdown変換、カスタムルールで拡張）

## クレジット

本プロジェクトは、[Massimiliano Vavassori](https://github.com/mvavassori)氏による[Obsidian Web Clipper](https://github.com/mvavassori/obsidian-web-clipper)の設計思想とObsidian連携の仕組みを参考にさせていただきました。素晴らしい基盤を提供していただいたことに心から感謝いたします。

ただし、Chat Clip ObsidianはAIチャット専用の拡張機能として、独自の実装とUI設計で開発されています。

## ライセンス

MIT License - 詳細は[LICENSE](LICENSE)ファイルをご覧ください。

---

**📧 質問・要望**: [Issues](https://github.com/yourusername/chat-clip-obsidian/issues)  
**🌟 気に入ったら**: リポジトリにスターをお願いします！  
**🤝 貢献**: プルリクエストやフィードバックをお待ちしています
