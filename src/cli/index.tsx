#!/usr/bin/env bun
import { Command } from "commander";
import chalk from "chalk";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { getDatabase, getAdapter, resolvePartialId } from "../db/database.js";
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
  tailLogs,
  clearLogs,
} from "../db/logs.js";
import {
  listProjects,
  ensureProject,
  getProjectByPath,
} from "../db/projects.js";
import { searchAll } from "../lib/search.js";
import type { Plan, PlanStatus, Audit, AuditType, AuditStatus, SeverityLevel, Log, LogLevel } from "../types/index.js";
import { safeText } from "./utils/terminal.js";

const program = new Command();

// Helpers

function handleError(e: unknown): never {
  console.error(chalk.red(safeText(e instanceof Error ? e.message : String(e))));
  process.exit(1);
}

function resolveEntityId(partialId: string, table: string): string {
  const db = getDatabase();
  const id = resolvePartialId(db, table, partialId);
  if (!id) {
    console.error(chalk.red(`Could not resolve ID: ${safeText(partialId)}`));
    process.exit(1);
  }
  return id;
}

function detectGitRoot(): string | null {
  try {
    return execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

function autoProject(opts: { project?: string }): string | undefined {
  if (opts.project) {
    const p = getProjectByPath(resolve(opts.project));
    return p?.id;
  }
  if (process.env["IMPLEMENTATIONS_AUTO_PROJECT"] === "false") return undefined;
  const gitRoot = detectGitRoot();
  if (gitRoot) {
    const p = ensureProject(basename(gitRoot), gitRoot);
    return p.id;
  }
  return undefined;
}

function output(data: unknown, jsonMode: boolean): void {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2));
  }
}

const planStatusColors: Record<string, (s: string) => string> = {
  draft: chalk.gray,
  review: chalk.yellow,
  approved: chalk.cyan,
  in_progress: chalk.blue,
  done: chalk.green,
  archived: chalk.dim,
};

const auditStatusColors: Record<string, (s: string) => string> = {
  pending: chalk.yellow,
  in_progress: chalk.blue,
  completed: chalk.green,
  failed: chalk.red,
};

const severityColors: Record<string, (s: string) => string> = {
  info: chalk.gray,
  low: chalk.cyan,
  medium: chalk.yellow,
  high: chalk.red,
  critical: chalk.red.bold,
};

const logLevelColors: Record<string, (s: string) => string> = {
  debug: chalk.gray,
  info: chalk.cyan,
  warn: chalk.yellow,
  error: chalk.red,
};

function formatPlanLine(p: Plan): string {
  const statusFn = planStatusColors[p.status] || chalk.white;
  const tags = p.tags.length > 0 ? chalk.dim(` [${p.tags.map(safeText).join(",")}]`) : "";
  return `${chalk.dim(safeText(p.id.slice(0, 8)))} ${statusFn(safeText(p.status).padEnd(11))} ${safeText(p.title)}${tags}`;
}

function formatAuditLine(a: Audit): string {
  const statusFn = auditStatusColors[a.status] || chalk.white;
  const sevFn = a.severity ? (severityColors[a.severity] || chalk.white) : chalk.dim;
  return `${chalk.dim(safeText(a.id.slice(0, 8)))} ${statusFn(safeText(a.status).padEnd(11))} ${safeText(a.type).padEnd(12)} ${sevFn(safeText(a.severity || "-"))} ${safeText(a.title)}`;
}

function formatLogLine(l: Log): string {
  const levelFn = logLevelColors[l.level] || chalk.white;
  const ts = l.created_at.replace("T", " ").slice(0, 19);
  return `${levelFn(`[${safeText(l.level).toUpperCase().padEnd(5)}]`)} ${safeText(ts)} ${chalk.dim(safeText(l.source))} ${safeText(l.message)}`;
}

// Global options
program
  .name("implementations")
  .description("Plans, audits, and logs for AI coding agents")
  .version("0.1.0")
  .option("--project <path>", "Project path")
  .option("--json", "Output as JSON")
  .option("--agent <name>", "Agent name");

// === PLAN COMMANDS ===

