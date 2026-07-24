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

Review local Git changes, propose atomic commits, and commit each with a semantic-prefix message.

## When to use me

Use this whenever preparing any Git commit — whether initiated by the user or the agent.

## Scope

**By default:**

- Handles only local Git changes (staged and unstaged)
- Does not push, create PRs, amend, force-push, rebase, or change Git config
- Does not use `--no-verify` (pre-commit hooks are respected)

**With explicit user instruction, may:**

- Push, amend, rebase, force-push, or skip hooks

These operations require the user's explicit request in the same session. When requested, re-confirm the operation with the user before executing.

## Preconditions

- Current directory is inside a Git repository
- There are changes to commit (staged, unstaged, or both)
- `git` command is available
- Repository is not in an exceptional state (no unresolved merge conflicts, in-progress rebase, or cherry-pick)

## Workflow

### Step 1: Gather repository state

**Normal flow:**

Run these commands in parallel to understand the current state:

- `git status` — full working tree status
- `git diff` — unstaged changes
- `git diff --staged` — staged changes
- `git log --oneline -50` — recent commit history

Use the combined output to assess what needs to be committed.

**Exceptions:**

- Not a Git repository → stop, report the error to the user
- No changes detected → stop, inform the user there is nothing to commit
- Repository has unresolved merge conflicts, in-progress rebase, or cherry-pick → stop and instruct the user to resolve the exceptional state before committing

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

Optionally add a scope — a short, single-word identifier for the affected module or component. Use scope for module-specific changes (e.g., `feat(auth)`, `fix(db)`). Omit scope when the change is cross-cutting or too broad (e.g., `feat: upgrade dependencies`).

Commit message format:

```
<prefix>: <short summary>              (when scope is omitted)
<prefix>(<scope>): <short summary>     (when scope is provided)
```

**Exceptions:**

- No prefix from the allowed list accurately describes the change → ask the user to choose or suggest one

### Step 4: Self-check commit plan

**Normal flow:**

For each planned commit, try to disprove the current message before accepting it. A "looks fine" answer is not enough. If a concrete counterexample exists in the diff, commit history, or changed paths, revise the plan before proceeding.

Ask these four questions for each commit:

1. **Prefix**: What is the strongest argument against this prefix? Check changed files and diff — if another prefix fits better, change it. Pay special attention to documentation-only, tests-only, CI-only, and config/tooling-only changes that might be misclassified as `feat` or `chore`.

2. **Atomicity**: Is this a single logical change? If there are multiple independent reasons to change, split them. Rename + reference update and other inseparable changes may stay as one commit.

3. **Scope**: Examine `git log --oneline -50` (already fetched in Step 1) and the changed paths. Does this scope match the existing granularity? If an existing scope can describe the change, do not create a new one. If the change is cross-cutting and a single scope would be misleading, omit scope.

4. **Summary**: Would a reader's prediction of the diff from this subject line be significantly wrong? Does the summary contain specific keywords for `git log --grep` discovery? If it uses only generic terms, rewrite it.

**Exceptions:**

- Self-check reveals a problem → revise the plan immediately. After revision, re-run the self-check on the affected commit(s).

### Step 5: Present commit plan (conditional)

**Normal flow:**

If 3 or more commits are planned, or if the self-check in Step 4 modified the plan, present the plan to the user:

> Planned commits (3):
>
> 1. `feat(auth): add login endpoint` — [src/auth/login.ts]
> 2. `test(auth): cover login endpoint` — [tests/auth/login.test.ts]
> 3. `docs(auth): document login flow` — [docs/auth.md]

The user's request to commit implies approval of the plan, so proceed without waiting for explicit confirmation.

**Exceptions:**

- Fewer than 3 commits planned and plan was not modified by self-check → skip presentation, proceed directly to Step 6

### Step 6: Execute commits sequentially

**Normal flow:**

For each atomic group:

1. Stage the relevant files:
   - Single-file group → `git add <file>`
   - Multi-file group → `git add <file1> <file2> ...`
   - Mixed changes in one file → `git add -p <file>` (interactive patch selection)
2. Commit with the chosen message: `git commit -m "<prefix>(<scope>): <summary>"`
3. Confirm the commit succeeded before moving to the next group

**Exceptions:**

- Pre-commit hook fails → the commit was not created. Read the hook output (linting errors, formatting issues, etc.), fix the reported problems in the source files, then re-run `git commit -m "<same message>"`
- Partially staged file leaves nothing to commit after `git add -p` → revise the commit plan and skip to the next group
- Potential secret detected in staged content (e.g. API key patterns) → stop immediately and ask the user to confirm before proceeding
- Unintended file was staged → unstage (`git reset HEAD <file>`) and update the commit plan

Before each commit, verify the staged diff is non-empty with `git diff --staged --stat`. If empty, revise the plan rather than running `git commit`.

### Step 7: Report completion

**Normal flow:**

Show the created commits with:

```
git log --oneline -N
```

where `N` is the number of new commits. Present the output to the user.

**Exceptions:** (none)
