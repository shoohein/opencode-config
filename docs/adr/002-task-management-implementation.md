# ADR 002: タスク管理システムの実装判断

## ステータス

Accepted (2026-07-04)

## コンテキスト

基本設計書 `docs/design/task-management-system.md` にて、ファイルシステムベースのタスク管理システムのアーキテクチャと Rationale が定義された。アーキテクチャレベルの判断は `ADR 001` に記録されている。本 ADR は、その設計を OpenCode の具体的な機構（plugin / command / skill / instruction）に落とす際に生じた実装判断とトレードオフを記録する。

## 関連 ADR

- **ADR 001:** アーキテクチャ判断（状態管理・ID採番・優先度決定・Git境界） — 本ADRの前提

## 判断一覧

### 1. 機械処理の実装方式 — `bin/tasks.sh` + Plugin 薄ラッパー

- **選択:** Bash Script (`bin/tasks.sh`) を機械処理の実体とし、Plugin (Custom Tool) はそれを呼ぶ薄いアダプターとする。
- **棄却した代替案:**
  - _Custom Tool のみ:_ OpenCode 外で再利用不可。TypeScript のビルド/リロードが必要。
  - _Bash Script のみ:_ エージェントが毎回 `execSync("bash bin/tasks.sh ...")` を書く必要がある。引数型のバリデーションがない。git commit の漏れが発生しうる。
- **理由:**
  - Unix 哲学（テキストストリームをパイプで繋ぐ）との整合性。
  - OpenAI Code / Claude Code / エディタターミナルなど OpenCode 外からの再利用が可能。
  - Plugin が死んでも `bin/tasks.sh` は直接叩ける（障害耐性）。
  - Plugin 側で引数の Zod バリデーション・git commit の自動化を強制できる。
- **結果:** `plugins/task-manager.ts` は `run()` / `gitCommit()` / `parseTSV()` の 3 つの主要共通ヘルパーを中心に構成される。

### 2. Script の設置ディレクトリ — `bin/` の選択

- **選択:** `bin/tasks.sh`
- **棄却した代替案:**
  - `.agent/`: Docker イメージビルド用コンテキストであり、タスク管理スクリプトの設置場所として不適切。
  - `tasks/` 直下: データ（.md ファイル）とコード（.sh）の混在。`ls tasks/` したときにスクリプトが邪魔になる。
  - ルート直置き `task.sh`: ルートディレクトリが散らかる。
- **理由:** Unix 標準 `bin/` は「利用者が直接叩くことを想定したスクリプト」の慣習的配置。OpenCode 外から `bin/tasks.sh create "..."` と叩ける。

### 3. Plugin の関心分離 — 3 ヘルパーへの集約

- **選択:** 以下の 3 関数に責務を集約し、各ツールから呼び出す。
  - `run(ctx, subcommand, ...args)`: パス解決 + bash 実行 + エラー伝搬
  - `gitCommit(ctx, msg)`: git init (初回) + add + commit (mutation 後)
  - `parseTSV(raw)`: TSV 出力を構造化 JSON に変換 (next/list で共用)
- **棄却した代替案:** 各ツール内で個別に execSync / path.resolve を書く。
- **理由:** 5 ツール中 4 ツールが `run()` を呼ぶ。重複排除と責務の明確化。git commit 漏れの防止。
- **結果:** 各ツールの execute 実装は以下の形式に統一される:
  ```
  const raw = run(ctx, "create", args.description, ...)
  const [id, filepath] = raw.split("\t")
  gitCommit(ctx, `Add task ${id}: ${args.description}`, [filepath])
  return { output: JSON.stringify({ id }) }
  ```

### 4. ユーザーインターフェース — 薄い Command + 複雑な Skill

- **選択:** 全 7 操作に Command (`/task-new`, `/task-start`, `/task-done`, `/task-cancel`, `/task-next`, `/task-suspend`, `/task-status`) を用意。各 Command は 1 文の薄いテンプレート。複雑な処理は内部で `skill()` を呼び出す。
- **棄却した代替案:**
  - _Command のみ:_ 条件分岐が多い処理 (done/next/suspend) をテンプレートだけで書こうとすると TUI ログが肥大化する。
  - _Skill のみ:_ TUI の `/` 補完が効かず、エージェントが自発的に判断する必要がある。
- **理由:**
  - Command は「引数があれば即実行、なければ対話モード」の統一インターフェースで、操作を覚えやすい。
  - 薄いテンプレート制限で TUI ログのノイズを抑制。
  - Skill 側で例外ケースや LLM 判断を詳細に記述できる。