const planCmd = program
  .command("plan")
  .description("Manage plans");

planCmd
  .command("add <title>")
  .description("Create a new plan")
  .option("-d, --description <text>", "Plan description")
  .option("-c, --content <text>", "Plan content")
  .option("-s, --status <status>", "Initial status: draft, review, approved", "draft")
  .option("-t, --tags <tags>", "Comma-separated tags")
  .action((title: string, opts) => {
    const globalOpts = program.opts();
    const projectId = autoProject(globalOpts);
    const plan = createPlan({
      title,
      description: opts.description,
      content: opts.content,
      status: opts.status as PlanStatus | undefined,
      tags: opts.tags ? opts.tags.split(",").map((t: string) => t.trim()) : undefined,
      project_id: projectId,
    });

    if (globalOpts.json) {
      output(plan, true);
    } else {
      console.log(chalk.green("Plan created:"));
      console.log(formatPlanLine(plan));
    }
  });

planCmd
  .command("list")
  .description("List plans")
  .option("-s, --status <status>", "Filter by status")
  .option("--tags <tags>", "Filter by tags (comma-separated)")
  .option("-a, --all", "Show all plans")
  .action((opts) => {
    const globalOpts = program.opts();
    const projectId = autoProject(globalOpts);

    const filter: Record<string, unknown> = {};
    if (projectId) filter["project_id"] = projectId;
    if (opts.status) {
      filter["status"] = opts.status.includes(",")
        ? opts.status.split(",").map((s: string) => s.trim())
        : opts.status;
    } else if (!opts.all) {
      filter["status"] = ["draft", "review", "approved", "in_progress"];
    }
    if (opts.tags) filter["tags"] = opts.tags.split(",").map((t: string) => t.trim());

    const plans = listPlans(filter as any);

    if (globalOpts.json) {
      output(plans, true);
      return;
    }

    if (plans.length === 0) {
      console.log(chalk.dim("No plans found."));
      return;
    }

    console.log(chalk.bold(`${plans.length} plan(s):\n`));
    for (const p of plans) {
      console.log(formatPlanLine(p));
    }
  });

planCmd
  .command("show <id>")
  .description("Show full plan details")
  .action((id: string) => {
    const globalOpts = program.opts();
    const resolvedId = resolveEntityId(id, "plans");
    const plan = getPlan(resolvedId);

    if (!plan) {
      console.error(chalk.red(`Plan not found: ${id}`));
      process.exit(1);
    }

    if (globalOpts.json) {
      output(plan, true);
      return;
    }

    console.log(chalk.bold("Plan Details:\n"));
    console.log(`  ${chalk.dim("ID:")}          ${safeText(plan.id)}`);
    console.log(`  ${chalk.dim("Title:")}       ${safeText(plan.title)}`);
    console.log(`  ${chalk.dim("Slug:")}        ${safeText(plan.slug)}`);
    console.log(`  ${chalk.dim("Status:")}      ${(planStatusColors[plan.status] || chalk.white)(safeText(plan.status))}`);
    if (plan.description) console.log(`  ${chalk.dim("Description:")} ${safeText(plan.description)}`);
    if (plan.tags.length > 0) console.log(`  ${chalk.dim("Tags:")}        ${plan.tags.map(safeText).join(", ")}`);
    console.log(`  ${chalk.dim("Version:")}     ${safeText(plan.version)}`);
    console.log(`  ${chalk.dim("Created:")}     ${safeText(plan.created_at)}`);
    console.log(`  ${chalk.dim("Updated:")}     ${safeText(plan.updated_at)}`);

    if (plan.content) {
      console.log(`\n${chalk.bold("Content:")}\n${safeText(plan.content)}`);
    }
  });

