---
name: task-next
description: Suggest the best next task using tsort ordering and important/urgent scoring
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: task
---

## What I do

Run `task_next()` to get dependency-ordered, scored pending tasks, then explain to the user why the top candidate is recommended.

## When to use me

Use when the user asks "what's next?" or invokes `/task-next`.

## Scope

- Read-only — does not modify any task.
- Only suggests — the user decides whether to start the task.

## Preconditions

- tasks/ directory exists with pending/ subdirectory.

## Workflow

### Step 1: Gather data

**Normal flow:**

Call `task_next()` to get the ordered task list with scores. Also call `task_list({ dir: "in_progress" })` to check for active tasks.

**Exceptions:**

- No pending tasks or `task_next()` returns empty → report "no tasks available" and stop.
- `task_next()` returns a circular dependency error → report it to the user, do not make a recommendation.

### Step 2: Check for active work

**Normal flow:**

- Multiple tasks in `in_progress` → list them, ask which to resume first.
- Exactly one task in `in_progress`:
  - User explicitly asked "what's next?" → still present the suggestion but note the active task.
  - User asked "what should I do now?" without context → remind them of the active task first.

### Step 3: Analyze the top candidate

**Normal flow:**

From the `task_next()` output, pick the top task. The returned order is authoritative. Score (important +2, urgent +1) explains why a task ranks where it does, but does not override tsort dependency order.

- **Dependency position**: tasks that block others (bottlenecks) rank first.
- **Importance**: high-impact tasks (score +2).
- **Urgency**: time-sensitive tasks (score +1).
- **Score tie**: if top tasks have equal scores, present alternatives and let the user decide.

### Step 4: Present to user

**Normal flow:**

Show:

```
Recommended: [id] [description]
  Score: [N] (important: yes/no, urgent: yes/no)
```

Optionally include the next 2-3 candidates for context.

End with: "Start this task? (yes / pick another / later)"
