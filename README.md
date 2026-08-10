# 🛡️ TRACRR

### AI-Powered GitHub Pull Request Security Review & Trust Analysis Platform

TRACRR automatically reviews pull requests, detects security vulnerabilities, evaluates repository risk, and generates actionable findings before code is merged.

---

## 🚀 Try TRACRR Right Now

No setup required.

### 1️⃣ Install GitHub App

👉 https://github.com/apps/tracr-ai

### 2️⃣ Create a Pull Request

Add vulnerable code:

```js
const password = "admin123";

const query =
"SELECT * FROM users WHERE id = " + userId;
```

### 3️⃣ Watch TRACRR Review Your Code

TRACRR automatically:

✅ Detects Hardcoded Credentials

✅ Detects SQL Injection Patterns

✅ Calculates Risk Levels

✅ Generates Pull Request Findings

✅ Produces Repository Trust Scores

---

## 🎥 Live Demo

🌐 https://tracr-6gyu.onrender.com

---

# Why TRACRR?

Code reviews are critical but often:

- Time-consuming
- Inconsistent
- Prone to human oversight

Security issues such as:

- Hardcoded secrets
- Unsafe SQL queries
- Poor coding practices

can easily slip into production.

TRACRR acts as an automated first-pass reviewer that scans pull requests and highlights potential risks before merge.

---

# 🔍 What Happens When A PR Is Created?

```text
Developer Opens PR
        │
        ▼
GitHub Webhook Event
        │
        ▼
TRACRR Analysis Engine
        │
        ▼
Security Scanner
        │
        ▼
Risk Evaluation
        │
        ▼
Trust Score Generation
        │
        ▼
PR Review Report
```

---

# ⚡ Features

### GitHub Integration

- Public GitHub App
- Repository Installation
- Pull Request Monitoring
- Webhook Automation

### Security Analysis

- Hardcoded Password Detection
- SQL Injection Detection
- Risk Classification
- Repository Trust Evaluation

### Developer Experience

- Automatic PR Reports
- Actionable Recommendations
- No Local Setup Required

---

# 📸 Example Review

TRACRR was tested on an independent GitHub account using a real Pull Request.

### Findings

🔴 Hardcoded Password

```js
const password = "admin123";
```

Recommendation:

Move credentials to environment variables.

---

🔴 Possible SQL Injection

```js
const query =
"SELECT * FROM users WHERE id = " + userId;
```

Recommendation:

Use parameterized queries.

---

### Generated Review

```text
Files Scanned: 1

Overall Risk: HIGH

Findings:
- Hardcoded Password
- Possible SQL Injection

Trust Score: 90/100
```

> Add your actual PR screenshot here.

---

# 🏗️ Architecture

```text
GitHub Repository
        │
        ▼
GitHub App
        │
        ▼
Webhook Listener
        │
        ▼
TRACRR Backend
        │
 ┌──────┴──────┐
 ▼             ▼
Scanner      Database
Engine
 ▼
Review Generator
 ▼
Trust Score Engine
 ▼
GitHub Pull Request
```

---

# 🛠️ Tech Stack

### Backend

- Node.js
- Express.js

### GitHub Integration

- GitHub Apps
- Octokit
- Webhooks

### Database

- SQLite

### Deployment

- Render

---

# 📂 Project Structure

```text
tracr/
├── src/
│   ├── routes/
│   ├── services/
│   ├── scanners/
│   ├── github/
│   └── database/
├── reviews/
├── public/
└── README.md
```

---

# 🧪 Validation

TRACRR has been successfully tested using:

✅ Independent GitHub Accounts

✅ Public GitHub App Installation

✅ Pull Request Webhooks

✅ Automated Vulnerability Detection

✅ Review Report Generation

✅ Multi-Repository Analysis

---

# 🚧 Roadmap

- Inline GitHub Review Comments
- Additional Security Rules
- AI-Powered Code Understanding
- Multi-Language Support
- Historical Risk Analytics
- Team Security Dashboards

---

# ⭐ Install & Test TRACRR

### GitHub App

👉 https://github.com/apps/tracr-ai

If you find TRACRR useful, consider starring the repository and trying it on your own projects.
