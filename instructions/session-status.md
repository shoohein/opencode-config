## Session Status Management

> **Note**: `session_status` and `session_set_title` only update session metadata — they do NOT modify files or system state. Safe to call in **any** mode (plan, explore, etc.), including read-only phases.

A plugin manages session title prefixes and base title:

- `【進行中】` — task in progress (auto-applied after title generation)
- `【完了】` — task completed

### Available Tools

| Tool | Purpose |
| --- | --- |
| `session_status(status)` | Change the status prefix (`【進行中】` / `【完了】`) while preserving the base title |
| `session_set_title(title)` | Change the base title while preserving the status prefix |

### Rules

1. If the user sends a new message while the title has `【完了】`, call `session_status("進行中")` first.
2. When the task is fully resolved, call `session_status("完了")`.
3. The `/done` and `/wip` commands are also available for manual use.
4. When the user announces intent to start a task (e.g., "タスク010をやります"), call `session_set_title()` with a descriptive title reflecting the task (e.g., `session_set_title("タスク010: Create create-command skill")`). This applies to both the main agent and sub-agents (plan, etc.).
