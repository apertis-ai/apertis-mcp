# Changelog

All notable changes to `@apertis/mcp-server` are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [0.4.1] — 2026-05-21

### Fixed

- `toolError()` now sets `isError: true` on error results, so MCP clients can
  detect tool failures at the protocol level instead of only by reading the
  error text. Applies to all tools.

## [0.4.0] — 2026-05-21

### Added

- **`delegate` coworker tool** — offload bulk grunt work (bulk file reads,
  boilerplate generation, summarization) to a cheap intern model via the
  Apertis gateway. Files passed in `file_paths` are read locally by the
  server, so their bulk content never enters the calling agent's context, and
  the work runs on Apertis credit instead of your Claude weekly/5-hour limit.
- `APERTIS_COWORKER_MODEL` environment variable to override the intern model
  (default `deepseek-v4-flash`).
- `coworker-rules.md` — a `CLAUDE.md` routing-rules template so agents
  delegate automatically.
- Test suite (unit + integration) runnable via `npm test`.
- npm provenance attestation on published releases, via GitHub Actions CI
  (`publish` on GitHub Release).

## [0.3.0]

### Added

- `recommend_model` tool wrapping `GET /v1/recommend`.

## [0.2.0]

### Added

- All 8 tools working with API-key authentication.

## [0.1.0]

- Initial Apertis MCP Server.
