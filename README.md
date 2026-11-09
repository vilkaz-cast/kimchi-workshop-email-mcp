# workshop-email-mcp

A fake email MCP **server** for the Kimchi workshop, hosted on Cloudflare Workers.
It exposes exactly one MCP tool, `list_emails`, that returns all workshop emails:
the two inbox briefing emails plus the participant registration emails. All data
is **embedded in the Worker** — there are no external fetches, no Durable Objects,
and no authentication (workshop-internal fake server).

Transport: stateless Streamable HTTP on `POST /mcp`, implemented with
`createMcpHandler` from the [Cloudflare Agents SDK](https://github.com/cloudflare/agents)
and `McpServer` from `@modelcontextprotocol/server`.

## Setup

```bash
npm install
```

## Local development

```bash
npm run dev
```

This runs `wrangler dev`. The MCP endpoint is then available at
`http://localhost:8787/mcp`. Any other path returns a small plain-text help
message.

## Tests

```bash
npm test
```

Uses `vitest` with `@cloudflare/vitest-pool-workers` (workers pool, config in
`wrangler.jsonc`). The tests cover the help route, the MCP `initialize`
handshake, and a full `tools/call` of `list_emails` (8 emails: 2 briefings +
6 registrations).

Type checking:

```bash
npm run typecheck
```

## Deploy

```bash
npm run deploy
```

## Connecting a client

With Claude Code:

```bash
claude mcp add --transport http workshop-emails https://<your-worker>.workers.dev/mcp
```

Any MCP client that supports Streamable HTTP works: point it at
`https://<your-worker>.workers.dev/mcp` (or `http://localhost:8787/mcp` when
running `npm run dev`). No authentication is required. Once connected, ask the
client to call the `list_emails` tool.

## Updating the email data

All emails live in `src/emails.ts` as a snapshot. To refresh registrations,
edit that file and redeploy.
