import type { Database, SQLQueryBindings } from "bun:sqlite";
import { resolve } from "node:path";
import type { CreateProjectInput, Project } from "../types/index.js";
import { ProjectNotFoundError } from "../types/index.js";
import { getDatabase, now, uuid } from "./database.js";

function normalizeProjectPath(path: string): string {
  return resolve(path);
}

export function createProject(
  input: CreateProjectInput,
  db?: Database,
): Project {
  const d = db || getDatabase();
  const name = input.name?.trim();
  const rawPath = input.path?.trim();
  if (!name) {
    throw new Error("Project name is required");
  }
  if (!rawPath) {
    throw new Error("Project path is required");
  }
  const id = uuid();
  const timestamp = now();
  const normalizedPath = normalizeProjectPath(rawPath);

  d.run(
    `INSERT INTO projects (id, name, path, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, normalizedPath, input.description?.trim() || null, timestamp, timestamp],
  );

  return getProject(id, d)!;
}

export function getProject(id: string, db?: Database): Project | null {
  const d = db || getDatabase();
  const row = d.query("SELECT * FROM projects WHERE id = ?").get(id) as Project | null;
  return row;
}

export function getProjectByPath(path: string, db?: Database): Project | null {
  const d = db || getDatabase();
  const normalizedPath = normalizeProjectPath(path);
  const row = d
    .query("SELECT * FROM projects WHERE path = ?")
    .get(normalizedPath) as Project | null;
  return row;
}

export function listProjects(db?: Database): Project[] {
  const d = db || getDatabase();
  return d
    .query("SELECT * FROM projects ORDER BY name")
    .all() as Project[];
}

export function updateProject(
  id: string,
  input: Partial<Pick<Project, "name" | "description">>,
  db?: Database,
): Project {
  const d = db || getDatabase();
  const project = getProject(id, d);
  if (!project) throw new ProjectNotFoundError(id);

  const sets: string[] = ["updated_at = ?"];
  const params: SQLQueryBindings[] = [now()];

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) {
      throw new Error("Project name cannot be empty");
    }
    sets.push("name = ?");
    params.push(name);
  }
  if (input.description !== undefined) {
    sets.push("description = ?");
    params.push(input.description?.trim() || null);
  }

  params.push(id);
  d.run(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`, params);

  return getProject(id, d)!;
}

export function deleteProject(id: string, db?: Database): boolean {
  const d = db || getDatabase();
  const result = d.run("DELETE FROM projects WHERE id = ?", [id]);
  return result.changes > 0;
}

export function ensureProject(
  name: string,
  path: string,
  db?: Database,
): Project {
  const d = db || getDatabase();
  const normalizedPath = normalizeProjectPath(path);
  const existing = getProjectByPath(normalizedPath, d);
  if (existing) return existing;
  return createProject({ name, path: normalizedPath }, d);
}
