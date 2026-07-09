# Tracr

> **A GitHub App that helps engineering teams review AI-assisted code more safely.**

Tracr (Tracking Review And Code-origin Record) adds an accountability layer to AI-assisted software development. Whenever a Pull Request is opened, Tracr automatically scans newly added code for risky patterns and posts review comments directly on GitHub.

Unlike traditional code scanners, Tracr focuses on **review awareness**—helping reviewers identify AI-assisted changes in sensitive areas before they are merged.

---

## Live Demo

**Dashboard**

https://tracr-6gyu.onrender.com

> **Note**
>
> The demo is hosted on Render's free tier. If the service has been idle, the first request may take **30–60 seconds** while it wakes up.

---

# Why Tracr?

AI coding assistants such as GitHub Copilot, Cursor, Claude, and ChatGPT are becoming a standard part of software development.

They significantly improve productivity, but they also introduce a new challenge:

> AI-generated code often looks polished enough that reviewers may spend less time examining it—especially in sensitive areas like authentication, payments, or secret management.

Tracr helps engineering teams identify these higher-risk changes and encourages additional human review before they reach production.

---

# Features

- GitHub App integration
- GitHub Webhooks
- GitHub App Installation Authentication
- Automatic Pull Request scanning
- Rule-based risk detection
- Repository Trust Score
- AI vs Human code tracking
- SQLite-backed scan history
- Lightweight dashboard

---

# Multi-Repository Support

Tracr is built as a **GitHub App**, not a Personal Access Token tool.

Once the GitHub App is installed on a repository:

- GitHub automatically sends Pull Request webhooks to Tracr.
- Tracr authenticates using the repository's **Installation ID**.
- A temporary Installation Access Token is generated.
- The Pull Request is scanned automatically.
- Review comments are posted directly on GitHub.

This architecture allows a single Tracr deployment to securely support multiple repositories without requiring users to share personal GitHub credentials.

---

# Architecture

```text
Developer opens Pull Request
            │
            ▼
      GitHub Webhook
            │
            ▼
      Tracr Backend
            │
     ┌──────┴────────┐
     ▼               ▼
Risk Scanner   GitHub App Auth
     │               │
     └──────┬────────┘
            ▼
      GitHub REST API
            │
            ▼
 Comment on Pull Request
```

---

# How It Works

1. A developer opens a Pull Request.
2. GitHub sends a webhook to Tracr.
3. Tracr authenticates using GitHub App Installation Authentication.
4. The Pull Request diff is downloaded using Octokit.
5. Newly added lines are scanned for risky patterns including:
   - Authentication
   - Passwords
   - API Keys
   - Tokens
   - Payment Logic
   - SQL Deletion
   - Environment Variables
6. If risky changes are found, Tracr automatically comments on the Pull Request.
7. Scan history contributes to the repository's Trust Score.

---

# Repository Trust Score

Every repository receives a Trust Score (0–100) calculated using tracked project data, including:

- Percentage of AI-generated code
- Risky AI-generated changes
- Bug history
- Reverted changes

The score helps teams understand how AI-assisted development is affecting repository health over time.

---

# Project Structure

```text
tracr/

├── database/
│   └── db.js
│
├── github/
│   ├── auth.js
│   └── scanner.js
│
├── routes/
│   ├── api.js
│   └── webhook.js
│
├── services/
│   ├── riskScanner.js
│   └── trustScore.js
│
├── public/
├── private/
└── index.js
```

---

# Tech Stack

| Layer | Technology |
|--------|------------|
| Backend | Node.js, Express |
| Database | SQLite (`better-sqlite3`) |
| GitHub Integration | GitHub App + Octokit |
| Authentication | GitHub App Installation Authentication |
| Event System | GitHub Webhooks |
| Frontend | HTML, CSS, JavaScript |
| Deployment | Render |

---

# Run Locally

Clone the repository:

```bash
git clone https://github.com/KoppisettiGnanaVishnu/tracr.git
cd tracr
npm install
```

Create a `.env` file:

```env
GITHUB_APP_ID=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

Place your GitHub App private key inside the `private/` directory.

Start the server:

```bash
npm start
```

---

# Engineering Highlights

During development, Tracr evolved from a simple GitHub API integration into a production-style GitHub App.

Major engineering improvements include:

- Migrated from Personal Access Tokens to GitHub App Installation Authentication
- Implemented GitHub Webhooks for automatic Pull Request scanning
- Migrated the backend from CommonJS to ES Modules
- Refactored the backend into a modular architecture
- Built a lightweight rule-based risk scanner
- Designed a Repository Trust Score system backed by SQLite

---

# Roadmap

- GitHub Check Runs
- Automatic reviewer assignment
- Organization-wide analytics
- VS Code extension
- Machine learning-based risk prediction
- Team dashboard

---

# License

MIT License
