import { type Hooks, type PluginInput, tool } from "@opencode-ai/plugin";
import type { Event } from "@opencode-ai/sdk";

const PREFIX_REGEX = /^【(?:完了|中断|回収)】\s*/;
const RECOVERY_PREFIX = "【回収】";
const ABANDONED_THRESHOLD_MS = 3 * 60 * 60 * 1000;
const LOCK_TTL_MS = 10 * 60 * 1000;

type Lock = {
  recoverySessionId: string;
  startedAt: number;
  ttlMs: number;
};

function isSessionActive(type: string): boolean {
  return type === "busy" || type === "retry";
}

async function fileExists(path: string): Promise<boolean> {
  return await Bun.file(path).exists();
}

async function readText(path: string): Promise<string> {
  return await Bun.file(path).text();
}

async function writeText(path: string, content: string): Promise<void> {
  await Bun.write(path, content);
}

async function ensureEpoch(epochPath: string): Promise<void> {
  if (await fileExists(epochPath)) return;
  await writeText(epochPath, String(Date.now()));
}

async function readLock(lockPath: string): Promise<Lock | null> {
  if (!(await fileExists(lockPath))) return null;
  try {
    return JSON.parse(await readText(lockPath));
  } catch {
    return null;
  }
}

async function writeLock(lockPath: string, lock: Lock): Promise<void> {
  await writeText(lockPath, JSON.stringify(lock));
}

async function isLockStale(
  lock: Lock,
  statuses: Record<string, { type: string }>,
): Promise<boolean> {
  if (!lock.recoverySessionId) return Date.now() - lock.startedAt > lock.ttlMs;
  const status = statuses[lock.recoverySessionId];
  if (status && isSessionActive(status.type)) return false;
  return Date.now() - lock.startedAt > lock.ttlMs;
}

async function runRecoverySweep(client: PluginInput["client"], baseDir: string): Promise<void> {
  const epochPath = `${baseDir}/.opencode/.recovery-epoch`;
  const lockPath = `${baseDir}/.opencode/.recovery.lock`;

  await ensureEpoch(epochPath);
  const epoch = parseInt(await readText(epochPath), 10);

  const sessionsResp = await client.session.list();
  const sessions = sessionsResp.data ?? [];
  const statusResp = await client.session.status();
  const statuses = statusResp.data ?? {};

  const now = Date.now();
  const abandoned = sessions.filter((s) => {
    if (PREFIX_REGEX.test(s.title)) return false;
    if (s.time.created <= epoch) return false;
    const st = statuses[s.id];
    if (st && isSessionActive(st.type)) return false;
    if (now - s.time.updated <= ABANDONED_THRESHOLD_MS) return false;
    return true;
  });

  if (abandoned.length === 0) return;

  abandoned.sort((a, b) => a.time.updated - b.time.updated);
  const target = abandoned[0];

  const existingLock = await readLock(lockPath);
  if (existingLock) {
    if (!(await isLockStale(existingLock, statuses))) return;
  }

  // Write lock before session creation to prevent race condition
  await writeLock(lockPath, {
    recoverySessionId: "",
    startedAt: now,
    ttlMs: LOCK_TTL_MS,
  });

  const createResp = await client.session.create({
    body: { title: `${RECOVERY_PREFIX} RECOVERY`, parentID: target.id },
  });
  if (!createResp.data) return;
  const recoveryId = createResp.data.id;

  await writeLock(lockPath, {
    recoverySessionId: recoveryId,
    startedAt: now,
    ttlMs: LOCK_TTL_MS,
  });

  await client.session.command({
    path: { id: recoveryId },
    body: { command: "session-recover", arguments: target.id },
  });
}

