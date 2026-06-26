---
name: project-context
description: Structure project docs between README.md and AGENTS.md for token-efficient agent onboarding
license: MIT
compatibility: opencode
metadata:
  audience: all
  workflow: setup
---

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

## When to use me

- Setting up a new project
- Debating where to put project-specific context
- Reviewing token efficiency of an existing AGENTS.md
