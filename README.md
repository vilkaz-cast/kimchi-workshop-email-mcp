# workshop-email-mcp

A fake email MCP **server** for the Kimchi workshop, hosted on Cloudflare Workers.
It exposes exactly one MCP tool, `list_emails`, that returns the workshop
inbox emails (1 welcome + 5 briefings, 6 in total). All data
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
handshake, and a full `tools/call` of `list_emails` (6 emails: `welcome`
plus the briefings `start-here`, `incident-brief`, `spec-docstrings`,
`kimchi-cadence`, and `submission-lifecycle`; the welcome email is
identity-sanitized — no attendee name or handle appears in the response).

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

All emails live in `src/emails.ts` as a snapshot of the live gh-pages inbox
(6 emails: the welcome email plus 5 briefings, sourced from
`https://castai.github.io/kimchi-workshop/briefings/welcome.json` and the
personalized welcome email, sanitized of attendee identity). To refresh,
edit that file and redeploy.