function createTools(client: PluginInput["client"], $: PluginInput["$"]) {
  return {
    session_title: tool({
      description:
        "Set the session title while preserving any existing status prefix（【完了】【中断】【回収】）.",
      args: {
        title: tool.schema.string().describe("New title body (without prefix)"),
      },
      async execute(args, ctx) {
        if (!args.title.trim()) {
          return { output: "", metadata: { skipped: true, reason: "title must not be empty" } };
        }
        const r = await client.session.get({ path: { id: ctx.sessionID } });
        const current = r.data?.title ?? "";
        const prefix = (current.match(PREFIX_REGEX) ?? [""])[0];
        const newTitle = prefix ? `${prefix}${args.title}` : args.title;
        const updateResp = await client.session.update({
          path: { id: ctx.sessionID },
          body: { title: newTitle },
        });
        if (!updateResp.data) {
          return { output: "", metadata: { skipped: true, reason: "session update failed" } };
        }
        ctx.metadata({ title: newTitle });
        return { output: newTitle };
      },
    }),

    session_mark: tool({
      description: "Update the status prefix of the session title. The body text is preserved.",
      args: {
        status: tool.schema.enum(["完了", "中断", "回収"]).describe("New session status"),
      },
      async execute(args, ctx) {
        const r = await client.session.get({ path: { id: ctx.sessionID } });
        const body = (r.data?.title ?? "").replace(PREFIX_REGEX, "").trim();
        const newTitle = `【${args.status}】 ${body}`;
        const updateResp = await client.session.update({
          path: { id: ctx.sessionID },
          body: { title: newTitle },
        });
        if (!updateResp.data) {
          return { output: "", metadata: { skipped: true, reason: "session update failed" } };
        }
        ctx.metadata({ title: newTitle });
        return { output: newTitle };
      },
    }),

    session_add_note: tool({
      description: "Attach a git note to a commit for session traceability.",
      args: {
        commit: tool.schema.string().describe("Target commit hash"),
        note: tool.schema.string().describe("JSON note string"),
      },
      async execute(args) {
        const gitCheck = await $`git rev-parse --git-dir`.nothrow().quiet();
        if (gitCheck.exitCode !== 0) {
          return {
            output: "git notes skipped",
            metadata: { skipped: true, reason: "git repository not found" },
          };
        }
        const r = await $`git notes add -m ${args.note} -- ${args.commit}`.nothrow().quiet();
        if (r.exitCode !== 0) {
          return {
            output: "git notes skipped",
            metadata: { skipped: true, reason: "git notes command failed" },
          };
        }
        return { output: "notes added" };
      },
    }),

    session_read_log: tool({
      description:
        "Read all messages from a specified session as structured JSON. Each entry contains role, text, thinking, and tools. Note: only text, reasoning, and tool parts are returned; other part types (file, step-start, etc.) are omitted.",
      args: {
        sessionId: tool.schema.string().describe("Session ID to read messages from"),
      },
      async execute(args) {
        const msgs = await client.session.messages({ path: { id: args.sessionId } });
        if (!msgs.data?.length) {
          return { output: JSON.stringify({ session: args.sessionId, messages: [] }) };
        }
        const messages = msgs.data.map(({ info, parts }) => {
          const entry: Record<string, unknown> = {
            role: info.role,
            time: info.time?.created,
          };
          for (const p of parts) {
            if (p.type === "text") {
              entry.text = ((entry.text as string) ?? "") + p.text;
            } else if (p.type === "reasoning") {
              entry.thinking = ((entry.thinking as string) ?? "") + p.text;
            } else if (p.type === "tool") {
              const tools = (entry.tools as Array<Record<string, unknown>>) ?? [];
              const t: Record<string, unknown> = { name: p.tool };
              if (p.state.status === "completed") {
                t.output = p.state.output;
              } else if (p.state.status === "error") {
                t.error = p.state.error;
              }
              tools.push(t);
              entry.tools = tools;
            }
          }
          return entry;
        });
        return { output: JSON.stringify(messages, null, 2) };
      },
    }),
  };
}

function createEventHandlers(client: PluginInput["client"], baseDir: string) {
  return async ({ event }: { event: Event }) => {
    if (event.type === "session.created") {
      if (event.properties.info.title.startsWith(RECOVERY_PREFIX)) return;
      await runRecoverySweep(client, baseDir);
    }
    // session.updated is intentionally not handled here.
    // Without persistent recovery session tracking, we cannot distinguish
    // recovery sessions from regular ones in the updated handler.
    // If title prefix stripping by other plugins is observed in practice,
    // re-enable with a persistent recovery session ID registry.
  };
}

export default async function sessionManagement(input: PluginInput): Promise<Hooks> {
  const { client, $ } = input;
  const baseDir = input.directory ?? process.cwd();
  return {
    tool: createTools(client, $),
    event: createEventHandlers(client, baseDir),
  };
}
