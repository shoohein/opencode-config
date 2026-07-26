# セッション管理システム 詳細設計書

## 1. 概要

セッション管理システムは以下の 4 レイヤーで構成される：

| レイヤー | 成果物 | 責務 |
| --- | --- | --- |
| Plugin | `plugins/session-management.ts` | OpenCode API / shell への状態変更（タイトル更新、git notes 付与） |
| Instruction | `instructions/session-status.md` | コンテキスト収集の要否判断基準 |
| Skill | `skills/session-close/SKILL.md`, `skills/session-recovery/SKILL.md` | 判断ロジック（どう閉じるか、どう回収するか） |
| Command | `commands/session-close.md` | ユーザー向けインターフェース |

外部システム不在時は縮退する（依存機能をスキップして残りの処理を継続する、§7 参照）。タスク管理システム（`tasks/`）は未実装のため、関連機能は縮退として扱う。

## 2. Plugin レイヤー

### 2.1 配置

`plugins/session-management.ts` — TypeScript ローカルスクリプト。npm パッケージとして配布しない。

### 2.2 ツール一覧

#### `session_title(title)`

タイトル本文を設定する。

- **引数**: `title: string` — 新しいタイトル本文（接頭辞を含まない）
- **処理**:
  1. 現在のセッションタイトルを `client.session.status()` で取得
  2. 正規表現 `/^【(?:完了|中断|回収)】\s*/` にマッチする接頭辞を抽出
  3. 接頭辞が存在する場合: `接頭辞 + title` の形式（例: `【完了】 新しいタイトル`）で `client.session.update()` を実行
  4. 接頭辞が存在しない場合: `title` をそのまま設定
- **戻り値**: `{ output: string }` — 設定後の完全なタイトル文字列

#### `session_mark(status)`

接頭辞を更新する。本文は保存される。

- **引数**: `status: "完了" | "中断" | "回収"`
- **処理**:
  1. 現在のセッションタイトルを取得
  2. 正規表現 `/^【(?:完了|中断|回収)】\s*/` にマッチする既存の接頭辞を除去し、本文のみを抽出
  3. `` `【${status}】 ${body}` `` の形式で `client.session.update()` を実行
- **戻り値**: `{ output: string }` — 設定後の完全なタイトル文字列

#### `session_add_note(commit, note)`

task-management リポジトリの自動生成コミットに git notes を付与する。

- **引数**:
  - `commit: string` — task-management リポジトリの自動生成コミットハッシュ
  - `note: string` — 付与する JSON 文字列
- **処理**: リポジトリルートで `git notes add -m <note> <commit>` を実行
- **戻り値**: `{ output: string }` — 成功時は `"notes added"`、不在時は縮退（§2.5 参照）

### 2.3 接頭辞ルール

| 項目       | 値                                   |
| ---------- | ------------------------------------ |
| 正規表現   | `/^【(?:完了\|中断\|回収)】\s*/`     |
| 基数       | 常に単一（重複不可）                 |
| 意味       | 表示ラベル                           |
| `【完了】` | 正常終了したセッション               |
| `【中断】` | ユーザーが中断したセッション         |
| `【回収】` | システムが自動起動した回収セッション |

制御判断の情報源は OpenCode の `time.updated` と `SessionStatus`（Single Source of Truth、以下 SSoT）である。

### 2.4 イベントフック

#### `session.created`

ユーザーセッションの起動時に発火。

- `【回収】` 接頭辞を持つセッション → スキップして処理を終了
- それ以外 → 放置セッションの検出（§4.2.1）を実行する。該当するセッションがある場合、新たな OpenCode セッションを spawn し、`session_mark('回収')` で `【回収】` 接頭辞を付与する

#### `session.updated`

タイトルの自動更新時に発火。

- 対象: タイトルに `【回収】` 接頭辞を持つセッション
- 処理: 更新前後のタイトルを比較し、接頭辞が実際に欠落している場合のみ `session_mark('回収')` で再適用
- イベント再帰発火防止: 接頭辞が欠落している場合のみ書き込む

### 2.5 縮退

依存システム（Git、タスク管理システム）が不在の場合、ツールは例外を投げず、以下の形式で skip 状態を返す。

