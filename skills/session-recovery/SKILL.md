---
name: session-recovery
description: Recover context from an abandoned session.
license: MIT
compatibility: opencode
---

## What I do

- Analyze an abandoned session's log
- Summarize findings
- Update task records
- Extract ADR candidates
- Mark both the abandoned and recovery sessions as complete

## When to use me

Call this skill when:

- The plugin's `session.created` hook spawns a recovery session (automatic).
- The user manually invokes `/session-recover` with a target session ID (testing/debugging).

## Scope

- Operates on the target abandoned session and the current recovery session.
- Does not create WIP commits — uncommitted changes are left for the user.

## Preconditions

### Required

- Plugin `session-management` must be loaded for `session_title`, `session_mark`, and `session_read_log` tools.

### Optional

- The `$` shell (OpenCode built-in) is available for git operations (for status reporting).
- Task management and ADR systems may be absent — if absent, the corresponding step is skipped.

## Workflow

### Step 1: Read abandoned session log

**Normal flow:** Call `session_read_log` with the abandoned session ID. Parse the returned JSON array of entries with the `role`, `text`, `thinking`, and `tools` fields.

**Exceptions:**

- No data (empty array) → log a warning, mark the recovery session as complete with `session_mark` (`完了`), and exit.
- Read failure → log the error, mark the recovery session as complete with `session_mark` (`完了`), and exit. Leave the abandoned session untouched.

### Step 2: Present summary

**Normal flow:** Analyze the log and present a concise summary of:

- What work was in progress
- Completed tasks vs. pending items
- Key decisions made

**Exceptions:**

- Summary generation fails → skip this step, continue.

### Step 3: Task management update

**Normal flow:** Call the task management skill to append the summary to Worklog and update Next Action.

**Exceptions:**

- Task management system absent → skip this step.
- Update fails → skip this step, continue.

### Step 4: ADR candidate extraction

**Normal flow:** Scan the session log for architecturally significant decisions, create ADR candidates as Proposed in `docs/adr/`.

**Exceptions:**

- ADR system absent → skip this step.
- Extraction fails → skip this step, continue.

### Step 5: Mark abandoned session as complete

**Normal flow:** Call `session_mark` with `完了` on the abandoned session's ID.

**Exceptions:**

- API call fails → surface the error, mark the recovery session as complete with `session_mark` (`完了`), and exit.

### Step 6: Set recovery session title

**Normal flow:** Call `session_title` with the summary from Step 2.

**Exceptions:**

- API call fails → surface the error and abort.

### Step 7: Mark recovery session as complete

**Normal flow:** Call `session_mark` with `完了` on the recovery session.

**Exceptions:**

- API call fails → surface the error and abort.

### Step 8: Notify

**Normal flow:** Inform the user of the recovery result.
