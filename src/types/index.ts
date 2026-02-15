// Plan statuses
export const PLAN_STATUSES = [
  "draft",
  "review",
  "approved",
  "in_progress",
  "done",
  "archived",
] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

// Audit types
export const AUDIT_TYPES = [
  "security",
  "performance",
  "code_review",
  "dependency",
  "other",
] as const;
export type AuditType = (typeof AUDIT_TYPES)[number];

// Audit statuses
export const AUDIT_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "failed",
] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

// Severity levels
export const SEVERITY_LEVELS = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

// Log levels
export const LOG_LEVELS = [
  "debug",
  "info",
  "warn",
  "error",
] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

// Project
export interface Project {
  id: string;
  name: string;
  path: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  name: string;
  path: string;
  description?: string;
}

// Plan
export interface Plan {
  id: string;
  project_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  content: string | null;
  status: PlanStatus;
  tags: string[];
  metadata: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PlanRow {
  id: string;
  project_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  content: string | null;
  status: string;
  tags: string | null;
  metadata: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePlanInput {
  title: string;
  description?: string;
  content?: string;
  project_id?: string;
  status?: PlanStatus;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdatePlanInput {
  title?: string;
  description?: string;
  content?: string;
  status?: PlanStatus;
  tags?: string[];
  metadata?: Record<string, unknown>;
  version: number; // required for optimistic locking
}

export interface PlanFilter {
  project_id?: string;
  status?: PlanStatus | PlanStatus[];
  tags?: string[];
}

// Audit
export interface Audit {
  id: string;
  project_id: string | null;
  title: string;
  type: AuditType;
  status: AuditStatus;
  severity: SeverityLevel | null;
  findings: string | null;
  metadata: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface AuditRow {
  id: string;
  project_id: string | null;
  title: string;
  type: string;
  status: string;
  severity: string | null;
  findings: string | null;
  metadata: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CreateAuditInput {
  title: string;
  project_id?: string;
  type?: AuditType;
  status?: AuditStatus;
  severity?: SeverityLevel;
  findings?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateAuditInput {
  title?: string;
  type?: AuditType;
  status?: AuditStatus;
  severity?: SeverityLevel;
  findings?: string;
  metadata?: Record<string, unknown>;
  version: number; // required for optimistic locking
}

export interface AuditFilter {
  project_id?: string;
  type?: AuditType | AuditType[];
  status?: AuditStatus | AuditStatus[];
  severity?: SeverityLevel | SeverityLevel[];
}

// Log
export interface Log {
  id: string;
  project_id: string | null;
  level: LogLevel;
  source: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LogRow {
  id: string;
  project_id: string | null;
  level: string;
  source: string;
  message: string;
  metadata: string | null;
  created_at: string;
}

export interface CreateLogInput {
  message: string;
  project_id?: string;
  level?: LogLevel;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface LogFilter {
  project_id?: string;
  level?: LogLevel | LogLevel[];
  source?: string;
  limit?: number;
}

// Error classes

export class VersionConflictError extends Error {
  constructor(
    public entityId: string,
    public expectedVersion: number,
    public actualVersion: number,
  ) {
    super(
      `Version conflict for ${entityId}: expected ${expectedVersion}, got ${actualVersion}`,
    );
    this.name = "VersionConflictError";
  }
}

export class PlanNotFoundError extends Error {
  constructor(public planId: string) {
    super(`Plan not found: ${planId}`);
    this.name = "PlanNotFoundError";
  }
}

export class AuditNotFoundError extends Error {
  constructor(public auditId: string) {
    super(`Audit not found: ${auditId}`);
    this.name = "AuditNotFoundError";
  }
}

export class LogNotFoundError extends Error {
  constructor(public logId: string) {
    super(`Log not found: ${logId}`);
    this.name = "LogNotFoundError";
  }
}

export class ProjectNotFoundError extends Error {
  constructor(public projectId: string) {
    super(`Project not found: ${projectId}`);
    this.name = "ProjectNotFoundError";
  }
}
