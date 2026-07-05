---
name: task-cancel
description: Move a task to canceled/ with reason logging
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: task
---

## What I do

Move a task from its current state to `tasks/canceled/` after confirmation, optionally recording the reason in the Worklog.

## When to use me

Use when the user says "cancel task", "abandon", or "wontfix", or invokes `/task-cancel`.

## Scope

- Moves a task from pending, in_progress, or done (ID-only, with confirmation) to canceled/.
- Confirmation is always required — canceling changes task state and can leave dependent tasks blocked.
- Optionally records a cancellation reason in the Worklog.
- Does not delete data; canceled tasks remain readable for reference.
- Does not modify the task content beyond the optional Worklog entry.

## Preconditions

- The target task exists and is not already in `canceled/`.
- The task file is readable. Write access is required for `task_move` and (optionally) for logging the reason.
- Invalid task ID → report error and stop.
- Ambiguous match → report error and stop.

## Workflow

### Step 1: Identify the task

**Normal flow:**

If `$ARGUMENTS` is provided with a task ID:

- Use it directly.
- If the task is already in `canceled/` → report and stop.
- If the task is in `done/` → warn that the task is already done and ask whether to cancel anyway. (y/N)
  - If no → stop.
  - If yes → proceed.

If `$ARGUMENTS` is empty:

- Call `task_list({ dir: "pending" })` and `task_list({ dir: "in_progress" })`.
- Present the combined list and ask which task to cancel.
- If no tasks are available → report and stop.

**Exceptions:**

- Task not found → report error and stop.

### Step 2: Check dependency impact

**Normal flow:**

Before confirming, check if any pending tasks depend on this one:

- Read the YAML front matter of each pending task (from `task_list({ dir: "pending" })`).
- If any have `depends_on` containing this task's ID → warn that N pending tasks depend on this one, explain that canceling would leave them blocked, and ask whether to continue. (y/N)
  - If user says no → stop.
  - If user says yes → proceed.

**Exceptions:**

- Cannot read a pending task's front matter → skip that task, do not show it in the warning. If any tasks were skipped, add a note that some pending tasks could not be checked for dependency impact.

### Step 3: Confirm and record reason

**Normal flow:**

Show the task description and ask the user for final confirmation before canceling. (y/N)

If user says yes:

- Ask the user for an optional cancellation reason.
- If reason is provided → note it for Step 4.
- If reason is empty → proceed.

If user says no → stop.

### Step 4: Move and log reason

**Normal flow:**

If a reason was provided:

- Read the task file.
- Append to the `# 📝 Worklog` section: `- canceled at YYYY-MM-DD: [reason]`
- If the `# 📝 Worklog` section does not exist, append `# 📝 Worklog` at the end of the file, then add the reason line. Preserve all existing content unchanged.

Call `task_move({ id, target: "canceled" })`.

**Exceptions:**

- File read/write fails → mark `reason_logged = false` but still attempt `task_move`. The cancellation should not be blocked by a logging failure.
- `task_move` fails → report the error and stop. If a reason was already written to the file, note the partial state.

### Step 5: Report

**Normal flow:**

If reason was logged:

```
Canceled task [ID]: [description]
  Reason: [reason]
```

Else if reason provided but not logged due to write failure:

```
Canceled task [ID]: [description]
  Reason provided but not recorded (write failure). Reason: [reason]
```

Else:

```
Canceled task [ID]: [description]
  Reason: none
```

If this task had dependents as detected in Step 2: notify the user that dependent tasks remain blocked and suggest running `task-next` to reassess priorities.
