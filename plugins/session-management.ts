import { type Hooks, type PluginInput, tool } from "@opencode-ai/plugin";
import type { Event } from "@opencode-ai/sdk";

const PREFIX_REGEX = /^【(?:完了|中断|回収)】\s*/;
const RECOVERY_PREFIX = "【回収】";
const ABANDONED_THRESHOLD_MS = 3 * 60 * 60 * 1000;
const LOCK_TTL_MS = 10 * 60 * 1000;

type Lock = {
  recovery_session_id: string;
  started_at: number;
  ttl_ms: number;
};

type BunShell = PluginInput["$"];

async function fileExists($: BunShell, path: string): Promise<boolean> {
  const r = await $`test -f ${path} && echo 1 || echo 0`.nothrow().quiet();
  return r.text().trim() === "1";
}

async function readText($: BunShell, path: string): Promise<string> {
  const r = await $`cat ${path}`.nothrow().quiet();
  return r.text().trim();
}

async function ensureEpoch($: BunShell, epochPath: string): Promise<void> {
  if (await fileExists($, epochPath)) return;
  await $`echo ${String(Date.now())} > ${epochPath}`.nothrow();
}

async function readLock($: BunShell, lockPath: string): Promise<Lock | null> {
  if (!(await fileExists($, lockPath))) return null;
  try {
    return JSON.parse(await readText($, lockPath));
  } catch {
    return null;
  }
}

async function writeLock($: BunShell, lockPath: string, lock: Lock): Promise<void> {
  await $`echo ${JSON.stringify(lock)} > ${lockPath}`.nothrow();
}

async function isLockStale(client: PluginInput["client"], lock: Lock): Promise<boolean> {
  const statuses = (await client.session.status()).data ?? {};
  const status = statuses[lock.recovery_session_id];
  if (status && (status.type === "busy" || status.type === "retry")) return false;
  return Date.now() - lock.started_at > lock.ttl_ms;
}

async function runRecoverySweep(
  client: PluginInput["client"],
  $: BunShell,
  recoverySessions: Set<string>,
): Promise<void> {
  const epochPath = ".opencode/.recovery-epoch";
  const lockPath = ".opencode/.recovery.lock";

  await ensureEpoch($, epochPath);
  const epoch = parseInt(await readText($, epochPath), 10);

  const sessionsResp = await client.session.list();
  const sessions = sessionsResp.data ?? [];
  const statusResp = await client.session.status();
  const statuses = statusResp.data ?? {};

  const now = Date.now();
  const abandoned = sessions.filter((s) => {
    if (PREFIX_REGEX.test(s.title)) return false;
    if (s.time.created <= epoch) return false;
    const st = statuses[s.id];
    if (st && (st.type === "busy" || st.type === "retry")) return false;
    if (now - s.time.updated <= ABANDONED_THRESHOLD_MS) return false;
    return true;
  });

  if (abandoned.length === 0) return;

  abandoned.sort((a, b) => a.time.updated - b.time.updated);
  const target = abandoned[0];

  const existingLock = await readLock($, lockPath);
  if (existingLock) {
    if (!(await isLockStale(client, existingLock))) return;
  }

  const createResp = await client.session.create({
    body: { title: `${RECOVERY_PREFIX} RECOVERY`, parentID: target.id },
  });
  if (!createResp.data) return;
  const recoveryId = createResp.data.id;
  recoverySessions.add(recoveryId);

  await client.session.command({
    path: { id: recoveryId },
    body: { command: "session-recover", arguments: target.id },
  });

  await writeLock($, lockPath, {
    recovery_session_id: recoveryId,
    started_at: now,
    ttl_ms: LOCK_TTL_MS,
  });
}

export default async function sessionManagement(input: PluginInput): Promise<Hooks> {
  const { client, $ } = input;
  const recoverySessions = new Set<string>();

  return {
    tool: {
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
          await client.session.update({ path: { id: ctx.sessionID }, body: { title: newTitle } });
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
          await client.session.update({ path: { id: ctx.sessionID }, body: { title: newTitle } });
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
          const r = await $`git notes add -m ${args.note} ${args.commit}`.nothrow().quiet();
          if (r.exitCode !== 0) {
            return {
              output: "git notes skipped",
              metadata: {
                skipped: true,
                reason: `git notes failed: ${r.stderr.toString().trim()}`,
              },
            };
          }
          return { output: "notes added" };
        },
      }),

      session_read_log: tool({
        description:
          "Read all messages from a specified session as structured JSON. Each entry contains role, text, thinking, and tools.",
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
    },

    event: async ({ event }: { event: Event }) => {
      if (event.type === "session.created") {
        if (event.properties.info.title.startsWith(RECOVERY_PREFIX)) return;
        await runRecoverySweep(client, $, recoverySessions);
      }
      if (event.type === "session.updated") {
        const { id, title } = event.properties.info;
        if (recoverySessions.has(id) && !title.startsWith(RECOVERY_PREFIX)) {
          const body = title.replace(PREFIX_REGEX, "").trim();
          await client.session.update({
            path: { id },
            body: { title: `${RECOVERY_PREFIX} ${body}` },
          });
        }
      }
    },
  };
}
