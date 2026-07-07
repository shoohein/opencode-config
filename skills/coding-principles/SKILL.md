---
name: coding-principles
description: Shared coding values — KISS, YAGNI, Fail Fast, and guardrails against overuse.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: review
---

<!-- This skill intentionally omits Workflow and tool invocation sections — it is a reference-only skill loaded for its Principles. -->

## What I do

Provide shared coding principles that implementers and reviewers use to align on design and implementation trade-offs. Each principle pairs a **Value** with a **Constraint** — the guardrail that prevents dogma from overwhelming practicality.

## When to use me

Load this skill before writing, refactoring, or reviewing code to ground decisions in the same values.

## Scope

- Principles only. No workflow, no tool invocations.
- Complements agent-specific evaluation criteria; does not replace them.
- Does not dictate language, framework, or project-specific conventions.

## Principles

### Architecture & Design

#### KISS & YAGNI

**Value:** Favor the simplest, most straightforward approach that solves the immediate problem. Do not add code for anticipated future needs.

**Constraint:** Reject premature abstraction. Abstract only when multiple variations already exist — defer until needed (lazy evaluation). When in doubt, leave it out.

#### Separation of Concerns & Orthogonality

**Value:** One function or module handles one concern. Changes to one module should not ripple into unrelated modules.

**Constraint:** Warning: over-splitting (tiny files, deeply nested modules) creates cognitive load — the "glue code" becomes harder to trace. Stop when the structure obscures the overall flow.

#### Design by Contract

**Value:** Module boundaries are defined by clear interfaces (contracts). Callers should not need to know internal implementation details.

**Constraint:** Do not fabricate implicit contracts or context-dependent rules that static analysis cannot verify. An interface that lies about its guarantees is worse than none.

#### OCP (Open-Closed) & Lazy Evaluation

**Value:** Prefer designs that allow adding new behavior without modifying existing code.

**Constraint:** Without concrete extension plans, abstraction is YAGNI violation. Postpone abstraction until two or more real variants exist.

#### Anti-Overengineering (Design Patterns)

**Value:** Apply design patterns to reduce existing complexity (exploding if/else chains, tangled state).

**Constraint:** Patterns are not goals. A simple function or linear logic is always preferred over a pattern that raises cognitive load. Reject pattern-for-pattern's-sake.

### Implementation & Code Quality

#### Fail Fast

**Value:** Detect and surface abnormal states early. Crash (or early-return) immediately to keep the happy path clean and readable.

**Constraint:** Eliminate defensive over-programming — excessive try-catch swallowing errors, cascading null checks that obscure the main flow. Let it fail early, fail visibly.

#### Meaningful Comments (Why, Not What)

**Value:** Comments must explain _why_ a decision was made — the constraints, trade-offs, or intent behind the code.

**Constraint:** A line-by-line translation of code into English (What comments) is noise. Delete it. The code itself is the source of truth for what it does.

#### No Broken Windows & Focus on Essentials

**Value:** Remove decay: dead code, commented-out blocks, abandoned TODOs, unused exports. A clean codebase resists further rot.

**Constraint:** Never flag style nits (indentation, naming conventions) that a linter or formatter should catch. Reserve energy for design and logic — the substance.
