/**
 * Reusable server starter for the implementations dashboard.
 * Used by both the CLI `serve` command and the standalone `implementations-serve` binary.
 * Serves the Vite-built React/shadcn dashboard from dashboard/dist/.
 */

import { existsSync, statSync } from "fs";
import { join, dirname, extname, resolve, sep } from "path";
import { fileURLToPath } from "url";
import {
  createPlan,
  listPlans,
  deletePlan,
} from "../db/plans.js";
import {
  createAudit,
  listAudits,
  deleteAudit,
} from "../db/audits.js";
import {
  createLog,
  listLogs,
} from "../db/logs.js";
import { getStats } from "../db/stats.js";
import {
  listProjects,
  createProject,
  deleteProject,
} from "../db/projects.js";
import type {
  CreatePlanInput,
  CreateAuditInput,
  CreateLogInput,
  CreateProjectInput,
  PlanStatus,
  AuditType,
  AuditStatus,
  SeverityLevel,
  LogLevel,
} from "../types/index.js";

// Resolve the dashboard dist directory — check multiple locations
function resolveDashboardDir(): string {
  const candidates: string[] = [];

  // Relative to the script file (works for both source and built)
  try {
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    candidates.push(join(scriptDir, "..", "dashboard", "dist"));
    candidates.push(join(scriptDir, "..", "..", "dashboard", "dist"));
  } catch {
    // import.meta.url may not resolve in all contexts
  }

  // Relative to the main script (process.argv[1])
  if (process.argv[1]) {
    const mainDir = dirname(process.argv[1]);
    candidates.push(join(mainDir, "..", "dashboard", "dist"));
    candidates.push(join(mainDir, "..", "..", "dashboard", "dist"));
  }

  // Relative to cwd (most reliable for local use)
  candidates.push(join(process.cwd(), "dashboard", "dist"));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return join(process.cwd(), "dashboard", "dist");
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; "),
};

function json(data: unknown, status = 200, corsOrigin?: string): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": corsOrigin || "*",
      "Vary": "Origin",
      "Cache-Control": "no-store",
      ...SECURITY_HEADERS,
    },
  });
}

function isClientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /required|cannot be empty|must be|constraint|unique/i.test(error.message);
}

function errorResponse(error: unknown, fallback: string, corsOrigin?: string): Response {
  const status = isClientError(error) ? 400 : 500;
  if (status === 500) {
    console.error(fallback, error);
  }
  const message = status === 400 && error instanceof Error ? error.message : fallback;
  return json({ error: message }, status, corsOrigin);
}

/** Max request body size (1MB) */
const MAX_BODY_SIZE = 1024 * 1024;
const DEFAULT_LOG_LIMIT = 100;
const MAX_LOG_LIMIT = 1000;

function serveStaticFile(filePath: string): Response | null {
  if (!existsSync(filePath)) return null;
  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) return null;
  } catch {
    return null;
  }

  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  return new Response(Bun.file(filePath), {
    headers: { "Content-Type": contentType, ...SECURITY_HEADERS },
  });
}

function resolveStaticPath(rootDir: string, requestPath: string): string | null {
  const trimmed = requestPath.replace(/^\/+/, "");
  if (!trimmed) return null;
  const filePath = resolve(join(rootDir, trimmed));
  const rootPath = resolve(rootDir);
  if (filePath !== rootPath && !filePath.startsWith(rootPath + sep)) {
    return null;
  }
  return filePath;
}

