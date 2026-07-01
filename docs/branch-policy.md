# Branch Policy

Decisions from the architecture discussion (2026-06-30).

## Naming Convention

Format: `<type>/<topic>` or `<type>/<scope>/<topic>`

Types:

- `feat` — new features and improvements (use `feat`, not `enhance`)
- `fix` — bug fixes
- `docs` — documentation only
- `refactor` — code restructuring (no behavior change)
- `chore` — tooling, config, maintenance

`enhance` is not used. The boundary between `feat` and `enhance` is subjective; Conventional Commits defines `feat` as covering both.

## Base Branch

The active development branch is `dev`. Base new branches on `dev` unless a different base is explicitly specified.

## Skill Design (Deferred)

A `skills/branch/SKILL.md` will be created separately, following the `create-skill` conventions. See `TODO.md` for status.
