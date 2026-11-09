# Review 2 — list_emails restricted to inbox briefings only

**Date:** 2026-11-09 (review of the change removing registration emails)
**Spec:** `.kimchi/plans/fake-email-mcp-worker.md` (original) + changed requirement: `list_emails` must return ONLY the emails the workshop inbox page puts in its `MAIL` array from `docs/briefings/welcome.json` (2 emails: `start-here`, `submission-lifecycle`).

## Verdict: APPROVED

## Verification performed

### 1. Data contract — `src/emails.ts` vs live welcome.json

Fetched https://raw.githubusercontent.com/castai/kimchi-workshop/challenge/docs/briefings/welcome.json live and diffed programmatically against the embedded `EMAILS` (transpiled `src/emails.ts` with the project's TypeScript, then compared field-by-field: `id`, `from.name`, `from.role`, `from.bg`, `subject`, `timestamp`, `body`).

- **Result: verbatim match, all fields, both emails** (`start-here`, `submission-lifecycle`), in original order.
- `category: "briefing"` on both; the `Email` type is correctly narrowed to `category: "briefing"` (no stale union with `"registration"`).
- No extra/unknown keys on either record.

Cross-checked against the inbox page (`docs/index.html` on the `challenge` branch): `loadStaticBriefings()` fetches `briefings/welcome.json` and pushes each email with `category: "briefing"`. The only other `MAIL.push` is `maybeLoadPersonal()`, which is opt-in per-handle personal mail (`personal/<handle>.json`) — out of scope per the user's "inbox briefing emails only" decision. So the 2 embedded briefings correctly match the default `MAIL` contents.

### 2. No registration data anywhere

Grepped case-insensitively for `registration|reg-|joined_at|github_handle|designat` across the repo. In `src/`, `test/`, and `README.md` the only hit is a comment in `src/emails.ts:3` (`role?: string; // e.g. "VP Engineering" or participant org/designation`) — a stale spec-quote comment, not data, and not a functional issue. Remaining hits are in `.kimchi/plans/` (the original spec, historical) and `.kimchi/docs/review.md` (the previous review, historical) — both out of scope. No registration emails, no personal email addresses, no `reg-*` ids in shipped code or docs.

### 3. Tool registration — `src/index.ts`

- Tool name: `"list_emails"` (unchanged). ✓
- Description: `"List the workshop inbox briefing emails."` — no mention of registrations. ✓
- Empty `inputSchema: {}` per spec. Handler returns text content (`JSON.stringify(EMAILS, null, 2)`) plus `structuredContent: { emails: EMAILS }`. ✓
- Routing unchanged: `/mcp` → `createMcpHandler(createServer)`, everything else → 200 `text/plain` help text. No `McpAgent`, no Durable Objects, no runtime fetches. ✓

### 4. Tests — `test/index.spec.ts`

- Asserts the 2-email contract: exactly 2 entries, ids `["start-here", "submission-lifecycle"]` in order, every `category === "briefing"`, single text content block parsed as JSON.
- No brittle full-body assertions — only ids/categories/length. Good balance.
- Minor note (non-blocking): in the initialize-handshake test the `sessionId` local (`const sessionId = res.headers.get("mcp-session-id")`) is captured but never used — harmless, and `tsc --noEmit` passes since `noUnusedLocals` is off. Not worth changing.

## Test results

- `npm run typecheck`: **PASS** (clean, no errors)
- `npm test`: **3/3 PASS** (1 file, 3 tests, 0 failures)
  - `GET / returns 200 help text` ✓
  - `MCP initialize handshake succeeds and returns serverInfo` ✓
  - `tools/call list_emails returns the 2 briefing emails with correct ids and categories` ✓

## Issues

None. The change fully satisfies the revised requirement: `list_emails` returns exactly the 2 briefing emails, verbatim against the live welcome.json, with no registration data anywhere in `src/`, `test/`, or `README.md`.
