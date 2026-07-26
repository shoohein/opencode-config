---
name: session-close
description: Close the current session with status and context preservation.
license: MIT
compatibility: opencode
---

## What I do

- Commit WIP changes
- Update task records
- Extract ADR candidates
- Apply a status prefix to the session title

## When to use me

Call this skill when the user invokes `/session-close` with a reason argument (`completed` or `interrupted`).

## Scope

- Operates on the current session only.
- Does not affect sibling or child sessions.

## Preconditions

### Required

- Plugin `session-management` must be loaded for `session_title`, `session_mark`, and `session_add_note` tools.
- The `$` shell (OpenCode built-in) is available for git operations.

### Optional

- Task management (`tasks/`) and ADR (`docs/adr/`) systems may be absent — if absent, the corresponding step is skipped.

## Workflow

### Step 1: WIP commit

**Normal flow:** If `git status --porcelain` shows changes, run `git add -A && git commit -m "wip: <session-slug>"` (slug from `client.session.status()`).

**Exceptions:**

- Git not available → skip this step.
- Commit fails → skip this step, continue.

### Step 2: Task management update

**Normal flow:** Call the task management skill to append a summary to Worklog and update Next Action.

**Exceptions:**

- Task management system absent → skip this step.
- Update fails → skip this step, continue.

### Step 3: ADR candidate extraction

**Normal flow:** Scan the session log for architecturally significant decisions, create ADR candidates as Proposed in `docs/adr/`.

**Exceptions:**

- ADR system absent → skip this step.
- Extraction fails → skip this step, continue.

### Step 4: Git notes

**Normal flow:** If step 2 created a commit, call `session_add_note` with the commit hash returned by step 2 and `JSON.stringify({ session: "<slug>" })`.

**Exceptions:**

- Git not available → skip this step.
- No commit from step 2 → skip this step.
- Notes add fails → skip this step, continue.

### Step 5: Set session title

**Normal flow:** Call `session_title` with a summary of the session's work, auto-summarized from the session log.

**Exceptions:**

- API call fails → surface the error and abort.

### Step 6: Mark session status

**Normal flow:** Call `session_mark` with `完了` for completed or `中断` for interrupted sessions.

**Exceptions:**

- Invalid reason → show an error listing valid options (`completed`, `interrupted`).
- API call fails → surface the error and abort.
