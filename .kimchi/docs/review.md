# Review — fake-email-mcp-worker

## Verdict: NEEDS_FIXES

The Worker implementation itself is correct and spec-compliant, but `npm test` is not green: 2 of 3 tests fail. The builder lowered `compatibility_date` (which did fix the workerd startup failure) but never re-ran the tests, so a test-layer bug went undetected.

## Test results

- `npm test` (vitest 4.1.12, workers pool): **1 passed, 2 failed** (3 total)
  - PASS: `GET / returns 200 help text`
  - FAIL: `MCP initialize handshake succeeds and returns serverInfo` — `SyntaxError: Unexpected token 'e', "event: mes"... is not valid JSON` (test/index.spec.ts:41)
  - FAIL: `tools/call list_emails returns all 8 emails with correct ids and categories` — same error (test/index.spec.ts:86)
- `npm run typecheck` (`tsc --noEmit`): **passes, no errors**

I verified the worker itself works: via a throwaway probe test (created, run, then deleted — repo left unmodified), `POST /mcp` with `initialize` returns `serverInfo.name === "workshop-email-mcp"` and `tools/call list_emails` returns all 8 records. The responses arrive as `text/event-stream` (SSE) frames, not plain JSON — the tests parse the raw SSE text as JSON and blow up.

## Issues

1. **`test/index.spec.ts:41` and `test/index.spec.ts:86` — tests JSON.parse an SSE body, causing 2 of 3 tests to fail.**
   The `createMcpHandler` Streamable HTTP transport always responds with `text/event-stream` when the client's `accept` header includes it (the tests send `accept: "application/json, text/event-stream"`), producing a body like:
   ```
   event: message
   data: {"result":{...},"jsonrpc":"2.0","id":1}
   ```
   Both failing tests do `JSON.parse(await res.text())` on this. Dropping `text/event-stream` from `accept` is NOT a fix — I verified the SDK then returns **406 Not Acceptable** (it requires `text/event-stream` in `accept`).
   **Suggested fix:** add an SSE parser helper and use it in both tests:
   ```ts
   function parseSseJsonRpc(text: string): { result: unknown } {
     for (const line of text.split("\n")) {
       if (line.startsWith("data: ")) {
         return JSON.parse(line.slice(6));
       }
     }
     throw new Error("no data frame in SSE response");
   }
   ```
   Then `const body = parseSseJsonRpc(await res.text());` in both tests. Note the SSE stream terminates after the response (the SDK stateless handler closes it), so `await res.text()` already receives the complete body — no event-by-event streaming read needed.

2. **`test/index.spec.ts:32` — handshake test hard-requires `mcp-session-id` header, contradicting the spec's tolerance requirement.**
   The spec (Risks) says "tests must tolerate missing `mcp-session-id`" and test 3 correctly guards with `if (sessionId)`, but test 2 asserts `expect(res.headers.get("mcp-session-id")).toBeDefined()`. It currently passes (the SDK emits the header), so this is a robustness nit, not a failure — but it should match the spec: `const sessionId = res.headers.get("mcp-session-id"); // optional per spec`.

3. **`src/index.ts:20-29` — handler omits `structuredContent`, an unnoted deviation.**
   Spec Interfaces: handler returns `{ content: [...], structuredContent: { emails: EMAILS } }`, with a documented fallback to text-only "if `structuredContent` is unsupported by the installed SDK version ... note the deviation in the build report". The installed `@modelcontextprotocol/server` is v2.4.0, which does support `structuredContent` in tool results, yet the handler returns text-only and no build report exists in `.kimchi/` to note the deviation. Either add `structuredContent: { emails: EMAILS }` to the return value, or document the deviation. Low severity — clients consuming `content[0].text` (the test, and the spec's primary contract) work either way.

## What was verified as correct

- **Data fidelity (all exact):** I compiled `src/emails.ts` standalone and diffed it against the live sources.
  - Both briefing emails (`start-here`, `submission-lifecycle`) are byte-for-byte verbatim from `welcome.json`: subject, timestamp, `from.name/role/bg`, and full body all match.
  - All 6 registrations (SLC-001 x1, KOL-001 x5) match the gh-pages `registrations.json` sources: ids `reg-<event>-<issue_number>`, `from.role` as `"<org> · <designation>"` with designation correctly omitted for Viktorija (`/` → `"Cast"`), subjects in the `Registration: <name> (@<handle>) — <event>` form, `joined_at` timestamps, and synthesized bodies (email, github_handle, org, designation, event, joined_at, credit_status).
  - Ordering matches spec: briefings first in original order, then registrations sorted by `joined_at`.
  - `list_emails` returns exactly 8 records (acceptance criterion met at the worker level, confirmed via probe).
- **Constraints:** no `McpAgent`, no Durable Objects, no runtime fetch to GitHub or any external host in `src/` (the only `fetch` is the Worker's own entry point).
- **Interfaces:** `Email`/`EmailFrom` shapes match the spec exactly; `createMcpHandler` from `agents/mcp/server` used at module scope for warm reuse; tool name, description ("List all workshop emails (inbox briefings and participant registrations)."), and empty `inputSchema` all match; routing is `POST /mcp` → handler, everything else → `200 text/plain` help text `"workshop-email-mcp — MCP endpoint at POST /mcp"`.
- **Config:** `wrangler.jsonc` (name, main, compatibility_date 2026-04-28, `nodejs_compat` flag) mirrors the mcp-worker example shape; the compatibility_date reduction to 2026-04-28 is the correct fix for the workerd version bundled with `vitest-pool-workers`.
- **Typecheck:** clean under strict mode.
- **README:** covers install, dev, test, deploy, and client hookup (`claude mcp add --transport http ...`) as required.
- **Test anti-flakiness:** apart from issue 1, assertions are deterministic (fixed data snapshot, order checks only where ordering is spec-defined); each test creates its own session; no shared mutable state.

## Summary

The only blocking problem is the broken SSE parsing in `test/index.spec.ts` (issue 1) — the acceptance criterion "`npm test` all green" is not met. Fixing that one test-layer bug should turn the suite fully green; issues 2 and 3 are minor and non-blocking.
