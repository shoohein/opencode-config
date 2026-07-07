---
name: review-cycle
description: Iterative code/doc review with subagents, user decisions, and verification
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: review
---

## What I do

Submit a file to the appropriate reviewer subagent, present structured findings, iterate with the user on which issues to fix, execute fixes, verify, and optionally run a final review round.

## When to use me

Use when the user asks to review a file, says "@reviewer-name review file", or invokes this skill directly.

## Scope

- Modifies files only during the fix execution step, and only on user approval.
- Does not create or delete files unrelated to the review.
- Does not merge or commit — leaves that to the user.

## Preconditions

- The target file exists and is readable.
- A matching reviewer subagent exists for the file type.
- The user has write permission to the file.

## Workflow

### Step 1: Identify file type and select reviewer

**Normal flow:**

From the user's message or argument, determine the target file path. Map the file extension to the appropriate reviewer:

| Extension | Reviewers |
| --- | --- |
| `.sh`, `.py`, `.js`, `.go`, `.rs`, `.ts`, `.tsx` | `code-design-reviewer`, `code-logic-reviewer`, `code-security-reviewer` |
| `SKILL.md` | `doc-reviewer`, plus `create-skill` compliance check |
| `.md` (non-skill docs) | `doc-reviewer` |
| other | Ask the user which reviewer(s) to use |

If unsure about the file path, ask the user.

**Exceptions:**

- File not found → report and stop.
- Unknown extension with no user guidance → ask the user for one or more reviewer subagents.

### Step 2: Run the first review round

**Normal flow:**

For the primary reviewer (the first one listed for the file type), call the subagent with a clear prompt that includes the file path and review focus. Receive findings as structured markdown.

For shell scripts (`.sh`), run at minimum `code-design-reviewer`, `code-logic-reviewer`, and `code-security-reviewer`. For skill docs (`SKILL.md`), run `doc-reviewer` plus verify against `create-skill`'s two-layer workflow format.

Present findings to the user grouped by severity (critical → major → minor). For each finding, show:

- file:line reference
- severity
- a concise description of the issue
- a concrete fix suggestion

**Exceptions:**

- Subagent returns no findings → report "no issues found". Optionally suggest a different reviewer.
- Subagent errors (tool failure, timeout) → retry once, then report the error and stop.

### Step 3: Let the user decide

**Normal flow:**

For each finding, the user can:

- **Accept**: include it in the fix plan.
- **Reject**: the finding is invalid or not worth fixing.
- **Skip**: (YAGNI) the finding is valid but low priority for now.
- **Discuss**: ask for clarification about the trade-offs.

If the user says "All accepted" or equivalent — treat all findings as accepted. If the user selects specific findings — apply only those.

If a finding involves a design trade-off, present both sides concisely (pros/cons) and recommend one approach.

**Exceptions:**

- User disagrees without clear rationale → ask clarifying questions: "Is this because it conflicts with another requirement, or do you disagree with the premise?"
- Discussion leads to a modified fix (not exactly what the reviewer suggested) → capture the modified plan.

### Step 4: Plan and execute fixes

**Normal flow:**

Switch to plan mode. Present the accepted fixes as a structured plan:

```
## File <path> Fix Plan

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
```

Use the two-layer format for edits: first present the plan, then ask "Proceed with these fixes?" Get explicit user approval before making any changes.

On approval, apply all fixes. Make one edit per issue for traceability.

**Exceptions:**

- Fix causes unexpected issues (e.g., shell syntax error) → fix the regression immediately and report.
- Cannot apply fix (e.g., the expected code pattern no longer matches) → report the discrepancy and ask the user for guidance.

### Step 5: Verify

**Normal flow:**

After applying all fixes, verify the result:

- For scripts (`.sh`): run a quick smoke test (`help` output, basic create/move cycle).
- For code (`.ts`): check lint and typecheck.
- For docs (`.md`): re-read the file and confirm no broken formatting.

Report verification results to the user.

**Exceptions:**

- Verification fails → report the failure, note what changed, and suggest a rollback or further fix.
- No verification tool available → read the file and confirm edits are syntactically consistent.

### Step 6: Final review (optional)

**Normal flow:**

Ask the user: "Want a final review round with the same reviewer to confirm fixes are applied correctly?"

- Yes → re-run Step 2 with the same reviewer. If only minor issues remain, apply and skip Step 3.
- No → report completion.

**Exceptions:**

- Final review reveals new critical issues → loop back to Step 3 (user decision).
- Final review passes (no remaining issues or only cosmetic ones) → report completion.

### Step 7: Report

**Normal flow:**

Show a summary:

- File reviewed: `<path>`
- Reviewers used: `<list>`
- Rounds: `<number>`
- Issues found: `<N> (accepted), <M> (rejected/skipped)`
- Verification: `<status>`

Ask: "Ready to commit, or continue with another file?"
