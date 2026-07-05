# Task Management System

A structured task system managed via `tasks/` directory.

## Directory Layout

| Path                 | State       | Meaning                      |
| -------------------- | ----------- | ---------------------------- |
| `tasks/pending/`     | Pending     | Default for new tasks        |
| `tasks/in_progress/` | In progress | Active work                  |
| `tasks/done/`        | Done        | `completed_at` auto-appended |
| `tasks/canceled/`    | Canceled    | Wontfix                      |
| `tasks/archive/`     | Archive     | Optional, for old tasks      |

## State Transition Rules

- Normal flow: `pending → in_progress → done/canceled`. Follow this flow unless explicitly directed otherwise.
- The tool allows any-to-any moves for flexibility, but agents should default to the linear flow.

## Behavior Rules

- **Mark subtasks as you work**: As soon as a subtask is completed, mark it `[x]` in the task file. Do not defer to task completion.
- **Explicit triggers**: State transitions (`create` / `move`) happen only on explicit user instruction. Do not auto-create or auto-move tasks.
- **Next Action is read-only**: The `# 📍 Next Action` section must not be rewritten without explicit delegation (via `task-suspend`).
- **Worklog is append-only**: Log only meaning (what happened, how it was resolved). No raw command output. Never rewrite existing entries.

## Available Tools & Skills

### Custom Tools

| Tool            | Purpose                                             |
| --------------- | --------------------------------------------------- |
| `task_create`   | Create task (auto-ID, placed in `pending/`)         |
| `task_move`     | State transition (`mv` + completion date injection) |
| `task_next`     | Priority-ordered data via `tsort` + scoring         |
| `task_progress` | Subtask progress (`- [ ]` / `- [x]` ratio)          |
| `task_list`     | List tasks in a directory                           |

Every mutation (`create` / `move`) auto-commits to the `tasks/` git repository.

### Skills

| Skill | When to invoke |
| --- | --- |
| `task-done` | On completion — `task_move` + subtask verification + dependency unblock notification |
| `task-next` | "What's next?" — interpret computation results and explain |
| `task-suspend` | On interrupt — summarize Worklog into Next Action |

## File Format

```
tasks/[state]/[3-digit]-[slug].md

---
description: One-line summary
created_at: YYYY-MM-DD
completed_at: YYYY-MM-DD   # done/ only, auto-appended by task_move(done)
important: true/false      # High impact (+2 points)
urgent: true/false         # Time-sensitive (+1 point)
depends_on:
  - 001                    # Optional, prerequisite task IDs (3-digit only)
---

(Optional: subtask list with `- [ ]` / `- [x]`)

# 📍 Next Action
(What to do next — resume context after suspend)

# 📝 Worklog
(Append-only work record)
```

Lines matching `- [ ]` / `- [x]` in the body (between YAML and Next Action) are treated as subtasks for progress calculation.
