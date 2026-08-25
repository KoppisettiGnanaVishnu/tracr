// Tracr — database setup
// Creates and migrates SQLite tables for Phase 1:
//   - code_blocks  (original, kept for compatibility)
//   - pr_scans     (one row per PR analysis run)
//   - findings     (one row per vulnerability found)
//   - installations (GitHub App installation tracking)

import Database from "better-sqlite3";

const db = new Database("tracr.db");

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ==========================================
// Table: code_blocks (original — kept for compatibility)
// ==========================================
db.exec(`
  CREATE TABLE IF NOT EXISTS code_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_name TEXT,
    file_path TEXT,
    code_snippet TEXT,
    is_ai_generated INTEGER,
    is_risky INTEGER DEFAULT 0,
    reviewed_by_human INTEGER DEFAULT 0,
    bugs_found INTEGER DEFAULT 0,
    reverted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// ==========================================
// Table: pr_scans — one row per PR analysis
// ==========================================
db.exec(`
  CREATE TABLE IF NOT EXISTS pr_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    installation_id INTEGER,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    pull_number INTEGER NOT NULL,
    commit_sha TEXT,
    files_scanned INTEGER DEFAULT 0,
    findings_count INTEGER DEFAULT 0,
    high_count INTEGER DEFAULT 0,
    medium_count INTEGER DEFAULT 0,
    low_count INTEGER DEFAULT 0,
    info_count INTEGER DEFAULT 0,
    risk_level TEXT DEFAULT 'LOW',
    trust_score INTEGER DEFAULT 100,
    scanned_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// ==========================================
// Table: findings — one row per vulnerability
// ==========================================
db.exec(`
  CREATE TABLE IF NOT EXISTS findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id INTEGER NOT NULL REFERENCES pr_scans(id) ON DELETE CASCADE,
    rule_id TEXT,
    file TEXT NOT NULL,
    line INTEGER,
    matched_text TEXT,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    confidence REAL DEFAULT 1.0,
    cwe TEXT,
    ai_explanation TEXT,
    ai_fix TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// ==========================================
// Table: installations — GitHub App tracking
// ==========================================
db.exec(`
  CREATE TABLE IF NOT EXISTS installations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    installation_id INTEGER UNIQUE NOT NULL,
    owner TEXT,
    owner_type TEXT,
    installed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    uninstalled_at TEXT
  )
`);

// ==========================================
// Prepared statements (exported for reuse)
// ==========================================

export const insertScan = db.prepare(`
  INSERT INTO pr_scans
    (installation_id, owner, repo, pull_number, commit_sha,
     files_scanned, findings_count, high_count, medium_count,
     low_count, info_count, risk_level, trust_score)
  VALUES
    (@installation_id, @owner, @repo, @pull_number, @commit_sha,
     @files_scanned, @findings_count, @high_count, @medium_count,
     @low_count, @info_count, @risk_level, @trust_score)
`);

export const insertFinding = db.prepare(`
  INSERT INTO findings
    (scan_id, rule_id, file, line, matched_text, severity,
     title, message, confidence, cwe)
  VALUES
    (@scan_id, @rule_id, @file, @line, @matched_text, @severity,
     @title, @message, @confidence, @cwe)
`);

export const upsertInstallation = db.prepare(`
  INSERT INTO installations (installation_id, owner, owner_type)
  VALUES (@installation_id, @owner, @owner_type)
  ON CONFLICT(installation_id) DO UPDATE SET
    owner = excluded.owner,
    owner_type = excluded.owner_type,
    uninstalled_at = NULL
`);

export const markUninstalled = db.prepare(`
  UPDATE installations
  SET uninstalled_at = CURRENT_TIMESTAMP
  WHERE installation_id = ?
`);

export const getRecentScans = db.prepare(`
  SELECT * FROM pr_scans
  ORDER BY scanned_at DESC
  LIMIT ?
`);

export const getScanById = db.prepare(`
  SELECT * FROM pr_scans WHERE id = ?
`);

export const getFindingsByScanId = db.prepare(`
  SELECT * FROM findings WHERE scan_id = ?
  ORDER BY severity DESC, file, line
`);

export const getScansByRepo = db.prepare(`
  SELECT * FROM pr_scans
  WHERE owner = ? AND repo = ?
  ORDER BY scanned_at DESC
  LIMIT 50
`);

export default db;