<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Managed publication and recovery

Ownership is the destination's `.cratis-render.json` manifest: semantic revision,
identity, path and SHA-256 per artifact, not in-file markers. Interrupted commits
are journaled in `.cratis-render/` (journal, staging, backups). Never stage that
control directory; commit the manifest with generated output.

- An unmanaged file at a planned path is refused, even with `--force`.
- A modified managed file is refused unless still active and `--force` is given.
  Force replaces it, never overwrites unmanaged files and never deletes modified
  stale files. Stale files are removed only when their bytes still match.
- Recovery precedes planning. `recovered: true` means stop and reconcile: the
  publication receipt does not describe what recovery changed.
- An unchanged re-render writes nothing; `unchanged` equals the artifact count.
- Use exclusive destination access. A receipt is a filesystem result, not a Git
  commit; rendering creates no branch, commit or PR.
- Probe drift with `cratis render ... --check` (exit 6 means pending changes).
  Otherwise compare manifest `semanticRevision` for the same `--name` and inputs.
  Do not compare MCP `modelRevision`: application identities can differ.

A modified managed file reports:

```text
Managed artifact 'Program.cs' was modified by the user; pass --force to replace it.
```

Find why it changed, move intent into the model or `Customizations/`, then
re-render. Use `--force` only to discard that edit deliberately.
