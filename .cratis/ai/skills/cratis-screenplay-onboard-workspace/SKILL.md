---
name: cratis-screenplay-onboard-workspace
description: Use when a modeler needs to initialize an empty .play workspace and connect a Screenplay MCP client to its application root. Not for renaming an existing declaration (use cratis-screenplay-edit-workspace).
compatibility: Requires the Screenplay CLI and a stdio MCP client for proposal review.
---

# Open one application, then review its first document

Start with the directory the application owner intends to use for model source. For Library, create an empty `model/` under the application root. Keep unrelated models and comparison copies outside it: folder compilation combines all `.play` files beneath the root.

1. Install `Cratis.Screenplay.Tool` with `dotnet tool install --global Cratis.Screenplay.Tool --version 7.0.0` if needed (.NET 11 SDK; put the global tools directory on `PATH`). Confirm `screenplay --version`. Configure the client's stdio command as `screenplay` with arguments `mcp` and the **absolute path to `model/`**. Keep approval enabled for writes and recovery.
2. Call `open-workspace` with `applicationName: "Library"`. Confirm the root and retain `revision` and `catalogRevision`. If the workspace already contains documents, inspect its saved identity and documents instead of initializing another application. Opening a workspace is not permission to change it.
3. Call `propose-source` with the returned values as `expectedRevision` and `expectedCatalogRevision`, `formatting: "PreserveExactSource"`, and this `documents` array:

   ```json
   [{"operation":"create-document","stableKey":"application","path":"application.play","source":"reaction batches atomic\ncommand reads protected\n"}]
   ```

   The root preamble selects atomic reaction batches and protected command reads. Don't change an existing application's modes as part of connecting a client. Put each declaration in one owning document; for example, put registration in `model/Authors/registration.play`, restating its module and feature headers there. The directory name alone doesn't establish its model address.
4. Inspect `read-proposal` changes and diagnostics. With read-only access, return the proposal and stop. With explicit approval for the reviewed changes, call `apply` with the proposal ID and both expected revisions. If either revision is stale, reopen and review again; don't retry with substituted revisions.
5. Reopen, read the document inventory, and check it includes `application.play`. From the application directory, `screenplay model` must compile the composed folder. This proves the workspace can load, not that a business outcome exists. [Declare the first slice](../cratis-screenplay-declare-slice/SKILL.md) from the agreed timeline.
