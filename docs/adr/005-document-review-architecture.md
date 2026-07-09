---
status: Proposed
date: 2026-07-09
tags:
  - architecture
  - agent
  - documentation
---

# ADR 005: ドキュメントレビュー基盤

## コンテキスト

プロジェクトのドキュメント品質を継続的に保証するため、ドキュメントをレビューするエージェント群の設計方針を確立する。対象は LLM が生成するプロジェクト内の全技術文書: `docs/`（ADR, 設計書, 開発ガイド, ユーザーガイド）、`instructions/`、`skills/*/SKILL.md`、`agents/*.md`、`AGENTS.md`、`README.md` 等。

問題点：

- `documentation-policy.md` が 6 原則（Structured / Cohesive / Clarity / Minimal / Completeness / Consistency）を定義しているが、レビュー主体が存在しない。
- 単一のレビューエージェントでは 1 パスでの全原則チェックに限界があり、見落としやノイズが増える。
- 実装者とレビュー担当者が共有する品質基準が明示されていない。

## 関連 ADR

- **ADR 001:** スキル設計原則
- **ADR 002:** エージェント設計 — 本 ADR のエージェント構成は同 ADR の 3 層アーキテクチャ（Role / Input / Output）および Criteria セクション拡張に従う
- **ADR 004:** 自問形式レビュアーアーキテクチャ — 本 ADR のエージェント Criteria は同 ADR の問い形式に従う

## 検討した代替案

### A: 3 軸（準拠性 / 表現品質 / 構成）

`document-style-reviewer` + `document-expression-reviewer` + `document-structure-reviewer`。没理由: style と expression の責務境界が日本語文書において曖昧で、出力の重複が避けられない。

### B: 2 軸 + 内容チェック

`document-language-reviewer`（文法・文体）+ `document-structure-reviewer`（構成・論理）+ `document-content-reviewer`（正確性・矛盾）。没理由: content-reviewer は事実確認が必要なため難易度が高く、設計段階のドキュメントでは判断材料不足でノイズが多くなる。

### C: 6 原則の 3 グループ化

`document-structure-reviewer`（Structured + Cohesive）+ `document-clarity-reviewer`（Clarity + Minimal）+ `document-completeness-reviewer`（Completeness + Consistency）。採用候補: 6 原則を相互排他的に分割でき重複が原理的に発生しない。ただし表層レイヤー（誤字脱字・文法）の受け皿がない。

### D: 最小化（1 エージェント）

`document-reviewer`（6 原則すべてを 1 パスでチェック）。没理由: プロンプトが長大化し 1 パスでの全原則見落としリスクが高い。

## 判断

### 1. 4 レイヤー 5 エージェント構成

- **決定:** 代替案 C を採用しつつ、表層レイヤーとして grammar-reviewer を新設。さらに日本語/英語の 2 エージェントに分割し、計 5 エージェント構成とする。

  ```
  表層   doc-grammar-jp-reviewer / doc-grammar-en-reviewer
  構造   doc-structure-reviewer  （Structured + Cohesive）
  表現   doc-clarity-reviewer    （Clarity + Minimal）
  意味   doc-completeness-reviewer（Completeness + Consistency）
  ```

- **代替案:** grammar-reviewer を 1 つに統合し多言語対応させる（没）。言語固有のルール（送り仮名と冠詞の違い、ら抜きと主述一致の違い）が混在すると criteria が肥大化し、レビュー精度が低下する。
- **理由:** 各レイヤーは完全に直交し、上位レイヤーが下位レイヤーの問題をノイズとして報告しない。grammar → structure → clarity → completeness の順に自然な積み上げとなる。

### 2. Severity: 3 段階

- **決定:** critical / major / minor の 3 段階を採用する。

  | severity     | 定義                                                     |
  | ------------ | -------------------------------------------------------- |
  | **critical** | 文書を誤読させる欠陥（矛盾、前提漏れ、誤解誘発）         |
  | **major**    | 認知負荷を有意に上げる問題（冗長、あいまい、構造非整合） |
  | **minor**    | 改善可能だが読解に支障なし（表記ゆれ、軽微な文末不一致） |

- **理由:** `code-*-reviewer` との対称性を保つ。doc 領域でも critical（例: 前提条件の脱漏で実装者が誤解する）は存在するため 2 段階では不足。

