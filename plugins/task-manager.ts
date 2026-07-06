// Thin wrapper around bin/tasks.sh.
// All task logic (create, move, next, progress, list) lives in the shell script.
// This plugin only:
//   1. resolves paths and calls tasks.sh via execSync
//   2. auto-commits to tasks/ git repo after mutations
//   3. parses TSV output into structured JSON

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tool } from "@opencode-ai/plugin";

function scriptEnv(tasksDir: string): NodeJS.ProcessEnv {
  return { PATH: "/bin:/usr/bin", TASKMAN_TASKS_DIR: tasksDir };
}

function gitEnv(): NodeJS.ProcessEnv {
  return { PATH: "/bin:/usr/bin", GIT_CONFIG_NOSYSTEM: "1" };
}

function gitExec(args: string[], cwd: string): string {
  return execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
    cwd,
    encoding: "utf-8",
    env: gitEnv(),
  })
    .toString()
    .trim();
}

function validateTaskPath(tasksDir: string, p: string): string {
  const resolved = resolve(p);
  if (!resolved.startsWith(`${resolve(tasksDir)}/`)) {
    throw new Error(`Task path outside tasks directory: ${p}`);
  }
  const rel = resolved.slice(resolve(tasksDir).length + 1);
  if (!/^(?:pending|in_progress|done|canceled)\/\d{3}[^/]*\.md$/.test(rel)) {
    throw new Error(`Task path has unexpected pattern: ${p}`);
  }
  return resolved;
}

const pluginDir = dirname(fileURLToPath(import.meta.url));

function run(
  ctx: { worktree?: string; directory?: string },
  subcommand: string,
  ...args: string[]
): string {
  const projectRoot = ctx.worktree || ctx.directory || ".";
  const script = resolve(pluginDir, "..", "bin", "tasks.sh");
  const tasksDir = resolve(projectRoot, "tasks");
  try {
    return execFileSync("/bin/bash", [script, subcommand, ...args], {
      encoding: "utf-8",
      env: scriptEnv(tasksDir),
    })
      .toString()
      .trim();
  } catch (error: unknown) {
    const err = error as { stderr?: Buffer; message?: string };
    const stderr = err.stderr?.toString().trim();
    throw new Error(stderr || err.message || String(error));
  }
}

function gitCommit(
  ctx: { worktree?: string; directory?: string },
  msg: string,
  paths: string[],
): void {
  const base = ctx.worktree || ctx.directory || ".";
  const tasksDir = resolve(base, "tasks");
  if (!existsSync(resolve(tasksDir, ".git"))) {
    mkdirSync(tasksDir, { recursive: true });
    gitExec(["init"], tasksDir);
    gitExec(["config", "user.email", "taskman@opencode.local"], tasksDir);
    gitExec(["config", "user.name", "Task Manager"], tasksDir);
  }
  const topLevel = gitExec(["rev-parse", "--show-toplevel"], tasksDir);
  if (resolve(topLevel) !== resolve(tasksDir)) {
    throw new Error(`tasks/ git repo points to unexpected location: ${topLevel}`);
  }
  for (const p of paths) {
    const vp = validateTaskPath(tasksDir, p);
    if (existsSync(vp)) {
      gitExec(["add", vp], tasksDir);
    } else {
      try {
        gitExec(["rm", "--cached", "--ignore-unmatch", vp], tasksDir);
      } catch (rmErr: unknown) {
        const r = rmErr as { stderr?: Buffer; message?: string };
        const errMsg = r.stderr?.toString() || r.message || "";
        if (!errMsg.includes("not removed") && !errMsg.includes("did not match")) throw rmErr;
      }
    }
  }
  try {
    gitExec(["commit", "-m", msg], tasksDir);
  } catch (cmtErr: unknown) {
    const c = cmtErr as { stderr?: Buffer; message?: string };
    const cmtMsg = c.stderr?.toString() || c.message || "";
    if (!cmtMsg.includes("nothing to commit")) throw cmtErr;
  }
}

function parseTSV(
  raw: string,
  hasScore: boolean,
): { id: string; score?: number; description: string }[] {
  const expectedCols = hasScore ? 3 : 2;
  const items: { id: string; score?: number; description: string }[] = [];
  for (const line of raw.trim().split("\n")) {
    const cols = line.split("\t");
    if (!cols[0]) continue;
    if (cols.length !== expectedCols) continue;
    items.push({
      id: cols[0],
      ...(hasScore ? { score: parseInt(cols[1], 10) || 0 } : {}),
      description: cols[hasScore ? 2 : 1],
    });
  }
  return items;
}

