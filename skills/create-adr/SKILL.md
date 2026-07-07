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

Create a new ADR file from the user's natural language description, auto-assigning the next sequential ID and validating front matter and required sections. The skill generates the ADR using a template (project-specific `_template.md` or a built-in English fallback) that defines required vs optional sections via `<!-- optional: ... -->` markers.

## When to use me

Call this skill when the user says something like "create an ADR for ...", "new ADR about ...", "record a decision on ...", or any request to document an architectural decision.

## Scope

- Create new ADRs only. Never modify, delete, or renumber existing ones. Reviewing or editing a just-created ADR is part of the creation flow.
- Works with any project that uses standard ADR conventions (NNN-*.md naming, YAML front matter, H2 section structure).

## Preconditions

- The ADR directory (determined in Step 1) either exists or can be created via `mkdir -p`.
- The user has write permission to that directory.

## Conventions

### Template resolution

Template discovery respects a priority chain: `<adr-dir>/_template.md` as project override, built-in English template as fallback.

### Validation policy

Front matter errors block creation; missing optional fields and sections warn but allow proceeding. superseded_by references are validated for format, self-reference, and target existence during Step 6.

## Workflow

### Design rules

- Each step is a **single action**: scan files, present findings, ask the user, write a file.
- `description` (front matter): a concise sentence that supplements the skill name. The agent reads this first when deciding whether to invoke the skill. Choose words for information contrast — clearly distinguishing this skill from others — over grammatical flow.
- `What I do`: supplements the description. Helps the agent confirm that the loaded skill matches the current task by bridging context.
- `Workflow`: executes What I do. Prioritize ambiguity resolution and exception handling over brevity. Be detailed about edge cases and fallback behavior.
- Each step uses the two-layer format:

  ```
  ### Step n: Short action name
  **Normal flow:**
  Happy-path instructions only (no conditionals).

  **Exceptions:**
  - Condition → fallback behavior.
  ```

- Steps with no exception cases may omit the Exceptions block.
- Do **not** include JSON schemas or strict data format definitions. Define input/output semantically: "what information flows in, what comes out, and what to do if information is missing (e.g., ask the user)."

### ADR generation rules

