export interface Plan {
  id: string;
  project_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  content: string | null;
  status: string;
  tags: string[];
  metadata: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Audit {
  id: string;
  project_id: string | null;
  title: string;
  type: string;
  status: string;
  severity: string | null;
  findings: string | null;
  metadata: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Log {
  id: string;
  project_id: string | null;
  level: string;
  source: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DashboardStats {
  plans: { total: number; draft: number; active: number; done: number };
  audits: { total: number; pending: number; completed: number; failed: number };
  logs: { total: number; errors: number; warns: number };
}
