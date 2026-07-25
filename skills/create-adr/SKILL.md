---
name: create-adr
description: Create a new Architecture Decision Record with auto-numbering and validation.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: documentation
---

## What I do

Create a new ADR file by extracting decisions from the discussion and mapping them to template sections. Auto-assigns the next sequential ID and validates front matter. Uses a template (project-specific `_template.md` or a built-in English fallback) as the list of available sections and their order.

## When to use me

Call this skill when the user says something like "create an ADR for ...", "new ADR about ...", "record a decision on ...", or any request to document an architectural decision.

## Scope

- Create new ADRs only. Existing ADRs are not modified, deleted, or renumbered by this skill.
- Works with any project that uses standard ADR conventions (NNN-*.md naming, YAML front matter, H2 section structure).

## Preconditions

- The ADR directory (determined in Step 1) either exists or can be created via `mkdir -p`.

## Conventions

### ADR atomic unit

- 1 ADR answers 1 question ("X should behave how?").
- Sub-decisions that follow from the same question may live in the same ADR.
- If a decision can be superseded independently of another, they answer different questions — split into separate ADRs.

### Extraction model

Extract information from the discussion, then map to template sections. The template is a catalog of available sections, not a form to complete.

1. Extract these information categories from the discussion:
   - **context**: background, constraints, assumptions
   - **decisions**: what was chosen and why (rationale)
   - **alternatives**: options discussed and rejected
     - Per-decision alternatives map to the nested bullet within the Decision section.
     - Broader project-level alternatives map to the "Considered Alternatives" H2 section.
     - Every alternative MUST include a rejection reason, separated as a sub-bullet (alternative description → sub-bullet labeled "Rejection reason:"). If no rejection reason was discussed, omit the alternative entirely.
   - **consequences**: predicted positive/negative effects (only if discussed; the template names this section — the skill does not judge the label)
   - **related**: other ADRs or documents mentioned

2. Map extracted categories to template sections. The template defines available sections and their order.

3. Minimum output: Context, Decision (including Rationale). These sections must have content. If extraction yields insufficient information, ask the user before proceeding.

4. Other sections: output only when the corresponding category was extracted. Empty sections are omitted — no placeholder headings.

5. Source Trace: every claim must be traceable to the discussion. A claim is valid when it was stated by the user, or proposed by the agent and confirmed by the user (explicit confirmation, or implicit — the user did not object to the proposal).

6. Within Decision bullets: include each bullet only when content exists or the user stated "none". Bullet labels follow the template language.

### Synthesized items

When a claim is derived from discussion context but lacks explicit user confirmation, include it in the ADR with an HTML comment marker. The comment communicates:

- This item was synthesized from discussion context
- The user's explicit confirmation has not been obtained
- Future agents referencing this ADR should confirm the item with the user

Use the same language as the template. Prefix the first line with `<!-- NOTE:` and close with `-->`.

## Workflow

### Step 1: Discover ADR directory

**Normal flow:**

1. Search for ADR directory path declarations in project configuration and instruction files. Collect every unique path.
2. If multiple different paths are found → stop with hard error: "Multiple instruction files specify different ADR directory paths: [`{list}`]. Resolve the conflict first."
3. If exactly one path is found → adopt that as the ADR directory path.
4. If no instruction file specifies a path, probe convention directories in order: `docs/adr/`, `doc/adr/`, `adr/`. Use the first one that exists.
5. If none exist, ask the user: "No ADR directory found. Where should ADRs be created?" with the default suggestion `docs/adr/`.

Report the discovered directory: "ADR directory: `<path>`"

**Exceptions:**

- Instruction file found but the specified directory does not exist → create it silently with `mkdir -p`.
- No convention directory exists and user does not provide one → stop with error.

### Step 2: Inventory existing ADRs

**Normal flow:**

Glob for `NNN-*.md` files in the ADR directory discovered in Step 1.

For each ADR found, extract from its front matter: `status`, `date`, `tags`, `superseded_by` (if present). Present the inventory as a table:

| ID  | Slug | Status | Date | Tags |
| --- | ---- | ------ | ---- | ---- |

Use this inventory to:

- Determine the next ID (Step 4).
- Detect naming collisions (Step 5).
- Provide context to the user about existing decisions.

**Exceptions:**

- No `NNN-*.md` found → note this as a valid state. The ADR being created may be the first. Skip the table and continue.
- A file matches `NNN-*.md` but has invalid or missing YAML front matter → include it in the inventory with `status: unknown` and flag the file for manual review.

### Step 3: Discover template

**Normal flow:**

Look for `_template.md` in the ADR directory discovered in Step 1.

