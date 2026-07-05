---
name: task-start
description: Move a task from pending/ to in_progress/
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: task
---

## What I do

Move a task from `tasks/pending/` to `tasks/in_progress/` and present its context for the user to begin work.

## When to use me

Use when the user says "start task" or "begin task", or invokes `/task-start`.

## Scope

- Moves exactly one task from `pending/` to `in_progress/` (if already in_progress, just presents context).
- Warns if other tasks are already in progress.
- Does not modify the task content — moving and context presentation only.

## Preconditions

- The target task exists in `pending/` or `in_progress/`.
- The task file is writable (required for `task_move`; only the context-presentation branch can proceed without write access).
- Invalid task ID → report error and stop.
- Ambiguous match (multiple files for the same ID) → report error and stop.

## Workflow

### Step 1: Identify the task

**Normal flow:**

If `$ARGUMENTS` is provided with a task ID (extract the first 3-digit number; any other input is ignored):

- If the task is in `pending/` → use it directly.
- If the task is already in `in_progress/` → inform the user and present context directly without moving. Skip to Step 4.
- If the task is in another state (`done/`, `canceled/`) → inform the user and stop. Starting from these states is not supported.

If `$ARGUMENTS` is empty:

- Call `task_list({ dir: "pending" })`.
- If exactly one pending task → confirm with the user before using it.
- If multiple → present the list and ask which to start.
- If none in pending → report that no tasks are available to start and stop.

**Exceptions:**

- Task not found at all → report error and stop.
- Task already in `done/` or `canceled/` → report and stop.

### Step 2: Warn about concurrent tasks

**Normal flow:**

Call `task_list({ dir: "in_progress" })`.

- If N > 0 tasks are already in progress → warn the user about concurrent tasks, list them, and ask whether to proceed anyway. (y/N)
- If user says no → stop.
- If user says yes → proceed.

**Exceptions:**

- N = 0 → proceed silently.

### Step 3: Move to in_progress

**Normal flow:**

Call `task_move({ id, target: "in_progress" })`.

**Exceptions:**

- `task_move` fails → report the error and stop.

### Step 4: Present context

**Normal flow:**

Call `task_progress({ id })` to get subtask counts. Read the task file. Present:

```
Started task [ID]: [description]
  Subtasks: [N/M completed = X%]
  [list unchecked subtasks if any]
```

If the task has a `📍 Next Action` section with content, show it as the suggested starting point.

If no subtasks and no Next Action: report that no subtasks or Next Action are configured and suggest the user inspect the task file directly.

**Exceptions:**

- Task file cannot be read after move → report that the move succeeded but the task file could not be read, and suggest manual verification.
- `Next Action` section is malformed or unparseable → skip it, show other context normally.
- Progress calculation fails → show "progress unavailable" for subtasks, continue with description.
