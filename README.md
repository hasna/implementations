# Implementations

Plans, audits, and logs management for AI coding agents. Four interfaces: library API, CLI with interactive TUI, MCP server, and web dashboard.

## Quick Start

```bash
# Install globally
bun install -g @hasna/implementations

# Or use bunx (no install needed)
bunx @hasna/implementations
```

## Usage

### Plans

```bash
implementations plan add "Add auth system" -d "OAuth2 flow" -s review -t auth,security
implementations plan list                          # Active plans
implementations plan list --status draft,review    # Filter by status
implementations plan show <id>                     # Full details
implementations plan update <id> --title "New"     # Update fields
implementations plan set-status <id> in_progress   # Change status
implementations plan delete <id>                   # Delete
implementations plan search "auth"                 # Search plans
```

### Audits

```bash
implementations audit add "XSS scan" -t security -s high
implementations audit list                         # Active audits
implementations audit list --type security         # Filter by type
implementations audit show <id>                    # Full details
implementations audit update <id> --severity critical
implementations audit complete <id> -f "No issues found"
implementations audit delete <id>
```

### Logs

```bash
implementations log add "Server started" -l info -s server
implementations log list -l error --limit 100      # Filter by level
implementations log tail -n 30                     # Recent logs
implementations log show <id>                      # Full details
implementations log clear --confirm                # Clear all
```

### Search & Export

```bash
implementations search "auth"                      # Search plans + audits
implementations export --format json               # Export all data
implementations export --format md                 # Export as markdown
```

### Dashboard

Start a local web dashboard to manage plans, audits, and logs:

```bash
implementations serve                              # http://localhost:19427
implementations serve --port 3000                  # Custom port
implementations serve --no-open                    # Don't auto-open browser
implementations dashboard                          # Alias for serve
```

The dashboard provides:
- Stats cards showing plan, audit, and log counts
- TanStack tables with sorting, filtering, and pagination
- Create dialogs for plans, audits, and logs
- Delete operations with confirmation
- Light/dark theme toggle

### Interactive TUI

```bash
implementations                                    # Launch TUI (default in TTY)
implementations interactive                        # Explicit TUI launch
```

Keyboard navigation: `p`=plans, `a`=audits, `l`=logs, `P`=projects, `/`=search, `q`=quit.

### MCP Server (for AI Agents)

```bash
implementations-mcp                                # Start MCP server on stdio

# Register with agents
implementations mcp --register claude              # Claude Code
implementations mcp --register codex               # OpenAI Codex CLI
implementations mcp --register gemini              # Gemini CLI
implementations mcp --register all                 # All agents
```

19 tools + 4 resources for plans, audits, logs, and projects management.

### JSON Output

Every command supports `--json` for machine-readable output:

```bash
implementations plan list --json
implementations audit list --json
implementations log list --json
implementations search "query" --json
```

### Projects

Auto-detects git repositories, or manage manually:

```bash
implementations projects                           # List projects
implementations projects --add /path/to/project    # Register
implementations --project /path plan list          # Scope to project
```

## Library API

```typescript
import {
  createPlan, listPlans, updatePlan, deletePlan,
  createAudit, listAudits, completeAudit, deleteAudit,
  createLog, listLogs, tailLogs,
  searchAll,
} from '@hasna/implementations';

const plan = createPlan({ title: 'New feature', status: 'draft', tags: ['v2'] });
const audits = listAudits({ type: 'security', severity: 'high' });
const logs = tailLogs(20, { level: 'error' });
const results = searchAll('auth');
```

## Key Concepts

**Plan statuses:** `draft` | `review` | `approved` | `in_progress` | `done` | `archived`

**Audit types:** `security` | `performance` | `code_review` | `dependency` | `other`

**Audit statuses:** `pending` | `in_progress` | `completed` | `failed`

**Severity levels:** `info` | `low` | `medium` | `high` | `critical`

**Log levels:** `debug` | `info` | `warn` | `error`

Plans and audits use **optimistic locking** via a `version` column. Logs are **append-only**.

## Architecture

```
src/
├── types/index.ts          # Type definitions and enums
├── index.ts                # Library entry point
├── db/                     # SQLite data layer (WAL mode)
│   ├── database.ts         # Singleton, migrations, utilities
│   ├── plans.ts            # Plan CRUD with optimistic locking
│   ├── audits.ts           # Audit CRUD with auto completed_at
│   ├── logs.ts             # Append-only log CRUD
│   └── projects.ts         # Project CRUD
├── lib/search.ts           # Cross-entity search
├── cli/                    # Commander CLI + Ink TUI
├── mcp/                    # MCP server (stdio transport)
└── server/                 # Bun HTTP server (API + dashboard)

dashboard/                  # Vite + React 19 + Tailwind CSS 4
├── src/
│   ├── app.tsx             # Main app with tab navigation
│   ├── components/         # Stats, tables, dialogs, theme
│   └── components/ui/      # shadcn-style Radix UI components
└── ...
```

## Development

**Prerequisites:** [Bun](https://bun.sh/) >= 1.0.0

```bash
bun install                            # Install dependencies
bun test                               # Run all tests (112 tests)
bun run typecheck                      # TypeScript type checking
bun run build                          # Build CLI + MCP + server + library
bun run build:dashboard                # Build the web dashboard
bun run dev:cli -- plan add "test"     # Run CLI in dev mode
bun run dev:mcp                        # Run MCP server in dev mode
bun run dev:dashboard                  # Run dashboard dev server (Vite)
bun run dev:serve                      # Run API server in dev mode
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, testing, and pull request guidelines.

## License

Apache-2.0
