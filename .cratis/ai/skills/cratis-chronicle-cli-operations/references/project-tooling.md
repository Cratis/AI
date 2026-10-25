<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# CLI updates and project tooling

This complements live-store operations; it does not grant permission to install
servers, change a repository or run quota-consuming agent sessions. Inspect the
installed version with `cratis --version` and its catalog before using a flag.

## Inspect the upgrade, not a remembered bundle

Requires CLI 3.87.0 for offline embedded release notes:

```bash
cratis release-notes --since <version> -o json
cratis release-notes --version <version>
```

`cratis update` displays the skipped releases after its update results. Requires
3.89.0 for `cratis new` to use the template set cached at `~/.cratis/templates`:
first use downloads from NuGet; offline use can reuse a complete cached set.
`cratis new cratis --language csharp --version <version>` selects a version for
one run rather than replacing the installed choice. `cratis update` refreshes
compatible templates without downgrading or failing the CLI update when refresh
fails; `--no-templates` skips it. CLI and template versions are separate. Do not
silently enable scaffold scripts; preserve the template's `--allow-scripts`
choice. Multi-service orchestration still needs explicit per-store settings.

For `cratis render` / `run`, read **cratis-screenplay-render-and-gap-fill** and
**cratis-stage-rendering-and-sandbox**. Their bundled renderer determines support;
a CLI upgrade can change admission, generated output and the default container
without changing the model. Never infer support from the ESM version alone or
edit generated output to make an older CLI accept it.

## Managed AI installation and MCP

Requires CLI 3.77.1 for `.pi/agents` to link to Pi-native corpus adapters when
available, falling back to canonical agents only for older corpora. Do not
hand-edit generated adapters to restore missing tools; update the CLI/corpus.

Requires 3.90.0 for profile-selected servers in the corpus's `mcp-servers.json` to
be registered by `cratis ai install` / `update` in Claude Code, Copilot, Cursor,
Codex and OpenCode. Installation registers configuration; it does not start the
servers. Deselecting/uninstalling removes only unchanged owned entries. Foreign
or modified entries remain conflicts, even with force. Resolve a conflict by
intentionally renaming/removing your entry or disabling that server with
`mcpServers.<id>.enabled = false` in the project configuration; do not overwrite
it speculatively. Pi supports only Screenplay through its native extension and
reports other servers unsupported. An invalid selected descriptor is reported
and skipped; successful guidance installation does not prove MCP availability.
Installing a server does not authorize its tools or commands.

## Deterministic AI checks versus harness behavior

Requires CLI 3.98.0 for opt-in `cratis ai test`. Each fixture × harness uses a
fresh temporary workspace with the fixture's selected profiles/languages; the
invoking repository is unchanged. It is **not** a security sandbox: fixture
commands and harnesses still have host tools/authentication. Trust the source,
request the intended session/budget, and keep transcripts off unless needed.
The default fixture root is `Evaluations/conformance`; `--fixtures` overrides
it, `--fixture` selects names, and `--harnesses claude,codex` narrows adapters.
`--output json` is this command's structured format, not proof of a passing run.

Requires 3.100.0 for install-only CI without a harness, credentials or model quota:

```bash
cratis ai test --source <corpus> --install-only --output json
```

This runs install-phase checks for declared harness ids (or the configured ids
when a fixture declares none), narrowed by `--harnesses`. Result-phase checks
stay `not_run`; no install checks means skipped, not behavioral conformance.
Normal mode rejects missing/modified installations unless corpus-source mode is
selected. `--source`/`CRATIS_AI_SOURCE` selects a trusted local corpus.

Fixtures require a non-optional result check even in install-only mode. File
checks choose one path/glob; an empty glob match fails. Install checks cannot be
commands. A result command uses `run: ["executable", "argument"]` with no implicit
shell and cannot also declare file path/glob/pattern fields. Invalid check shapes
are errors. Paths and links cannot escape the workspace.

A timeout kills the process tree; output is capped. Requested `--timeout` and
`--max-budget-usd` can lower, not raise, fixture limits. Claude enforces a spending
limit; Codex reports that bound `not_enforced`. Missing harnesses/credentials are
skipped with a reason, never passed. Exit 0 can mean all skipped or no selected
runs: inspect counts and `no fixtures ran successfully`. Exit 1 means fixture,
harness or check failures/errors; exit 2 means usage/install errors. Installed
file hashes, observed tool reads and check results are separate evidence levels;
unknown reads remain unknown. `--keep-transcripts` retains best-effort-redacted
temporary output; inspect it for secrets before sharing. Passing install checks
is not proof that an agent read or obeyed the guidance.
