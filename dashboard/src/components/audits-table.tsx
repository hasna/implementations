import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Audit } from "@/types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return Math.round(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.round(diff / 3600000) + "h ago";
  return Math.round(diff / 86400000) + "d ago";
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const typeColors: Record<string, string> = {
  security: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  performance: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  code_review: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  dependency: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
};

const severityColors: Record<string, string> = {
  info: "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400",
  low: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  high: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  critical: "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200",
};

interface AuditsTableProps {
  data: Audit[];
  onDelete: (id: string) => void;
}

export function AuditsTable({ data, onDelete }: AuditsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState({});

  const columns: ColumnDef<Audit>[] = React.useMemo(
    () => [
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge className={`border-0 ${statusColors[row.original.status] || ""}`}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <Badge className={`border-0 ${typeColors[row.original.type] || ""}`}>
            {row.original.type}
          </Badge>
        ),
      },
      {
        id: "severity",
        header: "Severity",
        accessorFn: (row) => row.severity || "-",
        cell: ({ row }) =>
          row.original.severity ? (
            <Badge className={`border-0 ${severityColors[row.original.severity] || ""}`}>
              {row.original.severity}
            </Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        id: "shortId",
        header: "ID",
        accessorFn: (row) => row.id.slice(0, 8),
        cell: ({ row }) => (
          <code className="text-xs text-muted-foreground">{row.original.id.slice(0, 8)}</code>
        ),
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3"
          >
            Title
            <ArrowUpDownIcon />
          </Button>
        ),
        cell: ({ row }) => <div className="font-medium">{row.original.title}</div>,
      },
      {
        accessorKey: "version",
        header: "Ver",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">v{row.original.version}</span>
        ),
      },
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3"
          >
            Created
            <ArrowUpDownIcon />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {timeAgo(row.original.created_at)}
          </span>
        ),
      },
      {
        id: "completed",
        header: "Completed",
        accessorFn: (row) => row.completed_at || "",
        cell: ({ row }) =>
          row.original.completed_at ? (
            <span className="text-muted-foreground text-sm">
              {timeAgo(row.original.completed_at)}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(row.original.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [onDelete]
  );

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    initialState: {
      pagination: { pageSize: 10 },
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filter audits..."
          value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
          onChange={(e) => table.getColumn("title")?.setFilterValue(e.target.value)}
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No audits found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-sm">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()} ({table.getFilteredRowModel().rows.length}{" "}
          audit{table.getFilteredRowModel().rows.length !== 1 ? "s" : ""})
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