### 3. Output: 共通 YAML envelope

- **決定:** 全エージェントで統一された YAML 形式を出力する。

  ```yaml
  findings:
    - location: string
      issue: string
      severity: critical | major | minor
      suggestion: string
  ```

- **理由:** 人間可読性（markdown list ではなくインデント構造による明瞭な分離）と LLM による自然言語判断での集約（doc-review-cycle スキルによる）の両立。YAML は JSON より技術文書の読者に馴染み深く、インデントによる視認性が高い。

### 4. Cross-document consistency の委譲

- **決定:** 文書間の矛盾検出（例: ADR 002 と ADR 003 の記述不一致）は `doc-completeness-reviewer` の責務から外し、別途作成する `cross-doc-check` スキルに委譲する。
- **理由:** 単一エージェントの責務を「1 ファイルの内容から判断できること」に限定する。複数ファイル横断の比較はオーケストレーターの仕事であり、agent が自身の入力範囲を超えた他文書を読み込むと Do one thing well（Unix philosophy）に違反する。

### 5. エージェントと原則のマッピング

各エージェントは `documentation-policy.md` の 6 原則を以下のように担当する。詳細 criteria は各 agent 定義ファイル（`agents/doc-*-reviewer.md`）を authority とする。

| Agent | Layer | Principle |
| --- | --- | --- |
| `doc-grammar-jp-reviewer` / `doc-grammar-en-reviewer` | Surface | Language-specific surface checks |
| `doc-structure-reviewer` | Structure | Structured + Cohesive |
| `doc-clarity-reviewer` | Expression | Clarity + Minimal |
| `doc-completeness-reviewer` | Semantic | Completeness + Consistency |

grammar-reviewer は言語固有ルールのため日英 2 agent に分割した。表層 → 構造 → 表現 → 意味の積み上げにより、下位レイヤーの問題が上位レイヤーの判断を汚染しない。

### 6. Scope: LLM 生成技術文書

- **決定:** 本エージェント群は LLM が生成する技術文書全般を対象とする。対象外の文書種別（エッセイ、プレゼンテーション原稿、一般文書）に適用した場合のレビュー精度は保証しない。対象文書の具体例は `agents/README.md` に列挙する。
- **理由:** 各 criteria は技術文書の読み手（実装者、設計者）の認知負荷最小化を前提に設計されている。文体の硬さやフィラー排除（例: 無意味な前置き「なお」「ちなみに」の削除）といった判断基準は技術文書固有のものであり、他の文書種別では適切でない場合がある。

## 結果

### ポジティブ

- 5 エージェントの責務が完全に直交し、レビュー結果の重複とノイズが最小化される
- 表層→構造→表現→意味の積み上げにより、下位レイヤーの問題が上位レイヤーの判断を汚染しない
- 共通 YAML envelope により LLM による自然言語判断での集約が可能
- criteria が `documentation-policy.md` の品質基準と 1:1 対応し、検証可能性が高い
- `code-*-reviewer` との severity 体系の対称性により、プロジェクト全体で一貫したレビュー基準を維持

### ネガティブ

- エージェント数が 5 と多く、review-cycle でのオーケストレーション負荷が増加する
- cross-document consistency が agent スコープ外のため、文書間矛盾の完全な検出は `cross-doc-check` スキルの実装品質に依存する
- LLM の推論品質に依存するため、特に grammar-reviewer は非決定的な表記ゆれ判定を出す可能性がある

## 関連文書

| 文書                                      | 関係                                            |
| ----------------------------------------- | ----------------------------------------------- |
| `instructions/documentation-policy.md`    | 本 ADR が参照するドキュメント品質 6 原則        |
| `docs/adr/002-agent-design-principles.md` | エージェントのファイル構造と 3 層アーキテクチャ |
| `agents/doc-grammar-jp-reviewer.md`       | 本 ADR に基づく実装                             |
| `agents/doc-grammar-en-reviewer.md`       | 同上                                            |
| `agents/doc-structure-reviewer.md`        | 同上                                            |
| `agents/doc-clarity-reviewer.md`          | 同上                                            |
| `agents/doc-completeness-reviewer.md`     | 同上                                            |
| `skills/doc-review-cycle/SKILL.md`        | 本 ADR に基づくオーケストレーションスキル       |
