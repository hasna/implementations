import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { getDatabase, closeDatabase, resetDatabase } from "../db/database.js";

beforeEach(() => {
  process.env["IMPLEMENTATIONS_DB_PATH"] = ":memory:";
  resetDatabase();
  getDatabase();
});

afterEach(() => {
  closeDatabase();
  delete process.env["IMPLEMENTATIONS_DB_PATH"];
});

describe("CLI integration", () => {
  it("should run plan add command", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "src/cli/index.tsx", "plan", "add", "CLI test plan", "--json"],
      {
        cwd: import.meta.dir + "/../..",
        env: { ...process.env, IMPLEMENTATIONS_DB_PATH: "/tmp/test-cli-implementations.db", IMPLEMENTATIONS_AUTO_PROJECT: "false" },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    const plan = JSON.parse(stdout);
    expect(plan.title).toBe("CLI test plan");
    expect(plan.status).toBe("draft");

    const { unlinkSync } = await import("node:fs");
    try { unlinkSync("/tmp/test-cli-implementations.db"); } catch {}
  });

  it("should run audit add command", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "src/cli/index.tsx", "audit", "add", "Security review", "-t", "security", "--json"],
      {
        cwd: import.meta.dir + "/../..",
        env: { ...process.env, IMPLEMENTATIONS_DB_PATH: "/tmp/test-cli-audit.db", IMPLEMENTATIONS_AUTO_PROJECT: "false" },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    const audit = JSON.parse(stdout);
    expect(audit.title).toBe("Security review");
    expect(audit.type).toBe("security");

    const { unlinkSync } = await import("node:fs");
    try { unlinkSync("/tmp/test-cli-audit.db"); } catch {}
  });

  it("should run log add command", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "src/cli/index.tsx", "log", "add", "Started build", "-s", "cli", "-l", "info", "--json"],
      {
        cwd: import.meta.dir + "/../..",
        env: { ...process.env, IMPLEMENTATIONS_DB_PATH: "/tmp/test-cli-log.db", IMPLEMENTATIONS_AUTO_PROJECT: "false" },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    const log = JSON.parse(stdout);
    expect(log.message).toBe("Started build");
    expect(log.level).toBe("info");

    const { unlinkSync } = await import("node:fs");
    try { unlinkSync("/tmp/test-cli-log.db"); } catch {}
  });

  it("should run search command", async () => {
    // First add a plan, then search for it
    const addProc = Bun.spawn(
      ["bun", "run", "src/cli/index.tsx", "plan", "add", "searchable plan", "--json"],
      {
        cwd: import.meta.dir + "/../..",
        env: { ...process.env, IMPLEMENTATIONS_DB_PATH: "/tmp/test-cli-search.db", IMPLEMENTATIONS_AUTO_PROJECT: "false" },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    await addProc.exited;

    const searchProc = Bun.spawn(
      ["bun", "run", "src/cli/index.tsx", "search", "searchable", "--json"],
      {
        cwd: import.meta.dir + "/../..",
        env: { ...process.env, IMPLEMENTATIONS_DB_PATH: "/tmp/test-cli-search.db", IMPLEMENTATIONS_AUTO_PROJECT: "false" },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const stdout = await new Response(searchProc.stdout).text();
    await searchProc.exited;

    const results = JSON.parse(stdout);
    expect(results.plans.length).toBeGreaterThanOrEqual(1);
    expect(results.plans[0].title).toBe("searchable plan");

    const { unlinkSync } = await import("node:fs");
    try { unlinkSync("/tmp/test-cli-search.db"); } catch {}
  });

  it("should run plan list command", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "src/cli/index.tsx", "plan", "list", "--json", "-a"],
      {
        cwd: import.meta.dir + "/../..",
        env: { ...process.env, IMPLEMENTATIONS_DB_PATH: "/tmp/test-cli-plist.db", IMPLEMENTATIONS_AUTO_PROJECT: "false" },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);

    const { unlinkSync } = await import("node:fs");
    try { unlinkSync("/tmp/test-cli-plist.db"); } catch {}
  });
});
