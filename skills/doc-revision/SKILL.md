---
name: doc-revision
description: Review and revise a user-specified documentation file using the doc-reviewer subagent
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: documentation
---

## What I do

Review a documentation file by calling `@doc-reviewer`, propose fixes, apply them with your approval, and verify the result.

## When to use me

Use this when a specific documentation file needs a quality pass.

## Scope

- Operates on **one file at a time**, specified by the user.
- The user must also specify the **document type** (one of: `README`, `AGENTS`, `SKILL`, `other`).

## Preconditions

- The target documentation file path must be provided by the user. Otherwise: ask the user for the file path.
- The document type (`README`, `AGENTS`, `SKILL`, or `other`) must be specified by the user. Otherwise: ask the user to specify the type.
- The `@doc-reviewer` subagent must be available. Otherwise: stop and report that the subagent is unavailable.
- The target file must exist and be readable. Otherwise: inform the user and stop.

## Workflow

### Step 1: Read target file

Read the content of the user-specified target file.

### Step 2: Call reviewer

Call `@doc-reviewer` with:

- the file content
- the audience-specific addendum below (matching the user-specified type)

If no findings are returned, inform the user that the document meets all criteria and proceed directly to Step 10 (Complete).

### Step 3: Propose

Present findings to the user. For each finding, ask whether to:

- Apply the suggested fix
- Apply with modification
- Dismiss (with reason)

### Step 4: Apply

Edit the file according to accepted findings.

### Step 5: Verify

Call `@doc-reviewer` on the modified file. Include context from the previous discussion: which findings were dismissed and why, and which were applied with modifications.

### Step 6: Check findings remaining

- If no new findings remain, proceed to Step 10.
- If new findings remain and review rounds < 3, return to Step 3.
- If new findings remain and review rounds >= 3, proceed to Step 7.

### Step 7: Escalate unresolved items

Present any remaining unresolved items to the user. For each, ask whether to:

- Apply the suggested fix
- Apply with modification
- Dismiss (with reason)

### Step 8: Final apply

Edit the file according to the user's decisions on escalated items.

### Step 9: Verify escalation edits

Call `@doc-reviewer` on the modified file. If new findings are returned, present them to the user with the same decision options as Step 7 (apply / modify / dismiss). Apply accepted changes, record dismissed findings with reasons, then rerun this step until no new findings remain. Once clear, proceed to Step 10.

### Step 10: Complete

Print a session summary using this exact format:

```yaml
session:
  target_file: "<path>"
  doc_type: "<README|AGENTS|SKILL|other>"
  outcome: "<no_findings|fixed|unresolved>"
  review_rounds: <1-3>
  verification_reruns: <0-n>
  verification: "<pass|pass_with_notes|fail>"

findings:
  total: <int>
  applied: <int>
  modified: <int>
  dismissed: <int>
  remaining: <int>

applied_changes:
  - id: "<finding-id>"
    summary: "<one-line summary>"
    verification: "<how it was checked>"

dismissed_findings:
  - id: "<finding-id>"
    reason: "<why it was dismissed>"

remaining_findings:
  - id: "<finding-id>"
    summary: "<what still needs work>"
    next_step: "<apply|modify|dismiss>"
```

## Audience-specific addenda

These are passed to `@doc-reviewer` in addition to its built-in six criteria.

### README (audience: human)

- The opening paragraphs convey project purpose, target reader, and first step.
- Setup instructions are copy-pasteable.

### AGENTS (audience: AI agent)

- Rules are expressed as concrete constraints (e.g., "Never X" / "Always Y"), not vague advice.
- No project description content that belongs in README has leaked in.

### SKILL (audience: AI agent)

- Steps are decomposed to single actions.
- Preconditions (required files, tools, or state) are stated explicitly.

### other

No additional criteria. Use the six built-in criteria only.
