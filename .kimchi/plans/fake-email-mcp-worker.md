# Plan: Fake Email MCP Server on Cloudflare Workers

## Goal

Build a fake email MCP **server** (workshop artifact) hosted on Cloudflare Workers. It exposes ONE MCP tool, `list_emails`, that returns all workshop emails: the two inbox briefing emails (from the workshop `docs/briefings/welcome.json`) plus the participant registration emails (from gh-pages `events/*/registrations.json`). All data is **embedded in the Worker** — no external fetches at runtime.

Transport: stateless **Streamable HTTP** on `POST /mcp`, using `createMcpHandler` from the Cloudflare Agents SDK (the deprecated `McpAgent` Durable Object approach must NOT be used).

Reference implementation to mirror: https://github.com/cloudflare/agents/tree/main/examples/mcp-worker

## Constraints

- User decision: one tool for all emails; data embedded in the Worker.
- No authentication (workshop-internal fake server).
- No new runtime data source; no KV/D1/DO needed — fully stateless.
- Follow the Cloudflare `mcp-worker` example for config shape (compatibility_date, flags).

## Interfaces

### Email record (src/emails.ts)

```ts
export interface EmailFrom {
  name: string;
  role?: string;   // e.g. "VP Engineering" or participant org/designation
  bg?: string;     // avatar color from welcome.json, optional
}

export interface Email {
  id: string;                    // unique, kebab-case
  from: EmailFrom;
  subject: string;
  timestamp: string;             // original string, verbatim
  category: "briefing" | "registration";
  body: string;                  // full body, verbatim for briefings; synthesized for registrations
}

export const EMAILS: Email[];
```

### Worker (src/index.ts)

```ts
import { createMcpHandler } from "agents/mcp/server";
import { McpServer } from "@modelcontextprotocol/server";
```

- `createServer()`: `new McpServer({ name: "workshop-email-mcp", version: "1.0.0" })`
- Registers tool `list_emails` via `server.registerTool("list_emails", { description, inputSchema: {} }, handler)`.
  - Description: "List all workshop emails (inbox briefings and participant registrations)."
  - Handler returns `{ content: [{ type: "text", text: JSON.stringify(EMAILS, null, 2) }], structuredContent: { emails: EMAILS } }` (if `structuredContent` is unsupported by the installed SDK version, return text content only — note the deviation in the build report).
  - No input parameters (or no required ones) so any client can call it trivially.
- Default export: `fetch(request, env, ctx)` that routes:
  - `POST|GET /mcp` (any method the handler supports) → `createMcpHandler(createServer)(request, env, ctx)`
  - any other path → small `200 text/plain` help message: "workshop-email-mcp — MCP endpoint at POST /mcp"
- Factory + handler creation may be lifted to module scope for warm reuse (as in the OAuth example in the docs).

## Embedded data

Builder fetches these URLs verbatim with `curl` and converts into `src/emails.ts` (keep bodies verbatim, escape properly for TS template/JSON strings):

1. Briefings — https://raw.githubusercontent.com/castai/kimchi-workshop/challenge/docs/briefings/welcome.json
   → 2 emails, `category: "briefing"`, ids `start-here`, `submission-lifecycle`; map `from.name/role/bg`, `subject`, `timestamp`, `body` directly.
2. Participant registrations (synthesize one email per registration, `category: "registration"`):
   - https://castai.github.io/kimchi-workshop/events/slc-001/registrations.json → 1 record
   - https://castai.github.io/kimchi-workshop/events/kol-001/registrations.json → 5 records
   - (test-001 has no registrations file — 404, skip)
   - For each registration `r`: id `reg-<event>-<issue_number>`; `from.name = r.name`, `from.role = "<org> · <designation>"` (omit designation when `/`); subject `Registration: <name> (@<github_handle>) — <event_code>`; timestamp = `joined_at`; body = plain-text lines with email, GitHub handle, org, designation, event, joined_at, credit_status. Include the real `email` address in the body.