- **結果:** 以下の 3 つの複雑な処理が Skill として切り出された:
  - `task-done`: 完了 + 依存タスクのブロック解除通知
  - `task-next`: tsort + スコア結果の解釈・説明
  - `task-suspend`: Worklog からの Next Action 要約

### 5. 優先度スコア配分 — important +2 / urgent +1

- **選択:** important (+2), urgent (+1)。同点時の順序は保証しない（`task-next` Skill 内で候補を提示しユーザー判断に委ねる）。
- **棄却した代替案:** important (+1), urgent (+1) / important (+3), urgent (+1) など。
- **理由:** 緊急だが重要でないタスクは「怠惰に都合の良いタスクを選んでいる」可能性がある。達成したときの効果（重要度）を優先して評価すべき。
- **注記:** この配分は暗黙のルールにせず、`task-next` Skill 内で LLM が明示的に理由を説明する。

### 6. tsort 結果の後処理 — 二段階出力

- **選択:** tsort 出力に登場するタスク（依存関係のエッジを持つ）を第一グループ、登場しないタスク（オーファン）を第二グループとして出力。
- **棄却した代替案:** tsort の生出力をそのまま使う（オーファンタスクは無視する）。
- **理由:** tsort は入力されたペア（依存関係）に含まれる要素のみを考慮する。依存関係を持たない独立タスクは自動的に出力から除外されるため、明示的に追加する必要がある。
- **結果:** `next` コマンドの出力は「tsort 順で依存関係を考慮したタスク一覧」+「スコア順の独立タスク一覧」の二段構成となる。

### 7. completed_at の注入位置

- **選択:** `fm_close()` + `awk` で YAML Front Matter の閉じ `---` の直前に `completed_at` を注入する。
- **棄却した代替案:** `sed` による注入（YAML の開き `---` の前に注入されてしまう）。
- **理由:** `fm_close()` で最終 `---` を特定し、その直前に `awk` で追記する方式の方が信頼性が高い。
- **結果:** `completed_at` は YAML 最終行として正しくフロントマター内に配置される。詳細は `bin/tasks.sh:16-41`（`fm_close()` / `inject_completed_at()`）を参照。

### 8. 記録媒体間の重複回避

- **選択:** instructions / docs/design / docs/adr の 3 媒体で責務を分割する。
- **棄却した代替案:** 全情報を 1 ファイルに集約する。
- **理由:** 各文書の参照目的と更新頻度が異なるため、責務分割により保守性を高める。
- **結果:**
  - `instructions/`: エージェントの実行時指示に限定。ツール名・スキル名・状態遷移ルールのみ。
  - `docs/design/`: 基本設計と Rationale。「なぜそう設計したか」。
  - `docs/adr/`: 実装上のトレードオフと具体的な判断。「何を検討し、なぜ選んだか」。

#### 注記: depends_on の検証範囲

設計書の `depends_on` には「存在しない ID や done/canceled の ID は指定不可」とあるが、現行実装では書式（`001,002,...`）の検証のみで依存先の実在・状態はチェックしない。これは意図的に deferred としている:

- 作成時点で依存先が未作成のタスクを指定するユースケース（事前計画的な依存指定）には、存在チェックが妨げになる。
- 依存先の状態変化（完了・破棄）をリアルタイム検証するには状態遷移フックが必要で、現行の設計複雑性の範囲を超える。

## OpenCode 機構へのマッピング

| 基本設計の要素 | 実装先 | 備考 |
| --- | --- | --- |
| ID採番 / 状態遷移 / 進捗計算 / 依存解析 | `bin/tasks.sh` | 機械処理の実体：5 関数（create/move/next/progress/list） |
| 上記をエージェントから呼び出す I/F | `plugins/task-manager.ts` (Custom Tool) | 薄いラッパー：run/gitCommit/parseTSV の 3 ヘルパー |
| Git 自動化 | 同上 `gitCommit()` | mutation 後に自動実行 |
| 次タスク提案 | `skills/task-next/SKILL.md` | LLM 判断：tsort + スコアを解釈し理由を説明 |
| ワークログ要約 + 中断 | `skills/task-suspend/SKILL.md` | LLM 判断：Worklog → Next Action |
| 完了処理 + 依存通知 | `skills/task-done/SKILL.md` | LLM 判断：完了 + ブロック解除通知 |
| タスク状態照会 | `commands/task-status.md` | `task_list` + `task_progress` の組み合わせ |
| ユーザーからの操作起点 | `commands/task-*.md` (7 ファイル) | 薄いテンプレート |
| エージェントへの指示 | `instructions/task-management.md` | 英語化済み |
| tasks/ | 独立 Git リポジトリ | 初回 commit 済み（README.md） |
