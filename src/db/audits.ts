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

function rowToAudit(row: AuditRow): Audit {
  return {
    ...row,
    metadata: JSON.parse(row.metadata || "{}") as Record<string, unknown>,
    type: row.type as Audit["type"],
    status: row.status as Audit["status"],
    severity: row.severity as Audit["severity"],
  };
}

export function createAudit(input: CreateAuditInput, db?: Database): Audit {
  const d = db || getDatabase();
  const id = uuid();
  const timestamp = now();

  d.run(
    `INSERT INTO audits (id, project_id, title, type, status, severity, findings, metadata, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      input.project_id || null,
      input.title,
      input.type || "other",
      input.status || "pending",
      input.severity || null,
      input.findings || null,
      JSON.stringify(input.metadata || {}),
      timestamp,
      timestamp,
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
      conditions.push(`type IN (${filter.type.map(() => "?").join(",")})`);
      params.push(...filter.type);
    } else {
      conditions.push("type = ?");
      params.push(filter.type);
    }
  }

  if (filter.status) {
    if (Array.isArray(filter.status)) {
      conditions.push(`status IN (${filter.status.map(() => "?").join(",")})`);
      params.push(...filter.status);
    } else {
      conditions.push("status = ?");
      params.push(filter.status);
    }
  }

  if (filter.severity) {
    if (Array.isArray(filter.severity)) {
      conditions.push(`severity IN (${filter.severity.map(() => "?").join(",")})`);
      params.push(...filter.severity);
    } else {
      conditions.push("severity = ?");
      params.push(filter.severity);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = d
    .query(
      `SELECT * FROM audits ${where} ORDER BY
       CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 WHEN 'info' THEN 4 ELSE 5 END,
       created_at DESC`,
    )
    .all(...params) as AuditRow[];

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
    sets.push("title = ?");
    params.push(input.title);
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
    }
  }
  if (input.severity !== undefined) {
    sets.push("severity = ?");
    params.push(input.severity);
  }
  if (input.findings !== undefined) {
    sets.push("findings = ?");
    params.push(input.findings);
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
