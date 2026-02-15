import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { getDatabase, closeDatabase, resetDatabase } from "../db/database.js";
import { createPlan, getPlan } from "../db/plans.js";
import { createAudit } from "../db/audits.js";
import { createLog } from "../db/logs.js";
import { createProject } from "../db/projects.js";
import { searchAll } from "../lib/search.js";

// These tests verify the core operations that the MCP server wraps.
// The MCP server itself uses stdio transport which is harder to test in unit tests.
// These validate the underlying data operations are correct.

let db: ReturnType<typeof getDatabase>;

beforeEach(() => {
  process.env["IMPLEMENTATIONS_DB_PATH"] = ":memory:";
  resetDatabase();
  db = getDatabase();
});

afterEach(() => {
  closeDatabase();
  delete process.env["IMPLEMENTATIONS_DB_PATH"];
});

describe("MCP tool operations", () => {
  it("create_plan equivalent", () => {
    const plan = createPlan(
      {
        title: "MCP plan",
        description: "Created via MCP",
        status: "review",
        tags: ["mcp"],
      },
      db,
    );
    expect(plan.title).toBe("MCP plan");
    expect(plan.status).toBe("review");
    expect(plan.tags).toEqual(["mcp"]);
  });

  it("create_audit equivalent", () => {
    const audit = createAudit(
      {
        title: "MCP audit",
        type: "security",
        severity: "high",
      },
      db,
    );
    expect(audit.title).toBe("MCP audit");
    expect(audit.type).toBe("security");
    expect(audit.severity).toBe("high");
  });

  it("create_log equivalent", () => {
    const log = createLog(
      {
        message: "MCP log message",
        level: "warn",
        source: "mcp",
      },
      db,
    );
    expect(log.message).toBe("MCP log message");
    expect(log.level).toBe("warn");
    expect(log.source).toBe("mcp");
  });

  it("list_plans with filters", () => {
    createPlan({ title: "Draft", status: "draft" }, db);
    createPlan({ title: "In progress", status: "in_progress" }, db);
    createPlan({ title: "Done", status: "done" }, db);

    const { listPlans } = require("../db/plans.js");
    const active = listPlans({ status: ["draft", "in_progress"] }, db);
    expect(active).toHaveLength(2);
  });

  it("search across plans and audits", () => {
    createPlan({ title: "Fix authentication flow" }, db);
    createPlan({ title: "Add dark mode" }, db);
    createAudit({ title: "Auth security audit" }, db);

    const results = searchAll("auth", undefined, db);
    expect(results.plans).toHaveLength(1);
    expect(results.plans[0]!.title).toBe("Fix authentication flow");
    expect(results.audits).toHaveLength(1);
    expect(results.audits[0]!.title).toBe("Auth security audit");
  });

  it("create_project", () => {
    const project = createProject(
      { name: "MCP Project", path: "/tmp/mcp-test" },
      db,
    );
    expect(project.name).toBe("MCP Project");
  });

  it("version-based optimistic locking via update_plan", () => {
    const plan = createPlan({ title: "Lockable" }, db);
    const { updatePlan } = require("../db/plans.js");

    // First update succeeds
    const updated = updatePlan(plan.id, { version: 1, title: "Updated" }, db);
    expect(updated.version).toBe(2);

    // Second update with stale version fails
    expect(() => updatePlan(plan.id, { version: 1, title: "Stale" }, db)).toThrow();
  });
});
