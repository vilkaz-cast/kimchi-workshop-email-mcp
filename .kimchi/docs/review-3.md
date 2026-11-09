# Review 3 — `list_emails` data swap (welcome + 5 briefings)

**Verdict: NEEDS_FIXES**

## Verification performed

1. **Live-data diff (field-by-field)** — fetched both live JSONs and compared every embedded email in `src/emails.ts` against them:
   - Briefings (`start-here`, `incident-brief`, `spec-docstrings`, `kimchi-cadence`, `submission-lifecycle`): `id`, `from.name`, `from.role`, `from.bg`, `subject`, `timestamp`, `body` are all **verbatim** identical to `https://castai.github.io/kimchi-workshop/briefings/welcome.json`. The only added field is `category: "briefing"`, which the live JSON omits but the `Email` interface requires — expected and correct.
   - Welcome email (`welcome`): differs from `https://castai.github.io/kimchi-workshop/personal/vilkaz-cast.json` in exactly the 3 required sanitizations and nothing else:
     - `id`: `welcome-vilkaz-cast` → `welcome`
     - `subject`: `"Welcome aboard, Vilius K"` → `"Welcome aboard"`
     - `body`: `"event KOL-001 (issue #87). Credit"` → `"event KOL-001. Credit"` (only that phrase removed)
     - `category: "welcome"`, `from` (Sam Carter / VP Engineering), and `timestamp` are identical. Correct.
2. **Leak grep** — `grep -ri 'vilius|vilkaz|issue #87'` over `src/`, `test/`, `README.md` matched only `test/index.spec.ts:128-129`, where both appear in negative assertions (`expect(text).not.toContain(...)`). Tool data is clean.
3. **`npm run typecheck`** — passed (no errors).
4. **`npm test`** — passed: **3 tests / 3 passed, 1 file** (help route, MCP initialize handshake, full `tools/call list_emails` asserting 6 emails, exact id list, both categories, and the two identity-leak guards).
5. **`src/index.ts`** — `list_emails` tool intact with `inputSchema: {}`, description updated to "List the workshop inbox emails (welcome + briefings)." (sane); `structuredContent` and the rest of the handler unchanged. README diff is documentation-only and accurate. No other behavior changed.

## Test results

- `npm run typecheck`: pass
- `npm test`: 3 passed / 3 failed=0 (`test/index.spec.ts`, 1 file)

## Issues

1. **`/Users/viliuskazlauskas/Work/kimchi-workshop-email-mcp/src/emails.ts:74` (and `test/index.spec.ts:117`)** — The briefings are NOT in live inbox order: `kimchi-cadence` (line 74) is placed before `submission-lifecycle` (line 86), whereas the live `briefings/welcome.json` array order is `start-here, incident-brief, spec-docstrings, submission-lifecycle, kimchi-cadence` (also the order the task itself lists the ids in). This contradicts the file's own header comment at line 23 ("then the briefings in live inbox order") and breaks an internal cross-reference in the verbatim `start-here` body: *"If you get stuck, read email #3 (Alex on the spec). If you get to submission, read email #4 (Jordan on the pipeline)."* With briefings-only numbering, email #4 must be Jordan's `submission-lifecycle`; in the embedded order email #4 is Casey's `kimchi-cadence`, so the reference points at the wrong email.
   **Fix:** swap the two objects in `EMAILS` so `submission-lifecycle` precedes `kimchi-cadence`, and update the expected id order in `test/index.spec.ts` (~line 115-118) to `["welcome", "start-here", "incident-brief", "spec-docstrings", "submission-lifecycle", "kimchi-cadence"]`.

Everything else in the change (verbatim briefing content, the three welcome sanitizations, leak-free data, tool wiring, tests, typecheck) is verified correct.
