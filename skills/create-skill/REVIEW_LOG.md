# Review log — create-skill

## Dismissed findings

### Step 1: inventory scan scope

**Source**: doc-reviewer (2026-07-01, final review)

**Finding**: Step 1 says "Find all directories where OpenCode looks for skills" but does not explicitly list `$OPENCODE_CONFIG_DIR/skills/`, which could cause the uniqueness check in Step 3 to miss installed skills.

**Decision**: Rejected. Explicitly listing paths contradicts the earlier design decision to keep concrete paths out of the skill (agent should discover them dynamically or check official docs). The current phrasing "project-local and global skill directories" is sufficient.