3. Ordering: briefings first (original order), then registrations sorted by `joined_at`.

## Chunks

### Chunk 1 — Scaffold, implementation, tests, docs (simple; single build agent)

**Files Changed**
- `package.json` — deps: `agents`, `@modelcontextprotocol/server`, `zod`; devDeps: `wrangler`, `typescript`, `vitest`, `@cloudflare/vitest-pool-workers`, `@cloudflare/workers-types`. Scripts: `dev` (`wrangler dev`), `deploy` (`wrangler deploy`), `test` (`vitest run`), `typecheck` (`tsc --noEmit`). Pin versions to whatever `npm install` resolves latest TODAY.
- `wrangler.jsonc` — name `workshop-email-mcp`, `main: "src/index.ts"`, recent `compatibility_date`; mirror flags from the mcp-worker example.
- `tsconfig.json` — workers types, strict.
- `src/index.ts` — worker as per Interfaces.
- `src/emails.ts` — embedded data as per Embedded data.
- `test/index.spec.ts` — vitest + `@cloudflare/vitest-pool-workers`, using `SELF` from `cloudflare:test`:
  1. `GET /` returns 200 help text.
  2. MCP handshake: `POST /mcp` JSON-RPC `initialize` succeeds (result contains `serverInfo.name === "workshop-email-mcp"`); capture `mcp-session-id` header if present and reuse it.
  3. `tools/call` for `list_emails` succeeds; parse result; assert the returned email list contains ids `start-here`, `submission-lifecycle`, and at least 6 entries total with `category` in `{briefing, registration}`.
- `vitest.config.ts` — pool workers config pointing at `wrangler.jsonc`.
- `README.md` — what it is, `npm install`, `npm run dev`, `npm test`, `npm run deploy`, and how to connect a client (`claude mcp add --transport http <name> <url>/mcp`).

**Depends On**: nothing (greenfield — single chunk does it all).

**Accept When**
- `npm install` clean, `npm run typecheck` passes, `npm test` all green.
- `list_emails` returns exactly 8 records (2 briefings + 6 registrations).
- No `McpAgent`, no Durable Objects, no external fetches in the Worker code.

**Test Coverage**: `test/index.spec.ts` as above (3 tests).

**Open Questions**: none.

## Verification Strategy

- Reviewer reads spec + all created files, runs `npm install`, `npm run typecheck`, `npm test` (fresh clone-equivalent).
- Reviewer additionally smoke-checks `wrangler dev` boots (optional if environment lacks network).

## Decision Log

- **`createMcpHandler` (stateless Streamable HTTP)** from `agents/mcp/server` — current Cloudflare-recommended approach; `McpAgent` is deprecated/feature-frozen (verified 2026-11-09 against Cloudflare docs). Server: `McpServer` from `@modelcontextprotocol/server` (SDK v2).
- **Embed data in the Worker** — user decision; rejected: live-fetch from GitHub at request time (extra failure modes, latency; workshop data changes rarely and redeploy is cheap).
- **Registrations embedded as email-shaped records** — user asked for "one tool for all emails"; briefings and registrations are different shapes, so registrations are synthesized into the same `Email` envelope, distinguishable via `category`.
- **Registrations are a point-in-time snapshot** (taken 2026-11-09: SLC-001 ×1, KOL-001 ×5). They will go stale as people register; acceptable for a fake/workshop server — update by editing `src/emails.ts` and redeploying.
- **No SSE transport** — Streamable HTTP only (SSE deprecated by Cloudflare/MCP).

## Risks

- `@modelcontextprotocol/server` SDK v2 API may differ slightly from docs snippets (e.g. `structuredContent` support) — builder falls back to text-only content and reports the deviation.
- `vitest-pool-workers` session handling in tests (stateful vs stateless init) — tests must tolerate missing `mcp-session-id`.
- Participant email addresses are personal data embedded in a public repo — they are already public on GitHub Pages and the user explicitly requested them.
