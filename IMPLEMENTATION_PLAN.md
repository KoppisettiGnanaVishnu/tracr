# Tracr — Implementation Plan (Revised)

_Last updated: 2026-08-25 · **Phase 1 complete and verified**_

Tracr is a GitHub App that scans pull requests for security risks, posts inline review
comments on the exact vulnerable lines, and assigns each repo a trust score. This document
tracks what has shipped and the path forward.

---

## Where we are

**Phase 1 is done and proven on a real PR.** On `KoppisettiGnanaVishnu/tracr-demo-repo` PR #8,
Tracr scanned the changed file and posted a full review:

| Metric | Result |
|---|---|
| Files scanned | 1 |
| Findings | 12 (8 HIGH, 4 MEDIUM) |
| Overall risk | HIGH |
| Trust score | 0 / 100 (Grade F — Critical) |

Every finding landed on a precise line — CORS wildcard (L11), hardcoded password (L14),
API key (L17), insecure HTTP (L20), SQL injection (L24, L30), JWT-no-verify (L36),
weak hash (L41), `eval()` (L44, L46), command injection (L51), DROP TABLE (L55) — each with
its own confidence score, and inline comments were posted on those exact diff lines.

That per-line precision is the whole point of the foundation, and it now works end-to-end.

---

## Architectural principle (why phase order matters)

Everything is built on **per-line findings**. Inline comments, AI context, confidence scoring,
and later historical linking all depend on knowing the exact `(file, line)` of each finding.
The original scanner joined all added lines into one blob and lost position — Phase 1 fixed
that at the root. Every later phase **enriches** a finding's line-anchored record; none of them
replace it. This is why Phase 1 had to come first.

---

## Decisions locked (2026-08-25)

| Decision | Choice | Notes |
|---|---|---|
| LLM provider | **Google Gemini (Flash)** | Free tier via Google AI Studio; conserve quota with caching + HIGH/MEDIUM-only. AI layer built provider-agnostic so Claude/OpenAI/local can be swapped in without rework. |
| AI execution | **Background job / queue** | Scan posts immediately; AI explanations follow as a second pass. Keeps webhook fast and survives LLM latency/failures. |
| First AST language | **JavaScript / TypeScript** | Matches our own stack and test fixtures; fastest path to value. |
| Persistence | **Migrate SQLite → Postgres in Phase 2** | Local `tracr.db` resets on redeploy on most hosts, wiping the history Phases 3–4 depend on. Move before that history matters. |
| Webhook signature verification | **Shipped in Phase 1** | HMAC-SHA256 with `timingSafeEqual`. No longer a future item. |

---

## Roadmap at a glance

| Phase | Focus | Key deliverables | Estimate | Status |
|---|---|---|---|---|
| 1 | Foundation | Per-line findings, DB tables, true inline comments, weighted trust score, webhook verification | 1–2 days | ✅ Done |
| 2 | AI Review + durable persistence | Postgres migration, background job queue, Gemini explanations, JS/TS AST context | ~1–1.5 weeks | ▶ Next |
| 3 | Repo Intelligence | Git history ingestion, code-origin linking (Line → Commit → PR → Issue) | 1–2 weeks | Planned |
| 4 | The Archaeologist | RAG + knowledge graph, natural-language Q&A with citations | 2–4 weeks | Planned |
| 5 | Analytics & Marketplace | Usage dashboard, marketplace listing prep | Post-maturity | Planned |

---

## Phase 1 — Foundation ✅ (Complete)

**Shipped:**

- [x] `scanPatch()` with hunk-accurate line numbers (parses `@@` headers, only scans added lines, tracks position across multiple hunks)
- [x] 15 detection rules with CWE codes, severity, matched text, and confidence scores
- [x] New tables: `pr_scans`, `findings`, `installations` (+ prepared statements)
- [x] Full orchestration: fetch head SHA → scan per file → persist → build report
- [x] Inline review comments on the exact vulnerable lines + a PR-level summary (single API call)
- [x] Weighted trust score (severity × confidence, dampened, with file-spread penalty → letter grade)
- [x] HMAC-SHA256 webhook signature verification (`timingSafeEqual`) + installation tracking
- [x] REST API: `/api/scans`, `/api/scans/:id`, `/api/scans/:id/findings`, `/api/repos/:owner/:repo/{scans,trust-score}`, `/api/stats`
- [x] 31-test suite (`npm test`) covering line detection, negative cases, trust math, and comment rendering

**Acceptance:** met — verified live on `tracr-demo-repo` PR #8 (see above).

---

## Phase 2 — AI Review + Durable Persistence (NEXT)

Two workstreams. **Land 2A (infrastructure) before 2B (AI)** so every AI result is stored durably
and the pipeline can absorb LLM latency.

### 2A — Persistence & job infrastructure

- **DB abstraction layer.** Introduce a repository/data-access module so nothing calls
  `better-sqlite3` directly. This makes the Postgres swap a one-file change, not a rewrite.
