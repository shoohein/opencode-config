---
name: doc-review-cycle
description: Submit a documentation file to all relevant doc-reviewer agents, aggregate findings, auto-approve trivial fixes, and present trade-off items for user decision.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: review
---

## What I do

Run the doc-reviewer subagent suite on a single documentation file, aggregate findings using natural language understanding, separate trivial fixes from trade-off decisions, present them to the user, and output an approved fix plan.

## When to use me

Use when the user wants to review a documentation file, asks for a doc review, or says "review this file" with a path to a `.md` or documentation file.

## Scope

- Reviews one file per invocation. Multi-file review requires multiple calls.
- Does not apply fixes. Outputs an approved fix plan for the superagent to execute directly.
- Does not perform cross-document consistency checks — that responsibility belongs to the separate `cross-doc-check` skill.
- Reviews only LLM-generated technical documentation (docs, ADRs, skills, agents, instructions, READMEs).

## Preconditions

- The target file exists and is readable.
- At least one doc-reviewer subagent exists and can be invoked.
- The user has write permission to the target file (since fixes will follow).

## Workflow

### Step 1: Detect file language

| Condition | Grammar reviewer |
| --- | --- |
| File contains CJK characters | Add `doc-grammar-jp-reviewer` |
| File is almost entirely ASCII | Add `doc-grammar-en-reviewer` |
| Language uncertain | Skip grammar. Notify user: "Skipping grammar — ambiguous language detection." |

### Step 2: Select and run reviewers in parallel

Always run these three:

- `doc-structure-reviewer`
- `doc-clarity-reviewer`
- `doc-completeness-reviewer`

Add the grammar reviewer determined in Step 1 (or none).

**Invocation pattern:** Call each reviewer subagent with the file path as input. All reviewers run concurrently.

**Exceptions:**

- A reviewer subagent errors (tool failure, timeout) → retry once. If it fails again, skip and report: "`{reviewer}` unavailable — proceeding without it."
- All reviewers fail or are unavailable → report the error and stop. Cannot proceed.

### Step 3: Aggregate findings

Read each reviewer's output using natural language understanding.

1. Merge duplicate or overlapping findings from different sources into one entry, preserving which reviewers flagged it.
2. Sort the unified list in reviewer order: structure, clarity, completeness, grammar.

### Step 4: Analyze each finding

Before classifying, examine each finding against these criteria:

- **Document type scope**: Is this the kind of concern this document type is meant to address?
- **Audience mismatch**: Does this finding assume the reader needs knowledge they already possess?
- **Severity vs impact**: Is the severity proportional to the finding's actual impact on the document's purpose?

**ADR scope rules:**

If the target document is an ADR or decision record, evaluate findings against ADR scope:

- Findings that recommend removing specification detail (implementation artifacts, procedures, configuration templates) from an ADR → auto-approve. ADRs document decisions and rationale, not resulting specifications.
- Findings that ask for implementation-level coverage (edge cases, error paths, conditional handling) → auto-reject. ADRs document rationale, not operational completeness.

### Step 5: Classify each finding

Based on the analysis in Step 4, assign each finding to one of three categories:

| Classification | Definition |
| --- | --- |
| **auto-approve** | The fix is self-evident with negligible risk of side effects. Examples: typos, missing periods, obvious misspellings, orthographic normalization, formatting violations. |
| **auto-reject** | The finding is valid in general but outside the target document's purpose. Discard without asking the user. |
| **needs decision** | The fix involves trade-offs — multiple reasonable alternatives exist, or the correct response depends on context or preference. Examples: section breakup, heading wording, tone choice, information density vs. completeness. |

Base this decision on the nature of the fix, not on the severity field from the reviewer. A critical missing-prerequisite finding can be auto-approved if the fix is obvious (just add the missing item). A minor wording finding may need human judgment (e.g., a colloquial vs. formal tone choice).

**Exceptions:**

