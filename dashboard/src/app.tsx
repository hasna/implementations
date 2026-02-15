import * as React from "react";
import { RefreshCwIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { StatsCards } from "@/components/stats-cards";
import { PlansTable } from "@/components/plans-table";
import { AuditsTable } from "@/components/audits-table";
import { LogsTable } from "@/components/logs-table";
import { CreatePlanDialog } from "@/components/create-plan-dialog";
import { CreateAuditDialog } from "@/components/create-audit-dialog";
import { CreateLogDialog } from "@/components/create-log-dialog";
import { Button } from "@/components/ui/button";
import type { Plan, Audit, Log, DashboardStats } from "@/types";

type Tab = "plans" | "audits" | "logs";

const defaultStats: DashboardStats = {
  plans: { total: 0, draft: 0, active: 0, done: 0 },
  audits: { total: 0, pending: 0, completed: 0, failed: 0 },
  logs: { total: 0, errors: 0, warns: 0 },
};

export function App() {
  const [tab, setTab] = React.useState<Tab>("plans");
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [audits, setAudits] = React.useState<Audit[]>([]);
  const [logs, setLogs] = React.useState<Log[]>([]);
  const [stats, setStats] = React.useState<DashboardStats>(defaultStats);
  const [loading, setLoading] = React.useState(true);
  const [toast, setToast] = React.useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, auditsRes, logsRes, statsRes] = await Promise.all([
        fetch("/api/plans"),
        fetch("/api/audits"),
        fetch("/api/logs?limit=100"),
        fetch("/api/stats"),
      ]);
      setPlans(await plansRes.json());
      setAudits(await auditsRes.json());
      setLogs(await logsRes.json());
      setStats(await statsRes.json());
    } catch {
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreatePlan(data: {
    title: string;
    description?: string;
    content?: string;
    status?: string;
    tags?: string[];
  }) {
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create plan");
      showToast("Plan created", "success");
      loadData();
    } catch {
      showToast("Failed to create plan", "error");
    }
  }

  async function handleCreateAudit(data: {
    title: string;
    type?: string;
    severity?: string;
    findings?: string;
  }) {
    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create audit");
      showToast("Audit created", "success");
      loadData();
    } catch {
      showToast("Failed to create audit", "error");
    }
  }

  async function handleCreateLog(data: {
    message: string;
    level?: string;
    source?: string;
  }) {
    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create log");
      showToast("Log created", "success");
      loadData();
    } catch {
      showToast("Failed to create log", "error");
    }
  }

  async function handleDeletePlan(id: string) {
    try {
      const res = await fetch(`/api/plans/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete plan");
      showToast("Plan deleted", "success");
      loadData();
    } catch {
      showToast("Failed to delete plan", "error");
    }
  }

  async function handleDeleteAudit(id: string) {
    try {
      const res = await fetch(`/api/audits/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete audit");
      showToast("Audit deleted", "success");
      loadData();
    } catch {
      showToast("Failed to delete audit", "error");
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "plans", label: "Plans" },
    { key: "audits", label: "Audits" },
    { key: "logs", label: "Logs" },
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
          </div>
        </div>

        {/* Active table */}
        {tab === "plans" && <PlansTable data={plans} onDelete={handleDeletePlan} />}
        {tab === "audits" && <AuditsTable data={audits} onDelete={handleDeleteAudit} />}
        {tab === "logs" && <LogsTable data={logs} />}
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
