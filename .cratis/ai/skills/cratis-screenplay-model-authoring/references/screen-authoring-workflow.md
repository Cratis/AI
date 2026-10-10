<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# End-to-end screen authoring workflow

## Contents

- Inputs to keep identical
- 1. Open and discover through MCP
- 2. Propose the multi-file application change
- 3. Review and apply with revision checks
- 4. Validate authoring and executable readiness
- 5. Run/render using the same configuration
- 6. Use Screenplay-owned fixtures
- Edit, render, run and see it in the browser
- Transcript checklist

Use this workflow when an agent must create or iteratively edit the canonical
multi-file Screenplay application and then prove the same source reaches the
runtime/render path. It relies on the existing MCP discovery/proposal/apply loop;
it does not define a parallel persistence or editing API.

## Inputs to keep identical

Record these once and pass the same values to every step:

- model root, application name and source identity;
- selected Screenplay tool (`screenplay mcp` or `cratis screenplay mcp`) and its
  reported version/tool schemas;
- package/catalog source and versions for component packages and icons;
- Stage/CLI render destination and runtime target;
- workspace export path if a host uses `export-workspace` rather than source files.

If any step uses a different root, workspace export, package set or application
name, it is not parity evidence.

## 1. Open and discover through MCP

1. Start the MCP with a fixed root and send `initialize` plus
   `notifications/initialized`.
2. Call `tools/list` and keep the schemas. Do not hard-code the screen node shape.
3. `open-workspace` and keep both source and catalog revisions.
4. Use `describe-application`, `read-workspace view=diagnostics`,
   `search-declarations`, `declaration-details` and `dependencies` to locate the
   target screen, template, form, toolbar and package references.
5. Use `syntax-schema` for every node family you will write: screen directives,
   forms, template configuration, package/icon declarations, toolbar/directive
   nodes and navigation/dialog destinations.

When the node does not exist in the schema, stop at an edit request that names the
missing authoring capability; do not invent text syntax.

## 2. Propose the multi-file application change

Use one coherent `propose-ast` transaction for the slice of UI being changed.
For a new canonical application this usually creates or changes:

- the application/barrel document and imports;
- module/feature/slice documents;
- read models and queries that supply screen data;
- screen declarations with Level 1 data/actions;
- templates, components, forms, toolbar items, outlets and navigation bindings;
- localized `$strings` keys referenced by labels.

Use `referencePolicy: "Safe"` unless unresolved debt is explicitly part of the
accepted model. Structural edits use `CanonicalizeTouchedDocuments`; literal or
mapping-only changes may use `PreserveTrivia`.

## 3. Review and apply with revision checks

Before applying:

- `read-proposal view=changes` and document before/after views;
- check introduced diagnostics and `droppedCommentCount`;
- compare every screen/form/toolbar binding against field lineage;
- reject proposals that silently drop a requested screen directive or package
  setting;
- apply only with the before revisions returned by `open-workspace` / proposal.

After `apply`, discard old handles and revisions. Reopen/read the workspace and
verify the source and identity state changed as expected.

## 4. Validate authoring and executable readiness

Run the whole model folder, not a single file:

```shell
cratis screenplay validate <model-folder> --warnings-as-errors
```

Then read executable diagnostics through MCP. Report separately:

- authoring validation (parsed plus source rules);
- executable readiness (MCP `executableReady` and blocking diagnostics);
- unsupported design-only UI (`PLAY0269` or later equivalent) without treating it
  as a source error.

## 5. Run/render using the same configuration

Rendering and runtime smoke checks use the same root or workspace export from the
MCP step:

```shell
cratis render <model-folder> --name <ApplicationName> --destination <render-dir> -o json
```

When a workspace envelope is the source of truth for the host, use the Stage/CLI
contract for `--workspace` and keep its application identity equal to the source
name. Build/tests/runtime checks are then the V5 steps owned by
`cratis-screenplay-render-and-gap-fill` and `cratis-stage-rendering-and-sandbox`.

For screens-release parity, the smoke check must assert that every authored
screen, template, component, form, toolbar, outlet, route and package/icon use is
represented in the generated plan or runtime diagnostics. A consumer that cannot
implement one reports a blocking diagnostic. Silent fallback to the default screen
composition is a failure.

## 6. Use Screenplay-owned fixtures

