import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileTextIcon, ActivityIcon, ShieldCheckIcon, ScrollTextIcon } from "lucide-react";
import type { DashboardStats } from "@/types";

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FileTextIcon className="size-4" />
            Plans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.plans.total}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ActivityIcon className="size-4" />
            Active
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {stats.plans.active}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShieldCheckIcon className="size-4" />
            Audits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.audits.total}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ScrollTextIcon className="size-4" />
            Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {stats.logs.total}
            {stats.logs.errors > 0 && (
              <span className="ml-2 text-sm font-normal text-red-600 dark:text-red-400">
                {stats.logs.errors} error{stats.logs.errors !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
