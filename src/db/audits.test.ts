import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { getDatabase, closeDatabase, resetDatabase } from "./database.js";
import {
  createAudit,
  getAudit,
  listAudits,
  updateAudit,
  completeAudit,
  deleteAudit,
} from "./audits.js";
import {
  VersionConflictError,
  AuditNotFoundError,
} from "../types/index.js";

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

describe("createAudit", () => {
  it("should create an audit with defaults", () => {
    const audit = createAudit({ title: "Test audit" }, db);
    expect(audit.title).toBe("Test audit");
    expect(audit.type).toBe("other");
    expect(audit.status).toBe("pending");
    expect(audit.version).toBe(1);
    expect(audit.id).toBeTruthy();
  });

  it("should create an audit with all fields", () => {
    const audit = createAudit(
      {
        title: "Security audit",
        type: "security",
        status: "in_progress",
        severity: "high",
        findings: "Found vulnerability",
        metadata: { tool: "snyk" },
      },
      db,
    );
    expect(audit.type).toBe("security");
    expect(audit.status).toBe("in_progress");
    expect(audit.severity).toBe("high");
    expect(audit.findings).toBe("Found vulnerability");
    expect(audit.metadata).toEqual({ tool: "snyk" });
  });

  it("should set completed_at when created as completed", () => {
    const audit = createAudit({ title: "Done", status: "completed" }, db);
    expect(audit.completed_at).toBeTruthy();
  });
});

describe("getAudit", () => {
  it("should return null for non-existent audit", () => {
    expect(getAudit("non-existent", db)).toBeNull();
  });

  it("should return an audit by id", () => {
    const created = createAudit({ title: "Test" }, db);
    const audit = getAudit(created.id, db);
    expect(audit).not.toBeNull();
    expect(audit!.title).toBe("Test");
  });
});

describe("listAudits", () => {
  it("should list all audits", () => {
    createAudit({ title: "Audit 1" }, db);
    createAudit({ title: "Audit 2" }, db);
    const audits = listAudits({}, db);
    expect(audits).toHaveLength(2);
  });

  it("should filter by type", () => {
    createAudit({ title: "Security", type: "security" }, db);
    createAudit({ title: "Performance", type: "performance" }, db);

    const security = listAudits({ type: "security" }, db);
    expect(security).toHaveLength(1);
    expect(security[0]!.title).toBe("Security");
  });

  it("should filter by status", () => {
    createAudit({ title: "Pending", status: "pending" }, db);
    createAudit({ title: "Completed", status: "completed" }, db);

    const pending = listAudits({ status: "pending" }, db);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.title).toBe("Pending");
  });

  it("should filter by severity", () => {
    createAudit({ title: "High", severity: "high" }, db);
    createAudit({ title: "Low", severity: "low" }, db);

    const high = listAudits({ severity: "high" }, db);
    expect(high).toHaveLength(1);
    expect(high[0]!.title).toBe("High");
  });

  it("should order by severity (critical first)", () => {
    createAudit({ title: "Low", severity: "low" }, db);
    createAudit({ title: "Critical", severity: "critical" }, db);
    createAudit({ title: "High", severity: "high" }, db);

    const audits = listAudits({}, db);
    expect(audits[0]!.severity).toBe("critical");
    expect(audits[1]!.severity).toBe("high");
    expect(audits[2]!.severity).toBe("low");
  });
});

describe("updateAudit", () => {
  it("should update an audit", () => {
    const audit = createAudit({ title: "Original" }, db);
    const updated = updateAudit(
      audit.id,
      { version: 1, title: "Updated", severity: "high" },
      db,
    );
    expect(updated.title).toBe("Updated");
    expect(updated.severity).toBe("high");
    expect(updated.version).toBe(2);
  });

  it("should throw VersionConflictError on version mismatch", () => {
    const audit = createAudit({ title: "Test" }, db);
    updateAudit(audit.id, { version: 1, title: "V2" }, db);

    expect(() =>
      updateAudit(audit.id, { version: 1, title: "Conflict" }, db),
    ).toThrow(VersionConflictError);
  });

  it("should throw AuditNotFoundError for non-existent audit", () => {
    expect(() =>
      updateAudit("non-existent", { version: 1, title: "Test" }, db),
    ).toThrow(AuditNotFoundError);
  });

  it("should set completed_at when status becomes completed", () => {
    const audit = createAudit({ title: "Test" }, db);
    const updated = updateAudit(
      audit.id,
      { version: 1, status: "completed" },
      db,
    );
    expect(updated.completed_at).toBeTruthy();
  });

  it("should clear completed_at when status becomes active", () => {
    const audit = createAudit({ title: "Test", status: "completed" }, db);
    const updated = updateAudit(
      audit.id,
      { version: audit.version, status: "pending" },
      db,
    );
    expect(updated.completed_at).toBeNull();
  });
});

describe("completeAudit", () => {
  it("should complete an audit", () => {
    const audit = createAudit({ title: "To complete" }, db);
    const completed = completeAudit(audit.id, undefined, db);
    expect(completed.status).toBe("completed");
    expect(completed.completed_at).toBeTruthy();
  });

  it("should complete an audit with findings", () => {
    const audit = createAudit({ title: "To complete" }, db);
    const completed = completeAudit(audit.id, "All checks passed", db);
    expect(completed.status).toBe("completed");
    expect(completed.findings).toBe("All checks passed");
  });

  it("should throw AuditNotFoundError for non-existent audit", () => {
    expect(() => completeAudit("non-existent", undefined, db)).toThrow(
      AuditNotFoundError,
    );
  });
});

describe("deleteAudit", () => {
  it("should delete an audit", () => {
    const audit = createAudit({ title: "To delete" }, db);
    expect(deleteAudit(audit.id, db)).toBe(true);
    expect(getAudit(audit.id, db)).toBeNull();
  });

  it("should return false for non-existent audit", () => {
    expect(deleteAudit("non-existent", db)).toBe(false);
  });
});
