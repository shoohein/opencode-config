---
name: session-recovery
description: Recover context from an abandoned session.
license: MIT
compatibility: opencode
---

## What I do

Analyze an abandoned session's log, summarize findings, update task records, extract ADR candidates, and mark both the abandoned and recovery sessions as complete.

## When to use me

Call this skill when:

- Plugin's `session.created` hook spawns a recovery session (automatic).
- User manually invokes `/session-recover` with a target session ID (testing/debugging).

## Scope

- Operates on the target abandoned session and the current recovery session.
- Does not create WIP commits (§4.2 of detailed design — uncommitted changes are left for the user).

## Preconditions

- Plugin `session-management` must be loaded for `session_title`, `session_mark`, and `session_read_log` tools.
- `$` shell is available for git operations (optional, for status reporting).
- Task management and ADR systems may be absent — graceful skip.

## Workflow

### Normal flow

1. **Read recovery session log**: Call `session_read_log({ targetSessionId })` to retrieve the abandoned session's message history. Parse the returned JSON array of entries with `role`, `text`, `thinking`, `tools` fields.
2. **Present summary**: Analyze the log and present a concise summary of:
   - What work was in progress
   - Completed tasks vs. pending items
   - Key decisions made
3. **Apply changes**: If the log contains actionable decisions (e.g., file modifications, configuration changes), re-apply them to the current workspace.
4. **Mark abandoned as complete**: Call `session_mark('完了')` on the abandoned session's ID.
5. **Self-terminate**: Call `session_title(<summary>)` then `session_mark('完了')` on the recovery session.
6. **Notify**: Inform the user of the recovery result.

### Exceptions

- _No data_ (`session_read_log` returns empty array) → Log a warning, mark as complete, and exit.
- _Read failure_ → Log the error and abort; abandoned session is left intact for manual handling.
- _No actionable changes found_ → Skip Step 3, continue with remaining steps.
- _API call fails_ → Surface the error and abort.
