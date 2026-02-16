import type { Database } from "bun:sqlite";
import type { DashboardStats } from "../types/index.js";
import { getDatabase } from "./database.js";

export function getStats(db?: Database): DashboardStats {
  const d = db || getDatabase();

  const projectRow = d.query(
    "SELECT COUNT(*) AS total FROM projects",
  ).get() as { total: number } | null;

  const planRow = d.query(
    `SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) AS draft,
      COALESCE(SUM(CASE WHEN status IN ('draft', 'review', 'approved', 'in_progress') THEN 1 ELSE 0 END), 0) AS active,
      COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS done
     FROM plans`,
  ).get() as { total: number; draft: number; active: number; done: number } | null;

  const auditRow = d.query(
    `SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN status IN ('pending', 'in_progress') THEN 1 ELSE 0 END), 0) AS pending,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
      COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed
     FROM audits`,
  ).get() as { total: number; pending: number; completed: number; failed: number } | null;

  const logRow = d.query(
    `SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END), 0) AS errors,
      COALESCE(SUM(CASE WHEN level = 'warn' THEN 1 ELSE 0 END), 0) AS warns
     FROM logs`,
  ).get() as { total: number; errors: number; warns: number } | null;

  return {
    projects: {
      total: projectRow?.total ?? 0,
    },
    plans: {
      total: planRow?.total ?? 0,
      draft: planRow?.draft ?? 0,
      active: planRow?.active ?? 0,
      done: planRow?.done ?? 0,
    },
    audits: {
      total: auditRow?.total ?? 0,
      pending: auditRow?.pending ?? 0,
      completed: auditRow?.completed ?? 0,
      failed: auditRow?.failed ?? 0,
    },
    logs: {
      total: logRow?.total ?? 0,
      errors: logRow?.errors ?? 0,
      warns: logRow?.warns ?? 0,
    },
  };
}