- **Found:** Use it as the authoritative template.
- **Not found:** Use the built-in English template (see [Built-in template](#built-in-template)).

Report: "Template: `<path>` (project override)" or "Template: built-in (English, no `_template.md` found)"

**Exceptions:**

- `_template.md` exists but cannot be parsed (permission error, malformed) → warn the user and fall back to built-in. Include the specific error in the warning.
- This is the first ADR in the project (no `_template.md` found AND no `NNN-*.md` files exist in any convention directory) → inform the user: "This is the first ADR in this project. If you want project-specific formatting, create a `_template.md` override file manually later." Proceed with the built-in fallback.

### Step 4: Auto-assign ID

**Normal flow:**

From the inventory in Step 2, find the maximum `NNN` across all existing `NNN-*.md` files.

- Next ID = `max(NNN) + 1`, formatted as 3-digit zero-padded (e.g., `002`, `012`).
- If inventory was empty, start at `001`.

Report: "Next ID: `NNN`"

**Exceptions:**

- Inventory contained files with unparseable filenames (non-matching patterns in the ADR dir) → warn about the presence of non-ADR files but proceed with the numeric max from valid `NNN-*.md` patterns.

### Step 5: Extract and classify

**Normal flow:**

1. Parse the discussion into information categories: context, decisions with rationale, alternatives discussed (per-decision and broader), consequences mentioned, related ADRs/documents.

2. Identify atomic decisions:
   - Determine the question each decision answers. Group decisions by question — each group becomes one ADR.
   - If multiple ADRs are identified, list them and ask: "N ADRs identified: [list]. Create all?"
   - Proceed per ADR for the remaining steps.

3. Generate title and slug. For slug: English-only, kebab-case. For Japanese body: translate title to English first, then kebab-case. Example: `新しいデータベースを採用する` → `adopt-new-database`.

4. Set front matter: `status: Proposed`, `date: YYYY-MM-DD` (today), `tags` from user input or `[]`.

5. Map extracted categories to template sections following the rules in [Extraction model](#extraction-model).

6. Source Trace each claim back to the discussion.

Detect template language by examining section headings and comments in `_template.md`. If they are in Japanese, generate the ADR body in Japanese. If using the built-in English template or a template with English headings, generate in English.

**Exceptions:**

- Context, Decision, or Rationale insufficient → ask the user: "What problem or context led to this decision?" / "What was chosen and why?"
- Slug collision (a file `NNN-slug.md` already exists) → suggest an alternative slug and ask the user to confirm.

### Step 6: Self-review

**Normal flow:**

Review the draft against evaluation criteria found in the project. Look for document review criteria definitions — for example, agent definition files with a `# Criteria` section. Read any that exist and apply findings. On failure, use the fallback criteria below.

**Deletion gates (remove, do not rewrite):**

- Source Trace: claim has no basis in the discussion → remove the claim
- Abstraction: CLI commands, file paths, data formats, API names → remove the line
- Meta-Rule: self-referential statements about how ADRs should be written → remove the line

**Fallback criteria (apply when no definition files are available):**

- Structure: heading hierarchy, section cohesion, adjacency
- Clarity: undefined terms, ambiguity, noise
- Completeness: missing prerequisites, internal contradictions
- Grammar: typos, orthographic errors, inconsistent style

**Exceptions:**

- No review criteria definition files are found → apply fallback criteria.
- A loaded definition introduces criteria that conflict with the deletion gates → deletion gates take precedence.

### Step 7: Validate

**Normal flow:**

Validate the ADR front matter before writing.

Fix automatically where resolution is unambiguous:

- `status` missing → set to `Proposed`
- `date` missing or unparseable → set to today's date in `YYYY-MM-DD` format
- `tags` missing → set to `[]`

Hard error (blocks creation, requires user input):

- YAML syntax error in front matter
- `status` value not one of `Proposed`, `Accepted`, `Rejected`, `Deprecated`, `Superseded`
- `status: Superseded` but `superseded_by` missing
- `superseded_by` references an invalid filename format (not `NNN-slug.md`)
- `superseded_by` references the same ADR (self-reference)
- `superseded_by` references an ADR that does not exist in the project

Present hard errors to the user and stop. Note auto-fixes in the final report.

### Step 8: Create file and report

**Normal flow:**

Write the file at `<adr-dir>/NNN-slug.md`.

Print a summary:

- **ID:** `NNN`
- **Title:** `<title>`
- **Status:** `Proposed`
- **Location:** `<adr-dir>/NNN-slug.md`
- **Template used:** `<source>`
- **Self-review:** `N` items removed, `M` items corrected
- **Synthesized:** `N` items marked for review in the ADR (report the count after creation)

Ask the user if they want to review or edit the file before finishing.

**Exceptions:**

- Write fails (permission denied, disk full) → report error and suggest an alternative path.
- `<adr-dir>/NNN-slug.md` already exists → stop with an error. Do not overwrite.

## Built-in template

The built-in template defines the default section structure. It is a generic fallback — project-local conventions belong in `_template.md`.

```markdown
---
status: Proposed
date: YYYY-MM-DD
tags:
  - architecture
---

<!-- This file is the ADR template. All front matter values are examples; replace them when creating a new ADR. -->

# ADR NNN: Title

## Context

<!-- Describe the background, constraints, and assumptions that motivate this decision. -->

## Related ADRs

<!-- List ADRs that this one depends on, supersedes, or relates to. -->

## Decision

### 1. Decision Name

- **Decision:** (what was chosen)
- **Rationale:** (why this choice was made)
- **Alternatives considered:**

  - (description of the alternative)
    - **Rejection reason:** (why this option was not chosen)

- **Trade-offs:** (positive and negative consequences of the decision)

## Considered Alternatives

<!-- Describe broader alternatives not covered under individual decisions. -->

## Consequences

### Positive

<!-- Positive effects of the decision. -->

### Negative

<!-- Negative effects, risks, or limitations introduced by the decision. -->

## Related Documents

<!-- Links to related documents (design docs, skills, commands, etc.). -->
```