function parseCsv(param: string | null): string[] | undefined {
  if (!param) return undefined;
  const items = param
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function parseLimit(param: string | null, defaultValue?: number, max?: number): number | undefined {
  if (param === null || param === undefined || param === "") return defaultValue;
  const parsed = Number.parseInt(param, 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  const bounded = Math.max(0, Math.floor(parsed));
  if (max !== undefined) return Math.min(bounded, max);
  return bounded;
}

function parseOffset(param: string | null): number | undefined {
  if (param === null || param === undefined || param === "") return undefined;
  const parsed = Number.parseInt(param, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.floor(parsed));
}

function isJsonContentType(value: string | null): boolean {
  if (!value) return false;
  return value.toLowerCase().includes("application/json");
}

async function readJsonBody<T>(req: Request, corsOrigin: string): Promise<T | Response> {
  if (!isJsonContentType(req.headers.get("content-type"))) {
    return json({ error: "Unsupported content type. Use application/json." }, 415, corsOrigin);
  }

  const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_SIZE) {
    return json({ error: "Request body too large" }, 413, corsOrigin);
  }

  const buffer = await req.arrayBuffer();
  if (buffer.byteLength > MAX_BODY_SIZE) {
    return json({ error: "Request body too large" }, 413, corsOrigin);
  }

  try {
    const text = new TextDecoder().decode(buffer);
    return JSON.parse(text) as T;
  } catch {
    return json({ error: "Invalid JSON body" }, 400, corsOrigin);
  }
}

export interface ServeOptions {
  port: number;
  open?: boolean;
  host?: string;
  corsOrigin?: string;
}

function normalizeHost(host: string): string {
  const trimmed = host.trim();
  if (!trimmed) return "127.0.0.1";
  // Avoid unsafe characters that could lead to header or shell injection.
  if (!/^[a-zA-Z0-9.\-:]+$/.test(trimmed)) return "127.0.0.1";
  return trimmed;
}

function sanitizeHeaderValue(value: string): string | null {
  if (value.includes("\r") || value.includes("\n")) return null;
  return value;
}

function formatHostForOrigin(host: string): string {
  if (host.includes(":") && !host.startsWith("[")) {
    return `[${host}]`;
  }
  return host;
}

function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

function buildCorsOrigin(host: string, port: number, override?: string): string {
  if (override && override.trim()) {
    const sanitized = sanitizeHeaderValue(override.trim());
    if (sanitized) return sanitized;
  }
  const hostLabel = host === "0.0.0.0" || host === "::" ? "localhost" : host;
  const originHost = formatHostForOrigin(hostLabel);
  return `http://${originHost}:${port}`;
}

export async function startServer(port: number, options?: { open?: boolean; host?: string; corsOrigin?: string }): Promise<void> {
  const shouldOpen = options?.open ?? true;
  const host = normalizeHost(options?.host ?? process.env["IMPLEMENTATIONS_HOST"] ?? "127.0.0.1");
  const corsOrigin = buildCorsOrigin(host, port, options?.corsOrigin ?? process.env["IMPLEMENTATIONS_CORS_ORIGIN"]);

  const dashboardDir = resolveDashboardDir();
  const dashboardExists = existsSync(dashboardDir);

  if (!dashboardExists) {
    console.error(`\nDashboard not found at: ${dashboardDir}`);
    console.error(`Run this to build it:\n`);
    console.error(`  cd dashboard && bun install && bun run build\n`);
    console.error(`Or from the project root:\n`);
    console.error(`  bun run build:dashboard\n`);
  }

  const server = Bun.serve({
    port,
    hostname: host,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;
      const method = req.method;

      // ── API Routes ──

      // GET /api/stats
      if (path === "/api/stats" && method === "GET") {
        try {
          const stats = getStats();
          return json(stats, 200, corsOrigin);
        } catch (e) {
          console.error("Failed to get stats", e);
          return json({ error: "Failed to get stats" }, 500, corsOrigin);
        }
      }

      // GET /api/plans
      if (path === "/api/plans" && method === "GET") {
        try {
          const filter: Record<string, unknown> = {};
          const projectId = url.searchParams.get("project_id");
          if (projectId) filter["project_id"] = projectId;
          const status = url.searchParams.get("status");
          const statuses = parseCsv(status);
          if (statuses) filter["status"] = statuses.length === 1 ? (statuses[0] as PlanStatus) : statuses;
          const tags = url.searchParams.get("tags");
          const tagList = parseCsv(tags);
          if (tagList) filter["tags"] = tagList;
          const limit = parseLimit(url.searchParams.get("limit"));
          const offset = parseOffset(url.searchParams.get("offset"));
          if (limit !== undefined) filter["limit"] = limit;
          if (offset !== undefined) filter["offset"] = offset;

          const plans = listPlans(filter as any);
          return json(plans, 200, corsOrigin);
        } catch (e) {
          console.error("Failed to list plans", e);
          return json({ error: "Failed to list plans" }, 500, corsOrigin);
        }
      }

      // POST /api/plans
      if (path === "/api/plans" && method === "POST") {
        try {
          const parsed = await readJsonBody<CreatePlanInput>(req, corsOrigin);
          if (parsed instanceof Response) return parsed;
          const body = parsed;
          if (!body.title) return json({ error: "Missing 'title' in request body" }, 400, corsOrigin);
          const plan = createPlan(body);
          return json(plan, 201, corsOrigin);
        } catch (e) {
          return errorResponse(e, "Failed to create plan", corsOrigin);
        }
      }

      // DELETE /api/plans/:id
      const planDeleteMatch = path.match(/^\/api\/plans\/([^/]+)$/);
      if (planDeleteMatch && method === "DELETE") {
        try {
          const id = planDeleteMatch[1]!;
          const deleted = deletePlan(id);
          return json({ success: deleted }, deleted ? 200 : 404, corsOrigin);
        } catch (e) {
          console.error("Failed to delete plan", e);
          return json({ error: "Failed to delete plan" }, 500, corsOrigin);
        }
      }

      // GET /api/audits
      if (path === "/api/audits" && method === "GET") {
        try {
          const filter: Record<string, unknown> = {};
          const projectId = url.searchParams.get("project_id");
          if (projectId) filter["project_id"] = projectId;
          const type = url.searchParams.get("type");
          const types = parseCsv(type);
          if (types) filter["type"] = types.length === 1 ? (types[0] as AuditType) : types;
          const status = url.searchParams.get("status");
          const statuses = parseCsv(status);
          if (statuses) filter["status"] = statuses.length === 1 ? (statuses[0] as AuditStatus) : statuses;
          const severity = url.searchParams.get("severity");
          const severities = parseCsv(severity);
          if (severities) filter["severity"] = severities.length === 1 ? (severities[0] as SeverityLevel) : severities;
          const limit = parseLimit(url.searchParams.get("limit"));
          const offset = parseOffset(url.searchParams.get("offset"));
          if (limit !== undefined) filter["limit"] = limit;
          if (offset !== undefined) filter["offset"] = offset;

          const audits = listAudits(filter as any);
          return json(audits, 200, corsOrigin);
        } catch (e) {
          console.error("Failed to list audits", e);
          return json({ error: "Failed to list audits" }, 500, corsOrigin);
        }
      }

      // POST /api/audits
      if (path === "/api/audits" && method === "POST") {
        try {
          const parsed = await readJsonBody<CreateAuditInput>(req, corsOrigin);
          if (parsed instanceof Response) return parsed;
          const body = parsed;
          if (!body.title) return json({ error: "Missing 'title' in request body" }, 400, corsOrigin);
          const audit = createAudit(body);
          return json(audit, 201, corsOrigin);
        } catch (e) {
          return errorResponse(e, "Failed to create audit", corsOrigin);
        }
      }

      // DELETE /api/audits/:id
      const auditDeleteMatch = path.match(/^\/api\/audits\/([^/]+)$/);
      if (auditDeleteMatch && method === "DELETE") {
        try {
          const id = auditDeleteMatch[1]!;
          const deleted = deleteAudit(id);
          return json({ success: deleted }, deleted ? 200 : 404, corsOrigin);
        } catch (e) {
          console.error("Failed to delete audit", e);
          return json({ error: "Failed to delete audit" }, 500, corsOrigin);
        }
      }

      // GET /api/logs
      if (path === "/api/logs" && method === "GET") {
        try {
          const filter: Record<string, unknown> = {};
          const projectId = url.searchParams.get("project_id");
          if (projectId) filter["project_id"] = projectId;
          const level = url.searchParams.get("level");
          const levels = parseCsv(level);
          if (levels) filter["level"] = levels.length === 1 ? (levels[0] as LogLevel) : levels;
          const source = url.searchParams.get("source");
          if (source) filter["source"] = source;
          const limit = parseLimit(url.searchParams.get("limit"), DEFAULT_LOG_LIMIT, MAX_LOG_LIMIT);
          const offset = parseOffset(url.searchParams.get("offset"));
          if (limit !== undefined) filter["limit"] = limit;
          if (offset !== undefined) filter["offset"] = offset;

          const logs = listLogs(filter as any);
          return json(logs, 200, corsOrigin);
        } catch (e) {
          console.error("Failed to list logs", e);
          return json({ error: "Failed to list logs" }, 500, corsOrigin);
        }
      }

      // POST /api/logs
      if (path === "/api/logs" && method === "POST") {
        try {
          const parsed = await readJsonBody<CreateLogInput>(req, corsOrigin);
          if (parsed instanceof Response) return parsed;
          const body = parsed;
          if (!body.message) return json({ error: "Missing 'message' in request body" }, 400, corsOrigin);
          const log = createLog(body);
          return json(log, 201, corsOrigin);
        } catch (e) {
          return errorResponse(e, "Failed to create log", corsOrigin);
        }
      }

      // GET /api/projects
      if (path === "/api/projects" && method === "GET") {
        try {
          const projects = listProjects();
          return json(projects, 200, corsOrigin);
        } catch (e) {
          console.error("Failed to list projects", e);
          return json({ error: "Failed to list projects" }, 500, corsOrigin);
        }
      }

      // POST /api/projects
      if (path === "/api/projects" && method === "POST") {
        try {
          const parsed = await readJsonBody<CreateProjectInput>(req, corsOrigin);
          if (parsed instanceof Response) return parsed;
          const body = parsed;
          if (!body.name) return json({ error: "Missing 'name' in request body" }, 400, corsOrigin);
          if (!body.path) return json({ error: "Missing 'path' in request body" }, 400, corsOrigin);
          const project = createProject(body);
          return json(project, 201, corsOrigin);
        } catch (e) {
          return errorResponse(e, "Failed to create project", corsOrigin);
        }
      }

      // DELETE /api/projects/:id
      const projectDeleteMatch = path.match(/^\/api\/projects\/([^/]+)$/);
      if (projectDeleteMatch && method === "DELETE") {
        try {
          const id = projectDeleteMatch[1]!;
          const deleted = deleteProject(id);
          return json({ success: deleted }, deleted ? 200 : 404, corsOrigin);
        } catch (e) {
          console.error("Failed to delete project", e);
          return json({ error: "Failed to delete project" }, 500, corsOrigin);
        }
      }

      // POST /api/update
      if (path === "/api/update" && method === "POST") {
        try {
          if (process.env["IMPLEMENTATIONS_ALLOW_UPDATE"] !== "true") {
            return json({ error: "Updates disabled. Set IMPLEMENTATIONS_ALLOW_UPDATE=true to enable." }, 403, corsOrigin);
          }
          if (!isLoopbackHost(host) && process.env["IMPLEMENTATIONS_ALLOW_REMOTE_UPDATE"] !== "true") {
            return json({ error: "Updates are restricted to localhost. Set IMPLEMENTATIONS_ALLOW_REMOTE_UPDATE=true to override." }, 403, corsOrigin);
          }
          if (req.headers.get("X-Implementations-Update") !== "true") {
            return json({ error: "Missing update confirmation header." }, 403, corsOrigin);
          }
          const updateToken = process.env["IMPLEMENTATIONS_UPDATE_TOKEN"];
          if (updateToken && req.headers.get("X-Implementations-Token") !== updateToken) {
            return json({ error: "Missing or invalid update token." }, 403, corsOrigin);
          }
          const { execSync } = await import("child_process");
          const output = execSync("bun update @hasna/implementations", {
            encoding: "utf-8",
            timeout: 30000,
          });
          return json({ success: true, output: output.trim() }, 200, corsOrigin);
        } catch (e) {
          console.error("Update failed", e);
          return json({ error: "Update failed" }, 500, corsOrigin);
        }
      }

      // ── CORS ──
      if (method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": corsOrigin,
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Implementations-Update, X-Implementations-Token",
            "Vary": "Origin",
            "Cache-Control": "no-store",
            ...SECURITY_HEADERS,
          },
        });
      }

      // ── Static Files (Vite dashboard) ──
      if (dashboardExists && (method === "GET" || method === "HEAD")) {
        // Try to serve exact file (e.g., /assets/index-abc123.js)
        if (path !== "/") {
          const filePath = resolveStaticPath(dashboardDir, path);
          if (filePath) {
            const res = serveStaticFile(filePath);
            if (res) return res;
          }
        }

        // SPA fallback: serve index.html for all other GET routes
        const indexPath = resolve(dashboardDir, "index.html");
        const res = serveStaticFile(indexPath);
        if (res) return res;
      }

      return json({ error: "Not found" }, 404, corsOrigin);
    },
  });

  // Graceful shutdown
  const shutdown = () => {
    server.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const displayHost = host === "0.0.0.0" || host === "::" ? "localhost" : host;
  const url = `http://${formatHostForOrigin(displayHost)}:${port}`;
  console.log(`Implementations Dashboard running at ${url}`);

  if (shouldOpen) {
    try {
      const { spawn } = await import("child_process");
      if (process.platform === "win32") {
        const child = spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true });
        child.unref();
      } else {
        const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
        const child = spawn(openCmd, [url], { stdio: "ignore", detached: true });
        child.unref();
      }
    } catch {
      // Silently ignore if we can't open browser
    }
  }
}