planCmd
  .command("update <id>")
  .description("Update a plan")
  .option("--title <text>", "New title")
  .option("-d, --description <text>", "New description")
  .option("-c, --content <text>", "New content")
  .option("-s, --status <status>", "New status")
  .option("--tags <tags>", "New tags (comma-separated)")
  .action((id: string, opts) => {
    const globalOpts = program.opts();
    const resolvedId = resolveEntityId(id, "plans");
    const current = getPlan(resolvedId);
    if (!current) {
      console.error(chalk.red(`Plan not found: ${id}`));
      process.exit(1);
    }

    let plan;
    try {
      plan = updatePlan(resolvedId, {
        version: current.version,
        title: opts.title,
        description: opts.description,
        content: opts.content,
        status: opts.status as PlanStatus | undefined,
        tags: opts.tags ? opts.tags.split(",").map((t: string) => t.trim()) : undefined,
      });
    } catch (e) {
      handleError(e);
    }

    if (globalOpts.json) {
      output(plan, true);
    } else {
      console.log(chalk.green("Plan updated:"));
      console.log(formatPlanLine(plan));
    }
  });

planCmd
  .command("set-status <id> <status>")
  .description("Set plan status")
  .action((id: string, status: string) => {
    const globalOpts = program.opts();
    const validStatuses = ["draft", "review", "approved", "in_progress", "done", "archived"];
    if (!validStatuses.includes(status)) {
      console.error(chalk.red(`Invalid status. Valid: ${validStatuses.join(", ")}`));
      process.exit(1);
    }

    const resolvedId = resolveEntityId(id, "plans");
    let plan;
    try {
      plan = setPlanStatus(resolvedId, status as PlanStatus);
    } catch (e) {
      handleError(e);
    }

    if (globalOpts.json) {
      output(plan, true);
    } else {
      console.log(chalk.green(`Plan status set to ${safeText(status)}:`));
      console.log(formatPlanLine(plan));
    }
  });

planCmd
  .command("delete <id>")
  .description("Delete a plan")
  .action((id: string) => {
    const globalOpts = program.opts();
    const resolvedId = resolveEntityId(id, "plans");
    const deleted = deletePlan(resolvedId);

    if (globalOpts.json) {
      output({ deleted }, true);
    } else if (deleted) {
      console.log(chalk.green("Plan deleted."));
    } else {
      console.error(chalk.red("Plan not found."));
      process.exit(1);
    }
  });

planCmd
  .command("search <query>")
  .description("Search plans")
  .action((query: string) => {
    const globalOpts = program.opts();
    const projectId = autoProject(globalOpts);
    const { searchPlans } = require("../lib/search.js");
    const plans = searchPlans(query, projectId);

    if (globalOpts.json) {
      output(plans, true);
      return;
    }

    if (plans.length === 0) {
      console.log(chalk.dim(`No plans matching "${safeText(query)}".`));
      return;
    }

    console.log(chalk.bold(`${plans.length} result(s) for "${safeText(query)}":\n`));
    for (const p of plans) {
      console.log(formatPlanLine(p));
    }
  });

// === AUDIT COMMANDS ===

const auditCmd = program
  .command("audit")
  .description("Manage audits");

auditCmd
  .command("add <title>")
  .description("Create a new audit")
  .option("-t, --type <type>", "Audit type: security, performance, code_review, dependency, other", "other")
  .option("-s, --severity <severity>", "Severity: info, low, medium, high, critical")
  .option("-f, --findings <findings>", "Initial findings")
  .action((title: string, opts) => {
    const globalOpts = program.opts();
    const projectId = autoProject(globalOpts);
    const audit = createAudit({
      title,
      type: opts.type as AuditType | undefined,
      severity: opts.severity as SeverityLevel | undefined,
      findings: opts.findings,
      project_id: projectId,
    });

    if (globalOpts.json) {
      output(audit, true);
    } else {
      console.log(chalk.green("Audit created:"));
      console.log(formatAuditLine(audit));
    }
  });