```typescript
type DegradedResult = {
  output: string;
  metadata: { skipped: true; reason: string };
};
```

- キー名は固定
- 縮退の判断と後続処理のスキップはスキル側の責務

## 3. Instruction レイヤー

### 3.1 `instructions/session-status.md`

エージェントはセッション開始時に以下の基準でコンテキスト収集の要否を判断する。

**デフォルト動作**: コンテキストを収集する。

**スキップ条件**（以下のいずれかに該当する場合、収集をスキップ）:

| 条件                         | 例                                   |
| ---------------------------- | ------------------------------------ |
| 単一ファイルの機械的編集     | 「この変数名を変更して」             |
| 自己完結的コマンドの実行     | 「`npm install` を実行して」         |
| 純粋な情報照会               | 「`git log` の結果を教えて」         |
| 構文上の修正                 | 「このコードを lint に従って直して」 |
| 単一の git 操作              | 「`git stash` して」                 |
| 機械的なテスト生成・修正依頼 | 「この関数のテストを書いて」         |

**強制収集条件**（以下のいずれかに該当する場合、常に収集する）:

| 条件                       | 例                                     |
| -------------------------- | -------------------------------------- |
| 漠然とした指示             | 「ログイン機能を実装して」             |
| 作業継続を示唆する語を含む | 「続きをやって」「resume」「引き続き」 |

**収集する情報**:

| 情報源                               | 内容                                          |
| ------------------------------------ | --------------------------------------------- |
| `git status`                         | ワーキングツリーの状態                        |
| `git log`                            | 直近のコミット履歴                            |
| タスク管理システム（不在時スキップ） | 進行中タスクの `📍 Next Action`、`📝 Worklog` |

## 4. Skill レイヤー

### 4.1 `skills/session-close/SKILL.md`

ユーザーが `/session-close` コマンドを実行したときに呼び出される。

**処理フロー**:

1. **WIP コミット**: ワーキングツリーに変更があれば `git add -A && git commit -m "wip: <session-slug>"` を実行
2. **タスク管理システム更新**（不在時スキップ）: タスク管理スキルを呼び出し、`📝 Worklog` に要約を追記、`📍 Next Action` を更新
3. **ADR 候補抽出**（不在時スキップ）: セッションログから ADR に値する判断を抽出し、`docs/adr/` に Proposed として作成
4. **git notes 付与**（タスク管理システムのコミットがある場合）: `session_add_note(commit, JSON.stringify({ session: "<slug>" }))` を実行
5. **セッションタイトル更新**:
   - `session_title(title)` で適切なタイトル本文を設定
   - `session_mark('完了')` で `【完了】` 接頭辞を付与

### 4.2 `skills/session-recovery/SKILL.md`

Plugin の `session.created` フックから回収セッションとして spawn されたときに呼び出される。

**全体フロー**:

1. **放置セッションの解析**: 指定された放置セッションのログを読み込み、作業内容を要約
2. **タスク管理システム更新**（不在時スキップ）: タスク管理スキルを呼び出し、作業記録を追記
3. **ADR 候補抽出**（不在時スキップ）: セッションログから ADR 候補を抽出
4. **セッションタイトル更新**: 放置セッションのタイトルに `【完了】` 接頭辞を付与
5. **自己終端**: 回収セッション自身のタイトルを `session_title(title)` + `session_mark('完了')` で更新

**注意**: 回収セッションでは WIP コミットを作成しない。未コミット変更はそのまま残る。ユーザーは次回セッション開始時に `git status` で確認できる。

**放置セッションの検出アルゴリズム**

外部ファイルや二重管理を避け、OpenCode 自身が持つデータを唯一の情報源（SSoT）として放置セッションを判定する。`time.updated` はユーザー意図の中断ではなく、OpenCode セッション更新時刻に基づく操作的近似である。判定条件は以下のとおり。

1. タイトルが `【完了】`、`【中断】`、`【回収】` のいずれかの接頭辞で始まる → スキップ
2. `time.created` が導入 epoch 以前 → スキップ（導入前セッション）
3. `SessionStatus` が `busy` または `retry` → スキップ（稼働中）
4. `now - time.updated > 3h` → 回収対象
5. 上記を満たすセッションが複数ある場合、`time.updated` が最古の 1 件を選択

