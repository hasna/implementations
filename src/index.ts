// Core database
export { getDatabase, closeDatabase, resetDatabase, resolvePartialId, slugify } from "./db/database.js";

// Plans
export {
  createPlan,
  getPlan,
  listPlans,
  updatePlan,
  setPlanStatus,
  deletePlan,
} from "./db/plans.js";

// Audits
export {
  createAudit,
  getAudit,
  listAudits,
  updateAudit,
  completeAudit,
  deleteAudit,
} from "./db/audits.js";

// Logs
export {
  createLog,
  getLog,
  listLogs,
  tailLogs,
  clearLogs,
  deleteLog,
} from "./db/logs.js";

// Projects
export {
  createProject,
  getProject,
  getProjectByPath,
  listProjects,
  updateProject,
  deleteProject,
  ensureProject,
} from "./db/projects.js";

// Search
export { searchPlans, searchAudits, searchAll } from "./lib/search.js";

// Types
export type {
  Plan,
  PlanRow,
  CreatePlanInput,
  UpdatePlanInput,
  PlanFilter,
  PlanStatus,
  Audit,
  AuditRow,
  CreateAuditInput,
  UpdateAuditInput,
  AuditFilter,
  AuditType,
  AuditStatus,
  SeverityLevel,
  Log,
  LogRow,
  CreateLogInput,
  LogFilter,
  LogLevel,
  Project,
  CreateProjectInput,
} from "./types/index.js";

export {
  PLAN_STATUSES,
  AUDIT_TYPES,
  AUDIT_STATUSES,
  SEVERITY_LEVELS,
  LOG_LEVELS,
  VersionConflictError,
  PlanNotFoundError,
  AuditNotFoundError,
  LogNotFoundError,
  ProjectNotFoundError,
} from "./types/index.js";