auditCmd
  .command("list")
  .description("List audits")
  .option("-t, --type <type>", "Filter by type")
  .option("-s, --status <status>", "Filter by status")
  .option("--severity <severity>", "Filter by severity")
  .option("-a, --all", "Show all audits")
  .action((opts) => {
    const globalOpts = program.opts();
    const projectId = autoProject(globalOpts);

    const filter: Record<string, unknown> = {};
    if (projectId) filter["project_id"] = projectId;
    if (opts.type) filter["type"] = opts.type;
    if (opts.status) {
      filter["status"] = opts.status.includes(",")
        ? opts.status.split(",").map((s: string) => s.trim())
        : opts.status;
    } else if (!opts.all) {
      filter["status"] = ["pending", "in_progress"];
    }
    if (opts.severity) filter["severity"] = opts.severity;

    const audits = listAudits(filter as any);

    if (globalOpts.json) {
      output(audits, true);
      return;
    }

    if (audits.length === 0) {
      console.log(chalk.dim("No audits found."));
      return;
    }

    console.log(chalk.bold(`${audits.length} audit(s):\n`));
    for (const a of audits) {
      console.log(formatAuditLine(a));
    }
  });

auditCmd
  .command("show <id>")
  .description("Show full audit details")
  .action((id: string) => {
    const globalOpts = program.opts();
    const resolvedId = resolveEntityId(id, "audits");
    const audit = getAudit(resolvedId);

    if (!audit) {
      console.error(chalk.red(`Audit not found: ${id}`));
      process.exit(1);
    }

    if (globalOpts.json) {
      output(audit, true);
      return;
    }

    console.log(chalk.bold("Audit Details:\n"));
    console.log(`  ${chalk.dim("ID:")}        ${safeText(audit.id)}`);
    console.log(`  ${chalk.dim("Title:")}     ${safeText(audit.title)}`);
    console.log(`  ${chalk.dim("Type:")}      ${safeText(audit.type)}`);
    console.log(`  ${chalk.dim("Status:")}    ${(auditStatusColors[audit.status] || chalk.white)(safeText(audit.status))}`);
    if (audit.severity) console.log(`  ${chalk.dim("Severity:")}  ${(severityColors[audit.severity] || chalk.white)(safeText(audit.severity))}`);
    console.log(`  ${chalk.dim("Version:")}   ${safeText(audit.version)}`);
    console.log(`  ${chalk.dim("Created:")}   ${safeText(audit.created_at)}`);
    console.log(`  ${chalk.dim("Updated:")}   ${safeText(audit.updated_at)}`);
    if (audit.completed_at) console.log(`  ${chalk.dim("Completed:")} ${safeText(audit.completed_at)}`);

    if (audit.findings) {
      console.log(`\n${chalk.bold("Findings:")}\n${safeText(audit.findings)}`);
    }
  });

auditCmd
  .command("update <id>")
  .description("Update an audit")
  .option("--title <text>", "New title")
  .option("-t, --type <type>", "New type")
  .option("-s, --status <status>", "New status")
  .option("--severity <severity>", "New severity")
  .option("-f, --findings <findings>", "New findings")
  .action((id: string, opts) => {
    const globalOpts = program.opts();
    const resolvedId = resolveEntityId(id, "audits");
    const current = getAudit(resolvedId);
    if (!current) {
      console.error(chalk.red(`Audit not found: ${id}`));
      process.exit(1);
    }

    let audit;
    try {
      audit = updateAudit(resolvedId, {
        version: current.version,
        title: opts.title,
        type: opts.type as AuditType | undefined,
        status: opts.status as AuditStatus | undefined,
        severity: opts.severity as SeverityLevel | undefined,
        findings: opts.findings,
      });
    } catch (e) {
      handleError(e);
    }

    if (globalOpts.json) {
      output(audit, true);
    } else {
      console.log(chalk.green("Audit updated:"));
      console.log(formatAuditLine(audit));
    }
  });

auditCmd
  .command("complete <id>")
  .description("Mark audit as completed")
  .option("-f, --findings <findings>", "Final findings")
  .action((id: string, opts) => {
    const globalOpts = program.opts();
    const resolvedId = resolveEntityId(id, "audits");
    let audit;
    try {
      audit = completeAudit(resolvedId, opts.findings);
    } catch (e) {
      handleError(e);
    }

    if (globalOpts.json) {
      output(audit, true);
    } else {
      console.log(chalk.green("Audit completed:"));
      console.log(formatAuditLine(audit));
    }
  });

