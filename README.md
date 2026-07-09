# Tracr

> **A GitHub App that helps engineering teams safely review AI-assisted code before it reaches production.**

<p align="center">

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-Backend-black?logo=express)
![GitHub App](https://img.shields.io/badge/GitHub-App-181717?logo=github)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite)
![License](https://img.shields.io/badge/License-MIT-green)

</p>

---

## Live Demo

**Dashboard**

https://tracr-6gyu.onrender.com

> **Note**
>
> The application is hosted on Render's free tier.
> If it has been idle, the first request may take **30–60 seconds** while the service wakes up.

---

# What is Tracr?

Tracr (**Tracking Review And Code-origin Record**) is a GitHub App that provides an accountability layer for AI-assisted software development.

Whenever a Pull Request is opened, Tracr automatically:

- receives the GitHub webhook
- authenticates using GitHub App Installation Authentication
- downloads the Pull Request diff
- scans newly added code for risky patterns
- posts a review comment directly on the Pull Request
- maintains a repository trust score over time

Unlike traditional static analysis tools, Tracr focuses on **review awareness** rather than trying to prove whether code is correct.

Its goal is simple:

> **Help reviewers spend more attention on AI-generated changes that affect sensitive parts of an application.**

---

# The Problem

AI coding assistants such as

- GitHub Copilot
- Cursor
- Claude Code
- ChatGPT

have fundamentally changed how software is written.

Developers now generate large amounts of code in seconds.

The problem isn't that AI always writes bad code.

The real problem is that **AI-generated code often receives less critical review because it appears polished and confident.**

Reviewers naturally trust clean-looking code.

That creates a dangerous situation where authentication logic, payment handling, database operations, or secret management can be merged without receiving the level of scrutiny they deserve.

Research consistently shows that AI-generated code can introduce security issues and logical mistakes while simultaneously increasing developer confidence.

Today's review tools focus on:

- formatting
- linting
- testing
- security scanning

Very few tools ask:

> **Should this specific AI-generated change receive extra human attention before merging?**

That's the gap Tracr is designed to fill.

---

# The Solution

Tracr acts as a GitHub App sitting inside the Pull Request workflow.

Instead of replacing code review, it enhances it.

Whenever a Pull Request is opened:

1. GitHub sends a webhook to Tracr.
2. Tracr authenticates using GitHub App Installation Tokens.
3. It downloads the changed files.
4. Only the newly added lines are analyzed.
5. Sensitive patterns are identified.
6. If risky changes are detected, Tracr automatically comments on the Pull Request.

Example:

```text
⚠️ Tracr Risk Warning

This Pull Request contains changes touching sensitive areas.

• auth.js — authentication logic
• payment.js — payment handling

Please ensure these changes receive human review before merging.
```

Tracr does **not** block merges.

It does **not** replace developers.

It simply ensures reviewers pay closer attention where the risk is highest.

---

# Key Features

## GitHub App

Built as a real GitHub App instead of relying on Personal Access Tokens.

Any repository that installs the app can immediately use Tracr.

---

## GitHub Webhooks

Automatically responds whenever a Pull Request is opened.

No manual scanning required.

---

## Installation Authentication

Uses GitHub App Installation Tokens instead of Personal Access Tokens.

Benefits:

- repository-specific permissions
- short-lived tokens
- secure authentication
- supports multiple organizations

---

## Risk Scanner

Scans newly added code for sensitive patterns including:

- authentication
- passwords
- API keys
- tokens
- payment logic
- SQL deletion
- environment variables
- secrets

---

## Pull Request Review

Automatically posts review comments directly inside GitHub Pull Requests.

Reviewers receive warnings exactly where they already work.

---

## Repository Trust Score

Each repository receives a Trust Score (0–100) based on:

- AI-generated code percentage
- risky AI changes
- bugs found
- reverted code

This provides long-term visibility into AI-assisted development quality.

---

## Lightweight Dashboard

A simple dashboard displays:

- tracked code blocks
- AI vs Human contributions
- repository trust score
- scan history

---

## Modular Architecture

The project is organized into separate modules:

- GitHub Integration
- API Routes
- Risk Analysis
- Database
- Trust Score

making it easy to extend and maintain.

---

# Why GitHub App Authentication?

Early versions of Tracr used a GitHub Personal Access Token.

That approach had major limitations:

- tied to one developer
- difficult to share
- excessive permissions
- poor scalability

Tracr now uses **GitHub App Installation Authentication**.

When someone installs Tracr on a repository:

- GitHub creates an Installation ID.
- Every webhook contains that Installation ID.
- Tracr generates a temporary Installation Access Token.
- The repository is scanned securely without storing personal credentials.

This allows Tracr to work for **any repository where the GitHub App is installed**.

---

# High-Level Workflow

```text
Developer opens Pull Request
            │
            ▼
GitHub Webhook
            │
            ▼
Tracr Backend
            │
            ▼
GitHub App Installation Authentication
            │
            ▼
Download Pull Request Diff
            │
            ▼
Risk Scanner
            │
            ▼
Review Comment
            │
            ▼
Repository Trust Score
```
