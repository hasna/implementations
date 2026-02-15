import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { getDatabase, closeDatabase, resetDatabase } from "../db/database.js";
import { createPlan, listPlans } from "../db/plans.js";
import { createAudit, listAudits } from "../db/audits.js";
import { createLog, listLogs } from "../db/logs.js";
import type { Database } from "bun:sqlite";

let db: Database;
let server: ReturnType<typeof Bun.serve>;
const PORT = 19499; // Test port to avoid conflicts

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": `http://localhost:${PORT}`,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

const MAX_BODY_SIZE = 1024 * 1024;

beforeEach(() => {
  process.env["IMPLEMENTATIONS_DB_PATH"] = ":memory:";
  resetDatabase();
  db = getDatabase();

  // Start a minimal server that mirrors the real serve.ts API routes
  server = Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;
      const method = req.method;

      // GET /api/stats
      if (path === "/api/stats" && method === "GET") {
        const allPlans = listPlans({}, db);
        const allAudits = listAudits({}, db);
        const allLogs = listLogs({ limit: 1000 }, db);
        return json({
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
        });
      }

      // GET /api/plans
      if (path === "/api/plans" && method === "GET") {
        const filter: Record<string, unknown> = {};
        const status = url.searchParams.get("status");
        if (status) filter["status"] = status;
        const tags = url.searchParams.get("tags");
        if (tags) filter["tags"] = tags.split(",").map((t) => t.trim());
        return json(listPlans(filter as any, db));
      }

      // POST /api/plans
      if (path === "/api/plans" && method === "POST") {
        const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
        if (contentLength > MAX_BODY_SIZE) return json({ error: "Request body too large" }, 413);
        const body = await req.json();
        if (!body.title) return json({ error: "Missing 'title' in request body" }, 400);
        const plan = createPlan(body, db);
        return json(plan, 201);
      }

      // DELETE /api/plans/:id
      const planDeleteMatch = path.match(/^\/api\/plans\/([^/]+)$/);
      if (planDeleteMatch && method === "DELETE") {
        const { deletePlan } = await import("../db/plans.js");
        const id = planDeleteMatch[1];
        const deleted = deletePlan(id, db);
        return json({ success: deleted }, deleted ? 200 : 404);
      }

      // GET /api/audits
      if (path === "/api/audits" && method === "GET") {
        const filter: Record<string, unknown> = {};
        const type = url.searchParams.get("type");
        if (type) filter["type"] = type;
        const status = url.searchParams.get("status");
        if (status) filter["status"] = status;
        const severity = url.searchParams.get("severity");
        if (severity) filter["severity"] = severity;
        return json(listAudits(filter as any, db));
      }

      // POST /api/audits
      if (path === "/api/audits" && method === "POST") {
        const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
        if (contentLength > MAX_BODY_SIZE) return json({ error: "Request body too large" }, 413);
        const body = await req.json();
        if (!body.title) return json({ error: "Missing 'title' in request body" }, 400);
        const audit = createAudit(body, db);
        return json(audit, 201);
      }

      // DELETE /api/audits/:id
      const auditDeleteMatch = path.match(/^\/api\/audits\/([^/]+)$/);
      if (auditDeleteMatch && method === "DELETE") {
        const { deleteAudit } = await import("../db/audits.js");
        const id = auditDeleteMatch[1];
        const deleted = deleteAudit(id, db);
        return json({ success: deleted }, deleted ? 200 : 404);
      }

      // GET /api/logs
      if (path === "/api/logs" && method === "GET") {
        const filter: Record<string, unknown> = {};
        const level = url.searchParams.get("level");
        if (level) filter["level"] = level;
        const source = url.searchParams.get("source");
        if (source) filter["source"] = source;
        const limit = url.searchParams.get("limit");
        filter["limit"] = limit ? parseInt(limit, 10) || 100 : 100;
        return json(listLogs(filter as any, db));
      }

      // POST /api/logs
      if (path === "/api/logs" && method === "POST") {
        const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
        if (contentLength > MAX_BODY_SIZE) return json({ error: "Request body too large" }, 413);
        const body = await req.json();
        if (!body.message) return json({ error: "Missing 'message' in request body" }, 400);
        const log = createLog(body, db);
        return json(log, 201);
      }

      // CORS
      if (method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": `http://localhost:${PORT}`,
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      return json({ error: "Not found" }, 404);
    },
  });
});