- **Migrate to Postgres.** Provision a free managed instance (Render Postgres / Neon). Connect via
  `DATABASE_URL`. Port the schema (`pr_scans`, `findings`, `installations`, `code_blocks`) using a
  lightweight migration tool (`knex` or `drizzle`, or `pg` + plain SQL migrations).
- **Data migration.** Current SQLite history is small and effectively disposable — do a clean cutover
  with an optional one-time export script; no need to preserve dev-era rows.
- **Background jobs.** Add a `jobs` table + a worker loop. The webhook enqueues a `scan+explain` job
  and returns `200` immediately (it already responds before processing today — this formalizes it
  into something durable with retries). The worker: runs the fast rule-based scan → posts the summary
  and rule-based inline comments → then calls Gemini per HIGH/MEDIUM finding → updates the comments
  with AI context. Start as an in-process worker; keep the interface clean so it can graduate to a
  separate Render worker or BullMQ + Redis if volume grows.

**Acceptance (2A):** scan history survives a redeploy; the webhook returns in <1s; failed jobs retry.

### 2B — AI explanations (Gemini) + JS/TS AST context

- **AST context (JS/TS first).** Parse changed files with `@babel/parser` (or `tree-sitter-javascript`).
  For each finding line, extract the enclosing function/scope and relevant identifiers so the model
  gets real context (e.g., "inside `login()`; `userId` comes from `req.params`") instead of a bare line.
- **Gemini integration.** Add `@google/generative-ai` behind a provider-agnostic interface. Prompt
  per finding (HIGH/MEDIUM only, to respect the free tier) → concise explanation, why it matters, and a
  suggested fix. `commentFormatter` already renders `aiExplanation` / `aiFix` — wire these fields in.
- **Caching.** Cache by `(rule_id + hash(normalized snippet))` so identical code isn't re-sent to the
  API. Keeps us inside free-tier rate limits and speeds re-scans.
- **Graceful degradation.** If Gemini is rate-limited or errors, fall back to the static fix hints from
  Phase 1 so the review still posts.

**Acceptance (2B):** HIGH/MEDIUM inline comments include an AI explanation with function-level context;
the system still produces a full review if the LLM is unavailable.

---

## Phase 3 — Repo Intelligence

- Ingest git history via the installation Octokit: commits, blame, and PR/issue links.
- **Code-origin linking:** Line → Commit → PR → Issue → author, stored in Postgres (now durable).
- Surface origin in reviews: "this vulnerable line was introduced in commit `abc123` / PR #7."
- Hard dependency on Phase 2's Postgres — this is where accumulated history starts to pay off.

**Estimate:** 1–2 weeks.

---

## Phase 4 — The Archaeologist

- RAG + knowledge graph over ingested history and findings.
- Natural-language Q&A with evidence citations ("when did we first introduce `eval` usage?",
  "which PRs added hardcoded secrets?").
- Use **pgvector on the existing Postgres** for embeddings — no new infrastructure required.

**Estimate:** 2–4 weeks.

---

## Phase 5 — Analytics & Marketplace

- Usage dashboard: scans and findings over time, trust-score trends per repo (the `/api/stats` and
  per-repo endpoints already exist as a starting point).
- Marketplace listing prep: onboarding flow, permissions review, docs, pricing.

**Timing:** after the core capability matures.

---

## Cross-cutting / tech debt

- **Rule tuning:** track false positives; add an inline-ignore mechanism (e.g., `// tracr-ignore`) and
  a per-repo allowlist.
- **Cleanup:** fold or remove root-level scaffolding (`pocDetector.js`, `testFile.js`, `test-auth.js`)
  into `/test`.
- **Secrets:** ensure `GEMINI_API_KEY` and `DATABASE_URL` are set in the host environment, not just
  local `.env`; confirm the deployed `GITHUB_WEBHOOK_SECRET` matches the GitHub App.
- **Observability:** structured logs + monitoring of webhook deliveries (200 vs 401/500).

---

## Immediate next steps (Phase 2 kickoff)

1. Add a DB abstraction layer over the current queries.
2. Provision Postgres (free tier) and wire `DATABASE_URL`.
3. Port the schema + add a migration runner.
4. Add a `jobs` table + worker; move the scan into a background job.
5. Then 2B: AST context + Gemini explanations behind a provider-agnostic interface.

---

## Open questions — resolved & remaining

**Resolved (2026-08-25):** LLM provider → Gemini Flash · AI execution → background queue ·
first AST language → JS/TS · persistence → Postgres in Phase 2.

**Still to decide (lower urgency):**

- JS AST library: `@babel/parser` vs `tree-sitter-javascript` (finalize at 2B start).
- Queue technology at scale: in-process worker now; BullMQ + Redis only if volume demands.
- Embeddings model for Phase 4 (revisit at Phase 4 kickoff).
