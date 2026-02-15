import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Audit, AuditRow, Plan, PlanRow } from "../types/index.js";
import { getDatabase } from "../db/database.js";

function rowToPlan(row: PlanRow): Plan {
  return {
    ...row,
    tags: JSON.parse(row.tags || "[]") as string[],
    metadata: JSON.parse(row.metadata || "{}") as Record<string, unknown>,
    status: row.status as Plan["status"],
  };
}

function rowToAudit(row: AuditRow): Audit {
  return {
    ...row,
    metadata: JSON.parse(row.metadata || "{}") as Record<string, unknown>,
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
  const pattern = `%${query}%`;

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
  const pattern = `%${query}%`;

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
