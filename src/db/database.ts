import { Database } from "bun:sqlite";
import { SqliteAdapter } from "@hasna/cloud";
import { existsSync, mkdirSync, cpSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function getDbPath(): string {
  // 1. Environment variable override (new name first, then legacy)
  const explicitPath = process.env["HASNA_IMPLEMENTATIONS_DB_PATH"] ?? process.env["IMPLEMENTATIONS_DB_PATH"];
  if (explicitPath) {
    return explicitPath;
  }

  // 2. Per-project: .implementations/implementations.db in cwd
  const cwd = process.cwd();
  const localDb = join(cwd, ".implementations", "implementations.db");
  if (existsSync(localDb)) {
    return localDb;
  }

  // 3. Default: ~/.hasna/implementations/implementations.db (with backward compat)
  const home = process.env["HOME"] || process.env["USERPROFILE"] || "~";
  const newDir = join(home, ".hasna", "implementations");
  const oldDir = join(home, ".implementations");

  // Auto-migrate: copy old data to new location if needed
  if (!existsSync(newDir) && existsSync(oldDir)) {
    mkdirSync(join(home, ".hasna"), { recursive: true });
    cpSync(oldDir, newDir, { recursive: true });
  }

  return join(newDir, "implementations.db");
}

function ensureDir(filePath: string): void {
  const dir = dirname(resolve(filePath));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

const MIGRATIONS = [
  // Migration 1: Initial schema
  `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    content TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'review', 'approved', 'in_progress', 'done', 'archived')),
    tags TEXT DEFAULT '[]',
    metadata TEXT DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audits (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'other' CHECK(type IN ('security', 'performance', 'code_review', 'dependency', 'other')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'failed')),
    severity TEXT CHECK(severity IN ('info', 'low', 'medium', 'high', 'critical')),
    findings TEXT,
    metadata TEXT DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    level TEXT NOT NULL DEFAULT 'info' CHECK(level IN ('debug', 'info', 'warn', 'error')),
    source TEXT NOT NULL DEFAULT 'cli',
    message TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_plans_project ON plans(project_id);
  CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
  CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug);
  CREATE INDEX IF NOT EXISTS idx_audits_project ON audits(project_id);
  CREATE INDEX IF NOT EXISTS idx_audits_type ON audits(type);
  CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
  CREATE INDEX IF NOT EXISTS idx_audits_severity ON audits(severity);
  CREATE INDEX IF NOT EXISTS idx_logs_project ON logs(project_id);
  CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
  CREATE INDEX IF NOT EXISTS idx_logs_source ON logs(source);

  CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO _migrations (id) VALUES (1);
  `,

  // Migration 2: Feedback table
  `
  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    message TEXT NOT NULL,
    email TEXT,
    category TEXT DEFAULT 'general',
    version TEXT,
    machine_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO _migrations (id) VALUES (2);
  `,
];

let _db: Database | null = null;
let _adapter: SqliteAdapter | null = null;

export function getDatabase(dbPath?: string): Database {
  if (_db) return _db;

  const path = dbPath || getDbPath();
  ensureDir(path);

  _adapter = new SqliteAdapter(path);
  _db = _adapter.raw;

  // SqliteAdapter already sets WAL and foreign_keys; add busy_timeout
  _db.run("PRAGMA busy_timeout = 5000");

  // Run migrations
  runMigrations(_db);

  return _db;
}

function runMigrations(db: Database): void {
  // Ensure migrations table exists for tracking
  db.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`,
  );

  const result = db.query("SELECT MAX(id) as max_id FROM _migrations").get() as { max_id: number | null } | null;
  const currentLevel = result?.max_id ?? 0;

  for (let i = currentLevel; i < MIGRATIONS.length; i++) {
    db.exec(MIGRATIONS[i]!);
    db.run("INSERT OR REPLACE INTO _migrations (id) VALUES (?)", [i + 1]);
  }
}

export function closeDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
    _adapter = null;
  }
}

export function resetDatabase(): void {
  _db = null;
  _adapter = null;
}

/** Get the SqliteAdapter for direct SQL queries (e.g. feedback). */
export function getAdapter(): SqliteAdapter {
  if (!_adapter) {
    getDatabase(); // force initialization
  }
  return _adapter!;
}

export function now(): string {
  return new Date().toISOString();
}

export function uuid(): string {
  return crypto.randomUUID();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

export function resolvePartialId(db: Database, table: string, partialId: string): string | null {
  const allowedTables = new Set(["plans", "audits", "logs", "projects"]);
  if (!allowedTables.has(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  const trimmed = partialId.trim();
  if (!trimmed) return null;
  if (trimmed.length >= 36) {
    // Full UUID
    const row = db.query(`SELECT id FROM ${table} WHERE id = ?`).get(trimmed) as { id: string } | null;
    return row?.id ?? null;
  }

  // Partial match (prefix)
  const rows = db.query(`SELECT id FROM ${table} WHERE id LIKE ?`).all(`${trimmed}%`) as { id: string }[];
  if (rows.length === 1) {
    return rows[0]!.id;
  }
  if (rows.length > 1) {
    // Ambiguous - return null
    return null;
  }
  return null;
}
