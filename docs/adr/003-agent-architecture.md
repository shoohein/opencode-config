# ADR 003: Single-file agents with skill-based principle injection

- **Status**: Accepted
- **Date**: 2026-07-05

## Context

OpenCode's `{file:}` syntax cannot load from URLs, making it unsuitable for referencing remote repositories. This leaves two built-in mechanisms for providing instructions to agents:

1. **Global `instructions`** — always loaded for every session, causing context pressure on unrelated tasks (e.g., loading design review criteria during a bug investigation).
2. **`agents/<name>.md`** — loaded only when the agent is invoked, but a single file with no native composition mechanism (`agent.<name>.prompt` overwrites the file content rather than merging).

Additionally, implementers and reviewers need to share the same coding values (KISS, YAGNI, DRY, etc.) to avoid friction loops where a reviewer flags something the implementer never considered.

## Decision

### Architecture

```
Global instructions (opencode.jsonc)
  └─ Operational metadata only (task management, doc policy, etc.)
  └─ No coding values or evaluation criteria

Skills (loaded on demand via skill() tool)
  └─ coding-principles       ← KISS, YAGNI, DRY, etc.

Agents (agents/<name>.md)
  └─ Role / Input / Output  (always present)
  └─ Criteria                (reviewer agents only — evaluation dimensions)
```

### Rules

1. **Single-file agents**: Each agent is defined by exactly one file at `agents/<name>.md`. No `{file:}` composition, no `agent.<name>.prompt` override.

2. **Sections**: Every agent file has at minimum Role, Input, Output. Additional sections may be added when the agent requires domain-specific instructions that must always be loaded when the agent runs. Example: reviewer agents may add a `# Criteria` section.

3. **Shared coding values**: Coding principles (KISS, YAGNI, DRY, etc.) live in the `coding-principles` skill, not in individual agent files. Both implementers and reviewers load this skill to align on the same values.

4. **Global instructions**: Restricted to project-wide operational metadata (task management, session status, documentation policy, critical thinking guidelines). No coding values or review criteria.

5. **Evaluation criteria**: Reviewer-specific evaluation dimensions are embedded in the agent file as a `# Criteria` section. They are not shared globally.

### Mechanism

- Skills are loaded via the native `skill()` tool, which injects the full `SKILL.md` content into the conversation only when called.
- The `skill` tool's `<available_skills>` list (name + description) is always present, but descriptions are lightweight (~100 chars each).
- Subagents can load skills — OpenCode docs show per-agent `permission.skill` configuration for custom agents, confirming they have access to the tool.

## Consequences

### Positive

- **No context pressure**: A bug-investigation session loads only global instructions (~4 files), not review criteria or design principles.
- **Shared values**: Both implementer and reviewer load the same `coding-principles` skill, reducing review friction.
- **Simple management**: One file per agent, no composition glue.
- **No `{file:}` dependency**: Works entirely within built-in OpenCode mechanisms (agent files + skills).

### Negative

- **LLM-dependent skill selection**: The agent must decide to load `coding-principles` based on the skill description. Trigger-word quality in the description is critical for reliability.
- **Skill descriptions always visible**: Every skill's name + description (~1-2 KB total) is always present in the system prompt. The full content is loaded on demand.

## Alternatives Considered

- **`{file:}` composition**: Rejected because it cannot load from URLs, making it unusable for cross-repository instruction sharing.
- **Global instructions for everything**: Rejected because it loads task-specific content (review criteria, coding principles) into every session regardless of relevance.
- **Plugin-based dynamic injection**: Rejected because OpenCode plugins do not expose hooks for system prompt composition.
- **`agent.<name>.prompt` with inline content**: Rejected because it duplicates or overwrites the agent file content rather than composing with it.
