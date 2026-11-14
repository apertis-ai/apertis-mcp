# Changelog

All notable changes to `@apertis/mcp-server` are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [0.4.2] — 2026-11-15

### Fixed

- **Fresh installs crashed at startup** with `The requested module
  '@modelcontextprotocol/server' does not provide an export named
  'StdioServerTransport'`. The `^2.0.0-alpha.2` range now resolves to 2.4.0,
  which moved the transport to the `@modelcontextprotocol/server/stdio`
  subpath. The dependency is pinned to exactly `2.4.0` and the import updated.
  `engines.node` is raised from `>=18` to `>=20` to match that SDK release.
- **Model catalog was truncated.** `list_models` and friends now page through
  `/api/v2/models` (`limit=100`, `offset`) until the gateway reports
  `has_more: false`, with a hard cap of 50 pages that raises an error instead
  of looping forever.
- **`check_quota`, `get_usage_stats` and `list_api_keys` printed `undefined`
  and wrong values.** They now read the fields the gateway returns
  (`remain_quota_usd`, `used_quota_usd`, `total_tokens`, `total_requests`,
  `last_used_at`, ...) and omit any field the gateway does not send. The
  gateway returns no email, and usage totals are all-time for the key, so the
  `period` argument of `get_usage_stats` no longer filters anything.
- **`list_api_keys` said it lists all keys.** The gateway reports only the
  key the server is using, and the tool and the docs now say so.

### Removed

- The `create_api_key` tool. Create API keys in the Apertis dashboard.
- The `@cfworker/json-schema` dependency, which the pinned SDK no longer
  needs.

### Added

- `npm run smoke`: packs the package, installs it into an empty directory with
  an empty npm cache, starts the installed bin and checks `tools/list` over
  stdio. Runs in CI before publish and on every pull request.

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
