---
name: create-agent
description: Creates new OpenCode subagent definition files in agents/
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: setup
---

## What I do

Create a new OpenCode agent definition as a `.md` file from the user's natural language description. The generated file uses a core template (Role / Input / Output) with optional additional sections for domain-specific instructions.

## When to use me

Call this skill when the user says something like "create an agent to ...", "new agent for ...", or any request to generate a reusable agent definition.

## Scope

- Create new agents only. Never modify or delete existing ones.
- Works with project-local (`.opencode/agents/`) and global (`$OPENCODE_CONFIG_DIR/agents/`) locations.
- Does not validate the generated agent's behavior — validation is left to the user.

## Preconditions

- The current project root must be determinable for project-local agent placement.
- The target directory's parent exists or can be created via `mkdir -p`.
- The user has write permission to the target location.

## Workflow

### Design rules

- Each step is a **single action**: scan files, present findings, ask the user, write a file.
- `description` (front matter): a concise sentence that supplements the agent name. The agent reads this first when deciding whether to invoke the agent. Choose words for information contrast — clearly distinguishing this skill from others — over grammatical flow.
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

### Generated agent file rules

- The generated agent file must follow the template:

  ```markdown
  ---
  name: { name }
  description: { description }
  mode: subagent
  temperature: 0.1
  permission:
    edit: deny
    bash: deny
  ---

  # Role

  {role}

  # Input

  {input}

  # Output

  {output}
  ```

- Additional sections beyond Role / Input / Output are allowed when the agent requires domain-specific instructions that should always be loaded when the agent runs. Example: reviewer agents may add a `# Criteria` section containing evaluation dimensions.
- Shared coding values (KISS (Keep It Simple, Stupid), YAGNI (You Aren't Gonna Need It), DRY (Don't Repeat Yourself), etc.) belong in the `coding-principles` skill, not in individual agent files. Both implementers and reviewers load this skill to align on the same values.
- The generated agent must be written in English.

### Step 1: Inventory all existing agents

**Normal flow:**

Find all agent locations that OpenCode currently scans. These are:

| Scope         | Directory                                                               |
| ------------- | ----------------------------------------------------------------------- |
| Project-local | `.opencode/agents/` (relative to project root)                          |
| Global        | `$OPENCODE_CONFIG_DIR/agents/` (fallback: `~/.config/opencode/agents/`) |

For each agent found, collect its `name`, `description`, and file path. Present the collected list to the user so they can verify uniqueness and choose an appropriate location.

**Exceptions:**

- Inventory is empty → continue anyway. This is a valid state — the agent being created may be the first one.
- A location does not exist yet → do not create it here. Continue with what exists.
- An agent file cannot be read or has malformed front matter → include the file path in the inventory with metadata fields set to `unknown`, warn the user, and continue.

### Step 2: Determine target location

**Normal flow:**

Infer the target location from the user's language:

| User says | Target |
| --- | --- |
| `"project-local"`, `"local only"`, `"project-specific"` | `.opencode/agents/` relative to current project root |
| `"global"`, `"shared"`, `"reusable across projects"` | `$OPENCODE_CONFIG_DIR/agents/` (fallback: `~/.config/opencode/agents/`) |
| Neither is clear | Use the default (`$OPENCODE_CONFIG_DIR/agents/`) |

Show the inferred location to the user and confirm: "I will create the agent at `<location>`. Is that correct?"

**Exceptions:**

- User disagrees with inferred location → ask them to specify the desired path.
- Parent directory of a default location doesn't exist → create silently.
- Parent directory of a user-chosen path doesn't exist → ask "create it or choose another location." If they choose to create, note the user's approval and proceed. If they choose another location, ask for the new path and restart the confirmation.
- User-chosen path is outside OpenCode's standard agent discovery paths → warn that the agent may not be auto-discovered and require explicit confirmation before proceeding.
- Target path exists but is not writable → inform user and ask for an alternative location.

### Step 3: Design the agent

**Normal flow:**

From the user's description, design the agent by defining its required elements first, then any optional additional sections.

**Required elements (every agent has these):**

**Identity:**

- **`name`**: Must match regex `^[a-z0-9]+(-[a-z0-9]+)*$`, 1-64 chars, and be **unique** across all agent files found in Step 1.
- **`description`**: 1-100 chars (120 max if unavoidable).
  - Unique: avoid repeating another agent's stated purpose or first sentence. Prefer a clearly distinct trigger sentence.
  - Specific: state what the agent does in one sentence. Do not mention input or output.

**Prompt sections:**

- **`role`**: A persona string starting with `"You are a {role}. {One-sentence responsibility}."` Input/Output are described in their own sections — the role line should not duplicate them.
- **`input`**: What data the agent receives. Describe semantically (not as a schema). Example: "Path to a documentation file to review."
- **`output`**: What the agent produces. Describe the expected format semantically. The format should be consistent and predictable (e.g., a list of findings, a structured markdown table, a JSON array). No greetings, preambles, or free-form prose in the output. Example: "List of findings as a JSON array of {location, issue, severity}, with no wrapper text."

**Runtime defaults:**

- **`temperature`**: Default `0.1`. Ask the user only if they express a specific need for higher creativity.
- **`permission`**: Default `edit: deny, bash: deny`. User can override if the agent needs specific tool permissions.

**Additional sections (optional):**

If the agent requires domain-specific instructions that must always be loaded when the agent runs, design one or more additional sections beyond the required elements. Ensure all sections use the same level of detail — either all high-level principles or all specific guidelines, not mixed.

Example: reviewer agents typically add a `# Criteria` section listing evaluation dimensions. Describe each dimension semantically (not as a JSON schema). Do not duplicate shared coding values — those are provided by the `coding-principles` skill.

For other agent types, additional sections may take different forms (e.g., `# Guidelines`, `# Dialogue`) as needed.

**Exceptions:**

- Generated `name` doesn't match regex → adjust and retry. If repeated attempts fail → ask the user to suggest a name.
- Name collision detected (same name in any scanned location) → stop with an error. Do not overwrite.
- Description semantically overlaps with an existing agent → suggest renaming or redesigning the description even if the name is unique.
- User provides insufficient description → ask clarifying questions: "What role should this agent play? What kind of input does it receive? What output format should it produce?"

### Step 4: Create the agent file

**Normal flow:**

Ensure the target directory exists:

```bash
mkdir -p "<target-dir>"
```

Write the agent file at `<target-dir>/<name>.md` using the template from the Generated agent file rules.

**Exceptions:**

- `<target-dir>/<name>.md` already exists → stop with an error. Do not overwrite.
- `mkdir` fails (e.g., permission denied) → report error and ask the user to resolve it or choose a different location.
- Write fails → report error with details.

### Step 5: Report

**Normal flow:**

Print a summary:

- name: `<name>`
- description: `<description>`
- location: `<target-dir>/<name>.md`

Optionally ask the user if they want to review or edit the generated agent before finishing.