auditCmd
  .command("delete <id>")
  .description("Delete an audit")
  .action((id: string) => {
    const globalOpts = program.opts();
    const resolvedId = resolveEntityId(id, "audits");
    const deleted = deleteAudit(resolvedId);

    if (globalOpts.json) {
      output({ deleted }, true);
    } else if (deleted) {
      console.log(chalk.green("Audit deleted."));
    } else {
      console.error(chalk.red("Audit not found."));
      process.exit(1);
    }
  });

// === LOG COMMANDS ===

const logCmd = program
  .command("log")
  .description("Manage logs");

logCmd
  .command("add <message>")
  .description("Add a log entry")
  .option("-l, --level <level>", "Log level: debug, info, warn, error", "info")
  .option("-s, --source <source>", "Log source/component", "cli")
  .option("-m, --metadata <json>", "Additional metadata as JSON")
  .action((message: string, opts) => {
    const globalOpts = program.opts();
    const projectId = autoProject(globalOpts);

    let metadata: Record<string, unknown> = {};
    if (opts.metadata) {
      try {
        metadata = JSON.parse(opts.metadata);
      } catch {
        console.error(chalk.red("Invalid JSON metadata"));
        process.exit(1);
      }
    }

    const log = createLog({
      message,
      level: opts.level as LogLevel | undefined,
      source: opts.source,
      metadata,
      project_id: projectId,
    });

    if (globalOpts.json) {
      output(log, true);
    } else {
      console.log(chalk.green("Log entry added:"));
      console.log(formatLogLine(log));
    }
  });

logCmd
  .command("list")
  .description("List recent logs")
  .option("-l, --level <level>", "Filter by level")
  .option("-s, --source <source>", "Filter by source")
  .option("-n, --limit <n>", "Number of entries", "50")
  .action((opts) => {
    const globalOpts = program.opts();
    const projectId = autoProject(globalOpts);

    const filter: Record<string, unknown> = {};
    if (projectId) filter["project_id"] = projectId;
    if (opts.level) filter["level"] = opts.level;
    if (opts.source) filter["source"] = opts.source;
    filter["limit"] = parseInt(opts.limit, 10) || 50;

    const logs = listLogs(filter as any);

    if (globalOpts.json) {
      output(logs, true);
      return;
    }

    if (logs.length === 0) {
      console.log(chalk.dim("No logs found."));
      return;
    }

    for (const l of logs) {
      console.log(formatLogLine(l));
    }
  });

logCmd
  .command("tail")
  .description("Show most recent logs")
  .option("-l, --level <level>", "Filter by level")
  .option("-s, --source <source>", "Filter by source")
  .option("-n, --limit <n>", "Number of entries", "20")
  .action((opts) => {
    const globalOpts = program.opts();
    const projectId = autoProject(globalOpts);

    const filter: Record<string, unknown> = {};
    if (projectId) filter["project_id"] = projectId;
    if (opts.level) filter["level"] = opts.level;
    if (opts.source) filter["source"] = opts.source;

    const logs = tailLogs(parseInt(opts.limit, 10) || 20, filter as any);

    if (globalOpts.json) {
      output(logs, true);
      return;
    }

    if (logs.length === 0) {
      console.log(chalk.dim("No logs found."));
      return;
    }

    for (const l of logs) {
      console.log(formatLogLine(l));
    }
  });

logCmd
  .command("show <id>")
  .description("Show log entry details")
  .action((id: string) => {
    const globalOpts = program.opts();
    const resolvedId = resolveEntityId(id, "logs");
    const log = getLog(resolvedId);

    if (!log) {
      console.error(chalk.red(`Log not found: ${id}`));
      process.exit(1);
    }

    if (globalOpts.json) {
      output(log, true);
      return;
    }

    console.log(chalk.bold("Log Entry:\n"));
    console.log(`  ${chalk.dim("ID:")}      ${safeText(log.id)}`);
    console.log(`  ${chalk.dim("Level:")}   ${(logLevelColors[log.level] || chalk.white)(safeText(log.level))}`);
    console.log(`  ${chalk.dim("Source:")}  ${safeText(log.source)}`);
    console.log(`  ${chalk.dim("Created:")} ${safeText(log.created_at)}`);
    console.log(`\n${chalk.bold("Message:")}\n${safeText(log.message)}`);

    if (Object.keys(log.metadata).length > 0) {
      console.log(`\n${chalk.bold("Metadata:")}`);
      console.log(JSON.stringify(log.metadata, null, 2));
    }
  });

