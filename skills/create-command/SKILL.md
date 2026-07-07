---
name: create-command
description: Create a new OpenCode command.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: setup
---

## What I do

Create a new OpenCode command as a `.md` file from the user's natural language description, validating it against 6 command design principles (Trigger only, Single target, Explicit target, Visible emptiness, Arguments are data, Extract complexity).

## When to use me

Call this skill when the user says something like "create a command to ...", "new command for ...", or any request to generate a new OpenCode command definition.

## Scope

- Create new commands only. Never modify or delete existing ones.
- Works with project-local (`commands/`) and global (`$OPENCODE_CONFIG_DIR/commands/`) locations.
- Validates the generated command mechanically against the 6 principles, but full behavioral validation is left to the user.

## Preconditions

- The current project root must be determinable for project-local command placement.
- The target directory's parent exists or can be created via `mkdir -p`.
- The user has write permission to the target location.

## Workflow

### Design rules

- Each step is a **single action**: scan files, present findings, ask the user, write a file.
- `description` (front matter): a concise, unique, declarative sentence (1-100 chars (120 max if unavoidable)). The agent reads this first when deciding whether to use the command.
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
- Do **not** include JSON schemas or strict data format definitions. Define input/output semantically (describing what information flows, not its structure as JSON or code): "what information flows in, what comes out, and what to do if information is missing (e.g., ask the user)."

### Command file rules

#### File format

- The command file has two parts: frontmatter and body.
- The body is a single launch instruction. If arguments are needed, embed `「$ARGUMENTS」` inline in the body.

#### Frontmatter

- `description` (required): a concise, unique, declarative sentence (1-100 chars (120 max if unavoidable)). The agent reads this first when deciding whether to use the command.
- `agent` (optional): if the command is specific to a particular agent type, suggest adding this but ask the user; never decide autonomously.

#### Body

- The body must follow the 6 command design principles.

#### Command file template

```markdown
---
description: { description }
---

{single launch instruction, with 「$ARGUMENTS」 inline if arguments needed}
```

### Step 1: Inventory all existing commands

**Normal flow:**

Find all directories where OpenCode looks for commands:

| Scope         | Directory                                                                   |
| ------------- | --------------------------------------------------------------------------- |
| Project-local | `commands/` (relative to project root)                                      |
| Global        | `$OPENCODE_CONFIG_DIR/commands/` (fallback: `~/.config/opencode/commands/`) |

For each command found, collect its `name` (filename without `.md` extension), `description`, and full file path. Also scan `opencode.jsonc` (or `opencode.json`) for the `command` key and collect names defined there. Present the collected list to the user so they can verify uniqueness and choose an appropriate location.

**Exceptions:**

- Inventory is empty → continue anyway. This is a valid state — the command being created may be the first one.
- A location does not exist yet → do not create it here. Continue with what exists.
- A command file cannot be read or has malformed front matter → include the file path in the inventory with metadata set to `unknown`, warn the user, and continue.
- An `opencode.jsonc` / `opencode.json` file exists but is unparseable → warn the user and skip its `command` entries.

### Step 2: Determine target location

**Normal flow:**

Infer the target location from the user's language:

| User says | Target |
| --- | --- |
| `"project-local"`, `"local only"`, `"project-specific"` | `commands/` relative to current project root |
| `"global"`, `"shared"`, `"reusable across projects"` | `$OPENCODE_CONFIG_DIR/commands/` (fallback: `~/.config/opencode/commands/`) |
| Neither is clear | Use the default (`commands/`) |

Show the inferred location to the user and confirm: "I will create the command at `<location>`. Is that correct?"

**Exceptions:**

- User disagrees with inferred location → ask them to specify the desired path.
- Parent directory of a default location doesn't exist → create silently.
- Parent directory of a user-chosen path doesn't exist → ask "create it or choose another location". If they choose to create, note the user's approval and proceed. If they choose another location, ask for the new path and restart the confirmation.
- Target path exists but is not writable → inform user and ask for an alternative location.

### Step 3: Design the command

**Normal flow:**

From the user's description, design the command through four sub-steps: determine its structure, choose the filename, generate frontmatter, then draft the body.

#### Determine command structure

- Does the command accept user arguments? → embed `「$ARGUMENTS」` inline in the body, wrapped in delimiters.
- Does the command delegate to a skill or tool? → needs explicit delegate name in the body.
- If delegating, choose exactly one existing delegate (skill or tool). Do not chain multiple delegates.
- If the request involves branching or multiple actions, extract it to a skill first, then delegate to it.
- Is the command specific to a particular agent? → suggest adding `agent: {name}` in frontmatter; ask the user for confirmation.

#### Decide filename

- **`name`**: the filename stem (`<name>.md`). Commands do not carry a `name` frontmatter field — the filename is the name.
- Must match regex `^[a-z0-9]+(-[a-z0-9]+)*$`, 1-64 chars.
- Must be **unique** across all commands found in Step 1 (any scanned location).