export default {
  id: "task-manager",
  server: async () => ({
    tool: {
      task_create: tool({
        description: "Create a new task file in tasks/pending/ with auto-incremented ID.",
        args: {
          description: tool.schema.string().describe("Task summary (one line)"),
          important: tool.schema
            .boolean()
            .optional()
            .default(false)
            .describe("High impact when done"),
          urgent: tool.schema
            .boolean()
            .optional()
            .default(false)
            .describe("Time-sensitive or blocks others"),
          depends_on: tool.schema
            .array(tool.schema.string())
            .optional()
            .default([])
            .describe("Task IDs this depends on"),
        },
        async execute(args, ctx) {
          if (args.description.includes("\t")) {
            throw new Error("Task description must not contain tab characters");
          }
          const cmdArgs = [args.description];
          if (args.important) cmdArgs.push("--important");
          if (args.urgent) cmdArgs.push("--urgent");
          if (args.depends_on?.length) cmdArgs.push("--depends", args.depends_on.join(","));
          const raw = run(ctx, "create", ...cmdArgs);
          const parts = raw.split("\t");
          if (parts.length !== 2 || !parts[0] || !parts[1]) {
            throw new Error(`Malformed create output: ${raw}`);
          }
          const [id, filepath] = parts;
          try {
            gitCommit(ctx, `Add task ${id}: ${args.description}`, [filepath]);
          } catch (commitErr: unknown) {
            const c = commitErr as { message?: string };
            throw new Error(
              `Task ${id} created at ${filepath} but auto-commit failed: ${c.message || commitErr}`,
            );
          }
          return { output: JSON.stringify({ id }) };
        },
      }),

      task_move: tool({
        description:
          "Move a task between states (pending/in_progress/done/canceled). Adds completed_at when moving to done.",
        args: {
          id: tool.schema.string().describe("3-digit task ID"),
          target: tool.schema
            .enum(["pending", "in_progress", "done", "canceled"])
            .describe("Target directory"),
        },
        async execute(args, ctx) {
          const raw = run(ctx, "move", args.id, args.target);
          const parts = raw.split("\t");
          if (parts.length !== 2 || !parts[0] || !parts[1]) {
            throw new Error(`Malformed move output: ${raw}`);
          }
          const [oldpath, newpath] = parts;
          try {
            gitCommit(ctx, `Move task ${args.id} to ${args.target}`, [oldpath, newpath]);
          } catch (commitErr: unknown) {
            const c = commitErr as { message?: string };
            throw new Error(
              `Task ${args.id} moved to ${newpath} but auto-commit failed: ${c.message || commitErr}`,
            );
          }
          return { output: JSON.stringify({ path: newpath }) };
        },
      }),

      task_next: tool({
        description:
          "Calculate priority order for pending tasks using topological sort (tsort) and important/urgent scoring. Returns tasks sorted by dependency order then score.",
        args: {},
        async execute(_args, ctx) {
          const raw = run(ctx, "next");
          const tasks = parseTSV(raw, true);
          return { output: JSON.stringify({ tasks, raw }) };
        },
      }),

      task_progress: tool({
        description:
          "Calculate subtask completion for a task. Counts - [ ] and - [x] in the markdown body.",
        args: {
          id: tool.schema.string().describe("3-digit task ID"),
        },
        async execute(args, ctx) {
          const raw = run(ctx, "progress", args.id).trim();
          const fields = raw.split(/\s+/);
          if (fields.length !== 2 || !/^\d+$/.test(fields[0]) || !/^\d+$/.test(fields[1])) {
            throw new Error(`Malformed progress output: ${raw}`);
          }
          const total = parseInt(fields[0], 10);
          const done = parseInt(fields[1], 10);
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          return { output: JSON.stringify({ total, done, pct }) };
        },
      }),

      task_list: tool({
        description: "List all tasks in a given directory, returning id and description.",
        args: {
          dir: tool.schema
            .enum(["pending", "in_progress", "done", "canceled"])
            .optional()
            .default("pending")
            .describe("Directory to list"),
        },
        async execute(args, ctx) {
          const raw = run(ctx, "list", args.dir);
          return { output: JSON.stringify({ tasks: parseTSV(raw, false), raw }) };
        },
      }),
    },
  }),
};
