---
name: task-suspend
description: Suspend an in-progress task by summarizing Worklog into Next Action
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: task
---

## What I do

Read a task's Worklog section, extract meaning (what was done, what remains, unresolved issues), and rewrite the Next Action section so the user can resume quickly.

## When to use me

Use when the user invokes `/task-suspend`, or explicitly asks to suspend or interrupt the current task with intent to resume later.

## Scope

- Operates on tasks inside `tasks/` only.
- Does not rewrite existing Worklog entries; may append a suspend marker.
- Does NOT create new tasks or move files (the command wrapper handles `task_move`).

## Preconditions

- The target task exists and is in `in_progress/`.
- The task file is readable.

## Workflow

### Step 1: Identify the target task

**Normal flow:**

- User provided a task ID → verify it is in `in_progress/` and use it.
- No ID, exactly one in `in_progress` → use it.
- No ID, multiple in `in_progress` → ask the user which one.

**Exceptions:**

- Task ID not in `in_progress/` or no matching task → report and stop.
- No `in_progress` tasks → report and stop.

### Step 2: Read the task file

**Normal flow:**

Read the full task file. Identify:

- The `# 📍 Next Action` section (human's current context)
- The `# 📝 Worklog` section (append-only log)

**Exceptions:**

- `# 📍 Next Action` or `# 📝 Worklog` section missing → report error and stop.
- File not found → report error and stop.

### Step 3: Analyze and summarize

**Normal flow:**

From the Worklog entries and Next Action, determine:

1. What was accomplished so far
2. What remains or was blocked
3. Any specific commands, file paths, or decisions that the user should remember

Write a concise, actionable summary that fits in the `# 📍 Next Action` section. Focus on what the user needs to do next — include concrete file paths, commands, or references when available.

**Exceptions:**

- Worklog has no substantive entries (only suspend markers) → preserve existing Next Action. Add a note that no new progress was recorded. Use a generic placeholder only if Next Action is also empty.

### Step 4: Update Next Action

**Normal flow:**

Replace the `# 📍 Next Action` section content with the new summary. Keep the section header intact. Preserve all other sections.

**Exceptions:**

- Write fails → report the error.

### Step 5: Append suspend record

**Normal flow:**

Append `- suspended at YYYY-MM-DD HH:MM` to the Worklog section.

**Exceptions:**

- Append fails → report partial state. The Next Action is updated but the suspend marker was not recorded. Do not report the task as moved to pending.

### Step 6: Report to user

**Normal flow:**

Show the user:

- What was summarized
- Only report "moved to pending" after the wrapper or `task_move` confirms success. Otherwise report only the summary and note the state is unknown.
