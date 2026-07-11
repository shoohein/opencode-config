---
status: Proposed
date: 2026-07-11
tags:
  - architecture
  - agent
  - reviewer
---

# ADR 006: コードレビューアーキテクチャ

## コンテキスト

ADR 005 はドキュメントレビュー基盤（doc-_-reviewer）の 4 レイヤー 5 エージェント構成を確立した。code-_-reviewer も同基盤（ADR 002 の Role/Input/Output/Criteria 分離、ADR 004 の自問形式）を引き継ぐが、コードレビューにはドキュメントと異なる制約がある:

- 機械的計測（行数、複雑度、ネスト深さ）は言語非依存ツールの得意領域であり、LLM に「美学」を問うべき領域ではない
- コードレビュアーが評価する項目（命名、制御フロー、正しさ、エラーハンドリング、エッジケース、セキュリティ、テスト品質）は局所的であり、単一ファイルの読み取りで完結する
- テスト実行の pass/fail は決定論的ツール（CI）の責務であり、AI は読んで判断する

## 関連 ADR

- **ADR 002:** エージェント設計原則 — 本 ADR は Role/Input/Output/Criteria 分離に従う
- **ADR 005:** ドキュメントレビュー基盤 — doc 版と対称な構成を取る
- **ADR 004:** 自問形式レビュアーアーキテクチャ — 各エージェントの Criteria は自問形式に従う

## 判断

### 1. 機械的計測を Criteria から除外する

- **決定:** code-reviewer の Criteria は「美学」を問うもののみとし、機械的計測（行数、複雑度、パラメータ数等）を含めない。機械的計測は言語非依存ツールの領域であり、AI エージェントが担うべきでない。
- **代替案:** 機械的計測を独立 reviewer とする（code-complexity-reviewer）。没 — 言語非依存ツールでも実現可能であり、AI にやらせる根拠がない。計測結果を元に美学判断をするとしても、計測そのものは LLM の不得意領域である。
- **理由:** LLM が得意でない機械的計測を Criteria に置くと「ツールが指摘するから短くした」という判断になり、ユーザーが求める「割れ窓となりいずれコードベースを破壊する臭いを感じ取る」判断と乖離する。code-reviewer に期待するのは「臭い」の感知であり、行数・複雑度の測定ではない。
- **トレードオフ:** 行数超過や過剰ネストなどの明らかな問題を Criteria で拾えなくなる。ただしこれらは linter / formatter で静的検出可能であり、コードレビュアーで扱うべき問題ではない。

### 2. 単一ファイル完結原則

- **決定:** code-reviewer は単一ファイル完結を基本とする。ファイル横断的な設計判断（モジュール境界違反、循環依存、層間結合）は architecture-reviewer の責務とする。
- **代替案:** code-reviewer を cross-module 対応とする。没 — 評価項目が局所的であるため cross-module まで広げると architecture-reviewer との責務境界が曖昧になり、各レビュアーの「Do one thing well」原則に反する。
- **理由:** code-reviewer が評価する項目はすべて局所的であり、単一ファイルの読み取りで完結する。cross-file に広げると architecture-reviewer（未作成）との責務境界が曖昧になり、レビュアー間の重複・判断のブレが生じる。また LLM の有限コンテキストウィンドウ内で判断精度を高めるためにも、コンテキストを 1 ファイルに制限する設計が適切である。
- **トレードオフ:** 単一ファイルを超える設計の問題（例: モジュール間の不適切な依存関係）はこのエージェント群では検出できない。検出には別途 architecture-reviewer の作成が必要となる。

### 3. テスト実行と検証の分離

- **決定:** code-testing-reviewer はテストを実行せず、コードを読んで評価する。テスト実行と pass/fail の検証は CI または pre-commit hook の責務とする。
- **代替案:** code-testing-reviewer にテスト実行権限を与える。没 — テスト実行は決定論的プロセスであり、環境依存・副作用を伴う。permission 設定も複雑になり、LLM の得意領域ではない。
- **理由:** テスト実行は決定論的なツール（CI、pre-commit hook）の領域であり、AI エージェントが担うべきでない。code-testing-reviewer の責務は「テストコードの設計品質」と「カバレッジのギャップ」の静的評価に限定する。
- **トレードオフ:** テストの実行結果（flaky test の検出、環境依存の障害）は code-testing-reviewer では評価できない。別途 CI パイプラインの整備が必要。

## 検討した代替案

- **機械的計測を独立 reviewer とする（code-complexity-reviewer）:** 判断 1 に含む
- **code reviewer を cross-module 対応とする:** 判断 2 に含む
- **code-testing-reviewer にテス実行権限を与える:** 判断 3 に含む
- **code-reviewer を doc-reviewer と区別せず、ADR 005 の 4 レイヤー構成をそのまま適用する:** コードにはドキュメントと異なる制約（機械的計測の不適合、テスト実行の分離）があるため、doc 版の構成をそのまま適用できない。没。

## 結果

### ポジティブ

- LLM の得意領域（判断・推論）と不得手領域（計測）が分離される
- 各 code-reviewer が単一ファイルに集中し、判断精度が高まる
- doc-reviewer（ADR 005）と対称な構成で保守性が高い
- テスト実行とテスト品質評価が分離され、各レイヤーが責務に集中できる

### ネガティブ

- 機械的計測の問題は別ツール（linter / formatter）に依存するため、ツール設定が不十分な環境では見落としが発生する
- cross-file 設計問題を検出するには architecture-reviewer の作成が別途必要
- code-testing-reviewer のみ Input が「テストファイル + ソースファイル」の 2 パスとなり、他 3 体と形式が異なる
- code-testing-reviewer の coverage gap 評価はテストコードとプロダクションコードの両方を読む必要があるため、Input の設計が複雑になる

## 関連文書

| 文書 | 関係 |
| --- | --- |
| `docs/adr/005-document-review-architecture.md` | doc 版レビューアーキテクチャ（対称） |
| `agents/code-design-reviewer.md` | 本 ADR に従って設計されたコードデザインレビュアー |
| `agents/code-logic-reviewer.md` | 同上、ロジックレビュアー |
| `agents/code-security-reviewer.md` | 同上、セキュリティレビュアー |
| `agents/code-testing-reviewer.md` | 同上、テストレビュアー |