1 回のスイープで回収するのは 1 セッションのみ。複数の放置セッションがある場合は次回以降のユーザーセッションで順次処理される。

## 5. Command レイヤー

### 5.1 `commands/session-close.md`

`/session-close` コマンドは `skills/session-close/SKILL.md` の処理フローを起動する。完了後、ユーザーにセッション終了を通知する。

## 6. データ形式

### 6.1 `.opencode/.recovery.lock`

回収セッションの排他制御に用いるロックファイル。

**形式**: JSON

```json
{
  "recovery_session_id": "ses_xxxxxxxxxxxx",
  "started_at": 1785045796164,
  "ttl_ms": 600000
}
```

| フィールド            | 型     | 説明                                                 |
| --------------------- | ------ | ---------------------------------------------------- |
| `recovery_session_id` | string | 回収を実行中のセッション ID                          |
| `started_at`          | number | 回収開始時刻（エポック ms）                          |
| `ttl_ms`              | number | ロック有効期間（ミリ秒）、デフォルト 600000（10 分） |

**ロック状態の判定**（回収スイープ時に評価）:

| 条件 | 判定 |
| --- | --- |
| 対象セッションの `SessionStatus` が `busy` または `retry` | TTL に関係なくスキップ（稼働中として信頼） |
| `SessionStatus` が `idle` または 404 かつ `now - started_at > ttl_ms` | stale とみなし、上書きして再 spawn する |
| `SessionStatus` が `idle` または 404 かつ `now - started_at <= ttl_ms` | スキップ（正常完了直後とみなす） |

※ クラッシュの場合は TTL 超過後に次回セッションで検出されるため、安全側に倒れる。

### 6.2 `.opencode/.recovery-epoch`

セッション管理システム導入以前のセッションを回収対象から除外するためのタイムスタンプファイル。

**形式**: 単一行のエポックミリ秒（整数）

```
1785045796164
```

- 初回起動時に現在時刻を記録
- `time.created` が epoch 以前のセッションは回収対象外
- ファイルが削除されても、`【完了】`/`【中断】` 接頭辞が付与された回収済みのセッションは保護されるため安全側に倒れる

## 7. 縮退設計

### 7.1 依存システム不在時の挙動

| 不在システム | 影響を受ける機能 | 挙動 |
| --- | --- | --- |
| Git リポジトリ (`./.git`) | WIP コミット、git notes | `session_add_note` は `{ output: "...", metadata: { skipped: true, reason: "git repository not found" } }` を返す。skill は skip を検出し、コミット・notes 関連処理をスキップ |
| タスク管理システム (`tasks/`) | コンテキスト収集、タスク更新 | instruction 判断でスキップ。skill はタスク更新処理をスキップ |
| ADR 管理システム (`docs/adr/`) | ADR 候補抽出 | skill は ADR 抽出処理をスキップ |

### 7.2 Plugin ツールの縮退条件

| ツール | 縮退条件 | 戻り値 |
| --- | --- | --- |
| `session_title` | なし（OpenCode API のみに依存） | — |
| `session_mark` | なし（OpenCode API のみに依存） | — |
| `session_add_note` | `./.git` 不在、または指定コミットが存在しない | `{ output: "...", metadata: { skipped: true, reason: "..." } }` |

### 7.3 スキルの縮退対応

スキルはツールの戻り値 `metadata.skipped === true` を検出した場合、該当する処理をスキップし、残りの処理を継続する。縮退による部分実行は正常動作の一部であり、エラーではない。

## 8. 関連文書

| 文書 | 関係 |
| --- | --- |
| `docs/design/session-management-system.md` | 上位にあたる基本設計書 |
| `docs/adr/007-session-lifecycle.md` | セッションライフサイクルの判断根拠 |
| `docs/adr/008-session-traceability.md` | トレーサビリティの判断根拠 |
| `docs/adr/009-session-recovery.md` | 回収アーキテクチャの判断根拠 |
| `docs/adr/013-session-recovery-detailed-design.md` | 回収機構の詳細設計判断 |
| `docs/adr/014-session-management-plugin-architecture.md` | プラグインアーキテクチャの詳細設計判断 |
