# Documentation Policy

## Directory structure

- `docs/guide/` — user-facing usage guides
- `docs/development/` — developer guides (setup, testing, release, contribution)
- `docs/design/` — how the system currently works
- `docs/adr/` — why important technical decisions were made

## Guidelines

- Write to `docs/design/` when describing the entire architecture.
- Write to `docs/adr/` when documenting a decision with trade-offs.
- Do NOT write a document for trivial implementation details or reversible choices.
- ADRs record what was decided and why, not the resulting specification. Specification detail belongs in design docs.

## Principles

**Minimize reader cognitive load.**

Keep questioning your document against these principles:

1. **Structured** — hierarchy clear, scannable in seconds, nesting ≤3 levels
2. **Cohesive** — one topic per section, related items adjacent, list items share the same abstraction level
3. **Clarity** — reader-appropriate language, terms defined, no ambiguity
4. **Minimal** — every line carries signal, nothing redundant
5. **Completeness** — prerequisites, edge cases, error paths documented
6. **Consistency** — matches project conventions and actual behavior
