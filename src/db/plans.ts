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

function rowToPlan(row: PlanRow): Plan {
  return {
    ...row,
    tags: JSON.parse(row.tags || "[]") as string[],
    metadata: JSON.parse(row.metadata || "{}") as Record<string, unknown>,
    status: row.status as Plan["status"],
  };
}

export function createPlan(input: CreatePlanInput, db?: Database): Plan {
  const d = db || getDatabase();
  const id = uuid();
  const timestamp = now();
  const slug = slugify(input.title);

  d.run(
    `INSERT INTO plans (id, project_id, title, slug, description, content, status, tags, metadata, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      input.project_id || null,
      input.title,
      slug,
      input.description || null,
      input.content || null,
      input.status || "draft",
      JSON.stringify(input.tags || []),
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
      conditions.push(`status IN (${filter.status.map(() => "?").join(",")})`);
      params.push(...filter.status);
    } else {
      conditions.push("status = ?");
      params.push(filter.status);
    }
  }

  if (filter.tags && filter.tags.length > 0) {
    const tagConditions = filter.tags.map(() => "tags LIKE ?");
    conditions.push(`(${tagConditions.join(" OR ")})`);
    params.push(...filter.tags.map((t) => `%"${t}"%`));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = d
    .query(`SELECT * FROM plans ${where} ORDER BY created_at DESC`)
    .all(...params) as PlanRow[];

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
    sets.push("title = ?");
    params.push(input.title);
    sets.push("slug = ?");
    params.push(slugify(input.title));
  }
  if (input.description !== undefined) {
    sets.push("description = ?");
    params.push(input.description);
  }
  if (input.content !== undefined) {
    sets.push("content = ?");
    params.push(input.content);
  }
  if (input.status !== undefined) {
    sets.push("status = ?");
    params.push(input.status);
  }
  if (input.tags !== undefined) {
    sets.push("tags = ?");
    params.push(JSON.stringify(input.tags));
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
