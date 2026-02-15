/**
 * Reusable server starter for the implementations dashboard.
 * Used by both the CLI `serve` command and the standalone `implementations-serve` binary.
 * Serves the Vite-built React/shadcn dashboard from dashboard/dist/.
 */

import { existsSync } from "fs";
import { join, dirname, extname } from "path";
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
import type {
  CreatePlanInput,
  CreateAuditInput,
  CreateLogInput,
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
};

function json(data: unknown, status = 200, port?: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": port ? `http://localhost:${port}` : "*",
      ...SECURITY_HEADERS,
    },
  });
}

/** Max request body size (1MB) */
const MAX_BODY_SIZE = 1024 * 1024;

function serveStaticFile(filePath: string): Response | null {
  if (!existsSync(filePath)) return null;

  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  return new Response(Bun.file(filePath), {
    headers: { "Content-Type": contentType },
  });
}

export interface ServeOptions {
  port: number;
  open?: boolean;
}

export async function startServer(port: number, options?: { open?: boolean }): Promise<void> {
  const shouldOpen = options?.open ?? true;

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
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;
      const method = req.method;

      // ── API Routes ──

      // GET /api/stats
      if (path === "/api/stats" && method === "GET") {
        try {
          const allPlans = listPlans({});
          const allAudits = listAudits({});
          const allLogs = listLogs({ limit: 1000 });

          const stats = {
            plans: {
              total: allPlans.length,
              draft: allPlans.filter((p) => p.status === "draft").length,
              active: allPlans.filter((p) =>
                ["draft", "review", "approved", "in_progress"].includes(p.status)
              ).length,
              done: allPlans.filter((p) => p.status === "done").length,
            },
            audits: {
              total: allAudits.length,
              pending: allAudits.filter((a) => a.status === "pending" || a.status === "in_progress").length,
              completed: allAudits.filter((a) => a.status === "completed").length,
              failed: allAudits.filter((a) => a.status === "failed").length,
            },
            logs: {
              total: allLogs.length,
              errors: allLogs.filter((l) => l.level === "error").length,
              warns: allLogs.filter((l) => l.level === "warn").length,
            },
          };
          return json(stats, 200, port);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Failed to get stats" }, 500, port);
        }
      }

      // GET /api/plans
      if (path === "/api/plans" && method === "GET") {
        try {
          const filter: Record<string, unknown> = {};
          const status = url.searchParams.get("status");
          if (status) filter["status"] = status as PlanStatus;
          const tags = url.searchParams.get("tags");
          if (tags) filter["tags"] = tags.split(",").map((t) => t.trim());

          const plans = listPlans(filter as any);
          return json(plans, 200, port);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Failed to list plans" }, 500, port);
        }
      }

      // POST /api/plans
      if (path === "/api/plans" && method === "POST") {
        try {
          const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
          if (contentLength > MAX_BODY_SIZE) return json({ error: "Request body too large" }, 413, port);
          const body = (await req.json()) as CreatePlanInput;
          if (!body.title) return json({ error: "Missing 'title' in request body" }, 400, port);
          const plan = createPlan(body);
          return json(plan, 201, port);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Failed to create plan" }, 500, port);
        }
      }

      // DELETE /api/plans/:id
      const planDeleteMatch = path.match(/^\/api\/plans\/([^/]+)$/);
      if (planDeleteMatch && method === "DELETE") {
        try {
          const id = planDeleteMatch[1];
          const deleted = deletePlan(id);
          return json({ success: deleted }, deleted ? 200 : 404, port);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Failed to delete plan" }, 500, port);
        }
      }

      // GET /api/audits
      if (path === "/api/audits" && method === "GET") {
        try {
          const filter: Record<string, unknown> = {};
          const type = url.searchParams.get("type");
          if (type) filter["type"] = type as AuditType;
          const status = url.searchParams.get("status");
          if (status) filter["status"] = status as AuditStatus;
          const severity = url.searchParams.get("severity");
          if (severity) filter["severity"] = severity as SeverityLevel;

          const audits = listAudits(filter as any);
          return json(audits, 200, port);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Failed to list audits" }, 500, port);
        }
      }

      // POST /api/audits
      if (path === "/api/audits" && method === "POST") {
        try {
          const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
          if (contentLength > MAX_BODY_SIZE) return json({ error: "Request body too large" }, 413, port);
          const body = (await req.json()) as CreateAuditInput;
          if (!body.title) return json({ error: "Missing 'title' in request body" }, 400, port);
          const audit = createAudit(body);
          return json(audit, 201, port);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Failed to create audit" }, 500, port);
        }
      }

      // DELETE /api/audits/:id
      const auditDeleteMatch = path.match(/^\/api\/audits\/([^/]+)$/);
      if (auditDeleteMatch && method === "DELETE") {
        try {
          const id = auditDeleteMatch[1];
          const deleted = deleteAudit(id);
          return json({ success: deleted }, deleted ? 200 : 404, port);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Failed to delete audit" }, 500, port);
        }
      }

      // GET /api/logs
      if (path === "/api/logs" && method === "GET") {
        try {
          const filter: Record<string, unknown> = {};
          const level = url.searchParams.get("level");
          if (level) filter["level"] = level as LogLevel;
          const source = url.searchParams.get("source");
          if (source) filter["source"] = source;
          const limit = url.searchParams.get("limit");
          filter["limit"] = limit ? parseInt(limit, 10) || 100 : 100;

          const logs = listLogs(filter as any);
          return json(logs, 200, port);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Failed to list logs" }, 500, port);
        }
      }

      // POST /api/logs
      if (path === "/api/logs" && method === "POST") {
        try {
          const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
          if (contentLength > MAX_BODY_SIZE) return json({ error: "Request body too large" }, 413, port);
          const body = (await req.json()) as CreateLogInput;
          if (!body.message) return json({ error: "Missing 'message' in request body" }, 400, port);
          const log = createLog(body);
          return json(log, 201, port);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Failed to create log" }, 500, port);
        }
      }

      // ── CORS ──
      if (method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": `http://localhost:${port}`,
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      // ── Static Files (Vite dashboard) ──
      if (dashboardExists && (method === "GET" || method === "HEAD")) {
        // Try to serve exact file (e.g., /assets/index-abc123.js)
        if (path !== "/") {
          const filePath = join(dashboardDir, path);
          const res = serveStaticFile(filePath);
          if (res) return res;
        }

        // SPA fallback: serve index.html for all other GET routes
        const indexPath = join(dashboardDir, "index.html");
        const res = serveStaticFile(indexPath);
        if (res) return res;
      }

      return json({ error: "Not found" }, 404, port);
    },
  });

  // Graceful shutdown
  const shutdown = () => {
    server.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const url = `http://localhost:${port}`;
  console.log(`Implementations Dashboard running at ${url}`);

  if (shouldOpen) {
    try {
      const { exec } = await import("child_process");
      const openCmd = process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "start"
          : "xdg-open";
      exec(`${openCmd} ${url}`);
    } catch {
      // Silently ignore if we can't open browser
    }
  }
}
