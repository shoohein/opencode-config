---
name: project-context
description: Structure project docs between README.md and AGENTS.md for token-efficient agent onboarding
license: MIT
compatibility: opencode
metadata:
  audience: all
  workflow: setup
---

## When to use me

- Setting up a new project
- Debating where to put project-specific context
- Reviewing token efficiency of an existing AGENTS.md

## What I do

Separate concerns:

- Project description → README.md (full context, loaded on demand)
- Agent rules → AGENTS.md (minimal, always in context)
- Behavioral guidelines → `opencode.jsonc` `instructions` (always in context)
- Task-specific workflows → skill files (loaded on demand)

## Why

- Avoid token waste in AGENTS.md while keeping full context available on demand
- Prevent redundant @explore calls every session
- Human-readable documentation doubles as agent context

## Workflow

1. **Analyze existing docs**: Check if README.md and AGENTS.md exist.
2. **Prune AGENTS.md**: Keep only agent-specific rules. Move project descriptions and setup to README.md.
3. **Structure README.md**: Full project context, organized for on-demand reading.
4. **Wire instructions**: Add behavioral rules to `opencode.jsonc` `instructions`.
5. **Extract skills**: Move complex workflows to skill files.

## Boundary examples

- **README.md**: High-level project overview, setup instructions, and architecture details ("To start the development server, run `npm run dev`")
- **AGENTS.md**: Project-level rules and constraints ("Never modify database schema without running migrations")
- **`opencode.jsonc` `instructions`**: Global behavior preferences ("Always write tests first")
- **Skill files**: Step-by-step procedures for complex repeatable tasks

## Validation Checklist

- [ ] AGENTS.md under 50 lines?
- [ ] README.md contains the full project description, setup instructions, and architecture details?
- [ ] Behavioral rules wired via `opencode.jsonc` `instructions`?
- [ ] Complex workflows extracted to skill files?
