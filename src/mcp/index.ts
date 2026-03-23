#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  createPlan,
  getPlan,
  listPlans,
  updatePlan,
  setPlanStatus,
  deletePlan,
} from "../db/plans.js";
import {
  createAudit,
  getAudit,
  listAudits,
  updateAudit,
  completeAudit,
  deleteAudit,
} from "../db/audits.js";
import {
  createLog,
  getLog,
  listLogs,
  clearLogs,
} from "../db/logs.js";
import {
  createProject,
  listProjects,
} from "../db/projects.js";
import { searchAll } from "../lib/search.js";
import { getDatabase, getAdapter, resolvePartialId } from "../db/database.js";
import {
  VersionConflictError,
  PlanNotFoundError,
  AuditNotFoundError,
  LogNotFoundError,
  ProjectNotFoundError,
} from "../types/index.js";
import type { Plan, Audit, Log } from "../types/index.js";

// --- in-memory agent registry ---
interface _ImplAgent { id: string; name: string; session_id?: string; last_seen_at: string; project_id?: string; }
const _implAgents = new Map<string, _ImplAgent>();

const server = new McpServer({
  name: "implementations",
  version: "0.1.0",
});

function formatError(error: unknown): string {
  if (error instanceof VersionConflictError) return `Version conflict: ${error.message}`;
  if (error instanceof PlanNotFoundError) return `Not found: ${error.message}`;
  if (error instanceof AuditNotFoundError) return `Not found: ${error.message}`;
  if (error instanceof LogNotFoundError) return `Not found: ${error.message}`;
  if (error instanceof ProjectNotFoundError) return `Not found: ${error.message}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

function resolveId(partialId: string, table: string): string {
  const db = getDatabase();
  const id = resolvePartialId(db, table, partialId);
  if (!id) throw new Error(`Could not resolve ID: ${partialId}`);
  return id;
}

function formatPlan(plan: Plan): string {
  const parts = [
    `ID: ${plan.id}`,
    `Title: ${plan.title}`,
    `Slug: ${plan.slug}`,
    `Status: ${plan.status}`,
  ];
  if (plan.description) parts.push(`Description: ${plan.description}`);
  if (plan.content) parts.push(`Content: ${plan.content}`);
  if (plan.project_id) parts.push(`Project: ${plan.project_id}`);
  if (plan.tags.length > 0) parts.push(`Tags: ${plan.tags.join(", ")}`);
  parts.push(`Version: ${plan.version}`);
  parts.push(`Created: ${plan.created_at}`);
  return parts.join("\n");
}

function formatAudit(audit: Audit): string {
  const parts = [
    `ID: ${audit.id}`,
    `Title: ${audit.title}`,
    `Type: ${audit.type}`,
    `Status: ${audit.status}`,
  ];
  if (audit.severity) parts.push(`Severity: ${audit.severity}`);
  if (audit.findings) parts.push(`Findings: ${audit.findings}`);
  if (audit.project_id) parts.push(`Project: ${audit.project_id}`);
  parts.push(`Version: ${audit.version}`);
  parts.push(`Created: ${audit.created_at}`);
  if (audit.completed_at) parts.push(`Completed: ${audit.completed_at}`);
  return parts.join("\n");
}

function formatLog(log: Log): string {
  return `[${log.level.toUpperCase()}] ${log.created_at} ${log.source}: ${log.message}`;
}

// === PLAN TOOLS ===

server.tool(
  "create_plan",
  "Create a new plan",
  {
    title: z.string().describe("Plan title"),
    description: z.string().optional().describe("Plan description"),
    content: z.string().optional().describe("Plan content/body"),
    project_id: z.string().optional().describe("Project ID"),
    status: z.enum(["draft", "review", "approved", "in_progress", "done", "archived"]).optional().describe("Initial status"),
    tags: z.array(z.string()).optional().describe("Plan tags"),
    metadata: z.record(z.unknown()).optional().describe("Arbitrary metadata"),
  },
  async (params) => {
    try {
      const plan = createPlan(params);
      return { content: [{ type: "text" as const, text: `Plan created:\n${formatPlan(plan)}` }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

server.tool(
  "list_plans",
  "List plans with optional filters",
  {
    project_id: z.string().optional().describe("Filter by project"),
    status: z.union([
      z.enum(["draft", "review", "approved", "in_progress", "done", "archived"]),
      z.array(z.enum(["draft", "review", "approved", "in_progress", "done", "archived"])),
    ]).optional().describe("Filter by status"),
    tags: z.array(z.string()).optional().describe("Filter by tags (any match)"),
    limit: z.number().optional().describe("Max entries"),
    offset: z.number().optional().describe("Offset for pagination"),
  },
  async (params) => {
    try {
      const plans = listPlans(params);
      if (plans.length === 0) {
        return { content: [{ type: "text" as const, text: "No plans found." }] };
      }
      const text = plans.map((p) =>
        `[${p.status}] ${p.id.slice(0, 8)} | ${p.title}`,
      ).join("\n");
      return { content: [{ type: "text" as const, text: `${plans.length} plan(s):\n${text}` }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

server.tool(
  "get_plan",
  "Get full plan details",
  {
    id: z.string().describe("Plan ID (full or partial)"),
  },
  async ({ id }) => {
    try {
      const resolvedId = resolveId(id, "plans");
      const plan = getPlan(resolvedId);
      if (!plan) return { content: [{ type: "text" as const, text: `Plan not found: ${id}` }], isError: true };
      return { content: [{ type: "text" as const, text: formatPlan(plan) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

server.tool(
  "update_plan",
  "Update plan fields (requires version for optimistic locking)",
  {
    id: z.string().describe("Plan ID (full or partial)"),
    version: z.number().describe("Current version (for optimistic locking)"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    content: z.string().optional().describe("New content"),
    status: z.enum(["draft", "review", "approved", "in_progress", "done", "archived"]).optional().describe("New status"),
    tags: z.array(z.string()).optional().describe("New tags"),
    metadata: z.record(z.unknown()).optional().describe("New metadata"),
  },
  async ({ id, ...rest }) => {
    try {
      const resolvedId = resolveId(id, "plans");
      const plan = updatePlan(resolvedId, rest);
      return { content: [{ type: "text" as const, text: `Plan updated:\n${formatPlan(plan)}` }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

server.tool(
  "delete_plan",
  "Delete a plan permanently",
  {
    id: z.string().describe("Plan ID (full or partial)"),
  },
  async ({ id }) => {
    try {
      const resolvedId = resolveId(id, "plans");
      const deleted = deletePlan(resolvedId);
      return {
        content: [{
          type: "text" as const,
          text: deleted ? `Plan ${id} deleted.` : `Plan ${id} not found.`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

server.tool(
  "set_plan_status",
  "Set plan status directly",
  {
    id: z.string().describe("Plan ID (full or partial)"),
    status: z.enum(["draft", "review", "approved", "in_progress", "done", "archived"]).describe("New status"),
  },
  async ({ id, status }) => {
    try {
      const resolvedId = resolveId(id, "plans");
      const plan = setPlanStatus(resolvedId, status);
      return { content: [{ type: "text" as const, text: `Plan status set to ${status}:\n${formatPlan(plan)}` }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

// === AUDIT TOOLS ===

server.tool(
  "create_audit",
  "Create a new audit",
  {
    title: z.string().describe("Audit title"),
    project_id: z.string().optional().describe("Project ID"),
    type: z.enum(["security", "performance", "code_review", "dependency", "other"]).optional().describe("Audit type"),
    status: z.enum(["pending", "in_progress", "completed", "failed"]).optional().describe("Initial status"),
    severity: z.enum(["info", "low", "medium", "high", "critical"]).optional().describe("Severity level"),
    findings: z.string().optional().describe("Initial findings"),
    metadata: z.record(z.unknown()).optional().describe("Arbitrary metadata"),
  },
  async (params) => {
    try {
      const audit = createAudit(params);
      return { content: [{ type: "text" as const, text: `Audit created:\n${formatAudit(audit)}` }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

server.tool(
  "list_audits",
  "List audits with optional filters",
  {
    project_id: z.string().optional().describe("Filter by project"),
    type: z.union([
      z.enum(["security", "performance", "code_review", "dependency", "other"]),
      z.array(z.enum(["security", "performance", "code_review", "dependency", "other"])),
    ]).optional().describe("Filter by type"),
    status: z.union([
      z.enum(["pending", "in_progress", "completed", "failed"]),
      z.array(z.enum(["pending", "in_progress", "completed", "failed"])),
    ]).optional().describe("Filter by status"),
    severity: z.union([
      z.enum(["info", "low", "medium", "high", "critical"]),
      z.array(z.enum(["info", "low", "medium", "high", "critical"])),
    ]).optional().describe("Filter by severity"),
    limit: z.number().optional().describe("Max entries"),
    offset: z.number().optional().describe("Offset for pagination"),
  },
  async (params) => {
    try {
      const audits = listAudits(params);
      if (audits.length === 0) {
        return { content: [{ type: "text" as const, text: "No audits found." }] };
      }
      const text = audits.map((a) =>
        `[${a.status}] ${a.id.slice(0, 8)} | ${a.type} | ${a.severity || "-"} | ${a.title}`,
      ).join("\n");
      return { content: [{ type: "text" as const, text: `${audits.length} audit(s):\n${text}` }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

server.tool(
  "get_audit",
  "Get full audit details",
  {
    id: z.string().describe("Audit ID (full or partial)"),
  },
  async ({ id }) => {
    try {
      const resolvedId = resolveId(id, "audits");
      const audit = getAudit(resolvedId);
      if (!audit) return { content: [{ type: "text" as const, text: `Audit not found: ${id}` }], isError: true };
      return { content: [{ type: "text" as const, text: formatAudit(audit) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

server.tool(
  "update_audit",
  "Update audit fields (requires version for optimistic locking)",
  {
    id: z.string().describe("Audit ID (full or partial)"),
    version: z.number().describe("Current version (for optimistic locking)"),
    title: z.string().optional().describe("New title"),
    type: z.enum(["security", "performance", "code_review", "dependency", "other"]).optional().describe("New type"),
    status: z.enum(["pending", "in_progress", "completed", "failed"]).optional().describe("New status"),
    severity: z.enum(["info", "low", "medium", "high", "critical"]).optional().describe("New severity"),
    findings: z.string().optional().describe("New findings"),
    metadata: z.record(z.unknown()).optional().describe("New metadata"),
  },
  async ({ id, ...rest }) => {
    try {
      const resolvedId = resolveId(id, "audits");
      const audit = updateAudit(resolvedId, rest);
      return { content: [{ type: "text" as const, text: `Audit updated:\n${formatAudit(audit)}` }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

server.tool(
  "complete_audit",
  "Mark audit as completed with optional findings",
  {
    id: z.string().describe("Audit ID (full or partial)"),
    findings: z.string().optional().describe("Final findings"),
  },
  async ({ id, findings }) => {
    try {
      const resolvedId = resolveId(id, "audits");
      const audit = completeAudit(resolvedId, findings);
      return { content: [{ type: "text" as const, text: `Audit completed:\n${formatAudit(audit)}` }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

server.tool(
  "delete_audit",
  "Delete an audit permanently",
  {
    id: z.string().describe("Audit ID (full or partial)"),
  },
  async ({ id }) => {
    try {
      const resolvedId = resolveId(id, "audits");
      const deleted = deleteAudit(resolvedId);
      return {
        content: [{
          type: "text" as const,
          text: deleted ? `Audit ${id} deleted.` : `Audit ${id} not found.`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

// === LOG TOOLS ===

server.tool(
  "create_log",
  "Create a new log entry",
  {
    message: z.string().describe("Log message"),
    project_id: z.string().optional().describe("Project ID"),
    level: z.enum(["debug", "info", "warn", "error"]).optional().describe("Log level"),
    source: z.string().optional().describe("Log source/component"),
    metadata: z.record(z.unknown()).optional().describe("Arbitrary metadata"),
  },
  async (params) => {
    try {
      const log = createLog(params);
      return { content: [{ type: "text" as const, text: `Log created: ${formatLog(log)}` }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

server.tool(
  "list_logs",
  "List recent log entries",
  {
    project_id: z.string().optional().describe("Filter by project"),
    level: z.union([
      z.enum(["debug", "info", "warn", "error"]),
      z.array(z.enum(["debug", "info", "warn", "error"])),
    ]).optional().describe("Filter by level"),
    source: z.string().optional().describe("Filter by source"),
    limit: z.number().optional().describe("Max entries (default 50)"),
    offset: z.number().optional().describe("Offset for pagination"),
  },
  async (params) => {
    try {
      const logs = listLogs(params);
      if (logs.length === 0) {
        return { content: [{ type: "text" as const, text: "No logs found." }] };
      }
      const text = logs.map(formatLog).join("\n");
      return { content: [{ type: "text" as const, text: `${logs.length} log(s):\n${text}` }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

server.tool(
  "get_log",
  "Get a specific log entry",
  {
    id: z.string().describe("Log ID (full or partial)"),
  },
  async ({ id }) => {
    try {
      const resolvedId = resolveId(id, "logs");
      const log = getLog(resolvedId);
      if (!log) return { content: [{ type: "text" as const, text: `Log not found: ${id}` }], isError: true };
      const parts = [
        `ID: ${log.id}`,
        `Level: ${log.level}`,
        `Source: ${log.source}`,
        `Message: ${log.message}`,
        `Created: ${log.created_at}`,
      ];
      if (Object.keys(log.metadata).length > 0) {
        parts.push(`Metadata: ${JSON.stringify(log.metadata)}`);
      }
      return { content: [{ type: "text" as const, text: parts.join("\n") }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

server.tool(
  "clear_logs",
  "Clear all log entries",
  {
    project_id: z.string().optional().describe("Clear only logs for this project"),
  },
  async ({ project_id }) => {
    try {
      const count = clearLogs(project_id);
      return { content: [{ type: "text" as const, text: `Cleared ${count} log entries.` }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

// === PROJECT TOOLS ===

server.tool(
  "list_projects",
  "List all registered projects",
  {},
  async () => {
    try {
      const projects = listProjects();
      if (projects.length === 0) {
        return { content: [{ type: "text" as const, text: "No projects registered." }] };
      }
      const text = projects.map((p) =>
        `${p.id.slice(0, 8)} | ${p.name} | ${p.path}${p.description ? ` - ${p.description}` : ""}`,
      ).join("\n");
      return { content: [{ type: "text" as const, text: `${projects.length} project(s):\n${text}` }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

server.tool(
  "create_project",
  "Register a new project",
  {
    name: z.string().describe("Project name"),
    path: z.string().describe("Absolute path to project"),
    description: z.string().optional().describe("Project description"),
  },
  async (params) => {
    try {
      const project = createProject(params);
      return {
        content: [{
          type: "text" as const,
          text: `Project created: ${project.id.slice(0, 8)} | ${project.name} | ${project.path}`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

// === SEARCH TOOL ===

server.tool(
  "search",
  "Search across plans and audits",
  {
    query: z.string().describe("Search query"),
    project_id: z.string().optional().describe("Limit to project"),
  },
  async ({ query, project_id }) => {
    try {
      const results = searchAll(query, project_id);
      const total = results.plans.length + results.audits.length;
      if (total === 0) {
        return { content: [{ type: "text" as const, text: `No results matching "${query}".` }] };
      }

      const parts: string[] = [];
      if (results.plans.length > 0) {
        parts.push(`Plans (${results.plans.length}):`);
        for (const p of results.plans) {
          parts.push(`  [${p.status}] ${p.id.slice(0, 8)} | ${p.title}`);
        }
      }
      if (results.audits.length > 0) {
        parts.push(`Audits (${results.audits.length}):`);
        for (const a of results.audits) {
          parts.push(`  [${a.status}] ${a.id.slice(0, 8)} | ${a.type} | ${a.title}`);
        }
      }
      return { content: [{ type: "text" as const, text: `${total} result(s) for "${query}":\n${parts.join("\n")}` }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: formatError(e) }], isError: true };
    }
  },
);

// === RESOURCES ===

server.resource(
  "plans",
  "implementations://plans",
  { description: "All plans", mimeType: "application/json" },
  async () => {
    const plans = listPlans();
    return { contents: [{ uri: "implementations://plans", text: JSON.stringify(plans, null, 2), mimeType: "application/json" }] };
  },
);

server.resource(
  "audits",
  "implementations://audits",
  { description: "All audits", mimeType: "application/json" },
  async () => {
    const audits = listAudits();
    return { contents: [{ uri: "implementations://audits", text: JSON.stringify(audits, null, 2), mimeType: "application/json" }] };
  },
);

server.resource(
  "logs",
  "implementations://logs",
  { description: "Recent logs", mimeType: "application/json" },
  async () => {
    const logs = listLogs();
    return { contents: [{ uri: "implementations://logs", text: JSON.stringify(logs, null, 2), mimeType: "application/json" }] };
  },
);

server.resource(
  "projects",
  "implementations://projects",
  { description: "All registered projects", mimeType: "application/json" },
  async () => {
    const projects = listProjects();
    return { contents: [{ uri: "implementations://projects", text: JSON.stringify(projects, null, 2), mimeType: "application/json" }] };
  },
);

// === FEEDBACK ===

server.tool(
  "send_feedback",
  "Send feedback about this service",
  {
    message: z.string().describe("Feedback message"),
    email: z.string().optional().describe("Contact email (optional)"),
    category: z.enum(["bug", "feature", "general"]).optional().describe("Feedback category"),
  },
  async (params: { message: string; email?: string; category?: string }) => {
    const adapter = getAdapter();
    const pkg = require("../../package.json");
    adapter.run(
      "INSERT INTO feedback (message, email, category, version) VALUES (?, ?, ?, ?)",
      params.message, params.email || null, params.category || "general", pkg.version
    );
    return { content: [{ type: "text" as const, text: "Feedback saved. Thank you!" }] };
  },
);

// === Agent Tools ===

server.tool("register_agent", "Register an agent session. Returns agent_id. Auto-triggers a heartbeat.", {
  name: z.string(),
  session_id: z.string().optional(),
}, async (params) => {
  const existing = [..._implAgents.values()].find(a => a.name === params.name);
  if (existing) { existing.last_seen_at = new Date().toISOString(); if (params.session_id) existing.session_id = params.session_id; return { content: [{ type: "text" as const, text: JSON.stringify(existing) }] }; }
  const id = Math.random().toString(36).slice(2, 10);
  const ag: _ImplAgent = { id, name: params.name, session_id: params.session_id, last_seen_at: new Date().toISOString() };
  _implAgents.set(id, ag);
  return { content: [{ type: "text" as const, text: JSON.stringify(ag) }] };
});

server.tool("heartbeat", "Update last_seen_at to signal agent is active.", {
  agent_id: z.string(),
}, async (params) => {
  const ag = _implAgents.get(params.agent_id);
  if (!ag) return { content: [{ type: "text" as const, text: `Agent not found: ${params.agent_id}` }], isError: true };
  ag.last_seen_at = new Date().toISOString();
  return { content: [{ type: "text" as const, text: JSON.stringify({ agent_id: ag.id, last_seen_at: ag.last_seen_at }) }] };
});

server.tool("set_focus", "Set active project context for this agent session.", {
  agent_id: z.string(),
  project_id: z.string().optional(),
}, async (params) => {
  const ag = _implAgents.get(params.agent_id);
  if (!ag) return { content: [{ type: "text" as const, text: `Agent not found: ${params.agent_id}` }], isError: true };
  ag.project_id = params.project_id;
  return { content: [{ type: "text" as const, text: JSON.stringify({ agent_id: ag.id, project_id: ag.project_id ?? null }) }] };
});

server.tool("list_agents", "List all registered agents.", {}, async () => {
  return { content: [{ type: "text" as const, text: JSON.stringify([..._implAgents.values()]) }] };
});

// === START SERVER ===

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
