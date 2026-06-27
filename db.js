// Tracr — database setup
// This creates a local SQLite database file and the tables
// we need to track code blocks and their AI/human origin.

const Database = require("better-sqlite3");
const db = new Database("tracr.db");

// Table: one row per code block we've seen
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

module.exports = db;