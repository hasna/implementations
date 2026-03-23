/**
 * PostgreSQL migrations for open-implementations cloud sync.
 *
 * Equivalent to the SQLite schema in database.ts, translated for PostgreSQL.
 */

export const PG_MIGRATIONS: string[] = [
  // Migration 1: projects table
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT NOW()::text,
    updated_at TEXT NOT NULL DEFAULT NOW()::text
  )`,

  // Migration 2: plans table
  `CREATE TABLE IF NOT EXISTS plans (
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
    created_at TEXT NOT NULL DEFAULT NOW()::text,
    updated_at TEXT NOT NULL DEFAULT NOW()::text
  )`,

  // Migration 3: audits table
  `CREATE TABLE IF NOT EXISTS audits (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'other' CHECK(type IN ('security', 'performance', 'code_review', 'dependency', 'other')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'failed')),
    severity TEXT CHECK(severity IN ('info', 'low', 'medium', 'high', 'critical')),
    findings TEXT,
    metadata TEXT DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT NOW()::text,
    updated_at TEXT NOT NULL DEFAULT NOW()::text,
    completed_at TEXT
  )`,

  // Migration 4: logs table
  `CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    level TEXT NOT NULL DEFAULT 'info' CHECK(level IN ('debug', 'info', 'warn', 'error')),
    source TEXT NOT NULL DEFAULT 'cli',
    message TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT NOW()::text
  )`,

  // Migration 5: indexes
  `CREATE INDEX IF NOT EXISTS idx_plans_project ON plans(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status)`,
  `CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_audits_project ON audits(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audits_type ON audits(type)`,
  `CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status)`,
  `CREATE INDEX IF NOT EXISTS idx_audits_severity ON audits(severity)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_project ON logs(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_source ON logs(source)`,

  // Migration 6: feedback table
  `CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    message TEXT NOT NULL,
    email TEXT,
    category TEXT DEFAULT 'general',
    version TEXT,
    machine_id TEXT,
    created_at TEXT NOT NULL DEFAULT NOW()::text
  )`,
];
