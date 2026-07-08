---
name: create-skill
description: Create a new OpenCode skill as a SKILL.md file.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: setup
---

## What I do

Create a new OpenCode agent skill as a `SKILL.md` file from the user's natural language description.

## When to use me

Call this skill when the user says something like "create a skill to ...", "new skill for ...", or any request to generate a reusable skill definition.

## Scope

- Create new skills only. Never modify or delete existing ones.
- Works with all OpenCode skill locations (`.opencode/skills/`, `~/.config/opencode/skills/`, etc.).
- Does not validate the generated skill's behavior — validation is left to the user.

## Preconditions

- The current project root must be determinable for project-local skill placement.
- The target skill directory's parent exists or can be created via `mkdir -p`.
- The user has write permission to the target location.

## Workflow

### Design rules

- Each step is a **single action**: read a file, run a command, present findings, ask the user.
- Keep sentences short and direct. For complex concepts, use multiple sentences or bullet lists instead of long nested clauses.
- `description` (front matter): a concise sentence that supplements the skill name. The agent reads this first when deciding whether to invoke the skill. Choose words for information contrast — clearly distinguishing this skill from others — over grammatical flow.
- `What I do`: supplements the description. Helps the agent confirm that the loaded skill matches the current task.
- `Workflow`: executes What I do. Be detailed about edge cases and fallback behavior.
- The generated Workflow uses a two-layer format (Normal flow + Exceptions) to separate happy-path logic from edge cases:

  ```
  ### Step n: Short action name
  **Normal flow:**
  Happy-path instructions only (no conditionals).

  **Exceptions:**
  - Condition → fallback behavior.
  ```

- Steps with no exception cases may omit the Exceptions block.
- For skills that perform irreversible or destructive actions (file overwrites, database modifications, deletions, or system state changes), add a mandatory fail-safe step: "Present a dry-run plan to the user and get explicit approval before executing."
- Do **not** include JSON schemas or strict data format definitions. Define input/output by describing what information flows in and out, and what to do if information is missing (e.g., ask the user).
- The generated skill must be written in English.

### Steps overview

1. **Inventory** existing skills for uniqueness checks.
2. **Determine** target location (project-local or global).
3. **Design** the skill name, description, and sections.
4. **Create** the skill directory and `SKILL.md` file.
5. **Report** the result.

### Step 1: Inventory all existing skills

**Normal flow:**

Find all directories where OpenCode looks for skills — project-local and global skill directories.

For each skill found, collect its `name`, `description` and file path. Present the collected list to the user as a reference.

**Exceptions:**

- Inventory is empty → continue anyway. This is a valid state — the skill being created may be the first one.
- A skill location does not exist yet → do not create it here. Continue with what exists.
- A `SKILL.md` file cannot be read or has malformed front matter → include the file path in the inventory with metadata set to `unknown`, warn the user, and continue.

### Step 2: Determine target location

**Normal flow:**

`$OPENCODE_CONFIG_DIR` is the OpenCode configuration directory (typically `~/.config/opencode/`).

| User says | Target |
| --- | --- |
| `"project-local"`, `"local only"`, `"project-specific"` | `.opencode/skills/` relative to current project root |
| `"global"`, `"shared"`, `"reusable across projects"` | `$OPENCODE_CONFIG_DIR/skills/` (fallback: `~/.config/opencode/skills/`) |
| Neither is clear | Use the default (`$OPENCODE_CONFIG_DIR/skills/`, fallback: `~/.config/opencode/skills/`) |

Show the inferred location to the user and confirm: "I will create the skill at `<location>`. Is that correct?"

**Exceptions:**

- User disagrees with inferred location → ask them to specify the desired path.
- Parent directory of a default location doesn't exist → create silently.
- Parent directory of a user-chosen path doesn't exist → ask the user: "Create the parent directory, or specify a different location?" and wait for their choice. If they choose to create, note the user's approval and proceed. If they choose another location, ask for the new path and restart the confirmation.
- User-chosen path is outside OpenCode's standard skill directories → warn: "This path is not in OpenCode's default search scope. The skill may not be auto-discovered." Ask for confirmation before proceeding.
- Target path exists but is not writable → inform user and ask for an alternative location.

### Step 3: Design the skill

**Normal flow:**

From the user's description, generate the skill content. If the user's request lacks details, ask clarifying questions:

- What is the purpose? (What I do)
- When should it be used? (When to use me)
- What tools are used, and in what order? (Workflow)
- What should be output, and how? (if needed)

Then generate:

- **`name`**: Must match regex `^[a-z0-9]+(-[a-z0-9]+)*$`, 1-64 chars, and be **unique** across all locations scanned in Step 1.
- **`description`**: 1-100 chars (120 max if unavoidable).
  - Unique: ensure the description is semantically distinct from existing skills — avoid similar wording or overlapping purpose statements.
  - Declarative: the agent can decide to invoke this skill without reading the full body.
  - Specific: state what the skill does in one sentence.
- **`license`**: `MIT`
- **`compatibility`**: `opencode`
- **`metadata`**: `audience` (developers | all) and `workflow` (a short category name).
- **Sections**: `What I do`, `When to use me`, `Scope`, `Preconditions`, `Workflow`.

**Exceptions:**

- Generated `name` doesn't match regex → adjust and retry. If repeated attempts fail → ask the user to suggest a name.
- Name collision detected (same name in any location) → present the conflict, suggest an alternative name, and ask which to use. If the user insists on the colliding name, stop with an error explaining the conflict.
- Description semantically overlaps with an existing skill → suggest renaming or redesigning the description even if the name is unique.

### Step 4: Create the skill file

**Normal flow:**

Create the parent directory if needed:

```bash
mkdir -p "<target-dir>"
```

Create the skill directory:

```bash
mkdir "<target-dir>/<name>/"
```

Write the `SKILL.md` file with proper frontmatter and sections.

**Exceptions:**

- `<target-dir>/<name>/` already exists → stop with an error. Do not overwrite.
- `mkdir` fails (e.g., permission denied) → report error and ask the user to resolve it or choose a different location.
- Writing the `SKILL.md` file fails → report the specific error (permission denied, disk full, partial write) and stop. If the directory was created but the `SKILL.md` file was not written, remove the empty directory so the next attempt is not blocked by the "already exists" check. Inform the user about the cleanup.

### Step 5: Report

**Normal flow:**

Print a summary:

- name: `<name>`
- description: `<description>`
- location: `<target-dir>/<name>/SKILL.md`

Optionally ask the user if they want to review or edit the generated skill before finishing.
