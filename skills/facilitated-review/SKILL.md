---
name: facilitated-review
description: Multi-turn review with pushback and re-review
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: review
---

## What I do

Act as a **facilitator** between the **Author** (you, the user) and the **Reviewer** (the `@doc-reviewer` subagent) to conduct a multi-turn review cycle:

1. **I call `@doc-reviewer`** to review the target document and produce findings.
2. **I present the findings** to you and ask: _Do you agree, or do you want to push back?_
3. **You critique** — challenge findings that are:
   - Based on incorrect assumptions
   - Overly subjective or opinion-based
   - Missing context the reviewer didn't have
4. **I relay your pushback** to `@doc-reviewer` (resuming the same session via `task_id`) and ask it to respond.
5. Repeat until both sides converge, or escalate to you for a final decision.

## When to use me

Use this when a document needs a quality check and the author wants to push back on invalid feedback rather than blindly applying changes.

## Rules for the orchestrator (me)

- Always use `@doc-reviewer` with `subagent_type: "doc-reviewer"` for reviews.
- Include the **Rules for the reviewer** section in the prompt sent to `@doc-reviewer`.
- Use `question` tool to ask the user for critique after receiving review results.
- When relaying pushback, use the same `task_id` to resume the reviewer session (if it is the same round of review).
- If the reviewer session has expired or convergence fails after 3 rounds, present a summary to the user and let them decide.

## Rules for the reviewer (transmitted to @doc-reviewer)

- Each round, either converge or clarify the remaining disagreement.
- Three rounds without convergence → escalate to human (the user).
- Accept valid pushback and refine or retract findings when appropriate.

## Rules for the author (you, the user)

- Challenge the _reasoning_, not the criterion.
- Provide counter-evidence when possible.
- Do not reject feedback just because it requires work.
