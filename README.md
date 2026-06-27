# Tracr

**T**racking **R**eview **A**nd **C**ode-origin **R**ecord

An accountability layer for AI-assisted software development.

## The problem

AI coding assistants (Copilot, Claude, Cursor, etc.) are now used to write a large share of production code. Research shows this comes with a hidden cost:

- AI-generated code has been found to introduce nearly twice as many security issues as it fixes, across an analysis of 300,000+ AI-authored GitHub commits.
- Developers using AI tools have been measured taking *longer* on tasks while believing they were faster — a real gap between perceived and actual reliability.
- Most importantly: studies on AI-generated pull requests show human reviewers are **less critical** of AI-written code, because it tends to look clean and confident — letting real issues slip through unreviewed.

Tracr doesn't try to make AI write better code. It tracks code origin, flags AI-generated code that touches sensitive areas (auth, payments, secrets) without human review, and surfaces that risk exactly where it matters: inside the pull request, before merge.

## What it does

1. **Capture** — tags each code block as AI-generated or human-written (currently via direct API input for this MVP; a VS Code extension for automatic capture is planned).
2. **Risk scan** — checks code for sensitive patterns (authentication, payments, secrets, destructive DB operations) using a transparent, rule-based scanner.
3. **GitHub integration** — pulls a Pull Request's diff via the GitHub API and posts a risk-warning comment directly on the PR.
4. **Trust score** — computes a 0–100 score per repository from real stored data: percentage of AI-generated code, flagged risk rate, bug count, and revert count.

## Architecture

| Layer | Responsibility |
|---|---|
| `db.js` | SQLite schema and connection |
| `riskScanner.js` | Pattern-based risk detection |
| `githubIntegration.js` | Pulls PR diffs, posts risk comments via Octokit |
| `trustScore.js` | Weighted trust score calculation |
| `index.js` | Express server tying everything together |

**This is an application, not a browser/editor extension.** A VS Code extension for automatic AI-vs-human code capture is scoped as future work — for this MVP, tagged data is sent directly to the API to focus engineering time on the risk-analysis and GitHub-integration engine.

## Trust score formula

\`\`\`
Trust Score = 100 − (riskPenalty + bugPenalty + revertPenalty)

riskPenalty   = (risky AI blocks / total AI blocks) × 40
bugPenalty    = (total bugs / total blocks) × 30
revertPenalty = (total reverts / total blocks) × 30
\`\`\`

Risk is weighted highest because it represents *unreviewed* exposure — the core problem Tracr targets.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/code-block` | Submit a tagged code block for risk scanning and storage |
| `GET` | `/api/code-blocks` | View all stored code blocks |
| `POST` | `/api/scan-pr` | Scan a real GitHub PR and post a risk comment on it |
| `GET` | `/api/trust-score/:repo_name` | Get the computed trust score for a repository |

## Setup

\`\`\`bash
npm install
cp .env.example .env   # then add your GitHub personal access token
npx nodemon index.js
\`\`\`

Server runs at \`http://localhost:3000\`.

## Tech stack

Node.js, Express, SQLite (better-sqlite3), GitHub REST API (Octokit).

## Known limitations

- Risk detection is rule-based (keyword/pattern matching), not a full static-analysis security scanner — chosen deliberately to keep logic transparent and explainable.
- Code-origin tracking is forward-looking only; it cannot retroactively determine the origin of code already in a legacy repository.
- Bug/revert counts are currently recorded manually rather than auto-detected from git history — a natural next step for this project.

## Prior art

A comparable commercial tool, [Git AI](https://github.com/git-ai-project), addresses an overlapping problem (line-level AI code attribution across the SDLC). Tracr focuses more narrowly on the review-time risk surfacing and trust-scoring angle.