The canonical multi-file application belongs to the Screenplay/conformance corpus,
not to the AI corpus. Link to the fixture path and run its published checks; do not
copy those `.play` files into `.cratis/ai/` or into a skill reference as a
maintained duplicate.

Verified public vector and executable checks:

- toolchain: public CLI 3.40.7 (`af9f18e`), whose default runtime is
  `cratis/stage:4.51.1` and which bundles Screenplay 4.114.0. Latest public
  packages are Scene 4.14.0, Screenplay 4.122.0, Stage 4.51.3 and Studio 0.141;
  claims made through `cratis` are 4.114.0 compiler claims;
- fixture root: `Source/DotNET/Screenplay.CanonicalCorpus/Corpus/ScreenComposition/v1/source/folder`
  in the Screenplay repository;
- Screenplay repo tool (available checkout): `dotnet run --project Source/DotNET/Tool
  -- <corpus-folder> --warnaserror` → exit `0`, `10 file(s) compiled - 0 error(s),
  0 warning(s)`;
- stdio MCP protocol harness: the AI repository carries `screenplay-mcp-transcript.ts`;
  run it with packaged `cratis` on `PATH`, `--corpus <corpus-folder>` and
  `--scratch <scratch-folder>`. It sends `initialize`, `tools/list`,
  `open-workspace`, `read-workspace`, `propose-source`, `read-proposal`, stale
  `apply`, real `apply` and `open-workspace` again. It uses a scratch copy,
  changes `application.play` with a comment-preservation probe, fails closed on a
  stale revision, applies with the matching revision and verifies the comment
  remains on disk. On CLI 3.40.7: 9 requests and 9 responses, 37 tools,
  `executableReady true`, stale apply `StaleRevision`, comment preserved;
- render (`cratis render <corpus-folder> --name ScreenComposition --destination
  <dir> -o json`) with CLI 3.40.7 publishes the corpus, and its browser
  acceptance run passes 51 assertions (Cratis/Screenplay#605);
- still refused by design: guarded Close (`STAGE-SCENE-ACTION-001`) and
  double-click (`STAGE-SCENE-INTERACTION-001`); still pending: UI-profile
  rejection and render-then-recover (Cratis/cli#301) and Studio production Play
  proof (test-account decision).

## Edit, render, run and see it in the browser

The loop above proves an agent can change the model. This proves the change
reaches a running application, end to end, on the installed public CLI:

1. Edit through MCP: `screenplay-mcp-transcript.ts --edit work-item-id-column
   --corpus <corpus-folder> --scratch <work>/model` adds `column workItemId label
   "Work item id"` to the `WorkItemList` table in the same revision-checked
   proposal as the comment probe, and requires the reopened workspace to be
   executable-ready.
2. Render the edited folder: `cratis render <work>/model --name ScreenComposition
   --destination <work>/app -o json`, then confirm `scene.json` has the new
   column (`"label":"Work item id","property":"workItemId"`).
3. Run and look: `screenplay-edited-app-browser.ts --model <work>/model` starts
   `cratis run` on that same folder, creates a work item through the generated
   command endpoint, opens `#/WorkItemList` in headless Chromium and requires the
   `Work item id` column header and the new item's id in the table. It needs
   Docker and a resolvable `playwright` (`SCREENPLAY_PLAYWRIGHT_NODE_PATH`); exit
   `0` verified, `1` edit not visible, `2` could not run.

Executed on public CLI 3.41.0 (`a1a9d62`, Stage 4.51.3, bundled Screenplay
4.114.0): 9/9 MCP requests with the column on disk, render `published` with the
column in `scene.json`, and all five browser checks passed against
`cratis/stage:4.51.3`.

Report a corpus the released compiler, MCP server or renderer refuses as a
capability/version-pairing gap with the exact diagnostics; never soften it to a
pass.

When the fixture is not yet published, report the parity checks as blocked by the
fixture contract and continue verifying the independently authored guidance and
routing in this repository.

## Transcript checklist

An MCP transcript is acceptable evidence only when it contains:

- `tools/list` with the version/tool schemas used;
- `open-workspace` revisions;
- discovery calls that found the target declarations;
- `syntax-schema` calls for each new UI node family;
- proposal id, `read-proposal` diagnostics, comment-loss result and before/after
  revisions;
- `apply` with matching revisions;
- post-apply `read-workspace` diagnostics;
- the same root/workspace passed to validate/render/runtime checks.

Store the transcript in `.ai-work/` while working. Do not commit it.
