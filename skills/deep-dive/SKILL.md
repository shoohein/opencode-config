---
name: deep-dive
description: Structured discussion framework for clarifying requirements through critical dialogue, trade-off analysis, and parallel expert sub-agent review before implementation.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: planning
---

## What I do

Guide the user through a structured requirements clarification process that produces a concrete implementation plan through iterative questioning, counter-argument, and optional expert consultation.

## When to use me

Invoked via the `/deep-dive` command when:

- Starting a non-trivial feature, bug fix, or architecture decision
- Mid-session when a complex sub-task emerges that needs requirements clarification before delegating to another agent

Do not use for mechanical tasks such as commits, single-line edits, or pure queries.

## Scope

I manage the discussion workflow and the evolving plan. I do NOT create files, define sub-agent configurations, or persist session context.

## Preconditions

- The project root is determinable
- The `theorist` and `pragmatist` sub-agents are defined and available
- The calling agent has permission to invoke the `Task` tool (OpenCode's built-in mechanism for invoking sub-agents)

## Internal structure: Plan Frame

Maintain this structure as the discussion progresses. Update it with each resolution.

```
plan frame:
  goal:        what to achieve (1-2 sentences)
  context:     relevant codebase, constraints (short paragraph)
  candidates:  viable approaches considered, at least 2, each with outline + pros + cons
  approach:    selected approach + reason for selection
  steps:       ordered implementation steps, minimum 2 concrete actions
  unknowns:    items needing investigation, each with what is unknown and why it matters
  risks:       known risks, each with what and mitigation
  answer:      ready / not_ready
```

Constraint: Do NOT set answer to ready unless every field has substantive, non-trivial content. One-word entries do not satisfy this constraint. Each field must contain at least one complete sentence that would be meaningful to a reader unfamiliar with the session.

## Workflow

### Step 1: Gather minimal context

**Normal flow:**

Read relevant project files and recent git history to ground the discussion:

- Modified and staged files (`git status` output) and the directory structure
- Files related to the user's goal
- The user's stated goal

Gather just enough to avoid offering irrelevant suggestions. Do not research external documentation or read every file.

**Exceptions:**

- Project has no git history: rely on file structure alone
- User provides explicit context: prioritize user-provided information over exploration
- Project root cannot be determined: ask the user to specify the repository root before proceeding

### Step 2: Identify key questions

**Normal flow:**

From the gathered context and the user's goal, extract 3-5 concrete, answerable discussion points. Present them to the user as the agenda.

**Exceptions:**

- User's request is already specific: reduce to 1-3 most ambiguous points
- User rejects the agenda: ask what they want to focus on instead

### Step 3: Generate candidates

**Normal flow:**

Based on context and the agreed agenda, generate 2-3 genuinely viable approaches. For each candidate:

- Core idea (1-2 sentences)
- Key pros
- Key cons

Then select one as the recommended initial direction, with clear reasoning for why it was chosen over the others.

Keep rejected candidates live — they may resurface during discussion. Do NOT fabricate straw-man alternatives just to reject them.

**Exceptions:**

- Only one viable approach exists: explain why alternatives are not viable
- Insufficient context to form any proposal: ask targeted clarifying questions before proceeding

### Step 4: Iterative discussion

**Normal flow:**

For each open point in the agenda:

1. Present the point and your position
2. After the user responds, challenge their answer — point out risks, contradictions, and overlooked trade-offs
3. Update the plan frame with each resolution
4. If the user changes course, update the frame accordingly

When the plan frame is fully populated and the user signals agreement, recommend moving to expert review.

Do NOT present the full plan frame to the user during discussion. Use it internally to detect gaps.

**Exceptions:**

- User pushes back on your challenge: if their reasoning is sound, accept it and move on. Re-raise only if a genuine contradiction remains.
- Discussion stalls on a minor point: suggest tabling it and moving forward.
- User redirects to a different topic: reset the relevant parts of the plan frame and follow the new topic.

### Step 5: Expert review

**Normal flow:**

When the plan frame's answer is ready:

1. Tell the user the plan is ready for expert review and ask whether to proceed with consulting theorist and pragmatist.
2. If the user agrees, invoke both in parallel using the Task tool, passing the serialized plan frame as the prompt for each.
3. Present both outputs side by side
4. Discuss the feedback and update the plan frame

**Exceptions:**

- User declines expert review: proceed directly to Step 6
- One sub-agent fails to respond: present the available feedback only, note the failure
- theorist and pragmatist directly contradict each other: highlight the contradiction to the user, ask which direction to follow
- Expert feedback reveals major gaps: return to Step 4 for the newly surfaced issues
- Task tool is unavailable: skip expert review and proceed to Step 6 with a note that expert consultation was not possible

### Step 6: Present final plan

**Normal flow:**

Present the final plan frame to the user as a concise summary. State clearly: what will be built, in what order, and with what risks.

Ask if they want to proceed with implementation, save as an ADR, write to a design doc, or continue refining.

Do NOT create files. The output is the plan itself.

**Exceptions:**

- User asks to save the plan as a file: remind them which commands or skills can create the relevant document, but do not execute them yourself.
