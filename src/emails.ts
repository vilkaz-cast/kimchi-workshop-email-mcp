export interface EmailFrom {
  name: string;
  role?: string; // e.g. "VP Engineering" or participant org/designation
  bg?: string; // avatar color from welcome.json, optional
}

export interface Email {
  id: string; // unique, kebab-case
  from: EmailFrom;
  subject: string;
  timestamp: string; // original string, verbatim
  category: "briefing";
  body: string; // full body, verbatim
}

/**
 * Embedded workshop email data: the inbox briefing emails, verbatim from:
 *   https://raw.githubusercontent.com/castai/kimchi-workshop/challenge/docs/briefings/welcome.json
 * (snapshot taken 2026-11-09)
 *
 * Ordering: original order from welcome.json.
 */
export const EMAILS: Email[] = [
  {
    id: "start-here",
    category: "briefing",
    from: {
      name: "Sam Carter",
      role: "VP Engineering",
      bg: "#b3261e",
    },
    subject: "Start here: reclaiming task-api",
    timestamp: "2026-10-22 16:10 UTC",
    body: `You already know the headline. Task-api rolled back at 15:07 UTC yesterday, I handed the keys to you at 16:00, and what you're about to work on is the pre-patch state.

What happened, in one minute: at 09:14 UTC POST /tasks started 500ing. A hot-patch was merged without full review, passed 5 of 9 checks, and went to prod at 10:22. By 14:00 we had three new anomalies \u2014 ~3% error rate on POST /tasks, a hardcoded \`sk-\` key in the deployed config, and GET /tasks returning the full table with p99 at 800 ms. The rollback at 15:07 preserved 5 of 9 tests. Your job: make it 9 of 9 \u2014 and survive the production scenario, which I'm told will be *unpleasant* if you skip verification.

Your first hour, in order:

**1. Fork, then clone YOUR fork.** This is the step people skip and regret. Hit the Fork button (top right), then:

\`\`\`bash
git clone https://github.com/<your-handle>/kimchi-workshop.git
cd kimchi-workshop
\`\`\`

Everything you push goes to your fork; your PR against our \`challenge\` branch is what gets scored. Never commit to the upstream repo.

**2. Clean environment.**

\`\`\`bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m pytest tests/ -q
\`\`\`

Expected: \`4 failed, 5 passed\`. The red is your starting position.

**3. Set your identity.** Inside the repo, run \`kimchi\`, trust the project, then \`/tags add attendee:<your-github-handle>\`. Your spend gets attributed on the leaderboard from this.

**4. Read before you code.** \`PRODUCTION-INCIDENT.md\` in the repo root, then the module docstrings. The docstrings are the contract \u2014 the previous patcher failed because he treated the code as the only source of truth. When your agent shows you a plausible diff, check the docstring first. The two flagrant examples: error handlers exist but aren't wired into the app factory (wire, don't rewrite), and config was supposed to load from env but got a literal key.

Then \u2014 and only then \u2014 open your agent. Treat it as a lever, not a driver.

When you're ready to submit, read the submission email. That's the only other one you need.

\u2014 Sam`,
  },
  {
    id: "submission-lifecycle",
    category: "briefing",
    from: {
      name: "Jordan Patel",
      role: "Release Engineering",
      bg: "#38761d",
    },
    subject: "How to submit your fix without breaking the pipeline",
    timestamp: "2026-10-23 08:45 UTC",
    body: `Reminder from release eng: we are not merging participant PRs into the seed repo. Ever. Your PR is a scoring instrument, not a contribution path.

**The four steps.**

1. Fork the repo (if you followed Sam's email you've already done this \u2014 fork FIRST, always before your first push) and push your branch to your fork.
2. Open a PR against the \`challenge\` branch of the original repo with title:

   \`[submission] <your-github-handle> - <one line on what you fixed>\`

3. Fill in the PR body with this exact block:

\`\`\`
attendee: <your-handle>
event: <event-code your facilitator announced>
review_score:
\`\`\`

4. That's it \u2014 no usage CSV, no cost line. When the facilitator adds the \`accepted\` label, the leaderboard pulls your real spend straight from the Kimchi API (matched by the email you joined with) and your row lands with an API-verified cost.

**Before you submit \u2014 the verification checklist that separates a passing score from a rework:**

1. Does the diff change ONLY what the failing behavior requires? If your agent added a refactor you didn't ask for, back it out.
2. Is anything new hardcoded? A key, a default, a magic number justified as "for now." If yes, reject it.
3. Does the code agree with its own docstrings? Read both. If they describe different behaviors, the code lies.
4. Run the suite after EVERY edit \u2014 not after the agent session. After every edit.

**What happens next.** CI runs the visible suite against your PR. The production-scenario workflow runs the hidden suite. A code review posts to your PR comments. When the facilitator adds the \`accepted\` label, your leaderboard row lands \u2014 and then the PR is closed unmerged. The repo stays in pre-patch state for the next participant; your scorecard is permanent on the leaderboard; your PR comments are your proof-of-work.

You have roughly an hour. Fix the posture, not just the symptom.

\u2014 Jordan`,
  },
];
