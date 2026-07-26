---
name: session-close
description: Close the current session with status and context preservation.
license: MIT
compatibility: opencode
---

## What I do

Close the current session: commit WIP changes, update task records, extract ADR candidates, and apply a status prefix to the session title.

## When to use me

Call this skill when the user invokes `/session-close` command with a `reason` argument (`completed` or `interrupted`).

## Scope

- Operates on the current session only.
- Does not affect sibling or child sessions.

## Preconditions

- Plugin `session-management` must be loaded for `session_title`, `session_mark`, and `session_add_note` tools.
- `$` shell is available for git operations.
- Task management (`tasks/`) and ADR (`docs/adr/`) systems may be absent — their absence causes graceful skip (§7 of detailed design).

## Workflow

### Normal flow

1. **WIP commit**: If `git status --porcelain` shows changes, run `git add -A && git commit -m "wip: <session-slug>"` (slug from `client.session.status()`).
2. **Task management update** (skip if absent): Call the task management skill to append a summary to `📝 Worklog` and update `📍 Next Action`.
3. **ADR candidate extraction** (skip if absent): Scan session log for architecturally significant decisions, create ADR candidates as Proposed in `docs/adr/`.
4. **Git notes** (skip if absent): If task management committed, call `session_add_note` with `JSON.stringify({ session: "<slug>" })`.
5. **Session title update**: Call `session_title(<description>)` to set the title body, then `session_mark('完了')` for completed or `session_mark('中断')` for interrupted sessions.

### Exceptions

- _Invalid reason_ → Show error listing valid options (`completed`, `interrupted`).
- _Git not available_ → Skip WIP commit and git notes; continue with remaining steps.
- _Task/adr system not available_ → Skip the corresponding step and continue.
- _API call fails_ → Surface the error to the user and abort.
