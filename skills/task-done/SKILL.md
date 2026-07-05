---
name: task-done
description: Complete a task with completed_at tracking and dependency notification
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: task
---

## What I do

Move a task to done/, inject completed_at into its YAML front matter, and check whether its completion unblocks other pending tasks.

## When to use me

Use when the user says "done", "complete", "finish", or invokes `/task-done`.

## Scope

- Moves the file, injects the completion date, and verifies subtasks.
- Modifies subtask markers (`[ ]` → `[x]`) when subtasks are confirmed complete.
- Verifies completion only; does not execute new work. May mark already-complete subtasks as `[x]` when the implementation is present.
- The dependency notification is informational — the user decides whether to start the unblocked task.

## Preconditions

- The target task exists (any directory except done/).
- The task file is writable.
- Invalid task ID → report error and stop.
- No matching task for the provided ID → report error and stop.
- Task already in `done/` → report and stop.
- Task in `canceled/` → confirm with user before moving to done.
- Ambiguous match (multiple files for the same ID) → report error and stop.

## Workflow

### Step 1: Identify the task

**Normal flow:**

- User provided a task ID → use it.
- No ID, exactly one in `in_progress` → confirm with the user, then use it.
- No ID, multiple in `in_progress` → ask the user which one.
- No ID, none in `in_progress` → ask the user to specify a task.

**Exceptions:**

- No in_progress tasks but user specified an ID in another state → confirm they want to mark that task as done.

### Step 2: Verify subtasks

**Normal flow:**

Read the task file. Verify all subtasks are `[x]`. Proceed to Step 3.

**Exceptions:**

- Unchecked subtasks remain → check if already implemented, mark `[x]` if so. Otherwise list them to the user. Do NOT move the task to done.
- No subtasks found → proceed to Step 3.
- Task file is unreadable → report error and stop.

### Step 3: Move to done

**Normal flow:**

Call `task_move({ id, target: "done" })`. This adds `completed_at: YYYY-MM-DD` to the YAML front matter and moves the file to `tasks/done/`.

**Exceptions:**

- `task_move` fails → report the error and stop.

### Step 4: Check unblocked dependencies

**Normal flow:**

Run `task_list({ dir: "pending" })` to see all pending tasks. For each pending task with `depends_on`:

- Read the pending task's YAML front matter.
- If ALL IDs in `depends_on` are now in `done/`, that task is unblocked.
- If only some are done, it remains blocked — do not report it as unblocked.

**Exceptions:**

- Pending task file unreadable or malformed → skip it, do not report it as unblocked.
- No pending tasks with any dependency on the completed task → report completion normally.

### Step 5: Report

**Normal flow:**

Show:

1. Confirmation that `<task>` is done.
2. If any tasks were unblocked: list them with their IDs and descriptions.
