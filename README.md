# @hasna/implementations

Plans, audits, and logs for AI coding agents - CLI + MCP server + interactive TUI + web dashboard

[![npm](https://img.shields.io/npm/v/@hasna/implementations)](https://www.npmjs.com/package/@hasna/implementations)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

## Install

```bash
npm install -g @hasna/implementations
```

## CLI Usage

```bash
implementations --help
```

## MCP Server

```bash
implementations-mcp
```

24 tools available.

## REST API

```bash
implementations-serve
```

## Cloud Sync

This package supports cloud sync via `@hasna/cloud`:

```bash
cloud setup
cloud sync push --service implementations
cloud sync pull --service implementations
```

## Data Directory

Data is stored in `~/.hasna/implementations/`.

## License

Apache-2.0 -- see [LICENSE](LICENSE)