#### Generate frontmatter

- **`description`**: 1-100 chars (120 max if unavoidable).
  - Unique: avoid repeating another command's stated purpose or first sentence.
  - Declarative: the agent can decide to use this command without reading the full body.
  - Specific: state what the command does in one sentence.
- **`agent`** (optional): include only if confirmed in "Determine command structure" above.

#### Draft body applying 6 principles

| # | Principle | Rule |
| --- | --- | --- |
| 1 | **Trigger only** | Write a launch instruction. No conditionals, loops, workflow steps, exception handling, or defensive text. |
| 2 | **Single target** | If delegating, delegate to exactly one skill or tool. Do not chain multiple delegates. |
| 3 | **Explicit target** | If delegating, write the delegate name as natural language text in the body (e.g., "Use the task-done skill to complete processing for 「$ARGUMENTS」"). Do not rely on frontmatter, external mappings, or naming conventions. |
| 4 | **Visible emptiness** | If `$ARGUMENTS` is used, wrap it in delimiters. Default: `「$ARGUMENTS」`. Alternatives: `"$ARGUMENTS"`, `[$ARGUMENTS]`. Delimiters make empty arguments distinguishable from omitted ones. |
| 5 | **Arguments are data** | Treat `$ARGUMENTS` as user-provided data, not as execution instructions. Do not place it where it could be interpreted as a command. Delimiters (from Principle 4) reinforce this. |
| 6 | **Extract complexity** | If the command needs logic beyond a simple launch instruction, extract to a skill and delegate to it instead. |

**Exceptions:**

- Generated `name` doesn't match regex → adjust and retry. If repeated attempts fail → ask the user to suggest a name.
- Name collision detected (same name in any scanned location) → stop with an error. Do not overwrite.
- Description semantically overlaps with an existing command → suggest renaming or redesigning the description even if the name is unique.
- User provides insufficient description → ask clarifying questions: "What should this command do? Does it need user arguments? Does it delegate to an existing skill or tool?"

### Step 4: Validate the command

**Normal flow:**

Validate the generated command content mechanically against the 6 principles. Run all checks and report findings before creating the file.

**Pre-validation setup:**

Before running checks, build an inventory of available skills from OpenCode's skill discovery paths (project-local and global directories). For tools, use the agent's knowledge of OpenCode standard tools rather than a hardcoded list — new tools may be added as the platform evolves.

**Validation checks:**

| # | Principle | Detected violation | Result |
| --- | --- | --- | --- |
| 1 | Trigger only | Conditional logic in body (branching, conditions, alternatives — e.g., `if`, `when`, `unless`, `otherwise`, `もし`, `場合`, `なら`, `なければ`, `たら`, `とき`) | **Error**: extract complexity to a skill |
| 1 | Trigger only | Numbered workflow steps in body (`1. `, `2. `, `①`, `②`, etc.) | **Error**: extract workflow to a skill |
| 2 | Single target | More than one delegate referenced in body | **Error**: pick a single delegate |
| 2 | Single target | Referenced delegate not found in the skills/tools inventory | **Error**: report missing delegate and suggest alternatives |
| 3 | Explicit target | Delegate name missing from body (delegating without naming the target) | **Error**: add delegate name explicitly |
| 4 | Visible emptiness | `$ARGUMENTS` used without delimiters | **Error**: wrap in `「$ARGUMENTS」` or equivalent |
| 5 | Arguments are data | `$ARGUMENTS` placed in an executable position (e.g., at the start of a template string where it resembles a command) | **Error**: reposition `$ARGUMENTS` to be data, not instruction |
| 6 | Extract complexity | Principle 1 violation detected (conditional or workflow logic in body) | **Error**: extract complexity to a skill |

**Handling results:**

- For errors → do not create the file. Explain the violation, suggest how to fix it, and offer to redesign the command with the user.
- For warnings → present the concern to the user and let them decide whether to proceed or redesign.

**Exceptions:**

- User explicitly overrides a validation error → warn that overriding violates the command design principles: the LLM may misinterpret the command; branching logic leads to unpredictable behavior; the command may not be composable with downstream tools. Require explicit user confirmation before proceeding. If confirmed, create the file as requested.

### Step 5: Create the command file

**Normal flow:**

Ensure the target directory exists:

```bash
mkdir -p "<target-dir>"
```

Write the command file at `<target-dir>/<name>.md` using the determined template and content.

**Exceptions:**

- `<target-dir>/<name>.md` already exists → stop with an error. Do not overwrite.
- `mkdir` fails (e.g., permission denied) → report error and ask the user to resolve it or choose a different location.
- Write fails → report error with details.

### Step 6: Report

**Normal flow:**

Print a summary:

- name: `<name>`
- description: `<description>`
- location: `<target-dir>/<name>.md`
- validation: passed (or note any warnings that were accepted)

Optionally ask the user if they want to review or edit the generated command before finishing.