afterEach(() => {
  server.stop(true);
  closeDatabase();
  delete process.env["IMPLEMENTATIONS_DB_PATH"];
});

const BASE = `http://localhost:${PORT}`;

// ── Stats ──

describe("GET /api/stats", () => {
  it("should return empty stats", async () => {
    const res = await fetch(`${BASE}/api/stats`);
    expect(res.status).toBe(200);
    const stats = await res.json();
    expect(stats.plans.total).toBe(0);
    expect(stats.audits.total).toBe(0);
    expect(stats.logs.total).toBe(0);
  });

  it("should return correct counts after creating data", async () => {
    createPlan({ title: "Plan 1" }, db);
    createPlan({ title: "Plan 2", status: "done" }, db);
    createPlan({ title: "Plan 3", status: "in_progress" }, db);
    createAudit({ title: "Audit 1" }, db);
    createAudit({ title: "Audit 2", status: "completed" }, db);
    createLog({ message: "Error msg", level: "error" }, db);
    createLog({ message: "Warn msg", level: "warn" }, db);
    createLog({ message: "Info msg", level: "info" }, db);

    const res = await fetch(`${BASE}/api/stats`);
    const stats = await res.json();
    expect(stats.plans.total).toBe(3);
    expect(stats.plans.active).toBe(2); // draft + in_progress
    expect(stats.plans.done).toBe(1);
    expect(stats.audits.total).toBe(2);
    expect(stats.audits.completed).toBe(1);
    expect(stats.logs.total).toBe(3);
    expect(stats.logs.errors).toBe(1);
    expect(stats.logs.warns).toBe(1);
  });
});

// ── Plans ──

describe("GET /api/plans", () => {
  it("should return empty list", async () => {
    const res = await fetch(`${BASE}/api/plans`);
    expect(res.status).toBe(200);
    const plans = await res.json();
    expect(plans).toEqual([]);
  });

  it("should return created plans", async () => {
    createPlan({ title: "Plan A" }, db);
    createPlan({ title: "Plan B" }, db);

    const res = await fetch(`${BASE}/api/plans`);
    const plans = await res.json();
    expect(plans.length).toBe(2);
    const titles = plans.map((p: any) => p.title).sort();
    expect(titles).toEqual(["Plan A", "Plan B"]);
  });

  it("should filter by status", async () => {
    createPlan({ title: "Draft", status: "draft" }, db);
    createPlan({ title: "Done", status: "done" }, db);

    const res = await fetch(`${BASE}/api/plans?status=draft`);
    const plans = await res.json();
    expect(plans.length).toBe(1);
    expect(plans[0].title).toBe("Draft");
  });

  it("should filter by tags", async () => {
    createPlan({ title: "Tagged", tags: ["feature", "urgent"] }, db);
    createPlan({ title: "Untagged" }, db);

    const res = await fetch(`${BASE}/api/plans?tags=feature`);
    const plans = await res.json();
    expect(plans.length).toBe(1);
    expect(plans[0].title).toBe("Tagged");
  });
});

