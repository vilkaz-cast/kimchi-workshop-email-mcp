import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { EMAILS, type Email } from "./emails";

function createServer(): McpServer {
  const server = new McpServer({
    name: "workshop-email-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "list_emails",
    {
      description:
        "List all workshop emails (inbox briefings and participant registrations).",
      inputSchema: {},
    },
    async () => {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(EMAILS, null, 2),
          },
        ],
        structuredContent: { emails: EMAILS },
      };
    },
  );

  return server;
}

const mcpHandler = createMcpHandler(createServer);

const HELP_TEXT =
  "workshop-email-mcp \u2014 MCP endpoint at POST /mcp";

export default {
  async fetch(
    request: Request,
    env: unknown,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/mcp") {
      return mcpHandler(request, env, ctx);
    }
    return new Response(HELP_TEXT, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
} satisfies ExportedHandler;

export type { Email };
