import type { Database, SQLQueryBindings } from "bun:sqlite";
import type {
  CreateLogInput,
  Log,
  LogFilter,
  LogRow,
} from "../types/index.js";
import { getDatabase, now, uuid } from "./database.js";

function rowToLog(row: LogRow): Log {
  return {
    ...row,
    metadata: JSON.parse(row.metadata || "{}") as Record<string, unknown>,
    level: row.level as Log["level"],
  };
}

export function createLog(input: CreateLogInput, db?: Database): Log {
  const d = db || getDatabase();
  const id = uuid();
  const timestamp = now();

  d.run(
    `INSERT INTO logs (id, project_id, level, source, message, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.project_id || null,
      input.level || "info",
      input.source || "cli",
      input.message,
      JSON.stringify(input.metadata || {}),
      timestamp,
    ],
  );

  return getLog(id, d)!;
}

export function getLog(id: string, db?: Database): Log | null {
  const d = db || getDatabase();
  const row = d.query("SELECT * FROM logs WHERE id = ?").get(id) as LogRow | null;
  if (!row) return null;
  return rowToLog(row);
}

export function listLogs(filter: LogFilter = {}, db?: Database): Log[] {
  const d = db || getDatabase();
  const conditions: string[] = [];
  const params: SQLQueryBindings[] = [];

  if (filter.project_id) {
    conditions.push("project_id = ?");
    params.push(filter.project_id);
  }

  if (filter.level) {
    if (Array.isArray(filter.level)) {
      conditions.push(`level IN (${filter.level.map(() => "?").join(",")})`);
      params.push(...filter.level);
    } else {
      conditions.push("level = ?");
      params.push(filter.level);
    }
  }

  if (filter.source) {
    conditions.push("source = ?");
    params.push(filter.source);
  }

  const limit = filter.limit || 50;
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = d
    .query(`SELECT * FROM logs ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...params, limit) as LogRow[];

  return rows.map(rowToLog);
}

export function tailLogs(
  limit: number = 20,
  filter: Omit<LogFilter, "limit"> = {},
  db?: Database,
): Log[] {
  return listLogs({ ...filter, limit }, db);
}

export function clearLogs(projectId?: string, db?: Database): number {
  const d = db || getDatabase();
  if (projectId) {
    const result = d.run("DELETE FROM logs WHERE project_id = ?", [projectId]);
    return result.changes;
  }
  const result = d.run("DELETE FROM logs");
  return result.changes;
}

export function deleteLog(id: string, db?: Database): boolean {
  const d = db || getDatabase();
  const result = d.run("DELETE FROM logs WHERE id = ?", [id]);
  return result.changes > 0;
}