describe("POST /api/plans", () => {
  it("should create a plan", async () => {
    const res = await fetch(`${BASE}/api/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New plan", description: "Desc", status: "review" }),
    });
    expect(res.status).toBe(201);
    const plan = await res.json();
    expect(plan.title).toBe("New plan");
    expect(plan.description).toBe("Desc");
    expect(plan.status).toBe("review");
    expect(plan.slug).toBe("new-plan");
    expect(plan.version).toBe(1);
  });

  it("should create a plan with tags", async () => {
    const res = await fetch(`${BASE}/api/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Tagged plan", tags: ["v2", "api"] }),
    });
    expect(res.status).toBe(201);
    const plan = await res.json();
    expect(plan.tags).toEqual(["v2", "api"]);
  });

  it("should reject missing title", async () => {
    const res = await fetch(`${BASE}/api/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "No title" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("title");
  });
});

describe("DELETE /api/plans/:id", () => {
  it("should delete an existing plan", async () => {
    const plan = createPlan({ title: "To delete" }, db);

    const res = await fetch(`${BASE}/api/plans/${plan.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify it's gone
    const listRes = await fetch(`${BASE}/api/plans`);
    const plans = await listRes.json();
    expect(plans.length).toBe(0);
  });

  it("should return 404 for non-existent plan", async () => {
    const res = await fetch(`${BASE}/api/plans/nonexistent-id`, { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

// ── Audits ──

describe("GET /api/audits", () => {
  it("should return empty list", async () => {
    const res = await fetch(`${BASE}/api/audits`);
    expect(res.status).toBe(200);
    const audits = await res.json();
    expect(audits).toEqual([]);
  });

  it("should return created audits", async () => {
    createAudit({ title: "Audit A", type: "security" }, db);
    createAudit({ title: "Audit B", type: "performance" }, db);

    const res = await fetch(`${BASE}/api/audits`);
    const audits = await res.json();
    expect(audits.length).toBe(2);
  });

  it("should filter by type", async () => {
    createAudit({ title: "Security", type: "security" }, db);
    createAudit({ title: "Perf", type: "performance" }, db);

    const res = await fetch(`${BASE}/api/audits?type=security`);
    const audits = await res.json();
    expect(audits.length).toBe(1);
    expect(audits[0].title).toBe("Security");
  });

  it("should filter by status", async () => {
    createAudit({ title: "Pending", status: "pending" }, db);
    createAudit({ title: "Done", status: "completed" }, db);

    const res = await fetch(`${BASE}/api/audits?status=pending`);
    const audits = await res.json();
    expect(audits.length).toBe(1);
    expect(audits[0].title).toBe("Pending");
  });

  it("should filter by severity", async () => {
    createAudit({ title: "High", severity: "high" }, db);
    createAudit({ title: "Low", severity: "low" }, db);

    const res = await fetch(`${BASE}/api/audits?severity=high`);
    const audits = await res.json();
    expect(audits.length).toBe(1);
    expect(audits[0].title).toBe("High");
  });
});

describe("POST /api/audits", () => {
  it("should create an audit", async () => {
    const res = await fetch(`${BASE}/api/audits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New audit", type: "security", severity: "high" }),
    });
    expect(res.status).toBe(201);
    const audit = await res.json();
    expect(audit.title).toBe("New audit");
    expect(audit.type).toBe("security");
    expect(audit.severity).toBe("high");
    expect(audit.status).toBe("pending");
    expect(audit.version).toBe(1);
  });

  it("should create an audit with findings", async () => {
    const res = await fetch(`${BASE}/api/audits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "With findings", findings: "Found XSS vulnerability" }),
    });
    expect(res.status).toBe(201);
    const audit = await res.json();
    expect(audit.findings).toBe("Found XSS vulnerability");
  });

  it("should reject missing title", async () => {
    const res = await fetch(`${BASE}/api/audits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "security" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("title");
  });
});

describe("DELETE /api/audits/:id", () => {
  it("should delete an existing audit", async () => {
    const audit = createAudit({ title: "To delete" }, db);

    const res = await fetch(`${BASE}/api/audits/${audit.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("should return 404 for non-existent audit", async () => {
    const res = await fetch(`${BASE}/api/audits/nonexistent-id`, { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

// ── Logs ──

describe("GET /api/logs", () => {
  it("should return empty list", async () => {
    const res = await fetch(`${BASE}/api/logs`);
    expect(res.status).toBe(200);
    const logs = await res.json();
    expect(logs).toEqual([]);
  });

  it("should return created logs", async () => {
    createLog({ message: "Log A" }, db);
    createLog({ message: "Log B" }, db);

    const res = await fetch(`${BASE}/api/logs`);
    const logs = await res.json();
    expect(logs.length).toBe(2);
  });

  it("should filter by level", async () => {
    createLog({ message: "Error", level: "error" }, db);
    createLog({ message: "Info", level: "info" }, db);

    const res = await fetch(`${BASE}/api/logs?level=error`);
    const logs = await res.json();
    expect(logs.length).toBe(1);
    expect(logs[0].message).toBe("Error");
  });

  it("should filter by source", async () => {
    createLog({ message: "API log", source: "api" }, db);
    createLog({ message: "CLI log", source: "cli" }, db);

    const res = await fetch(`${BASE}/api/logs?source=api`);
    const logs = await res.json();
    expect(logs.length).toBe(1);
    expect(logs[0].message).toBe("API log");
  });

  it("should respect limit parameter", async () => {
    for (let i = 0; i < 5; i++) {
      createLog({ message: `Log ${i}` }, db);
    }

    const res = await fetch(`${BASE}/api/logs?limit=3`);
    const logs = await res.json();
    expect(logs.length).toBe(3);
  });
});

describe("POST /api/logs", () => {
  it("should create a log entry", async () => {
    const res = await fetch(`${BASE}/api/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Test log", level: "warn", source: "test" }),
    });
    expect(res.status).toBe(201);
    const log = await res.json();
    expect(log.message).toBe("Test log");
    expect(log.level).toBe("warn");
    expect(log.source).toBe("test");
  });

  it("should use defaults for level and source", async () => {
    const res = await fetch(`${BASE}/api/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Default log" }),
    });
    expect(res.status).toBe(201);
    const log = await res.json();
    expect(log.level).toBe("info");
    expect(log.source).toBe("cli");
  });

  it("should reject missing message", async () => {
    const res = await fetch(`${BASE}/api/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "error" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("message");
  });
});

// ── CORS ──

describe("CORS", () => {
  it("should handle OPTIONS preflight", async () => {
    const res = await fetch(`${BASE}/api/plans`, { method: "OPTIONS" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("DELETE");
  });
});

// ── 404 ──

describe("404 handling", () => {
  it("should return 404 for unknown routes", async () => {
    const res = await fetch(`${BASE}/api/unknown`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not found");
  });
});

// ── Content-Type and Security Headers ──

describe("Response headers", () => {
  it("should set JSON content type", async () => {
    const res = await fetch(`${BASE}/api/plans`);
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  it("should set security headers", async () => {
    const res = await fetch(`${BASE}/api/plans`);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("should set CORS origin header", async () => {
    const res = await fetch(`${BASE}/api/plans`);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(`http://localhost:${PORT}`);
  });
});

// ── End-to-end flow ──

describe("End-to-end flow", () => {
  it("should create, list, and delete a plan via API", async () => {
    // Create
    const createRes = await fetch(`${BASE}/api/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "E2E Plan", status: "review", tags: ["e2e"] }),
    });
    expect(createRes.status).toBe(201);
    const plan = await createRes.json();
    expect(plan.id).toBeTruthy();

    // List
    const listRes = await fetch(`${BASE}/api/plans`);
    const plans = await listRes.json();
    expect(plans.length).toBe(1);
    expect(plans[0].id).toBe(plan.id);

    // Stats reflect creation
    const statsRes = await fetch(`${BASE}/api/stats`);
    const stats = await statsRes.json();
    expect(stats.plans.total).toBe(1);
    expect(stats.plans.active).toBe(1);

    // Delete
    const deleteRes = await fetch(`${BASE}/api/plans/${plan.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(200);

    // Verify empty
    const emptyRes = await fetch(`${BASE}/api/plans`);
    const empty = await emptyRes.json();
    expect(empty.length).toBe(0);
  });

  it("should create, list, and delete an audit via API", async () => {
    const createRes = await fetch(`${BASE}/api/audits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "E2E Audit", type: "security", severity: "critical" }),
    });
    expect(createRes.status).toBe(201);
    const audit = await createRes.json();

    const listRes = await fetch(`${BASE}/api/audits`);
    const audits = await listRes.json();
    expect(audits.length).toBe(1);

    const deleteRes = await fetch(`${BASE}/api/audits/${audit.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(200);

    const emptyRes = await fetch(`${BASE}/api/audits`);
    expect((await emptyRes.json()).length).toBe(0);
  });

  it("should create and list logs via API", async () => {
    await fetch(`${BASE}/api/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Error occurred", level: "error", source: "api" }),
    });
    await fetch(`${BASE}/api/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "All good", level: "info", source: "system" }),
    });

    const allRes = await fetch(`${BASE}/api/logs`);
    expect((await allRes.json()).length).toBe(2);

    const errRes = await fetch(`${BASE}/api/logs?level=error`);
    const errors = await errRes.json();
    expect(errors.length).toBe(1);
    expect(errors[0].message).toBe("Error occurred");
  });
});
