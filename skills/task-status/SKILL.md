---
name: task-status
description: Show overall task status — counts per directory and active task progress
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: task
---

## What I do

Aggregate and display task counts across all state directories and show progress for in-progress tasks, or show detailed information for a single task.

## When to use me

Use when the user says "status", "task status", or "what's the status", or invokes `/task-status`.

## Scope

- Read-only — never creates, modifies, or moves tasks. No state transitions.
- Overview mode: aggregates counts from all directories and shows progress for each in_progress task.
- Single-task mode: shows one task's state, frontmatter, and subtask progress.

## Preconditions

- Target task, if specified, exists in some directory.

## Workflow

### Step 1: Determine mode

**Normal flow:**

If `$ARGUMENTS` contains a valid task ID (3-digit number, extracted from anywhere in the string) → single-task mode. If `$ARGUMENTS` is empty → overview mode. If `$ARGUMENTS` is non-empty but no valid 3-digit ID can be extracted → report the accepted argument format and stop. Explain that arguments are optional (overview mode).

### Step 2a: Overview mode — collect data

**Normal flow:**

Call `task_list` on all four directories (pending, in_progress, done, canceled). Present results as:

```
Tasks Overview
  pending:     N
  in_progress: N
  done:        N
  canceled:    N
  ──────────────────
  total:       N
```

**Exceptions:**

- A directory does not exist → treat its count as 0, do not fail.
- `tasks/` directory does not exist → report that no tasks exist and stop.

### Step 2a-extra: In-progress details

**Normal flow:**

For each task in `in_progress/`, first verify the ID is unique across directories. If the same ID exists elsewhere → skip progress for that task and report a state inconsistency (task ID found in multiple directories; suggest manual verification). Otherwise, call `task_progress({ id })`. Show:

```
  [ID] [description]
    Subtasks: [X] / [N] ([X/N]%)
```

**Exceptions:**

- `task_progress` call fails for a specific task → show "progress unavailable" for that task, continue for others.
- Task has no subtasks (N = 0) → show "Subtasks: none" instead of "[X]/[N]".

### Step 2b: Single-task mode

**Normal flow:**

Determine the task's current state:

- Search all directories (pending, in_progress, done, canceled) for a file matching `[ID]-*.md`.
- If the same ID exists in multiple directories → report a state inconsistency error, list the matching paths, and ask the user to verify manually. Then stop.
- Not found in any directory → report that the task was not found and stop.

Read the matched task file. Parse the YAML front matter to extract `description`, `created_at`, `completed_at`, `important`, `urgent`, `depends_on`.

Show:

```
Task [ID]: [description]
  State:     [pending / in_progress / done / canceled]
  Created:   [YYYY-MM-DD]
  Completed: [YYYY-MM-DD or "-"]
  Important: [yes/no]
  Urgent:    [yes/no]
  Depends on: [IDs or "none"]
```

Call `task_progress({ id })`. Show subtask progress:

```
  Subtasks: [X] / [N] ([X/N]%)
```

If N > 0, list each subtask with its [x] or [ ] status. If N = 0, show "Subtasks: none" instead.

**Exceptions:**

- YAML front matter is malformed → derive the ID from the filename, derive the state from the directory. Omit unparseable front matter fields. Continue subtask/progress display if the body is readable. Show a one-line parse warning.
- Task file cannot be read → report error and stop.

### Step 3: Report

**Normal flow:**

Present the data to the user. No further action is expected from the skill. If the user asks to start a task after seeing the status, delegate to `/task-start`.