logCmd
  .command("clear")
  .description("Clear all logs")
  .option("--confirm", "Skip confirmation")
  .action((opts) => {
    const globalOpts = program.opts();
    const projectId = autoProject(globalOpts);

    if (!opts.confirm) {
      console.log(chalk.yellow("This will delete all logs. Use --confirm to proceed."));
      return;
    }

    const count = clearLogs(projectId);

    if (globalOpts.json) {
      output({ deleted: count }, true);
    } else {
      console.log(chalk.green(`Deleted ${count} log entries.`));
    }
  });

// === PROJECTS ===

program
  .command("projects")
  .description("List and manage projects")
  .option("--add <path>", "Register a project by path")
  .option("--name <name>", "Project name (with --add)")
  .action((opts) => {
    const globalOpts = program.opts();

    if (opts.add) {
      const projectPath = resolve(opts.add);
      const name = opts.name || basename(projectPath);
      const project = ensureProject(name, projectPath);

      if (globalOpts.json) {
        output(project, true);
      } else {
        console.log(chalk.green(`Project registered: ${safeText(project.name)} (${safeText(project.path)})`));
      }
      return;
    }

    const projects = listProjects();
    if (globalOpts.json) {
      output(projects, true);
      return;
    }

    if (projects.length === 0) {
      console.log(chalk.dim("No projects registered."));
      return;
    }

    console.log(chalk.bold(`${projects.length} project(s):\n`));
    for (const p of projects) {
      console.log(`${chalk.dim(safeText(p.id.slice(0, 8)))} ${chalk.bold(safeText(p.name))} ${chalk.dim(safeText(p.path))}${p.description ? ` - ${safeText(p.description)}` : ""}`);
    }
  });

// === SEARCH ===

program
  .command("search <query>")
  .description("Search across plans and audits")
  .action((query: string) => {
    const globalOpts = program.opts();
    const projectId = autoProject(globalOpts);
    const results = searchAll(query, projectId);

    if (globalOpts.json) {
      output(results, true);
      return;
    }

    const total = results.plans.length + results.audits.length;
    if (total === 0) {
      console.log(chalk.dim(`No results matching "${safeText(query)}".`));
      return;
    }

    console.log(chalk.bold(`${total} result(s) for "${safeText(query)}":\n`));

    if (results.plans.length > 0) {
      console.log(chalk.bold("Plans:"));
      for (const p of results.plans) {
        console.log(`  ${formatPlanLine(p)}`);
      }
    }
    if (results.audits.length > 0) {
      console.log(chalk.bold("Audits:"));
      for (const a of results.audits) {
        console.log(`  ${formatAuditLine(a)}`);
      }
    }
  });

// === UPDATE ===

program
  .command("update")
  .description("Update @hasna/implementations to the latest version")
  .option("--confirm", "Proceed with update")
  .action(async (opts: { confirm?: boolean }) => {
    try {
      if (!opts.confirm && process.env["IMPLEMENTATIONS_ALLOW_UPDATE"] !== "true") {
        console.log(chalk.yellow("Update requires confirmation. Re-run with --confirm or set IMPLEMENTATIONS_ALLOW_UPDATE=true."));
        return;
      }
      const { execSync } = await import("child_process");
      console.log(chalk.dim("Updating @hasna/implementations..."));
      execSync("bun update @hasna/implementations", { stdio: "inherit" });
      console.log(chalk.green("Update complete."));
    } catch {
      console.error(chalk.red("Update failed."));
      process.exit(1);
    }
  });

// === EXPORT ===

