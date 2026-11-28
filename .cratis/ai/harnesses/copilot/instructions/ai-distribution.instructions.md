---
applyTo: "**/.cratis/**"
paths:
  - "**/.cratis/**"
---
<!-- cratis-ai: generated Copilot instructions. Do not edit; rules/ is the source. -->

# Shared AI Distribution

How the shared Cratis AI corpus reaches a repository, and what a consuming
repository must and must not do with it.

Do not copy or synchronize shared `.cratis/ai`, `.agents`, `.claude`, `.github`, or
`.pi` trees from one Cratis repository to another. A consuming repository must
never become an accidental source that republishes its local AI corpus.

Shared Cratis capabilities are authored and reviewed in `Cratis/AI` and reach a
repository through these channels, each with its own version semantics:

- **`cratis ai install` / `cratis ai update`** copy the corpus into `.cratis/ai/`
  from the current `main` of `Cratis/AI` (or an explicit `--source` path), record
  the source commit and every installed file's hash in `.cratis/ai.manifest.json`,
  and create native harness adapters as symlinks into that managed copy. There is
  no version pin on this channel: an update takes whatever `main` holds. Hooks
  are always installed; rules are filtered by profile and language; skills by
  the profile catalog; `harnesses/<harness>/` only for the harnesses selected.
- **`@cratis/pi`** is a versioned channel: an npm package cut per release,
  pinned and rolled back by package version. It yields to a managed install when
  `.cratis/ai.manifest.json` exists.
- **Native plugin marketplaces** (Claude Code, Codex, Copilot, Cursor) expose the
  skills only, from the unpinned `Cratis/AI` GitHub source.
- **`Cratis/AI.Distribution`** is a separate tag-versioned, deny-by-default public
  evaluation marketplace. It is explicitly unsupported `0.x`, not a supported
  installation channel, and it carries a subset of the skills.

`cratis ai install`, `update` and `uninstall` support `--dry-run`; `--source`
or `CRATIS_AI_SOURCE` supplies a local corpus. Otherwise the CLI shallow-clones
Cratis/AI's default branch and deletes the download after the run. `status`
exits non-zero on local modifications; `--force` does not remove changed owned
MCP entries on uninstall. Consumer extension sections in `.cratis/ai.json` and
hook shebang/execute bits are preserved. Installation creates no model folder.

## Profile-selected MCP servers

`mcp-servers.json` declares MCP launch capabilities for selected profiles. It is
canonical corpus content, not a replacement client configuration and not an
instruction for an assistant to install or execute arbitrary software.

The Cratis CLI owns native client registration and executable hosting. Screenplay
uses `cratis screenplay mcp`, bundled in the CLI; no second global tool install
or startup download is required. Client installation must preserve unrelated
servers, settings and comments, detect conflicts, support dry-run/status, and
remove only unchanged owned entries on uninstall. Unsupported adapters must be
reported explicitly rather than presented as configured.

The CLI registers each server whose profile is selected in the project
configuration of every managed harness: `.mcp.json` for Claude, `.vscode/mcp.json`
for Copilot, `.cursor/mcp.json`, `.codex/config.toml` and OpenCode's config. This
requires Cratis CLI 3.90.0 or later; older CLIs register only Screenplay. Pi uses
the `cratis-mcp` harness extension rather than a config file. Set
`mcpServers.<id>.enabled` to `false` in `.cratis/ai.json` to opt out of one
server. The corpus declares no Chronicle or Studio MCP server. Run
`cratis ai status` to see what was registered.

Project model roots and opt-outs are consumer-owned configuration. Model writes
go through a reviewed proposal that is then applied, and need the user's in-scope
request.

## Preserve consumer ownership

Keep existing repository-local AI files in place while a replacement corpus is
under canary; do not restart legacy all-to-all propagation and do not delete
legacy adapters before reviewed retirement evidence exists.

Shared public product and `engineering-*` packages contain only public-safe
Cratis behavior. The `engineering-` prefix identifies the maintainer audience;
it does not imply confidential package contents or a private registry.

The consuming repository owns its project facts, confidential behavior, local
skills, and minimal host bootstraps. Project-specific context is the repository's own
documentation plus `.cratis/ai/rules/project.md`; `.agents/skills/` holds private or
repository-specific local workflows. Never merge, overwrite, or remove these
local files as a side effect of installing, updating, rolling back, or
uninstalling shared AI capabilities.

Keep confidential and repository-specific behavior local. Generalize and remove
private facts before proposing a reusable improvement to `Cratis/AI`; never
reverse-sync a private repository's AI tree or generated adapters.

Update shared AI through the channel's own mechanism (`cratis ai update`, or the
`@cratis/pi` package version). Canary the change, observe its behavior and gates,
and roll back the same way — by package version where one exists, otherwise by
reinstalling from a known-good source commit with `--source`. Never patch managed
files under `.cratis/ai/`, generated adapters, or marketplace wrappers by hand;
`cratis ai status` reports such drift and `update` refuses it without `--force`.
