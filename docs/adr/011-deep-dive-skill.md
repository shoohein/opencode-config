---
status: Proposed
date: 2026-07-25
tags:
  - skill
  - agent
  - planning
---

# ADR 011: 対話オーケストレーションスキル `deep-dive`

## コンテキスト

ADR 007 によりセッションは stateless 運用と定められたが、セッション開始時にユーザーの曖昧な要求を具体化するための機構は定義されていなかった。

現状、Plan agent は計画の提案はできるが、ユーザーの提案に対する批判的検証は行わない。`critical-thinking.md` の指示は「盲目的にユーザーの提案に従うな」と言うにとどまり、構造的な反証や段階的な議論の深化を義務づけてはいない。

問題点:

- ユーザーの初期要求が曖昧なまま実装に進むと、手戻りが大きい
- Plan agent の「計画を出すだけで終わる」モードでは、議論による要求の解像度向上が起こらない
- セッション中盤で複雑なサブタスク（サブエージェントへの委譲など）が発生した際にも、課題整理の仕組みが必要

## 関連 ADR

- **ADR 001:** スキル設計原則 — deep-dive は静的依存を持たず、description が宣言的で unique である
- **ADR 003:** コマンド設計原則 — deep-dive は `/deep-dive` コマンドでトリガーされる
- **ADR 007:** セッションライフサイクル — deep-dive はセッション状態を永続化しない
- **ADR 012:** 本スキルが呼び出す theorist / pragmatist エージェントの設計

## 判断

### 1. スキル + コマンドトリガー

- **決定:** deep-dive を Plan agent の指示への埋め込みではなく、OpenCode の skill として実装し、`/deep-dive` コマンドで起動する。コマンドは `$ARGUMENTS` を取らず、現在の会話コンテキスト全体を入力とする。
- **理由:**
  - 埋め込み方式では、軽量タスク（コミット、単行編集）でも deep-dive のオーバーヘッドがかかる
  - 自動ロード（Plan agent が「これは deep-dive が必要だ」と判断する）はトリガー判断の信頼性に問題がある
  - コマンド方式は「ユーザーはいつ使うべきか知っている」という前提に立ち、誤発動がない
- **代替案:**
  - Plan agent の常駐指示への埋め込み — 没理由: 軽量タスクでのオーバーヘッド。議論促進の文脈が不要なケースでノイズになる
  - 自動ロード — 没理由: トリガー判断が曖昧。「ただの計画」と「deep-dive」の区別はエージェントに任せるよりユーザーに任せる方が確実
  - v0.1 縮小版（theorist/pragmatist 召喚のみ） — 没理由: 議論促進の本質が抜け落ちる。アドバイザー召喚だけでは批判的対話の仕組みが欠ける
- **トレードオフ:** ユーザーがコマンドの存在を知っている必要がある。コマンド名にキャッチーな名前（`deep-dive`）を採用することで発見可能性を補う

### 2. Plan Frame による内部状態管理

- **決定:** 議論の進捗を管理するために、以下の Plan Frame を内部状態として維持する:

  ```
  goal:        what to achieve (1-2 sentences)
  context:     relevant codebase, constraints (short paragraph)
  candidates:  viable approaches considered (minimum 2, with outline + pros + cons)
  approach:    selected approach + reason for selection
  steps:       ordered implementation steps (minimum 2 concrete actions)
  unknowns:    items needing investigation, each with what is unknown and why
  risks:       known risks, each with what and mitigation
  answer:      ready / not_ready
  ```

  すべてのフィールドに実質的な内容が埋まり、かつ `answer` が `ready` になった時点を議論の収束と判定する。一語エントリは「実質的な内容」とはみなさない。

- **理由:**
  - 非構造的な会話だけでは、収束判定が主観的になり、theorist/pragmatist の呼び出しタイミングが早すぎたり遅すぎたりする
  - 構造化されたフレームが LLM 自身の「議論が足りているか」の自己チェックを可能にする
  - フレームは内部用であり、議論中にユーザーに提示しないことで、会話の自然さを損なわない
- **代替案:** ADR の Decision Frame を流用 — 没理由: ADR は決定の記録であり、deep-dive が作るのは実装計画である。candidates / steps の違いが重要
- **トレードオフ:** フレームの維持はエージェントの内部処理であり、ユーザーからは見えない。フレームが正しく更新されているかの検証手段がない

### 3. 反証の義務化

- **決定:** スキルの Step 4（Iterative discussion）において、ユーザーの回答に対しリスク・矛盾・見過ごされたトレードオフを指摘する。ユーザーの反論が合理的であれば受け入れ、真正な矛盾が残る場合のみ再提起する。
- **理由:** `critical-thinking.md` は「盲目的に従うな」と言うが「構造的に反証せよ」とは言っていない。deep-dive はこれを義務化することで、Plan agent の常駐指示とは差別化された価値を提供する
- **代替案:** 反証なしの単純な質疑応答 — 没理由: Plan agent の既存機能と差別化されず、deep-dive の存在意義が薄れる
- **トレードオフ:** 過剰な反証がユーザーを疲弊させるリスクがある。ユーザーが「終わり」と言った時点で議論を終了する設計で緩和する

### 4. 成果物の非生成

- **決定:** deep-dive の成果物は計画そのものであり、ファイル（ADR、設計書、contexts/ メモ）は生成しない。ファイル化の要否と形式はユーザーの後続判断に委ねる。
- **理由:**
  - 成果物の形式を固定すると、他プロジェクトでの再利用性が損なわれる
  - ADR が必要なら `/create-adr`、設計書が必要なら別途指示 — 責務の分離が明確になる（Unix philosophy: Do one thing well）
- **代替案:** ADR または設計書を自動生成 — 没理由: スキルが複数の責務を持つことになり、ADR 001（skills as commands）の原則に反する
- **トレードオフ:** ユーザーが計画をファイル化する手間が発生する。Step 6 で関連コマンドを案内することで軽減する

## 検討した代替案

- **Plan agent の指示への埋め込み:** 全セッションで議論ワークフローが常駐し、軽量タスクのオーバーヘッドになる。ユーザーは「議論せずに実装してほしい」ケースが多数あり、常駐は過剰
- **v0.1 縮小版（theorist/pragmatist 召喚のみ）:** アドバイザー召喚は便利だが、批判的対話の仕組みが欠落する。deep-dive の価値の大部分は議論促進にある

## 結果

### ポジティブ

- Plan agent では実現できない構造的な批判的対話が可能になる
- Plan Frame により収束判定が客観的になり、theorist/pragmatist 呼び出しの質が向上する
- 成果物を生成しないことで、既存のエコシステム（create-adr, 設計書作成）と自然に統合される
- コマンドトリガーにより、軽量タスクのオーバーヘッドがゼロ

### ネガティブ

- 6 ステップのワークフローは相応のトークン消費を伴う
- Plan Frame が正しく維持されるかは LLM の実行品質に依存する
- ユーザーがコマンドの存在を認識している必要がある

## 関連文書

| 文書                                | 関係                               |
| ----------------------------------- | ---------------------------------- |
| `skills/deep-dive/SKILL.md`         | 本 ADR の判断を実装するスキル定義  |
| `skills/create-skill/SKILL.md`      | deep-dive の作成に使用されたスキル |
| `instructions/critical-thinking.md` | deep-dive が拡張する反証の指示     |
