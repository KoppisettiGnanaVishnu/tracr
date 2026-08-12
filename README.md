# 🛡️ TRACRR

### AI-Powered GitHub Pull Request Security Review & Trust Analysis Platform

TRACRR is a GitHub App that automatically analyzes Pull Requests, detects security vulnerabilities, evaluates repository risk, and generates actionable review reports before code is merged.

[![GitHub App](https://img.shields.io/badge/GitHub-App-blue)](https://github.com/apps/tracr-ai)
[![Live Demo](https://img.shields.io/badge/Live-Demo-success)](https://tracr-6gyu.onrender.com)

---

## 🚀 Try TRACRR Right Now

No local setup required.

### Step 1: Install the GitHub App

👉 https://github.com/apps/tracr-ai

### Step 2: Select a Repository

Install TRACRR on any personal or organization repository.

### Step 3: Create a Pull Request

Add vulnerable code such as:

```javascript
const password = "admin123";

const query =
  "SELECT * FROM users WHERE id = " + userId;
```

### Step 4: Watch TRACRR Review Your Code

TRACRR automatically:

* Detects security vulnerabilities
* Evaluates repository risk
* Generates Pull Request findings
* Calculates repository trust scores
* Posts review reports directly to GitHub

---

## 🌐 Live Application

Demo URL:

https://tracr-6gyu.onrender.com

---

# Why TRACRR?

Code reviews are essential for maintaining software quality and security, but manual reviews are often:

* Time-consuming
* Inconsistent
* Difficult to scale
* Prone to human oversight

Security issues such as hardcoded credentials and unsafe query construction can easily reach production environments.

TRACRR acts as an automated first-pass security reviewer that analyzes Pull Requests and highlights potential risks before code is merged.

---

# ⚡ Key Features

### GitHub Integration

* Public GitHub App Installation
* Pull Request Monitoring
* Webhook-Based Automation
* Multi-Repository Support

### Security Analysis

* Hardcoded Credential Detection
* SQL Injection Detection
* Repository Risk Assessment
* Trust Score Generation

### Developer Experience

* Automated Pull Request Reviews
* Actionable Security Recommendations
* Zero Configuration Testing
* GitHub-Native Workflow

---

# 🌍 Language-Agnostic Security Scanning

TRACRR performs pattern-based security analysis on source code changes and is not restricted to a single programming language.

### Validated Languages

* ✅ JavaScript
* ✅ C++

### Current Detection Rules

* Hardcoded Passwords
* Hardcoded Credentials
* SQL Injection Patterns
* Repository Risk Classification

Additional language validations and security rules are actively being expanded.

---

# 🔍 How TRACRR Works

```text
Developer Creates Pull Request
                │
                ▼
        GitHub Webhook Event
                │
                ▼
          TRACRR Backend
                │
                ▼
       Security Analysis Engine
                │
                ▼
         Vulnerability Scanner
                │
                ▼
         Risk Evaluation Layer
                │
                ▼
        Trust Score Generation
                │
                ▼
       Pull Request Review Report
```

---

# 📸 Real Pull Request Reviews

## Vulnerable Pull Request

TRACRR successfully detected security vulnerabilities in a Pull Request containing:

* Hardcoded Password
* SQL Injection Pattern

Add the screenshot below:

```text
docs/images/vulnerable-pr-review.png
```

Example Result:

```text
Files Scanned: 1

Overall Risk: HIGH

Findings:
- Hardcoded Password
- Possible SQL Injection

Trust Score: 90/100
```

---

## Clean Pull Request

TRACRR correctly identified a clean Pull Request with no security findings.

Add the screenshot below:

```text
docs/images/clean-pr-review.png
```

Example Result:

```text
Files Scanned: 1

Overall Risk: LOW

No issues detected

Trust Score: 100/100
```

This validation demonstrates both:

* ✅ Vulnerability Detection
* ✅ Low False Positive Behavior

---

# 🧪 Validation Results

TRACRR has been successfully tested using:

* ✅ Independent GitHub Accounts
* ✅ Public GitHub App Installation
* ✅ External Repositories
* ✅ Pull Request Webhooks
* ✅ JavaScript Projects
* ✅ C++ Projects
* ✅ Vulnerable Pull Requests
* ✅ Clean Pull Requests
* ✅ Automated Review Generation
* ✅ Trust Score Evaluation

---

# 🏗️ System Architecture

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
GitHub Pull Request Review
```

---

# 🛠️ Tech Stack

### Backend

* Node.js
* Express.js

### GitHub Integration

* GitHub Apps
* Octokit
* GitHub Webhooks

### Database

* SQLite

### Deployment

* Render

---

# 📂 Project Structure

```text
tracr/
├── src/
│   ├── routes/
│   ├── scanners/
│   ├── services/
│   ├── github/
│   └── database/
├── reviews/
├── public/
├── docs/
│   └── images/
└── README.md
```

---

# 🚀 Local Development

```bash
git clone https://github.com/KoppisettiGnanaVishnu/TRACRR.git

cd TRACRR

npm install

npm start
```

Configure required environment variables before running the application.

---

# 🚧 Roadmap

### Planned Enhancements

* Inline GitHub Review Comments
* Additional Security Rules
* AI-Assisted Code Understanding
* Python Validation
* Java Validation
* Historical Risk Analytics
* Team Security Dashboards
* Advanced Trust Scoring Models

---

# ⭐ Install & Test TRACRR

Ready to try it yourself?

### GitHub App Installation

👉 https://github.com/apps/tracr-ai

Install TRACRR on a repository, create a Pull Request, and experience automated security reviews directly within GitHub.

If you find TRACRR useful, consider giving the repository a ⭐ and sharing feedback.
