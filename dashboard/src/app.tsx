import * as React from "react";
import { RefreshCwIcon, ArrowUpCircleIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { StatsCards } from "@/components/stats-cards";
import { PlansTable } from "@/components/plans-table";
import { AuditsTable } from "@/components/audits-table";
import { LogsTable } from "@/components/logs-table";
import { ProjectsTable } from "@/components/projects-table";
import { CreatePlanDialog } from "@/components/create-plan-dialog";
import { CreateAuditDialog } from "@/components/create-audit-dialog";
import { CreateLogDialog } from "@/components/create-log-dialog";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { Button } from "@/components/ui/button";
import type { Plan, Audit, Log, Project, DashboardStats } from "@/types";

type Tab = "plans" | "audits" | "logs" | "projects";

const defaultStats: DashboardStats = {
  projects: { total: 0 },
  plans: { total: 0, draft: 0, active: 0, done: 0 },
  audits: { total: 0, pending: 0, completed: 0, failed: 0 },
  logs: { total: 0, errors: 0, warns: 0 },
};

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    if (res.ok) {
      throw new Error("Invalid JSON response");
    }
  }
  if (!res.ok) {
    const message =
      typeof data === "object" && data && "error" in data
        ? String((data as { error?: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export function App() {
  const [tab, setTab] = React.useState<Tab>("plans");
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [audits, setAudits] = React.useState<Audit[]>([]);
  const [logs, setLogs] = React.useState<Log[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [stats, setStats] = React.useState<DashboardStats>(defaultStats);
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState(false);
  const [toast, setToast] = React.useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);
  const loadAbortRef = React.useRef<AbortController | null>(null);
  const loadSeqRef = React.useRef(0);

  const showToast = React.useCallback((message: string, type: "success" | "error") => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const loadData = React.useCallback(async () => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const [plansData, auditsData, logsData, projectsData, statsData] = await Promise.all([
        fetchJson<Plan[]>("/api/plans", { signal: controller.signal }),
        fetchJson<Audit[]>("/api/audits", { signal: controller.signal }),
        fetchJson<Log[]>("/api/logs?limit=100", { signal: controller.signal }),
        fetchJson<Project[]>("/api/projects", { signal: controller.signal }),
        fetchJson<DashboardStats>("/api/stats", { signal: controller.signal }),
      ]);
      if (loadSeqRef.current !== seq) return;
      setPlans(plansData);
      setAudits(auditsData);
      setLogs(logsData);
      setProjects(projectsData);
      setStats(statsData);
    } catch (error) {
      if (controller.signal.aborted) return;
      controller.abort();
      showToast(error instanceof Error ? error.message : "Failed to load data", "error");
    } finally {
      if (loadSeqRef.current === seq) {
        setLoading(false);
      }
    }
  }, [showToast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    return () => {
      loadSeqRef.current += 1;
      loadAbortRef.current?.abort();
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  async function handleCreatePlan(data: {
    title: string;
    description?: string;
    content?: string;
    status?: string;
    tags?: string[];
  }): Promise<boolean> {
    try {
      await fetchJson<Plan>("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      showToast("Plan created", "success");
      loadData();
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to create plan", "error");
      return false;
    }
  }

  async function handleCreateAudit(data: {
    title: string;
    type?: string;
    severity?: string;
    findings?: string;
  }): Promise<boolean> {
    try {
      await fetchJson<Audit>("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      showToast("Audit created", "success");
      loadData();
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to create audit", "error");
      return false;
    }
  }

  async function handleCreateLog(data: {
    message: string;
    level?: string;
    source?: string;
  }): Promise<boolean> {
    try {
      await fetchJson<Log>("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      showToast("Log created", "success");
      loadData();
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to create log", "error");
      return false;
    }
  }

  async function handleDeletePlan(id: string) {
    try {
      const result = await fetchJson<{ success: boolean }>(`/api/plans/${id}`, {
        method: "DELETE",
      });
      if (!result.success) throw new Error("Failed to delete plan");
      showToast("Plan deleted", "success");
      loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to delete plan", "error");
    }
  }

  async function handleDeleteAudit(id: string) {
    try {
      const result = await fetchJson<{ success: boolean }>(`/api/audits/${id}`, {
        method: "DELETE",
      });
      if (!result.success) throw new Error("Failed to delete audit");
      showToast("Audit deleted", "success");
      loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to delete audit", "error");
    }
  }

  async function handleCreateProject(data: {
    name: string;
    path: string;
    description?: string;
  }): Promise<boolean> {
    try {
      await fetchJson<Project>("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      showToast("Project registered", "success");
      loadData();
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to create project", "error");
      return false;
    }
  }

  async function handleDeleteProject(id: string) {
    try {
      const result = await fetchJson<{ success: boolean }>(`/api/projects/${id}`, {
        method: "DELETE",
      });
      if (!result.success) throw new Error("Failed to delete project");
      showToast("Project deleted", "success");
      loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to delete project", "error");
    }
  }

  async function handleUpdate() {
    setUpdating(true);
    try {
      const data = await fetchJson<{ success: boolean; output?: string }>("/api/update", {
        method: "POST",
        headers: { "X-Implementations-Update": "true" },
      });
      if (!data.success) throw new Error("Update failed");
      showToast("Package updated", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Update failed", "error");
    } finally {
      setUpdating(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "plans", label: "Plans" },
    { key: "audits", label: "Audits" },
    { key: "logs", label: "Logs" },
    { key: "projects", label: "Projects" },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="Hasna"
              className="h-7 w-auto rounded"
            />
            <h1 className="text-base font-semibold">
              Hasna{" "}
              <span className="font-normal text-muted-foreground">
                Implementations
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUpdate}
              disabled={updating}
            >
              <ArrowUpCircleIcon
                className={`size-3.5 ${updating ? "animate-spin" : ""}`}
              />
              Update
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCwIcon
                className={`size-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Reload
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        <StatsCards stats={stats} />

        {/* Tab bar */}
        <div className="flex items-center justify-between border-b">
          <div className="flex">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="pb-2">
            {tab === "plans" && <CreatePlanDialog onCreate={handleCreatePlan} />}
            {tab === "audits" && <CreateAuditDialog onCreate={handleCreateAudit} />}
            {tab === "logs" && <CreateLogDialog onCreate={handleCreateLog} />}
            {tab === "projects" && <CreateProjectDialog onCreate={handleCreateProject} />}
          </div>
        </div>

        {/* Active table */}
        {tab === "plans" && <PlansTable data={plans} onDelete={handleDeletePlan} />}
        {tab === "audits" && <AuditsTable data={audits} onDelete={handleDeleteAudit} />}
        {tab === "logs" && <LogsTable data={logs} />}
        {tab === "projects" && <ProjectsTable data={projects} onDelete={handleDeleteProject} />}
      </main>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg transition-all ${
            toast.type === "success"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
