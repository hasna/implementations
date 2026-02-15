# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install                        # Install dependencies
bun test                           # Run all tests
bun test src/db/plans.test.ts      # Run a single test file
bun run typecheck                  # TypeScript type checking (tsc --noEmit)
bun run build                      # Build all 3 entry points to dist/
bun run dev:cli -- plan add "x"    # Run CLI in dev mode (args after --)
bun run dev:mcp                    # Run MCP server in dev mode
```

## Architecture

This package (`@hasna/implementations`) provides plans, audits, and logs management via three interfaces: a library API, a Commander CLI with Ink TUI, and an MCP server. It mirrors the architecture of `@hasna/todos` (sibling package in `../open-todos`).

### Three Entry Points

- **Library** (`src/index.ts` -> `dist/index.js`): Re-exports all db/search functions and types for programmatic use
- **CLI** (`src/cli/index.tsx` -> `dist/cli/index.js`): Commander program with subcommand groups (`plan`, `audit`, `log`, `projects`, `search`, `export`, `mcp`, `interactive`)
- **MCP Server** (`src/mcp/index.ts` -> `dist/mcp/index.js`): 19 tools + 4 resources over stdio transport

### Data Layer

`src/db/database.ts` provides a singleton `bun:sqlite` instance with WAL mode, `busy_timeout=5000`, and `foreign_keys=ON`. DB path resolution: `IMPLEMENTATIONS_DB_PATH` env var > `.implementations/implementations.db` (local) > `~/.implementations/implementations.db` (global). Schema uses a `_migrations` table for versioned migrations.

Four tables: `projects`, `plans`, `audits`, `logs`. Plans and audits use optimistic locking via a `version` column — updates require passing the current version and increment it atomically with `WHERE id = ? AND version = ?`. Logs are append-only (no versioning).

Each entity module (`plans.ts`, `audits.ts`, `logs.ts`, `projects.ts`) follows the same pattern: a private `rowToX()` function parses JSON string columns (`tags`, `metadata`) from `XRow` to `X` type, and all CRUD functions accept an optional `db?: Database` parameter (falls back to singleton).

### JSON Fields Convention

`tags` (string array) and `metadata` (object) are stored as JSON text in SQLite. Row types have `string | null` for these fields; domain types have `string[]` and `Record<string, unknown>`. The `rowToX()` conversion handles parsing.

### CLI Structure

The CLI uses Commander subcommand groups: `implementations plan add|list|show|update|set-status|delete|search`, `implementations audit add|list|show|update|complete|delete`, `implementations log add|list|tail|show|clear`. Global options: `--project`, `--json`, `--agent`. Auto-project detection uses `git rev-parse --show-toplevel` + `ensureProject()` unless `IMPLEMENTATIONS_AUTO_PROJECT=false`.

MCP registration (`--register claude|codex|gemini|all`) writes to `.mcp.json` (Claude), `~/.codex/config.toml` (Codex), `~/.gemini/settings.json` (Gemini).

### TUI

Ink/React components in `src/cli/components/`. `App.tsx` manages view state (`plans`, `plan-detail`, `audits`, `audit-detail`, `logs`, `projects`, `search`) with keyboard navigation: `p`=plans, `a`=audits, `l`=logs, `P`=projects, `/`=search, `q`=quit.

## Testing

Tests use in-memory SQLite (`IMPLEMENTATIONS_DB_PATH=:memory:`) with `resetDatabase()` + `getDatabase()` in `beforeEach` and `closeDatabase()` in `afterEach`. CLI integration tests spawn `Bun.spawn` subprocesses with temp DB files and `IMPLEMENTATIONS_AUTO_PROJECT=false`.

## Build

The build script runs three separate `bun build` commands (CLI, MCP, library) with strategic `--external` flags to avoid bundling ink/react/chalk into the CLI bundle and `@modelcontextprotocol/sdk` into the MCP bundle. Types are copied from `src/types/index.ts` to `dist/index.d.ts`.

## Key Enums

- Plan statuses: `draft`, `review`, `approved`, `in_progress`, `done`, `archived`
- Audit types: `security`, `performance`, `code_review`, `dependency`, `other`
- Audit statuses: `pending`, `in_progress`, `completed`, `failed`
- Severity levels: `info`, `low`, `medium`, `high`, `critical`
- Log levels: `debug`, `info`, `warn`, `error`
