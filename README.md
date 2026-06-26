# OpenCodeの設定

このリポジトリは [opencode](https://opencode.ai) の設定を管理する共有設定リポジトリです。 環境変数 `OPENCODE_CONFIG_DIR` にこのリポジトリのパスを指定して各プロジェクトで利用します。

## セットアップ

```bash
git clone https://github.com/shoohein/opencode-config ~/.config/opencode-config
export OPENCODE_CONFIG_DIR="$HOME/.config/opencode-config"
```

詳しくは [OpenCode Config ドキュメント](https://opencode.ai/docs/config/#custom-directory) を参照してください。

## 開発

Node.js が必要です。

```bash
npm install
npm run format:check
npm run format  # 自動修正
```

新しい agent / command / skill を追加する場合は、対応するディレクトリにファイルを作成してください。

## 構成

- `agents/` — カスタムエージェント定義
- `commands/` — カスタムコマンド定義
- `skills/` — 再利用可能なスキル定義
- `instructions/` — 追加指示ファイル
- `opencode.jsonc` — opencode 設定
- `tui.json` — TUI 設定
