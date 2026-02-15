import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { getDatabase, closeDatabase, resetDatabase } from "./database.js";
import {
  createPlan,
  getPlan,
  listPlans,
  updatePlan,
  setPlanStatus,
  deletePlan,
} from "./plans.js";
import {
  VersionConflictError,
  PlanNotFoundError,
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

describe("createPlan", () => {
  it("should create a plan with defaults", () => {
    const plan = createPlan({ title: "Test plan" }, db);
    expect(plan.title).toBe("Test plan");
    expect(plan.status).toBe("draft");
    expect(plan.version).toBe(1);
    expect(plan.id).toBeTruthy();
    expect(plan.slug).toBe("test-plan");
  });

  it("should create a plan with all fields", () => {
    const plan = createPlan(
      {
        title: "Full plan",
        description: "A description",
        content: "Plan content here",
        status: "review",
        tags: ["urgent", "feature"],
        metadata: { key: "value" },
      },
      db,
    );
    expect(plan.description).toBe("A description");
    expect(plan.content).toBe("Plan content here");
    expect(plan.status).toBe("review");
    expect(plan.tags).toEqual(["urgent", "feature"]);
    expect(plan.metadata).toEqual({ key: "value" });
  });

  it("should auto-generate slug from title", () => {
    const plan = createPlan({ title: "My Awesome Plan!" }, db);
    expect(plan.slug).toBe("my-awesome-plan");
  });
});

describe("getPlan", () => {
  it("should return null for non-existent plan", () => {
    expect(getPlan("non-existent", db)).toBeNull();
  });

  it("should return a plan by id", () => {
    const created = createPlan({ title: "Test" }, db);
    const plan = getPlan(created.id, db);
    expect(plan).not.toBeNull();
    expect(plan!.title).toBe("Test");
  });
});

describe("listPlans", () => {
  it("should list all plans", () => {
    createPlan({ title: "Plan 1" }, db);
    createPlan({ title: "Plan 2" }, db);
    const plans = listPlans({}, db);
    expect(plans).toHaveLength(2);
  });

  it("should filter by status", () => {
    createPlan({ title: "Draft", status: "draft" }, db);
    createPlan({ title: "Approved", status: "approved" }, db);

    const drafts = listPlans({ status: "draft" }, db);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.title).toBe("Draft");
  });

  it("should filter by multiple statuses", () => {
    createPlan({ title: "Draft", status: "draft" }, db);
    createPlan({ title: "Review", status: "review" }, db);
    createPlan({ title: "Done", status: "done" }, db);

    const active = listPlans({ status: ["draft", "review"] }, db);
    expect(active).toHaveLength(2);
  });

  it("should filter by tags", () => {
    createPlan({ title: "Tagged", tags: ["feature", "v2"] }, db);
    createPlan({ title: "Untagged" }, db);

    const plans = listPlans({ tags: ["feature"] }, db);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.title).toBe("Tagged");
  });

  it("should return all plans when listing", () => {
    createPlan({ title: "First" }, db);
    createPlan({ title: "Second" }, db);

    const plans = listPlans({}, db);
    expect(plans).toHaveLength(2);
    const titles = plans.map(p => p.title).sort();
    expect(titles).toEqual(["First", "Second"]);
  });
});

describe("updatePlan", () => {
  it("should update a plan", () => {
    const plan = createPlan({ title: "Original" }, db);
    const updated = updatePlan(
      plan.id,
      { version: 1, title: "Updated", status: "approved" },
      db,
    );
    expect(updated.title).toBe("Updated");
    expect(updated.status).toBe("approved");
    expect(updated.version).toBe(2);
    expect(updated.slug).toBe("updated");
  });

  it("should throw VersionConflictError on version mismatch", () => {
    const plan = createPlan({ title: "Test" }, db);
    updatePlan(plan.id, { version: 1, title: "V2" }, db);

    expect(() =>
      updatePlan(plan.id, { version: 1, title: "Conflict" }, db),
    ).toThrow(VersionConflictError);
  });

  it("should throw PlanNotFoundError for non-existent plan", () => {
    expect(() =>
      updatePlan("non-existent", { version: 1, title: "Test" }, db),
    ).toThrow(PlanNotFoundError);
  });
});

describe("setPlanStatus", () => {
  it("should set plan status", () => {
    const plan = createPlan({ title: "Test" }, db);
    const updated = setPlanStatus(plan.id, "approved", db);
    expect(updated.status).toBe("approved");
    expect(updated.version).toBe(2);
  });

  it("should throw PlanNotFoundError for non-existent plan", () => {
    expect(() => setPlanStatus("non-existent", "approved", db)).toThrow(
      PlanNotFoundError,
    );
  });
});

describe("deletePlan", () => {
  it("should delete a plan", () => {
    const plan = createPlan({ title: "To delete" }, db);
    expect(deletePlan(plan.id, db)).toBe(true);
    expect(getPlan(plan.id, db)).toBeNull();
  });

  it("should return false for non-existent plan", () => {
    expect(deletePlan("non-existent", db)).toBe(false);
  });
});
