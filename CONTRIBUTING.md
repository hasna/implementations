# Contributing

Thanks for helping improve implementations. Please follow these guidelines.

## Development Setup

```bash
# Clone and install
git clone https://github.com/hasna/implementations.git
cd implementations
bun install

# Build everything
bun run build
bun run build:dashboard

# Run in development
bun run dev:cli -- plan add "test plan"
bun run dev:serve
bun run dev:dashboard
```

## Running Tests

```bash
bun test                               # Run all 112 tests
bun test src/db/plans.test.ts          # Run a single test file
bun run typecheck                      # TypeScript type checking
```

Tests use in-memory SQLite (`IMPLEMENTATIONS_DB_PATH=:memory:`) with `resetDatabase()` + `getDatabase()` in `beforeEach` and `closeDatabase()` in `afterEach`.

## Project Structure

- `src/types/` — Type definitions and enums
- `src/db/` — SQLite data layer (plans, audits, logs, projects)
- `src/lib/` — Search module
- `src/cli/` — Commander CLI + Ink TUI components
- `src/mcp/` — MCP server (stdio transport)
- `src/server/` — Bun HTTP server (API + static dashboard)
- `dashboard/` — Vite + React 19 + Tailwind CSS 4 web dashboard

## Commit Message Conventions

Follow the existing commit style:

- `feat:` — New feature
- `fix:` — Bug fix
- `chore:` — Maintenance, deps, config changes
- `test:` — Adding or updating tests
- `docs:` — Documentation only

Examples:
```
feat: add bulk plan import endpoint
fix: correct optimistic locking race condition
test: add server API integration tests
docs: update CLI usage examples
```

## Pull Request Process

1. Fork the repository and create a branch from `main`.
2. Make your changes, following existing patterns and code style.
3. Run `bun test` and `bun run typecheck` to verify nothing is broken.
4. Write a clear PR description explaining **what** and **why**.
5. Keep PRs focused — one feature or fix per PR when possible.

## Key Patterns

**Optimistic locking:** Plans and audits use a `version` column. Updates require passing the current version, which is checked atomically with `WHERE id = ? AND version = ?`.

**JSON fields:** `tags` (string array) and `metadata` (object) are stored as JSON text in SQLite. Row types use `string | null`, domain types use `string[]` and `Record<string, unknown>`.

**Database parameter:** All CRUD functions accept an optional `db?: Database` parameter, falling back to the singleton. This enables testing with in-memory databases.

## Secrets

- Never commit `.env` files or database files.
- Keep credentials in your local environment only.
- The `.gitignore` excludes `*.db`, `.implementations/`, and `node_modules/`.
