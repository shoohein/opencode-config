---
name: git-commit
description: Create small, atomic Git commits with semantic prefixes.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: git
---

## What I do

Review local Git changes, split them into atomic commits, and commit each with a semantic-prefix message.

## When to use me

Use this when the user asks to commit local changes to a Git repository.

## Scope

**By default:**

- Handles only local Git changes (staged and unstaged)
- Does not push, create PRs, amend, force-push, rebase, or change Git config
- Does not use `--no-verify` (pre-commit hooks are respected)

**With explicit user instruction, may:**

- Push, amend, rebase, force-push, or skip hooks
- These operations require the user's explicit request in the same session

## Preconditions

- Current directory is inside a Git repository
- There are changes to commit (staged, unstaged, or both)
- `git` command is available

## Workflow

### Step 1: Gather repository state

**Normal flow:**

Run these commands in parallel to understand the current state:

- `git status` — full working tree status
- `git diff` — unstaged changes
- `git diff --staged` — staged changes
- `git log --oneline -10` — recent commit history

Use the combined output to assess what needs to be committed.

**Exceptions:**

- Not a Git repository → stop, report the error to the user
- No changes detected → stop, inform the user there is nothing to commit

### Step 2: Split changes into atomic groups

**Normal flow:**

Group the changes into logical atomic commits following these rules:

- One logical change per commit
- Ideally one file per commit when practical
- Separate commits for code, tests, documentation, configuration, and CI changes
- If a single file contains multiple unrelated changes, plan to use `git add -p` for that file

**Exceptions:**

- Changes are inseparably combined (e.g. a rename with modifications) → merge into a single commit and note the reason in the commit message

### Step 3: Assign prefix and scope to each group

**Normal flow:**

Choose a prefix from the allowed list:

| Prefix     | When to use                                       |
| ---------- | ------------------------------------------------- |
| `feat`     | New functionality                                 |
| `fix`      | Bug fix                                           |
| `docs`     | Documentation only                                |
| `refactor` | Code restructuring (no behavior change)           |
| `test`     | Tests only                                        |
| `chore`    | Tooling, build, or config (no user-facing change) |
| `ci`       | CI configuration or workflow changes              |

Optionally add a scope — a short, single-word identifier for the affected module or component. Use scope when it improves `git log --oneline` readability. Omit scope when the change is cross-cutting or too broad.

Commit message format:

```
<prefix>(<scope>): <short summary>
```

**Exceptions:**

- No prefix matches the change type → ask the user to choose or suggest one

### Step 4: Present commit plan (conditional)

**Normal flow:**

If 3 or more commits are planned, present the plan to the user:

> Planned commits (3):
>
> 1. `feat(auth): add login endpoint` — [src/auth/login.ts]
> 2. `test(auth): cover login endpoint` — [tests/auth/login.test.ts]
> 3. `docs(auth): document login flow` — [docs/auth.md]

Then proceed to Step 5 without waiting for approval (invocation itself implies approval).

**Exceptions:**

- Fewer than 3 commits planned → skip presentation, proceed directly to Step 5

### Step 5: Execute commits sequentially

**Normal flow:**

For each atomic group:

1. Stage the relevant files:
   - Single-file group → `git add <file>`
   - Multi-file group → `git add <file1> <file2> ...`
   - Mixed changes in one file → `git add -p <file>` (interactive patch selection)
2. Commit with the chosen message: `git commit -m "<prefix>(<scope>): <summary>"`
3. Confirm the commit succeeded before moving to the next group

**Exceptions:**

- Pre-commit hook fails → the commit was not created. Read the hook output, fix the reported issues, then re-run `git commit -m "<same message>"`
- Potential secret detected in staged content (e.g. API key patterns) → stop immediately and ask the user to confirm before proceeding
- Unintended file was staged → unstage (`git reset HEAD <file>`) and update the commit plan

### Step 6: Report completion

**Normal flow:**

Show the created commits with:

```
git log --oneline -N
```

where `N` is the number of new commits. Present the output to the user.
