---
name: git-commit
description: Create small, atomic commits using semantic prefixes
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: git
---

## What I do

- Review local Git changes
- Split changes into small, atomic commits
- Choose an appropriate semantic prefix for each commit
- Create commit messages in this format: `<prefix>(<scope>): <short summary>`
- Allowed prefixes:
  - `feat`: new functionality
  - `fix`: bug fix
  - `docs`: documentation only
  - `refactor`: code restructuring (no behavior change)
  - `test`: tests only
  - `chore`: tooling / build / config (no user-facing change)
  - `ci`: CI configuration / workflow changes
- Optional scope (area/module affected, e.g. `feat(auth)`):
  - Use a short, single-word identifier for the component/module changed
  - Good for `git log --oneline` readability: `feat(auth): add login` vs `feat: add login`
  - Skip scope when the change is too broad or cross-cutting

## When to use me

Use this when committing local changes to a Git repository.

## Commit granularity

Keep commits small and atomic.

Prefer:

- One logical change per commit
- Ideally one commit per file when practical
- Separate commits for code, tests, documentation, configuration, and CI changes

Avoid:

- Mixing unrelated changes
- Combining refactoring with behavior changes
- Combining documentation updates with code changes
- Creating large miscellaneous commits
