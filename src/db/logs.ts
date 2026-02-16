import type { Database, SQLQueryBindings } from "bun:sqlite";
import type {
  CreateLogInput,
  Log,
  LogFilter,
  LogRow,
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

function rowToLog(row: LogRow): Log {
  return {
    ...row,
    metadata: parseMetadata(row.metadata),
    level: row.level as Log["level"],
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

export function createLog(input: CreateLogInput, db?: Database): Log {
  const d = db || getDatabase();
  const message = input.message?.trim();
  if (!message) {
    throw new Error("Log message is required");
  }
  const source = input.source?.trim() || "cli";
  const id = uuid();
  const timestamp = now();

  d.run(
    `INSERT INTO logs (id, project_id, level, source, message, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.project_id || null,
      input.level || "info",
      source,
      message,
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
      const levels = filter.level.filter(Boolean);
      if (levels.length === 0) return [];
      conditions.push(`level IN (${levels.map(() => "?").join(",")})`);
      params.push(...levels);
    } else {
      conditions.push("level = ?");
      params.push(filter.level);
    }
  }

  if (filter.source) {
    conditions.push("source = ?");
    params.push(filter.source);
  }

  const limit = normalizeLimit(filter.limit) ?? 50;
  const offset = normalizeOffset(filter.offset);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  let sql = `SELECT * FROM logs ${where} ORDER BY created_at DESC LIMIT ?`;
  const queryParams = [...params, limit];
  if (offset !== undefined) {
    sql += " OFFSET ?";
    queryParams.push(offset);
  }
  const rows = d.query(sql).all(...queryParams) as LogRow[];

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
