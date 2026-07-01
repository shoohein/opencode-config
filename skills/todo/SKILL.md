---
name: todo
description: Add or manage TODO items in TODO.md
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: project
---

## What I do

- Add new TODO items to the `## Pending` section of `TODO.md`
- Show current TODO.md content when no item is specified

## When to use me

Use this when the user mentions a new task that should be tracked, or says something like "TODOに追加して" / "add this to TODO".

## Scope

- Operates on `TODO.md` in the workspace root only.
- Creates `TODO.md` with a `## Pending` section if it does not exist.
- Only appends to the `## Pending` section. Does not modify other sections.

## Preconditions

- The workspace root must be writable.
- If `TODO.md` exists, it must be readable.

## Workflow

### Step 1: Check TODO.md existence

Read `TODO.md` from the workspace root.

**Normal flow:**

If the file exists, proceed to Step 2.

**Exceptions:**

- File does not exist → create it with the following content and proceed to Step 2:

  ```markdown
  # TODO

  ## Pending
  ```

### Step 2: Determine item to add

**Normal flow:**

If the user provided an item description as an argument, use that as the item content.

**Exceptions:**

- No argument was given → display the current `TODO.md` content and ask the user: "What should I add to Pending?"

### Step 3: Append to Pending section

**Normal flow:**

Append `- [ ] <item>` to the end of the `## Pending` section. Preserve any existing blank line between sections.

**Exceptions:**

- Item already exists in TODO.md (exact match, any section) → inform the user and skip the append. Ask if they want to add a different item.

### Step 4: Confirm

**Normal flow:**

Print the added item and the updated `TODO.md` preview.

**Exceptions:**

- Write fails (e.g., permission denied) → report the error and stop.
