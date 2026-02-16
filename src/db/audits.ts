import type { Database, SQLQueryBindings } from "bun:sqlite";
import type {
  Audit,
  AuditFilter,
  AuditRow,
  CreateAuditInput,
  UpdateAuditInput,
} from "../types/index.js";
import {
  AuditNotFoundError,
  VersionConflictError,
} from "../types/index.js";
import { getDatabase, now, uuid } from "./database.js";

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

function rowToAudit(row: AuditRow): Audit {
  return {
    ...row,
    metadata: parseMetadata(row.metadata),
    type: row.type as Audit["type"],
    status: row.status as Audit["status"],
    severity: row.severity as Audit["severity"],
  };
}

function normalizeLimit(limit?: number): number | undefined {
  if (limit === undefined || !Number.isFinite(limit)) return undefined;
  const bounded = Math.max(0, Math.floor(limit));
  return Math.min(bounded, 1000);
}

function normalizeOffset(offset?: number): number | undefined {
  if (offset === undefined || !Number.isFinite(offset)) return undefined;
  return Math.max(0, Math.floor(offset));
}

export function createAudit(input: CreateAuditInput, db?: Database): Audit {
  const d = db || getDatabase();
  const title = input.title?.trim();
  if (!title) {
    throw new Error("Audit title is required");
  }
  const id = uuid();
  const timestamp = now();
  const status = input.status || "pending";
  const completedAt =
    status === "completed" || status === "failed" ? timestamp : null;

  d.run(
    `INSERT INTO audits (id, project_id, title, type, status, severity, findings, metadata, version, created_at, updated_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [
      id,
      input.project_id || null,
      title,
      input.type || "other",
      status,
      input.severity || null,
      input.findings?.trim() || null,
      JSON.stringify(input.metadata || {}),
      timestamp,
      timestamp,
      completedAt,
    ],
  );

  return getAudit(id, d)!;
}

export function getAudit(id: string, db?: Database): Audit | null {
  const d = db || getDatabase();
  const row = d.query("SELECT * FROM audits WHERE id = ?").get(id) as AuditRow | null;
  if (!row) return null;
  return rowToAudit(row);
}

export function listAudits(filter: AuditFilter = {}, db?: Database): Audit[] {
  const d = db || getDatabase();
  const conditions: string[] = [];
  const params: SQLQueryBindings[] = [];

  if (filter.project_id) {
    conditions.push("project_id = ?");
    params.push(filter.project_id);
  }

  if (filter.type) {
    if (Array.isArray(filter.type)) {
      const types = filter.type.filter(Boolean);
      if (types.length === 0) return [];
      conditions.push(`type IN (${types.map(() => "?").join(",")})`);
      params.push(...types);
    } else {
      conditions.push("type = ?");
      params.push(filter.type);
    }
  }

  if (filter.status) {
    if (Array.isArray(filter.status)) {
      const statuses = filter.status.filter(Boolean);
      if (statuses.length === 0) return [];
      conditions.push(`status IN (${statuses.map(() => "?").join(",")})`);
      params.push(...statuses);
    } else {
      conditions.push("status = ?");
      params.push(filter.status);
    }
  }

  if (filter.severity) {
    if (Array.isArray(filter.severity)) {
      const severities = filter.severity.filter(Boolean);
      if (severities.length === 0) return [];
      conditions.push(`severity IN (${severities.map(() => "?").join(",")})`);
      params.push(...severities);
    } else {
      conditions.push("severity = ?");
      params.push(filter.severity);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  let sql = `SELECT * FROM audits ${where} ORDER BY
       CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 WHEN 'info' THEN 4 ELSE 5 END,
       created_at DESC`;
  const limit = normalizeLimit(filter.limit);
  const offset = normalizeOffset(filter.offset);
  if (limit !== undefined) {
    sql += " LIMIT ?";
    params.push(limit);
    if (offset !== undefined) {
      sql += " OFFSET ?";
      params.push(offset);
    }
  } else if (offset !== undefined) {
    sql += " LIMIT -1 OFFSET ?";
    params.push(offset);
  }
  const rows = d.query(sql).all(...params) as AuditRow[];

  return rows.map(rowToAudit);
}

export function updateAudit(
  id: string,
  input: UpdateAuditInput,
  db?: Database,
): Audit {
  const d = db || getDatabase();
  const audit = getAudit(id, d);
  if (!audit) throw new AuditNotFoundError(id);

  // Optimistic locking check
  if (audit.version !== input.version) {
    throw new VersionConflictError(id, input.version, audit.version);
  }

  const sets: string[] = ["version = version + 1", "updated_at = ?"];
  const params: SQLQueryBindings[] = [now()];

  if (input.title !== undefined) {
    const nextTitle = input.title.trim();
    if (!nextTitle) {
      throw new Error("Audit title cannot be empty");
    }
    sets.push("title = ?");
    params.push(nextTitle);
  }
  if (input.type !== undefined) {
    sets.push("type = ?");
    params.push(input.type);
  }
  if (input.status !== undefined) {
    sets.push("status = ?");
    params.push(input.status);
    if (input.status === "completed" || input.status === "failed") {
      sets.push("completed_at = ?");
      params.push(now());
    } else {
      sets.push("completed_at = ?");
      params.push(null);
    }
  }
  if (input.severity !== undefined) {
    sets.push("severity = ?");
    params.push(input.severity);
  }
  if (input.findings !== undefined) {
    sets.push("findings = ?");
    params.push(input.findings?.trim() || null);
  }
  if (input.metadata !== undefined) {
    sets.push("metadata = ?");
    params.push(JSON.stringify(input.metadata));
  }

  params.push(id, input.version);

  const result = d.run(
    `UPDATE audits SET ${sets.join(", ")} WHERE id = ? AND version = ?`,
    params,
  );

  if (result.changes === 0) {
    const current = getAudit(id, d);
    throw new VersionConflictError(
      id,
      input.version,
      current?.version ?? -1,
    );
  }

  return getAudit(id, d)!;
}

export function completeAudit(
  id: string,
  findings?: string,
  db?: Database,
): Audit {
  const d = db || getDatabase();
  const audit = getAudit(id, d);
  if (!audit) throw new AuditNotFoundError(id);

  const timestamp = now();
  if (findings !== undefined) {
    d.run(
      `UPDATE audits SET status = 'completed', completed_at = ?, findings = ?, version = version + 1, updated_at = ? WHERE id = ?`,
      [timestamp, findings, timestamp, id],
    );
  } else {
    d.run(
      `UPDATE audits SET status = 'completed', completed_at = ?, version = version + 1, updated_at = ? WHERE id = ?`,
      [timestamp, timestamp, id],
    );
  }

  return getAudit(id, d)!;
}

export function deleteAudit(id: string, db?: Database): boolean {
  const d = db || getDatabase();
  const result = d.run("DELETE FROM audits WHERE id = ?", [id]);
  return result.changes > 0;
}