- A finding is flagged by multiple independent reviewers → prefer auto-approve (consensus increases confidence).
- A finding affects other files (cross-references, shared conventions) → prefer needs decision.

### Step 6: Present results

Output examples are in English. Present actual results in the user's language.

Print three blocks in order.

#### Section 1: Auto-Approved Fixes (table format)

```markdown
## Auto-Approved Fixes

| Severity | Finding | Fix | Reason |
| --- | --- | --- | --- |
| critical | L15: Missing prerequisite "JDK 17 or later" | Add "Requires JDK 17 or later" before setup | Self-evident missing requirement |
| minor | L28: Spelling error "recieve" | Replace with "receive" | Self-evident surface correction |
```

**Reason** explains why the fix was auto-classified and needs no user input (e.g., "self-evident surface correction", "ADR scope rule").

If there are no auto-approved findings, omit this section.

#### Section 2: Auto-Rejected Findings (table format)

```markdown
## Auto-Rejected

| Severity | Finding | Reason |
| --- | --- | --- |
| major | Missing error handling: no fallback when `description` field is absent | ADR scope — error handling is implementation detail |
```

If there are no auto-rejected findings, omit this section.

#### Section 3: Needs Decision (detailed format)

For each item, show:

```markdown
### [{severity}] {Short issue title}

**Current**: {exact text or description of the current state}

**Analysis**: {why the reviewer flagged this, any trade-offs or dependencies}

**Proposed fix**: {concrete fix the reviewer suggests — not necessarily the final answer}

**Decision points**:

- {point 1}
- {point 2}
```

If there are no items needing decision, omit this section.

### Step 7: Collect user decisions

For each `needs decision` item, the user responds:

| Response               | Meaning                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `accept`               | Apply the proposed fix as-is                                        |
| `reject`               | Skip this finding entirely                                          |
| `skip`                 | Defer this finding for later (same as reject for the current cycle) |
| Alternative suggestion | User describes a different fix — capture it as the approved fix     |

The user may also respond with a blanket statement (e.g., "accept all", "reject all"), in which case apply it to all remaining items at once.

**Exceptions:**

- User disagrees without clear rationale → ask clarifying questions: "Is this because the fix conflicts with another requirement, or do you disagree with the premise of the finding?"
- Discussion leads to a modified fix → capture the modified version as the approved one.

### Step 8: Output the approved fix plan

Combine all auto-approved findings and user-approved findings into a natural-language list:

```markdown
## Approved Fix Plan: {path}

All findings have been approved. Apply these fixes:

1. [critical] L15: Add missing prerequisite → insert "Requires JDK 17 or later" in setup section
2. [minor] L28: Fix spelling → replace "recieve" with "receive"
3. [major] Clarify heading → change "# Overview" to "# Session Management Architecture" (user-approved)
4. [major] L58: Replace vague language → change to "On error, log and continue with next file" (user-approved)
```

Each entry includes severity, a short description of the finding, and the approved fix. The superagent will apply these fixes one by one using Edit + Read tools directly.

### Step 9: Report

Show a summary:

- File reviewed: `{path}`
- Reviewers used: `{list}`
- Findings: `{N} total ({A} auto-approved, {R} auto-rejected, {D} user-accepted, {X} rejected/skipped)`
- Fix plan ready with `{N}` items

## Principles

- **Evaluate findings against document purpose and audience.** Do not accept reviewer findings at face value. Classify each finding based on whether it aligns with the target document's role and intended reader. A finding that ignores the reader's expertise is noise. Provide a brief rationale for every auto-classified finding so the user understands the basis for the decision.
- **LLM judgment, not mechanical rules.** Classification of findings into auto-approve, auto-reject, and needs-decision is done by natural language understanding of the finding's nature, not by severity field.
- **Human-readable output throughout.** No YAML or JSON tables for findings presentation — readers evaluate output in natural language.
- **One file per invocation.** Do not loop over multiple files. The superagent calls this skill once per file.
