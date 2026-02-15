import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { getDatabase, closeDatabase, resetDatabase } from "./database.js";
import {
  createLog,
  getLog,
  listLogs,
  tailLogs,
  clearLogs,
  deleteLog,
} from "./logs.js";

let db: Database;

beforeEach(() => {
  process.env["IMPLEMENTATIONS_DB_PATH"] = ":memory:";
  resetDatabase();
  db = getDatabase();
});

afterEach(() => {
  closeDatabase();
  delete process.env["IMPLEMENTATIONS_DB_PATH"];
});

describe("createLog", () => {
  it("should create a log with defaults", () => {
    const log = createLog({ message: "Test message" }, db);
    expect(log.message).toBe("Test message");
    expect(log.level).toBe("info");
    expect(log.source).toBe("cli");
    expect(log.id).toBeTruthy();
  });

  it("should create a log with all fields", () => {
    const log = createLog(
      {
        message: "Build started",
        level: "debug",
        source: "builder",
        metadata: { step: 1 },
      },
      db,
    );
    expect(log.level).toBe("debug");
    expect(log.source).toBe("builder");
    expect(log.metadata).toEqual({ step: 1 });
  });
});

describe("getLog", () => {
  it("should return null for non-existent log", () => {
    expect(getLog("non-existent", db)).toBeNull();
  });

  it("should return a log by id", () => {
    const created = createLog({ message: "Test" }, db);
    const log = getLog(created.id, db);
    expect(log).not.toBeNull();
    expect(log!.message).toBe("Test");
  });
});

describe("listLogs", () => {
  it("should list logs with default limit of 50", () => {
    for (let i = 0; i < 5; i++) {
      createLog({ message: `Log ${i}` }, db);
    }
    const logs = listLogs({}, db);
    expect(logs).toHaveLength(5);
  });

  it("should filter by level", () => {
    createLog({ message: "Info", level: "info" }, db);
    createLog({ message: "Error", level: "error" }, db);

    const errors = listLogs({ level: "error" }, db);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe("Error");
  });

  it("should filter by source", () => {
    createLog({ message: "From CLI", source: "cli" }, db);
    createLog({ message: "From API", source: "api" }, db);

    const cliLogs = listLogs({ source: "cli" }, db);
    expect(cliLogs).toHaveLength(1);
    expect(cliLogs[0]!.message).toBe("From CLI");
  });

  it("should respect limit", () => {
    for (let i = 0; i < 10; i++) {
      createLog({ message: `Log ${i}` }, db);
    }
    const logs = listLogs({ limit: 3 }, db);
    expect(logs).toHaveLength(3);
  });

  it("should return all logs when listing", () => {
    createLog({ message: "First" }, db);
    createLog({ message: "Second" }, db);

    const logs = listLogs({}, db);
    expect(logs).toHaveLength(2);
    const messages = logs.map(l => l.message).sort();
    expect(messages).toEqual(["First", "Second"]);
  });
});

describe("tailLogs", () => {
  it("should return most recent logs", () => {
    for (let i = 0; i < 5; i++) {
      createLog({ message: `Log ${i}` }, db);
    }
    const logs = tailLogs(3, {}, db);
    expect(logs).toHaveLength(3);
  });
});

describe("clearLogs", () => {
  it("should clear all logs", () => {
    createLog({ message: "Log 1" }, db);
    createLog({ message: "Log 2" }, db);

    const deleted = clearLogs(undefined, db);
    expect(deleted).toBe(2);

    const remaining = listLogs({}, db);
    expect(remaining).toHaveLength(0);
  });

  it("should clear logs for a specific project", () => {
    const { createProject } = require("./projects.js");
    const project = createProject({ name: "Test", path: "/tmp/test" }, db);

    createLog({ message: "Project log", project_id: project.id }, db);
    createLog({ message: "Global log" }, db);

    const deleted = clearLogs(project.id, db);
    expect(deleted).toBe(1);

    const remaining = listLogs({}, db);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.message).toBe("Global log");
  });
});

describe("deleteLog", () => {
  it("should delete a log", () => {
    const log = createLog({ message: "To delete" }, db);
    expect(deleteLog(log.id, db)).toBe(true);
    expect(getLog(log.id, db)).toBeNull();
  });

  it("should return false for non-existent log", () => {
    expect(deleteLog("non-existent", db)).toBe(false);
  });
});
