import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Audit, AuditRow, Plan, PlanRow } from "../types/index.js";
import { getDatabase } from "../db/database.js";

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseMetadata(value: string | null | undefined): Record<string, unknown> {
  const parsed = parseJson<unknown>(value, {});
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}

function parseTags(value: string | null | undefined): string[] {
  const parsed = parseJson<unknown>(value, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((tag): tag is string => typeof tag === "string");
}

function rowToPlan(row: PlanRow): Plan {
  return {
    ...row,
    tags: parseTags(row.tags),
    metadata: parseMetadata(row.metadata),
    status: row.status as Plan["status"],
  };
}

function rowToAudit(row: AuditRow): Audit {
  return {
    ...row,
    metadata: parseMetadata(row.metadata),
    type: row.type as Audit["type"],
    status: row.status as Audit["status"],
    severity: row.severity as Audit["severity"],
  };
}

export function searchPlans(
  query: string,
  projectId?: string,
  db?: Database,
): Plan[] {
  const d = db || getDatabase();
  const trimmed = query.trim();
  if (!trimmed) return [];
  const pattern = `%${trimmed}%`;

  let sql = `SELECT * FROM plans WHERE (title LIKE ? OR description LIKE ? OR content LIKE ? OR tags LIKE ?)`;
  const params: SQLQueryBindings[] = [pattern, pattern, pattern, pattern];

  if (projectId) {
    sql += " AND project_id = ?";
    params.push(projectId);
  }

  sql += ` ORDER BY created_at DESC`;

  const rows = d.query(sql).all(...params) as PlanRow[];
  return rows.map(rowToPlan);
}

export function searchAudits(
  query: string,
  projectId?: string,
  db?: Database,
): Audit[] {
  const d = db || getDatabase();
  const trimmed = query.trim();
  if (!trimmed) return [];
  const pattern = `%${trimmed}%`;

  let sql = `SELECT * FROM audits WHERE (title LIKE ? OR findings LIKE ?)`;
  const params: SQLQueryBindings[] = [pattern, pattern];

  if (projectId) {
    sql += " AND project_id = ?";
    params.push(projectId);
  }

  sql += ` ORDER BY
    CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 WHEN 'info' THEN 4 ELSE 5 END,
    created_at DESC`;

  const rows = d.query(sql).all(...params) as AuditRow[];
  return rows.map(rowToAudit);
}

export function searchAll(
  query: string,
  projectId?: string,
  db?: Database,
): { plans: Plan[]; audits: Audit[] } {
  return {
    plans: searchPlans(query, projectId, db),
    audits: searchAudits(query, projectId, db),
  };
}