- The generated ADR file has two parts: YAML front matter and markdown body.
- Front matter fields: `status` (required, one of `Proposed`, `Accepted`, `Rejected`, `Deprecated`, `Superseded`), `date` (required, `YYYY-MM-DD`), `tags` (recommended, list of strings), `superseded_by` (required only when `status: Superseded`).
- The body consists of H2 sections. Sections marked with `<!-- optional: ... -->` in the template are optional; all others are required.
- The built-in English template mirrors the project template (`_template.md`) in structure, section ordering, and marker convention. All section headers and content use the same language as the chosen template.
- Use the [Built-in template](#built-in-template) below as the authoritative fallback when no `_template.md` exists.
- Fill in only items with user-provided information. Never fabricate alternatives, trade-offs, or rationale that were not discussed. If the user's input lacks these elements, remove the corresponding bullet point from the section.
- Preserve all section headings from the template, even when the section has no content. For empty optional sections, keep the heading and `<!-- optional: ... -->` comment. For empty required sections, keep the heading. A consistent structure improves pattern recognition for future ADR operations.

### Step 1: Discover ADR directory

**Normal flow:**

1. Search all instruction files for ADR directory path declarations. Collect every unique path.
2. If multiple different paths are found → stop with hard error: "Multiple instruction files specify different ADR directory paths: [`{list}`]. Resolve the conflict in `documentation-policy.md` or `opencode.jsonc` first."
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

- **Found:** Use it as the authoritative template. Parse it to identify required vs optional sections by scanning for `<!-- optional: ... -->` markers immediately below H2 headings.
- **Not found:** Use the built-in English template (see [Built-in template](#built-in-template)).

Report which template is in use: "Template: `<path>` (project override)" or "Template: built-in (English, no `_template.md` found)"

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

### Step 5: Design the ADR content

**Normal flow:**

From the user's natural language description, fill in each section of the template:

1. **Title:** Derive a short, descriptive title from the user's request. Combine with the ID from Step 4 to form the file slug: `NNN-slug.md`. **Slug generation:** Generate the slug in English. For English body: lowercase the title, replace spaces and special characters with hyphens (kebab-case). For Japanese body: LLM-translate the title to English first, then apply kebab-case. Example: `新しいデータベースを採用する` → `adopt-new-database`.
2. **Front matter:** Set `status: Proposed`, `date: YYYY-MM-DD` (today's date), `tags` from user input (if user didn't specify, leave as `[]` and warn in Step 6).
3. **Required sections:** Fill from user input. If content for a required section has fewer than two substantive points or lacks specific rationale, ask the user for more detail before proceeding. If the user confirms "leave as-is", preserve the section heading with no body content. Never fabricate alternatives, trade-offs, or rationale that the user did not discuss.
4. **Optional sections:** Fill if the user provided relevant information. Leave with the `<!-- optional: ... -->` placeholder comment intact if no content.

Detect template language by examining the section headings and comments in `_template.md`. If they are in Japanese, generate the ADR body in Japanese. If using the built-in English template or a template with English headings, generate in English.

**Exceptions:**

- Slug collision (a file `NNN-slug.md` already exists) → suggest an alternative slug and ask the user to confirm.
- User provides insufficient detail for a required section → ask clarifying questions:
  - "What problem or context led to this decision?"
  - "What alternatives were considered, and why were they rejected?"
  - "What are the positive and negative consequences of this decision?"
  - "Does this decision relate to any other ADRs?" Do not fabricate alternatives, trade-offs, or rationale the user did not discuss.

### Step 6: Validate

**Normal flow:**

Validate the generated ADR content before writing:

**Hard error (blocks creation):**

- `status` missing or not one of `Proposed`, `Accepted`, `Rejected`, `Deprecated`, `Superseded`
- `date` missing or not in `YYYY-MM-DD` format
- YAML syntax error in front matter
- `status: Superseded` but `superseded_by` missing
- `superseded_by` references an invalid filename format (not `NNN-slug.md`)
- `superseded_by` references the same ADR (self-reference)
- `superseded_by` references an ADR that does not exist in the project

**Warning (allows creation after user confirmation):**

- `tags` missing or empty
- Required H2 section missing — a section is required when its heading in the template does not include the `<!-- optional: ... -->` comment

Present all errors and warnings to the user. On hard error → stop and ask the user to fix. On warning → show warnings and ask "Proceed anyway?" If the user declines, return to Step 5 for revision or stop without writing.

**Exceptions:**

- Template parsing failed to identify section markers → treat all sections as required. Warn the user that automatic section validation was skipped.

### Step 7: Create file and report

**Normal flow:**

Write the file at `<adr-dir>/NNN-slug.md`.

Print a summary:

- **ID:** `NNN`
- **Title:** `<title>`
- **Status:** `Proposed`
- **Location:** `<adr-dir>/NNN-slug.md`
- **Template used:** `<source>`
- **Sections:** required `<N>/<M>` filled, optional `<O>/<P>` filled

Ask the user if they want to review or edit the file before finishing.

**Exceptions:**

- Write fails (permission denied, disk full) → report error and suggest an alternative path.
- `<adr-dir>/NNN-slug.md` already exists → stop with an error. Do not overwrite.

## Built-in template

The built-in template mirrors the project template (`_template.md`) structure in English. It uses the same `<!-- optional: ... -->` marker convention:

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

<!-- optional: List ADRs that this one depends on, supersedes, or relates to. -->

- **ADR NNN:** Description of the relationship

## Decision

### 1. Decision Name

- **Decision:** (what was chosen)
- **Alternatives considered:** (what other options were evaluated and rejected)
- **Rationale:** (why this choice was made)
- **Trade-offs:** (positive and negative consequences of the decision)

## Considered Alternatives

<!-- optional: Describe broader alternatives not covered under individual decisions. -->

## Consequences

### Positive

<!-- Positive effects of the decision. -->

### Negative

<!-- Negative effects, risks, or limitations introduced by the decision. -->

## Related Documents

<!-- optional: Links to related documents (design docs, skills, commands, etc.). -->

| Document | Relationship |
| -------- | ------------ |
```
