<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Export, compare and rename from the CLI

Read this when a script or a builder needs a model's executable bytes, the difference between two model versions, or an identity-preserving rename without an MCP session.
Requires Screenplay 6.1.0 or later (`screenplay --version`).

## Export

`screenplay export [PATH] [--format esm] [--scope <Module>[.<Feature>[.<Slice>]]] [--output <path>]`

- `esm` (the default) writes the executable semantic model, byte-identical to `SemanticModelSerializer.Serialize`, including `schemaVersion` and `revision`. `PATH` defaults to the current folder; without `--output` the bytes go to stdout; an identical existing file is left untouched.
- `--scope` keeps one module, feature or slice plus the application-wide declarations (concepts, types, policies, triggers, event sources, lifecycles, graphs). The excerpt's `revision` identifies the excerpt.

| Exit | Meaning |
| --- | --- |
| 0 | Written |
| 1 | No executable model for the sources |
| 2 | Invalid arguments or scope, or unreadable sources |

## Compare two model versions

`screenplay diff <before> <after> [--format text|json]` over `.play` files or folders. It reports added, removed, renamed and moved elements, member changes, event-contract changes (marked `[contract-breaking]`), enumeration changes, specification-outcome changes, and identity changes with their direct dependants.

- Elements match by persisted identity when both folders hold `.screenplay/identities.json` for the same application; otherwise by address. The report says which.
- `--format json` carries `before` and `after` (path, source revision, persisted identities used, model revision) and a `difference` object.
- Exit 0 compared; exit 2 could not run (including identities of two different applications).
- To compare two commits, `git worktree add` each into its own folder and diff the folders.

## Rename

`screenplay rename <address> <new-name> [<folder>] [--kind <Command|EventContract|ReadModel|...>]` is the scriptable form of MCP `propose-rename` plus `apply`: it repairs references across files, keeps the element's semantic identity, pins a renamed event's stored type name with `id`, and writes (creating on the first rename) `.screenplay/identities.json`. Exit 0 renamed, 1 refused, 2 could not run.

## Persisted identities

`test`, `export`, `diff` and `rename` open a folder with `.screenplay/identities.json` when one exists, so the CLI and the MCP server report the same persisted identities the MCP server uses.

- `export` and `diff` refuse a source that drifted from the identities (`IdentityReconciliationRequired`, `IdentityMappingConflict`). Restore the names, then rename through the CLI or MCP.
- `test` falls back to address-derived ids and never refuses; any printed semantic id is accepted by `--filter`. A single file, a folder without identities or a drifted folder use address ids.
