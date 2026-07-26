# Session Status Instruction

At session start, determine whether to collect context (git status, git log, task management). The purpose is to give the agent awareness of the current project state before acting.

## Default behavior

Collect context.

## Decision rules

Force-collect conditions take priority over skip conditions. If a force-collect condition matches, collect context regardless of skip conditions.

### Skip conditions (skip context collection if any of these apply AND no force-collect condition matches)

| Condition                         | Example                            |
| --------------------------------- | ---------------------------------- |
| Single-file mechanical edit       | "Rename this variable"             |
| Self-contained command execution  | "Run `npm install`"                |
| Pure information lookup           | "Show me `git log`"                |
| Syntax-only fix                   | "Fix this code to pass the linter" |
| Single git operation              | "Run `git stash`"                  |
| Mechanical test generation or fix | "Write a test for this function"   |

### Force-collect conditions (always collect context if any of these apply)

| Condition | Example |
| --- | --- |
| Vague or open-ended instruction with no specific file or command named | "Implement the login feature" |
| Contains an explicit continuation cue | "Continue", "resume", "carry on" |

## Information to collect

| Source                 | Content                                                  |
| ---------------------- | -------------------------------------------------------- |
| `git status`           | Working tree state (modified, staged, untracked files)   |
| `git log`              | Recent commit history (last 10 commits)                  |
| Task management system | In-progress task's Next Action, Worklog (skip if absent) |
