# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-15

### Added

- Initial open-source release
- SQLite data layer with WAL mode and versioned migrations
- Plans CRUD with optimistic locking and 6 statuses (draft, review, approved, in_progress, done, archived)
- Audits CRUD with optimistic locking, 5 types, 4 statuses, and 5 severity levels
- Logs CRUD with append-only semantics and 4 log levels
- Projects CRUD with auto-detection via git
- Cross-entity search across plans and audits
- Commander CLI with subcommand groups (plan, audit, log, projects, search, export, mcp)
- Ink/React interactive TUI with keyboard navigation
- MCP server with 19 tools and 4 resources over stdio transport
- MCP registration for Claude Code, Codex CLI, and Gemini CLI
- Web dashboard with React 19, Tailwind CSS 4, and Radix UI components
- TanStack tables with sorting, filtering, and pagination
- Create/delete dialogs for plans, audits, and logs
- Stats cards with aggregate counts
- Dark/light/system theme support
- Bun HTTP server with REST API and static dashboard serving
- 112 tests (unit + integration + server API tests)
- Apache-2.0 license
