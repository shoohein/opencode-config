---
name: close-check
description: Run end-of-session checks to confirm safe session closure
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: session
---

## What I do

Run four checks at session end, report issues, and delegate fixes to existing commands/skills.

Checks:

1. **User requests vs actual work** — cross-reference the session conversation, `todowrite` state, and TODO.md for unaddressed items
2. **Git commit status** — detect uncommitted or untracked files
3. **TODO.md consistency** — cross-reference recent git activity with TODO.md for stale items
4. **Unexpected file changes** — detect files modified outside the session's scope

Each check only **detects** problems. Fixes are delegated to the user or existing tools.

## When to use me

Call this skill at the end of a session, or when the user signals intent to close (e.g., "close ok?").

## Scope

- Detection only — I report problems and suggest next actions, but do not fix them.
- Project formatting automation (pre-commit hooks, husky, CI) is out of scope.

## Preconditions

- The workspace is a Git repository.
- `TODO.md` is optional. If absent, the TODO consistency check is skipped.

## Workflow

### Step 1: Check user requests vs actual work

Read `todowrite` state, scan `TODO.md` for pending items, and review the session conversation for any requests the user made that have not been addressed.

This is a best-effort, LLM judgement. If confidence is low, present candidates to the user and ask.

- **No issues found** → proceed to Step 2.
- **Issues found** → present the list to the user. Ask whether to address them now or close as-is. If the user chooses to proceed anyway, record them in the summary under `issues` and continue to Step 2.

### Step 2: Check git commit status

Run `git status --porcelain`.

- **Clean** → proceed to Step 3.
- **Uncommitted or untracked files exist** → present the list to the user and suggest running `/branch` or the `git-commit` skill. After the user acknowledges, proceed to Step 3.

### Step 3: Check TODO.md consistency

If `TODO.md` does not exist, **skip** this step (record as `skipped`).

Run `git log --oneline -10` and `git diff --name-only HEAD~3..HEAD`. Cross-reference with `TODO.md`:

- Items in `Pending` that appear done → suggest moving to `Done` with the relevant commit hash.
- Completed items or new work not in `TODO.md` → suggest adding a new entry.

Present findings to the user and suggest running `/todo-update`. After the user acknowledges, proceed to Step 4.

### Step 4: Check unexpected file changes

Run `git diff --name-only` (working tree + staged) and `git ls-files --others --exclude-standard` (untracked).

Cross-reference the file list with the session conversation. Identify files that were seemingly modified outside the session's scope.

- **No unexpected files** → proceed to Step 5.
- **Suspicious files found** → present them to the user with a note about why each seems out of scope. Suggest `git restore <file>` or ask the user to confirm the file is intentional. After the user responds, proceed to Step 5.

### Step 5: Output summary

Print a YAML summary:

```yaml
session:
  outcome: ready_to_close | issues_found
  checks_passed: "2/4"

checks:
  user_requests: pass | fail
  git_status: pass | fail
  todo_consistency: pass | fail | skipped
  unexpected_changes: pass | fail

issues:
  - check: <check_name>
    detail: <what was found>
    suggested_action: <command, skill, or manual step>

next_steps:
  - <first concrete action>
  - <second concrete action>
```
