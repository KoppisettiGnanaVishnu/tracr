# Tracr

Tracking Review And Code-origin Record

An accountability layer for AI-assisted development. Basically — it watches where your code came from (AI or human) and warns reviewers when AI-written code touches something risky and nobody's actually checked it.

## Why I built this (the Priya story)

Here's the scenario that made me want to build this.

Priya is a backend dev. Her team uses Copilot a lot — like, a big chunk of their code starts out as an AI suggestion. One day a teammate opens a PR with a new `refundPayment()` function, mostly written by Copilot. It looks clean, properly formatted, reads like something Priya herself would write. So she approves it fast — which is honestly what most people do when AI code *looks* fine.

Three weeks later a customer gets refunded twice for the same order. Turns out it's that exact function. Nobody actually read it carefully because it looked too clean to double check.

That's the whole problem in one story. AI code looks trustworthy, so it gets reviewed less carefully — even though "looks clean" and "is correct" aren't the same thing at all.

With Tracr running, the second that PR opens, it auto-comments:

> ⚠️ **Tracr risk warning**
> This PR touches sensitive areas:
> - **payment.js** — payment handling, auth token handling
>
> Make sure a human has actually reviewed this before merging.

Now Priya sees the warning right where she's already looking, before she clicks approve. Tracr isn't replacing her judgement or blocking anything — it's just making sure she doesn't skip the one function that actually needed a closer look.

## What it actually does

Some quick numbers on why this isn't just a "feels like a problem" thing:
- One study looked at 300k+ AI-authored commits on GitHub and found AI tools introduce almost 2x more security issues than they fix.
- Devs using AI tools were measured taking *longer* on tasks while thinking they were faster. Big gap between what people feel and what's actually true.
- The most important one for this project: reviewers are measurably less critical of AI-written PRs because the code just looks more put-together. That's the actual gap Tracr is trying to fill.

So Tracr doesn't try to make AI write better code (that's not really fixable from outside). It just tracks where code came from, flags AI code in risky spots that hasn't been reviewed, and puts that warning exactly where the reviewer is already looking — inside the PR, before merge.

### The 4 pieces

1. **Capture** — tags a code block as AI or human. Right now this is done manually through the API (you tell it which is which) since building a real automatic capture tool is its own whole project (see the detection section below). A VS Code extension that does this automatically is the planned next step.
2. **Risk scan** — checks code for sensitive stuff: auth, payments, secrets, db deletes. Simple keyword/pattern based, nothing fancy, but it works and it's easy to explain.
3. **GitHub integration** — pulls a PR's diff and comments on it automatically using the GitHub API.
4. **Trust score** — a 0-100 number per repo based on real stored data (risk %, bugs, reverts). Not made up, calculated from whatever's actually in the database.

## Files

- `db.js` — sets up the SQLite database
- `riskScanner.js` — the actual risk-checking logic
- `githubIntegration.js` — talks to GitHub, posts the PR comments
- `trustScore.js` — does the trust score math
- `index.js` — the Express server, ties it all together
- `public/index.html` — the dashboard (just plain HTML/CSS/JS, no framework)
- `pocDetector.js` — a separate little experiment, not part of the main app (see below)

**Quick note on extension vs app:** this is an application, not a browser/editor extension. I originally planned to also build a VS Code extension for automatic capture but cut that for the MVP — it's genuinely hard to build well in the time I had (Copilot doesn't expose a public "suggestion accepted" event), so for now you tag code manually through the API and the real engineering effort went into the risk scanner + GitHub integration instead. The extension is still on the roadmap.

## Trust score math

\`\`\`
Trust Score = 100 − (riskPenalty + bugPenalty + revertPenalty)

riskPenalty   = (risky AI blocks / total AI blocks) × 40
bugPenalty    = (total bugs / total blocks) × 30
revertPenalty = (total reverts / total blocks) × 30
\`\`\`

Risk counts for the most because unreviewed risk is the actual core problem here, bugs/reverts matter but they're a bit more downstream.

## API endpoints

| Method | Endpoint | What it does |
|---|---|---|
| `POST` | `/api/code-block` | send in a tagged code block, it gets scanned + saved |
| `GET` | `/api/code-blocks` | see everything saved so far |
| `POST` | `/api/scan-pr` | scan a real GitHub PR, posts a comment if anything's risky |
| `GET` | `/api/trust-score/:repo_name` | get the trust score for a repo |

## Running it

\`\`\`bash
npm install
cp .env.example .env   # add your own GitHub token here
npx nodemon index.js
\`\`\`

Then go to `http://localhost:3000` for the dashboard.

## Stack

Node.js, Express, SQLite (better-sqlite3), GitHub REST API via Octokit. Kept it simple on purpose — no React, no heavy frontend framework, just enough to get the point across.

## Can we actually detect AI vs human code automatically? (the messy part)

Short answer: not reliably, and honestly nobody can right now. There's no public API that says "yes this was AI-written." So I looked into a few options:

- **Burst-typing detection** — I built a small standalone test for this (`pocDetector.js`, not wired into the main app yet). The idea: track how fast text shows up. A human typing tops out around 10-15 characters/second. When I tested pasting code into it, it came in at over 100,000 characters/second — obviously not typed by hand. So timing *can* reliably tell "typed" apart from "appeared all at once." But it can't tell apart an AI suggestion from a regular copy-paste from Stack Overflow — both look identical to this kind of detector.
- **Comparing against a dev's own coding history** — could flag when someone's commit looks very different from their normal style/size. Didn't build this, just an idea for later.
- **Commit metadata** — some AI tools leave traces in commit data. Also didn't build this yet.
- **Style analysis** (looking for "AI-sounding" code patterns) — this has the same problem as those AI-text-detector tools that don't actually work that well. Wouldn't trust this alone.

Realistically the right move for a future version is combining a few of these into a confidence percentage ("70% likely AI-written") instead of pretending to know for sure. For this MVP, I just went with manual tagging since it's 100% accurate when the person tagging it is honest, and building real detection is genuinely a separate hard project on its own.

## Honest limitations

- Risk scanning is just keyword/pattern matching, not a real security scanner. Kept it this way on purpose so it's easy to explain and verify, not because I think it's the "best" approach.
- Can only track code going forward from when you start using it — can't tell you the origin of code already sitting in an old repo.
- Bug/revert numbers are entered manually right now, not pulled automatically from git history yet.

## Similar tools

Found out partway through that a company called Git AI is doing something pretty similar (line-level AI code attribution). Mine is more narrowly focused on the review-time warning + trust score angle rather than full attribution tracking across the whole dev lifecycle. Good to know I'm not solving a made-up problem at least.