program
  .command("export")
  .description("Export plans and audits")
  .option("-f, --format <format>", "Format: json or md", "json")
  .action((opts) => {
    const globalOpts = program.opts();
    const projectId = autoProject(globalOpts);
    const plans = listPlans(projectId ? { project_id: projectId } : {});
    const audits = listAudits(projectId ? { project_id: projectId } : {});

    if (opts.format === "md") {
      console.log("# Plans\n");
      for (const p of plans) {
        console.log(`- **${safeText(p.title)}** (${safeText(p.status)})`);
        if (p.description) console.log(`  ${safeText(p.description)}`);
      }
      console.log("\n# Audits\n");
      for (const a of audits) {
        const sev = a.severity ? ` [${a.severity}]` : "";
        console.log(`- **${safeText(a.title)}** (${safeText(a.type)}, ${safeText(a.status)})${safeText(sev)}`);
        if (a.findings) console.log(`  ${safeText(a.findings)}`);
      }
    } else {
      console.log(JSON.stringify({ plans, audits }, null, 2));
    }
  });

// === MCP ===

program
  .command("mcp")
  .description("Start MCP server (stdio)")
  .option("--register <agent>", "Register MCP server with an agent (claude, codex, gemini, all)")
  .option("--unregister <agent>", "Unregister MCP server from an agent (claude, codex, gemini, all)")
  .action(async (opts) => {
    if (opts.register) {
      registerMcp(opts.register);
      return;
    }
    if (opts.unregister) {
      unregisterMcp(opts.unregister);
      return;
    }

    // Start MCP server by importing and running
    await import("../mcp/index.js");
  });

// --- MCP Registration Helpers ---

const HOME = process.env["HOME"] || process.env["USERPROFILE"] || "~";

function getMcpBinaryPath(): string {
  try {
    const p = execSync("which implementations-mcp", { encoding: "utf-8" }).trim();
    if (p) return p;
  } catch { /* fall through */ }

  const bunBin = join(HOME, ".bun", "bin", "implementations-mcp");
  if (existsSync(bunBin)) return bunBin;

  return "implementations-mcp";
}

