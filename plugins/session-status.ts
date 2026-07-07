import type { Hooks, PluginInput } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";

const PREFIX_IN_PROGRESS = "【進行中】";
const PREFIX_COMPLETED = "【完了】";
const DEFAULT_TITLE_RE = /^(New session|Child session) - /;

export default {
  id: "session-status",
  server: async ({ client }: PluginInput) => {
    const pendingPrefix = new Set<string>();

    return {
      event: async ({ event }: Parameters<NonNullable<Hooks["event"]>>[0]) => {
        const { type, properties } = event;

        if (type === "session.created") {
          pendingPrefix.add(properties.info.id);
        }

        if (type === "session.updated" && pendingPrefix.has(properties.info.id)) {
          const { id, title } = properties.info;
          if (!title || DEFAULT_TITLE_RE.test(title)) return;
          pendingPrefix.delete(id);
          if (title.startsWith(PREFIX_IN_PROGRESS) || title.startsWith(PREFIX_COMPLETED)) return;
          await client.session.update({
            path: { id },
            body: { title: `${PREFIX_IN_PROGRESS}${title}` },
          });
        }
      },

      tool: {
        session_status: tool({
          description:
            "Set session status to 【進行中】 or 【完了】. " +
            "Call 【進行中】 when starting a task, 【完了】 when done.",
          args: {
            status: tool.schema.enum(["進行中", "完了"]).describe("Status to set"),
          },
          async execute(args, ctx) {
            const session = await client.session.get({ path: { id: ctx.sessionID } });
            const bare = session.data?.title.replace(/^【(?:進行中|完了)】\s*/, "") ?? "";
            const newTitle = `【${args.status}】${bare}`;
            await client.session.update({
              path: { id: ctx.sessionID },
              body: { title: newTitle },
            });
            return { output: `Status changed to ${args.status}: ${newTitle}` };
          },
        }),

        session_set_title: tool({
          description:
            "Set the session base title while preserving the 【進行中】/【完了】 status prefix.",
          args: {
            title: tool.schema.string().describe("New base title for the session"),
          },
          async execute(args, ctx) {
            const session = await client.session.get({ path: { id: ctx.sessionID } });
            const prefix = session.data?.title.match(/^【(?:進行中|完了)】\s*/)?.[0] ?? "";
            const newTitle = `${prefix}${args.title}`;
            await client.session.update({
              path: { id: ctx.sessionID },
              body: { title: newTitle },
            });
            return { output: `Session title set to: ${newTitle}` };
          },
        }),
      },
    };
  },
};
