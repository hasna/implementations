import { useState, useCallback, useEffect } from "react";
import { render, Box, useInput, useApp } from "ink";
import { Header } from "./Header.js";
import { PlanList } from "./PlanList.js";
import { PlanDetail } from "./PlanDetail.js";
import { PlanForm } from "./PlanForm.js";
import { AuditList } from "./AuditList.js";
import { AuditDetail } from "./AuditDetail.js";
import { LogList } from "./LogList.js";
import { ProjectList } from "./ProjectList.js";
import { SearchView } from "./SearchView.js";
import { listPlans } from "../../db/plans.js";
import { listAudits } from "../../db/audits.js";
import { listLogs } from "../../db/logs.js";
import { listProjects, getProject } from "../../db/projects.js";
import { searchAll } from "../../lib/search.js";
import type { Plan, Audit, Log, Project } from "../../types/index.js";

type View =
  | "plans"
  | "plan-detail"
  | "plan-add"
  | "audits"
  | "audit-detail"
  | "logs"
  | "projects"
  | "search";

interface AppProps {
  projectId?: string;
}

function App({ projectId }: AppProps) {
  const { exit } = useApp();
  const [view, setView] = useState<View>("plans");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [projectIndex, setProjectIndex] = useState(0);
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(projectId);
  const [searchPlanResults, setSearchPlanResults] = useState<Plan[]>([]);
  const [searchAuditResults, setSearchAuditResults] = useState<Audit[]>([]);

  const projectName = currentProjectId
    ? (getProject(currentProjectId)?.name ?? undefined)
    : undefined;

  const refreshPlans = useCallback(() => {
    const filter: Record<string, unknown> = {
      status: ["draft", "review", "approved", "in_progress"],
    };
    if (currentProjectId) filter["project_id"] = currentProjectId;
    setPlans(listPlans(filter as any));
  }, [currentProjectId]);

  const refreshAudits = useCallback(() => {
    const filter: Record<string, unknown> = {
      status: ["pending", "in_progress"],
    };
    if (currentProjectId) filter["project_id"] = currentProjectId;
    setAudits(listAudits(filter as any));
  }, [currentProjectId]);

  const refreshLogs = useCallback(() => {
    const filter: Record<string, unknown> = { limit: 50 };
    if (currentProjectId) filter["project_id"] = currentProjectId;
    setLogs(listLogs(filter as any));
  }, [currentProjectId]);

  useEffect(() => {
    refreshPlans();
  }, [refreshPlans]);

  const itemCount =
    view === "plans" || view === "plan-detail" || view === "plan-add"
      ? plans.length
      : view === "audits" || view === "audit-detail"
        ? audits.length
        : view === "logs"
          ? logs.length
          : view === "projects"
            ? projects.length
            : searchPlanResults.length + searchAuditResults.length;

  useInput((input, key) => {
    // Navigation keys available from list views
    if (view === "plans" || view === "audits" || view === "logs") {
      if (input === "q") {
        exit();
        return;
      }
      if (input === "p" && view !== "plans") {
        refreshPlans();
        setSelectedIndex(0);
        setView("plans");
        return;
      }
      if (input === "a" && view !== "audits") {
        refreshAudits();
        setSelectedIndex(0);
        setView("audits");
        return;
      }
      if (input === "l" && view !== "logs") {
        refreshLogs();
        setSelectedIndex(0);
        setView("logs");
        return;
      }
      if (input === "P") {
        setProjects(listProjects());
        setProjectIndex(0);
        setView("projects");
        return;
      }
      if (input === "/") {
        setSearchPlanResults([]);
        setSearchAuditResults([]);
        setView("search");
        return;
      }
    }

    if (view === "plans") {
      if (key.upArrow || input === "k") {
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow || input === "j") {
        setSelectedIndex((i) => Math.min(plans.length - 1, i + 1));
      } else if (key.return) {
        const plan = plans[selectedIndex];
        if (plan) {
          setSelectedPlan(plan);
          setView("plan-detail");
        }
      } else if (input === "n") {
        setView("plan-add");
      } else if (input === "r") {
        refreshPlans();
      }
    } else if (view === "audits") {
      if (key.upArrow || input === "k") {
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow || input === "j") {
        setSelectedIndex((i) => Math.min(audits.length - 1, i + 1));
      } else if (key.return) {
        const audit = audits[selectedIndex];
        if (audit) {
          setSelectedAudit(audit);
          setView("audit-detail");
        }
      } else if (input === "r") {
        refreshAudits();
      }
    } else if (view === "logs") {
      if (key.upArrow || input === "k") {
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow || input === "j") {
        setSelectedIndex((i) => Math.min(logs.length - 1, i + 1));
      } else if (input === "r") {
        refreshLogs();
      }
    } else if (view === "plan-detail") {
      if (key.escape) {
        setView("plans");
        refreshPlans();
      }
    } else if (view === "audit-detail") {
      if (key.escape) {
        setView("audits");
        refreshAudits();
      }
    } else if (view === "projects") {
      if (key.escape) {
        setView("plans");
        refreshPlans();
      } else if (key.upArrow || input === "k") {
        setProjectIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow || input === "j") {
        setProjectIndex((i) => Math.min(projects.length - 1, i + 1));
      } else if (key.return) {
        const project = projects[projectIndex];
        if (project) {
          setCurrentProjectId(project.id);
          setView("plans");
          setSelectedIndex(0);
        }
      }
    }
  });

  const handlePlanAddSubmit = useCallback(
    (data: { title: string; description?: string; status?: string }) => {
      const { createPlan } = require("../../db/plans.js");
      createPlan({
        title: data.title,
        description: data.description,
        status: data.status as Plan["status"] | undefined,
        project_id: currentProjectId,
      });
      refreshPlans();
      setView("plans");
    },
    [currentProjectId, refreshPlans],
  );

  const handlePlanAddCancel = useCallback(() => {
    setView("plans");
  }, []);

  const handleSearch = useCallback(
    (query: string) => {
      const results = searchAll(query, currentProjectId);
      setSearchPlanResults(results.plans);
      setSearchAuditResults(results.audits);
    },
    [currentProjectId],
  );

  const viewLabel =
    view === "plans"
      ? "Plans"
      : view === "plan-detail"
        ? "Plan Detail"
        : view === "plan-add"
          ? "Add Plan"
          : view === "audits"
            ? "Audits"
            : view === "audit-detail"
              ? "Audit Detail"
              : view === "logs"
                ? "Logs"
                : view === "projects"
                  ? "Projects"
                  : "Search";

  return (
    <Box flexDirection="column">
      <Header
        projectName={projectName}
        itemCount={itemCount}
        view={viewLabel}
      />

      {view === "plans" && (
        <PlanList plans={plans} selectedIndex={selectedIndex} />
      )}

      {view === "plan-detail" && selectedPlan && (
        <PlanDetail plan={selectedPlan} />
      )}

      {view === "plan-add" && (
        <PlanForm
          onSubmit={handlePlanAddSubmit}
          onCancel={handlePlanAddCancel}
        />
      )}

      {view === "audits" && (
        <AuditList audits={audits} selectedIndex={selectedIndex} />
      )}

      {view === "audit-detail" && selectedAudit && (
        <AuditDetail audit={selectedAudit} />
      )}

      {view === "logs" && (
        <LogList logs={logs} selectedIndex={selectedIndex} />
      )}

      {view === "projects" && (
        <ProjectList
          projects={projects}
          selectedIndex={projectIndex}
        />
      )}

      {view === "search" && (
        <SearchView
          planResults={searchPlanResults}
          auditResults={searchAuditResults}
          onSearch={handleSearch}
          onBack={() => {
            setView("plans");
            refreshPlans();
            setSearchPlanResults([]);
            setSearchAuditResults([]);
          }}
        />
      )}
    </Box>
  );
}

export function renderApp(projectId?: string): void {
  render(<App projectId={projectId} />);
}