function readJsonFile(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeJsonFile(path: string, data: Record<string, unknown>): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

function readTomlFile(path: string): string {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

function writeTomlFile(path: string, content: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, content);
}

function registerClaude(binPath: string): void {
  const cwd = process.cwd();
  const configPath = join(cwd, ".mcp.json");
  const config = readJsonFile(configPath);

  config["implementations"] = {
    command: binPath,
    args: [] as string[],
  };

  writeJsonFile(configPath, config);
  console.log(chalk.green(`Claude Code: registered in ${configPath}`));
}

function unregisterClaude(): void {
  const cwd = process.cwd();
  const configPath = join(cwd, ".mcp.json");
  const config = readJsonFile(configPath);

  if (!("implementations" in config)) {
    console.log(chalk.dim(`Claude Code: implementations not found in ${configPath}`));
    return;
  }

  delete config["implementations"];
  writeJsonFile(configPath, config);
  console.log(chalk.green(`Claude Code: unregistered from ${configPath}`));
}

function registerCodex(binPath: string): void {
  const configPath = join(HOME, ".codex", "config.toml");
  let content = readTomlFile(configPath);

  content = removeTomlBlock(content, "mcp_servers.implementations");

  const block = `\n[mcp_servers.implementations]\ncommand = "${tomlString(binPath)}"\nargs = []\n`;
  content = content.trimEnd() + "\n" + block;

  writeTomlFile(configPath, content);
  console.log(chalk.green(`Codex CLI: registered in ${configPath}`));
}

function unregisterCodex(): void {
  const configPath = join(HOME, ".codex", "config.toml");
  let content = readTomlFile(configPath);

  if (!content.includes("[mcp_servers.implementations]")) {
    console.log(chalk.dim(`Codex CLI: implementations not found in ${configPath}`));
    return;
  }

  content = removeTomlBlock(content, "mcp_servers.implementations");
  writeTomlFile(configPath, content.trimEnd() + "\n");
  console.log(chalk.green(`Codex CLI: unregistered from ${configPath}`));
}

function removeTomlBlock(content: string, blockName: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let skipping = false;
  const header = `[${blockName}]`;

  for (const line of lines) {
    if (line.trim() === header) {
      skipping = true;
      continue;
    }
    if (skipping && line.trim().startsWith("[")) {
      skipping = false;
    }
    if (!skipping) {
      result.push(line);
    }
  }

  return result.join("\n");
}

function tomlString(value: string): string {
  return value
    .replace(/[\r\n]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"");
}

function registerGemini(binPath: string): void {
  const configPath = join(HOME, ".gemini", "settings.json");
  const config = readJsonFile(configPath);

  if (!config["mcpServers"]) {
    config["mcpServers"] = {};
  }
  const servers = config["mcpServers"] as Record<string, unknown>;
  servers["implementations"] = {
    command: binPath,
    args: [] as string[],
  };

  writeJsonFile(configPath, config);
  console.log(chalk.green(`Gemini CLI: registered in ${configPath}`));
}

function unregisterGemini(): void {
  const configPath = join(HOME, ".gemini", "settings.json");
  const config = readJsonFile(configPath);
  const servers = config["mcpServers"] as Record<string, unknown> | undefined;

  if (!servers || !("implementations" in servers)) {
    console.log(chalk.dim(`Gemini CLI: implementations not found in ${configPath}`));
    return;
  }

  delete servers["implementations"];
  writeJsonFile(configPath, config);
  console.log(chalk.green(`Gemini CLI: unregistered from ${configPath}`));
}

function registerMcp(agent: string): void {
  const agents = agent === "all" ? ["claude", "codex", "gemini"] : [agent];
  const binPath = getMcpBinaryPath();

  for (const a of agents) {
    switch (a) {
      case "claude":
        registerClaude(binPath);
        break;
      case "codex":
        registerCodex(binPath);
        break;
      case "gemini":
        registerGemini(binPath);
        break;
      default:
        console.error(chalk.red(`Unknown agent: ${a}. Use: claude, codex, gemini, all`));
    }
  }
}

function unregisterMcp(agent: string): void {
  const agents = agent === "all" ? ["claude", "codex", "gemini"] : [agent];

  for (const a of agents) {
    switch (a) {
      case "claude":
        unregisterClaude();
        break;
      case "codex":
        unregisterCodex();
        break;
      case "gemini":
        unregisterGemini();
        break;
      default:
        console.error(chalk.red(`Unknown agent: ${a}. Use: claude, codex, gemini, all`));
    }
  }
}

// === SERVE / DASHBOARD ===

program
  .command("serve")
  .alias("dashboard")
  .option("-p, --port <port>", "Port to run the dashboard on", "19427")
  .option("--open", "Open dashboard in browser (default)", true)
  .option("--no-open", "Don't open browser automatically")
  .description("Start local dashboard for implementations management")
  .action(async (options: { port: string; open: boolean }) => {
    const port = parseInt(options.port, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.log(chalk.red("Invalid port number"));
      process.exit(1);
      return;
    }
    console.log(chalk.bold("\nStarting Implementations Dashboard...\n"));
    const { startServer } = await import("../server/serve.js");
    await startServer(port, { open: options.open });
  });

// === INTERACTIVE ===

program
  .command("interactive")
  .description("Launch interactive TUI")
  .action(async () => {
    const { renderApp } = await import("./components/App.js");
    const globalOpts = program.opts();
    const projectId = autoProject(globalOpts);
    renderApp(projectId);
  });

// ── Feedback ─────────────────────────────────────────────────────────────────

program
  .command("feedback <message>")
  .description("Send feedback")
  .option("--email <email>", "Contact email")
  .option("--category <category>", "Category: bug, feature, general")
  .action((message: string, opts: { email?: string; category?: string }) => {
    const adapter = getAdapter();
    const pkg = JSON.parse(readFileSync(join(import.meta.dir, "../../package.json"), "utf8"));
    adapter.run(
      "INSERT INTO feedback (message, email, category, version) VALUES (?, ?, ?, ?)",
      message, opts.email || null, opts.category || "general", pkg.version
    );
    console.log(chalk.green("Feedback saved. Thank you!"));
  });

// Default action
program.action(async () => {
  if (process.stdout.isTTY) {
    try {
      const { renderApp } = await import("./components/App.js");
      const globalOpts = program.opts();
      const projectId = autoProject(globalOpts);
      renderApp(projectId);
    } catch {
      program.help();
    }
  } else {
    program.help();
  }
});

program.parse();
