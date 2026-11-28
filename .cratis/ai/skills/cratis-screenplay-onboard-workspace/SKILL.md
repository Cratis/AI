---
name: cratis-screenplay-onboard-workspace
description: Use when a modeler needs to initialize an empty .play workspace with the CLI or connect an optional Screenplay MCP client. Not for renaming an existing declaration (use cratis-screenplay-edit-workspace).
compatibility: Requires the Screenplay CLI. A stdio MCP client is optional for proposal review.
---

# Open one application, then review its first document

Locate the configured or existing application model root first; reuse it rather than creating a second model. For a new Library model, use the empty `model/` directory under the application root if the owner has not chosen another root. Substitute the actual model root in the examples below. Keep unrelated models and comparison copies outside it: folder compilation combines all `.play` files beneath the root.

Choose the tool version before writing the model. For standalone authoring use Screenplay 7.0.0. For Stage generation with Cratis CLI 3.154.2 use Screenplay **6.37.0**, the compiler it bundles with Stage 6.4.1. For another renderer, check its released compiler pairing rather than assuming 7.0.0. With the .NET 11 SDK, install the selected version if needed (render pair example: `dotnet tool install --global Cratis.Screenplay.Tool --version 6.37.0`). Confirm `screenplay --version` and, for rendering, `cratis --version`.

**CLI only:** In an empty workspace, create `model/application.play` with these two lines, then run `screenplay model` from its parent:

```play
reaction batches atomic
command reads protected
```

Do not overwrite existing source or change existing modes. Continue with the [first slice](../cratis-screenplay-declare-slice/SKILL.md). Folder compilation is a one-off setup check, not a business spec.

**With MCP:** Choose this path when a client is already available and you want to review a proposal before writing.

1. Configure the client's stdio command as `screenplay` with arguments `mcp` and the **absolute path to `model/`**. Keep approval enabled for writes and recovery.
2. Call `open-workspace` with `applicationName: "Library"`. Confirm the root and retain `revision` and `catalogRevision`. If the workspace already contains documents, inspect its saved identity and documents instead of initializing another application. Opening a workspace is not permission to change it.
3. Call `propose-source` with the returned values as `expectedRevision` and `expectedCatalogRevision`, `formatting: "PreserveExactSource"`, and this `documents` array:

   ```json
   [{"operation":"create-document","stableKey":"application","path":"application.play","source":"reaction batches atomic\ncommand reads protected\n"}]
   ```

   The root preamble selects atomic reaction batches and protected command reads. Don't change an existing application's modes as part of connecting a client. Put each declaration in one owning document; for example, put registration in `model/Authors/registration.play`, restating its module and feature headers there. The directory name alone doesn't establish its model address.
4. Inspect `read-proposal` changes and diagnostics. With read-only access, return the proposal and stop. With explicit approval for the reviewed changes from the requesting user or their named owner, call `apply` with the proposal ID and both expected revisions. If either revision is stale, reopen and review again; don't retry with substituted revisions.
5. Reopen, read the document inventory, and check it includes `application.play`. From the application directory, `screenplay model` must compile the composed folder. This proves the workspace can load, not that a business outcome exists. [Declare the first slice](../cratis-screenplay-declare-slice/SKILL.md) from the agreed timeline.

For an existing Screenplay 5 model with retired slot or outlet forms, [migrate the whole model](references/version-migration.md) before making the requested edit.
