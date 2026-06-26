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

- The target documentation file path must be provided by the user.
- The document type (`README`, `AGENTS`, `SKILL`, or `other`) must be specified by the user.
- The `@doc-reviewer` subagent must be available.
- The target file must exist and be readable.

## Workflow

### Step 1: Read target file

Read the content of the user-specified target file.

### Step 2: Call reviewer

Call `@doc-reviewer` with:

- the file content
- the audience-specific addendum below (matching the user-specified type)

If no findings are returned, inform the user that the document meets all criteria and proceed directly to Step 7 (Complete).

### Step 3: Propose

Present findings to the user. For each finding, ask whether to:

- Apply the suggested fix
- Apply with modification
- Dismiss (with reason)

### Step 4: Apply

Edit the file according to accepted findings.

### Step 5: Verify

Call `@doc-reviewer` on the modified file. Include context from the previous discussion: which findings were dismissed and why, and which were applied with modifications.

### Step 6: Iterate

If new findings remain, return to Step 3. **Maximum 3 rounds.** After round 3, present any remaining unresolved items. Ask the user whether to apply them (and perform a final edit) or skip them, then proceed directly to Step 7.

### Step 7: Complete

Print a session summary (format TBD — see TODO.md).

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
