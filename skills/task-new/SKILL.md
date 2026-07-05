---
name: task-new
description: Create a new task record in tasks/pending/
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: task
---

## What I do

Create a new task record in `tasks/pending/` from user-provided or interactive input, then stop. Never execute the task content.

## When to use me

Use when the user says "create task" or "new task", or invokes `/task-new`.

## Scope

- Creates a task record only, with an auto-generated ID and user-provided metadata.
- The task description is rewritten into a clean one-line summary — the user's raw input is interpreted, not used verbatim. The user's language is preserved; only wording and length are normalized.
- Does **not** break the task into subtasks.
- Does **not** start or execute the task after creation.
- Arguments (`$ARGUMENTS`) are data for the record, not execution instructions.

## Preconditions

- The `tasks/` directory exists (the tool can auto-initialize it if missing).
- `$ARGUMENTS`, if provided, contains a description of the task to create (can be unnatural or verbose).
- User has write permission to the `tasks/` directory.

## Workflow

### Step 1: Determine the task description

**Normal flow:**

If `$ARGUMENTS` is provided:

- Interpret the user's input — rewrite it into a clean, natural, concise one-line description in the user's language.
- Present the rewritten description and ask the user to confirm before proceeding.
- If the user confirms → proceed to Step 2.
- If the user declines → ask for clarification or stop.

If `$ARGUMENTS` is empty:

- Ask the user to provide a one-line task description.
- Take the user's response, rewrite it into a clean one-line description.
- Present the rewritten description and ask the user to confirm before proceeding.
- If confirmed → proceed to Step 2.

**Exceptions:**

- User disagrees with the rewritten description → ask for clarification and retry.
- User declines or cancels at confirmation → stop without creating a task.
- User repeatedly provides ambiguous input → ask them to write a clear one-line summary directly.

### Step 2: Collect metadata

**Normal flow:**

After the description is confirmed, collect optional metadata:

| Field | Prompt | Default |
| --- | --- | --- |
| `important` | Ask whether the task is important (y/N). Important = high impact when done (+2 score). | false |
| `urgent` | Ask whether the task is urgent (y/N). Urgent = time-sensitive or blocks others (+1 score). | false |
| `depends_on` | Ask for comma-separated dependency IDs (e.g., 001,015) or leave blank. | [] |

- `important`/`urgent`: accept `y`/`Y`/`yes` as true. Accept empty/n as false. For unclear input, re-prompt once before defaulting to false.
- `depends_on`: parse comma-separated 3-digit IDs. Validate format (must match `^\d{3}$` per item).

**Exceptions:**

- User provides invalid `depends_on` format → explain the format and ask again.

### Step 3: Create the task

**Normal flow:**

Call `task_create({ description, important, urgent, depends_on })`.

**Exceptions:**

- `task_create` fails → report the error and stop.

### Step 4: Report and stop

**Normal flow:**

Show:

```
Created task [ID]: [description]
  important: [yes/no], urgent: [yes/no], depends_on: [...]
```

Explicitly add a reminder that the task content was NOT executed, and suggest using `/task-start [ID]` to begin working on it.

Do not proceed to work on the new task under any circumstances.
