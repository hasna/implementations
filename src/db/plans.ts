import type { Database, SQLQueryBindings } from "bun:sqlite";
import type {
  CreatePlanInput,
  Plan,
  PlanFilter,
  PlanRow,
  UpdatePlanInput,
} from "../types/index.js";
import {
  PlanNotFoundError,
  VersionConflictError,
} from "../types/index.js";
import { getDatabase, now, slugify, uuid } from "./database.js";

const jsonSupportCache = new WeakMap<Database, boolean>();

function supportsJson1(db: Database): boolean {
  const cached = jsonSupportCache.get(db);
  if (cached !== undefined) return cached;
  try {
    db.query("SELECT json('[]') AS v").get();
    jsonSupportCache.set(db, true);
    return true;
  } catch {
    jsonSupportCache.set(db, false);
    return false;
  }
}

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

function normalizeTags(tags: string[]): string[] {
  const cleaned = tags
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

function parseTags(value: string | null | undefined): string[] {
  const parsed = parseJson<unknown>(value, []);
  if (!Array.isArray(parsed)) return [];
  return normalizeTags(parsed.filter((tag): tag is string => typeof tag === "string"));
}

function normalizeTagsInput(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return normalizeTags(value.filter((tag): tag is string => typeof tag === "string"));
}

function rowToPlan(row: PlanRow): Plan {
  return {
    ...row,
    tags: parseTags(row.tags),
    metadata: parseMetadata(row.metadata),
    status: row.status as Plan["status"],
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

export function createPlan(input: CreatePlanInput, db?: Database): Plan {
  const d = db || getDatabase();
  const title = input.title?.trim();
  if (!title) {
    throw new Error("Plan title is required");
  }
  if (input.tags !== undefined && !Array.isArray(input.tags)) {
    throw new Error("Plan tags must be an array of strings");
  }
  const id = uuid();
  const timestamp = now();
  const slug = slugify(title);
  const tags = normalizeTagsInput(input.tags);

  d.run(
    `INSERT INTO plans (id, project_id, title, slug, description, content, status, tags, metadata, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      input.project_id || null,
      title,
      slug,
      input.description?.trim() || null,
      input.content?.trim() || null,
      input.status || "draft",
      JSON.stringify(tags),
      JSON.stringify(input.metadata || {}),
      timestamp,
      timestamp,
    ],
  );

  return getPlan(id, d)!;
}

export function getPlan(id: string, db?: Database): Plan | null {
  const d = db || getDatabase();
  const row = d.query("SELECT * FROM plans WHERE id = ?").get(id) as PlanRow | null;
  if (!row) return null;
  return rowToPlan(row);
}

export function listPlans(filter: PlanFilter = {}, db?: Database): Plan[] {
  const d = db || getDatabase();
  const conditions: string[] = [];
  const params: SQLQueryBindings[] = [];

  if (filter.project_id) {
    conditions.push("project_id = ?");
    params.push(filter.project_id);
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

  if (filter.tags) {
    if (!Array.isArray(filter.tags)) return [];
    const tags = filter.tags.filter(Boolean);
    if (tags.length === 0) return [];
    if (supportsJson1(d)) {
      const tagConditions = tags.map(() =>
        "EXISTS (SELECT 1 FROM json_each(plans.tags) WHERE json_each.value = ?)"
      );
      conditions.push(`(${tagConditions.join(" OR ")})`);
      params.push(...tags);
    } else {
      const tagConditions = tags.map(() => "tags LIKE ?");
      conditions.push(`(${tagConditions.join(" OR ")})`);
      params.push(...tags.map((t) => `%"${t}"%`));
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  let sql = `SELECT * FROM plans ${where} ORDER BY created_at DESC`;
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
  const rows = d.query(sql).all(...params) as PlanRow[];

  return rows.map(rowToPlan);
}

export function updatePlan(
  id: string,
  input: UpdatePlanInput,
  db?: Database,
): Plan {
  const d = db || getDatabase();
  const plan = getPlan(id, d);
  if (!plan) throw new PlanNotFoundError(id);

  // Optimistic locking check
  if (plan.version !== input.version) {
    throw new VersionConflictError(id, input.version, plan.version);
  }

  const sets: string[] = ["version = version + 1", "updated_at = ?"];
  const params: SQLQueryBindings[] = [now()];

  if (input.title !== undefined) {
    const nextTitle = input.title.trim();
    if (!nextTitle) {
      throw new Error("Plan title cannot be empty");
    }
    sets.push("title = ?");
    params.push(nextTitle);
    sets.push("slug = ?");
    params.push(slugify(nextTitle));
  }
  if (input.description !== undefined) {
    sets.push("description = ?");
    params.push(input.description?.trim() || null);
  }
  if (input.content !== undefined) {
    sets.push("content = ?");
    params.push(input.content?.trim() || null);
  }
  if (input.status !== undefined) {
    sets.push("status = ?");
    params.push(input.status);
  }
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags)) {
      throw new Error("Plan tags must be an array of strings");
    }
    sets.push("tags = ?");
    params.push(JSON.stringify(normalizeTagsInput(input.tags)));
  }
  if (input.metadata !== undefined) {
    sets.push("metadata = ?");
    params.push(JSON.stringify(input.metadata));
  }

  params.push(id, input.version);

  const result = d.run(
    `UPDATE plans SET ${sets.join(", ")} WHERE id = ? AND version = ?`,
    params,
  );

  if (result.changes === 0) {
    const current = getPlan(id, d);
    throw new VersionConflictError(
      id,
      input.version,
      current?.version ?? -1,
    );
  }

  return getPlan(id, d)!;
}

export function setPlanStatus(
  id: string,
  status: Plan["status"],
  db?: Database,
): Plan {
  const d = db || getDatabase();
  const plan = getPlan(id, d);
  if (!plan) throw new PlanNotFoundError(id);

  d.run(
    `UPDATE plans SET status = ?, version = version + 1, updated_at = ? WHERE id = ?`,
    [status, now(), id],
  );

  return getPlan(id, d)!;
}

export function deletePlan(id: string, db?: Database): boolean {
  const d = db || getDatabase();
  const result = d.run("DELETE FROM plans WHERE id = ?", [id]);
  return result.changes > 0;
}
