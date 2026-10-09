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

Verified screens-release vector (executed 2026-10-09 against the released
checkout toolchain):

- fixture root: `Source/DotNET/Screenplay.CanonicalCorpus/Corpus/ScreenComposition/v1/source/folder`
  in the Screenplay repository;
- Screenplay repo tool (4.105.0 query-shapes era): `dotnet run --project
  Source/DotNET/Tool -- <corpus-folder> --warnaserror` → exit `0`, `10 file(s)
  compiled - 0 error(s), 0 warning(s)`;
- MCP (`dotnet run --project cli/Source/Cli -- screenplay mcp <corpus-folder>`,
  CLI 3.40.0 bundling Screenplay 4.105.0): `sourceSuccess true`, `semanticSuccess
  true`, `executableReady true`, 10 documents; a scratch `propose-rename`
  transcript proved revision/catalog checks but apply did not complete because
  the target handle contract rejected the supplied target shape;
- render (`dotnet run --project cli/Source/Cli -- render <corpus-folder> --name
  ScreenComposition --destination <dir> -o json`, CLI 3.40.0 / Stage 4.49.1):
  exit `0`, status `published`, `.cratis-render.json`, backend files, `.frontend`,
  `scene.json` and `src/bindings.ts` written. The generated Scene includes Arc
  `commandForm` components and query registrations.

Report a corpus the released compiler or renderer refuses as a capability/version
pairing gap with the exact diagnostics; never soften it to a pass.

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
