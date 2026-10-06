<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Screenplay language reference for authoring

The `.play` source is plain UTF-8 text. Nesting is indentation-based, without
braces or terminators. A construct owns the content indented beneath it. `//`
starts a comment; escape reserved words inside a block with a leading `@`.
The grammar in `Documentation/screenplay/grammar.md` of the Screenplay
repository is the full list; this page is the authoring summary.

## Accepted constructs

**Top level:** `domain`, `import`, `concept`, `type`, `policy`, `persona`,
`authentication`, `trigger`, `theme`, `layout`, `ui profile`, `behavior`,
`module`, `seed`, and the syntax-only `system` and `eventsource` (with its `stream`s).

**Inside a module:** `description`, `authorize`, `import "<glob>"`,
`screen`/`dialog` templates, `form`, `contribute`, `on`/`uses` behavior
attachments, `feature`.

**Inside a feature:** `description`, `authorize`, `import "<glob>"`, nested
`feature`, `slice`, `contribute`, `on`/`uses` behavior attachments.

**Files (v4.48.0).** `import "<path or glob>"` - quoted - imports `.play` files
relative to the importing file; unquoted, `import` still names a contract from
another bounded context. At the top level it brings in whole documents. Inside a
`module` or `feature` it places each imported file there, and that file's top
level is the module's or feature's body, alongside any application-level
declarations it makes. A file matched by several imports is imported once, at the
deepest placement; conflicting placements (`PLAY0457`), cycles (`PLAY0458`) and
imports that match nothing (`PLAY0455`, `PLAY0456`) are reported where the import
is written. `screenplay <file>` compiles the application that file is the root
of; `screenplay <folder>` treats every file as a root and still places what the
imports place. The VS Code extension validates a workspace folder the same way,
as one application.

| Slice type | Meaning | Typical contents |
| --- | --- | --- |
| `StateChange` | Change the system | Command, events, validation, constraints |
| `StateView` | Read the system | Read model, projection, query, screen |
| `Automation` | React to something happening | Reaction |
| `Translate` | Translate external data into events | Capture |

Any slice can contain `description`, `file`, `event`, `command`, `query`,
`projection`, `capture`, `reaction`, `operation` (syntax-only), `screen`, `constraint`, `specification`,
`readmodel` and `reducer`. An unknown slice construct is only a warning
(`PLAY0029`) and its block is skipped; never accept a warning-free claim without
compiling the entire document set.

Concept primitives are `Uuid`, `String`, `Int`, `Decimal`, `Bool`, `Date` and
`DateTime`; `Enum` is a separate concept kind whose members are indented below
it. Concepts can carry `@pii`, `@sensitive`, reasons and validation.

Projections and captures use their dedicated sub-grammars. Inline code uses a
tagged fence (` ```csharp `); the older language-line form still parses with
warning `PLAY0397`. Query the MCP's `syntax-schema` instead of inventing JSON
members or translating names from memory.

## Complete model

This registration model uses an inline event and context identity rather than
copying the identifier into payload. It was compiled at main `fd18129` with zero
source diagnostics and recompiled with standalone 4.66.0 `--warnaserror`; neither
check runs its specifications. Inline lowering
and `optional` spelling do not themselves select a newer ESM version.

```screenplay
concept ProjectId : Uuid
concept ProjectName : String
module Projects
  feature Registration
    slice StateChange RegisterProject
      command RegisterProject
        projectId ProjectId identifier
        name ProjectName
        validate
          name not empty message "Project name is required"
        produces event ProjectRegistered
          name ProjectName = name
      specification RegisteringAProject
        when RegisterProject
          projectId = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
          name = "Screenplay"
        then ProjectRegistered
          for "3fa85f64-5717-4562-b3fc-2c963f66afa6"
          name = "Screenplay"
        then readmodel ProjectSummary
          projectId = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
          name = "Screenplay"
        then query ProjectById
          arguments
            projectId = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
          result
            projectId = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
            name = "Screenplay"
      specification RejectingAnEmptyProjectName
        when RegisterProject
          projectId = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
          name = ""
        then error "Project name is required"
    slice StateView ProjectLookup
      readmodel ProjectSummary
        projectId ProjectId
        name ProjectName
      query ProjectById => ProjectSummary optional
        by projectId ProjectId
      projection ProjectSummaryProjection => ProjectSummary
        from ProjectRegistered
          projectId = $eventSourceId
          name = name
```

## Source validity is not execution

A construct can be in one of four states. Say which one you checked.

| State | What establishes it | What it does not prove |
| --- | --- | --- |
| **Parsed** | `screenplay <folder> --warnaserror` or MCP authoring diagnostics: syntax plus the model-consistency checks (`PLAY0282`-`PLAY0294`, for example a specification event that no producer can emit, `PLAY0285`) | Binding, execution, or anything about attached code. It never binds, so it cannot report `PLAY0268`, and the tool never reads `file` attachments |
| **Bound** | Semantic binding to the executable semantic model (ESM): MCP `executableReady`, executable diagnostics | That the reference execution plan admits the model, or that any specification passes |
| **Reference-executed** | The reference runner passes the specification (library only: no MCP tool and no `screenplay` command runs it) | Target behavior; opaque code never runs here |
| **Target-executed** | Stage or a rendered application runs it with the implementations supplied | Nothing further in Screenplay |

Map the states onto the verdicts of `cratis-screenplay-modeling-lifecycle`:
Parsed is V1 (authorable); Bound is V2 (executable diagnostics read) and V3
(binding-ready, zero executable errors); Reference-executed is V4; Target-executed
is V5, reported as admission, publication, build and tests separately. A verdict
you did not run is "not run" with the reason, never implied by a lower one. MCP
`readiness.executableReady` can be true while executable diagnostics still hold
information entries (`PLAY0269`, `PLAY0270`).

The ESM version is selected by what a model uses, never by the author:

- **v1** is the default.
- **v2** is selected by typed event-source facts: `produces … for <identifier>`
  when the event does not repeat the identifier, `for` values in specifications,
  and `$context.occurred` or caller identity in `produces`.
- **v3** is selected by implementation attachments: a reducer whose rules all
  have bodies, a named `rule` with a body, a fenced `validate` block, or a
  `policy` implemented in code or a file. They bind as opaque requirements with
  capability `pure`. The reference runner returns `SemanticUnsupported` whenever
  it would need one, so a specification that depends on one never passes.
- **v4** represents complete event generations, with one contract identity and
  distinct revision property identities. Historical declarations are not migration
  implementations; a target without migration support must reject the contract.
- **v5** adds keyed read-model absence assertions (`then no readmodel`).
- **v6** (Screenplay 4.61 and later; v4.66.0 `Versions.cs`) admits reactions,
  captures, application triggers and the clock, hence `Automation` and
  `Translate` slices. The Cratis CLI 3.28.2 bundles Screenplay 4.66.0 and binds them;
  3.27.1 and earlier bundled 4.60.1 (ESM 5 at most), where these constructs failed
  binding with `PLAY0268`. Name the tool
  with every bound result; `cratis-screenplay-toolchain` (`references/versions.md`)
  holds the per-tool table.

Inline events lower to slice-owned standalone contracts and preserve equivalent
canonical bytes. Event `description`, `documentation` and rename-only `id` are
authoring metadata, not new ESM bytes or replacements for catalog identity.

Binding is not the last gate before the reference runner. The runner needs an
execution plan, and the plan is created only when every reachable capability is
admitted. One refused construct blocks the whole plan, so no specification in
the model runs, including specifications that never touch it.

What binds today, what the reference execution plan refuses, what is opaque, what is
authorable but not executable, and what blocks binding. The snapshot comes from the
v4.31.0 table, re-read against v4.66.0 documentation and probed through the MCP of
the standalone 4.66.0 tool for the rows marked "probed"; Cratis CLI 3.28.2 bundles the
same Screenplay 4.66.0 (3.27.1 and earlier, Screenplay 4.60.1, differ where stated).

| Disposition | Constructs |
| --- | --- |
| Binds and runs in the reference runner | `StateChange`/`StateView` slices; `produces` including `when` conditions over command properties and literal tags; the portable validation rules, `matches email`, quoted `matches` patterns and `require` over command properties; declarative policies and `authorize` on modules, features, commands and keyed queries; `unique` constraints; projections as Chronicle lowers them, including variants, except the projection constructs in the next row; specifications, including `given caller`, `then denied` and `when append` |
| Binds, but the reference execution plan refuses it | A projection-level `remove via join`; `all` beside removals, `children` or `nested`; a `join`, `children` or `remove via join` inside `nested`; any event-context value other than the event source identity in a projection mapping or key, such as `$eventContext.occurred`, `$eventContext.sequenceNumber` or `$eventContext.causedBy.subject` (`$eventSourceId` and `$eventContext.eventSourceId` run) |
| Binds as ESM v6 on Screenplay 4.66.0, standalone and Cratis CLI 3.28.2 (probed); `PLAY0268` on Cratis CLI 3.27.1 and earlier | `Automation` and `Translate` slices, reactions that produce or invoke, captures, top-level `trigger`, clock, trigger and capture specifications. The library reference runner evaluates them (v6 actions); no `screenplay` command or MCP tool runs it, and Stage 4.24.1 renders none of them (the whole automation is gap-fill) |
| Reaction with trigger `reads` | Direct-producing (or code-bodied) reaction with `reads`: `PLAY0268` ("ESM v6 cannot protect that decision dependency", decision 0006), non-executable. Invokes-only reaction with `reads`: information only; the invoked command must declare and protect its own decision reads. Keep the `reads`; never remove them to obtain binding |
| Binds as opaque code (v3); reference runner reports unsupported | Bodied reducers, bodied named rules, fenced `validate` blocks, code or file policies. A pure reducer body is the only attachment Stage 4.24.0 admits |
| Information only, never blocks (probed) | `persona` (report-only: `PLAY0270`, the policies it lists must exist), `authentication`, `domain`, `seed`, descriptions and `file` provenance. A persona does not block binding and does not change behavior, so state persona scope in a description or a policy the model uses |
| Authorable, not executable (`PLAY0268`, probed) | `generated` properties and `returns` responses (allocated ESM v8), `system` and `operation` (v9), `eventsource` and `stream` (allocated, not implemented; see `cratis-screenplay-toolchain` `references/sources-and-streams.md`). The MCP reads and edits them (`declaration-details`, `find-fixtures`, `read-workspace` views `event-sources`/`event-streams`/`command-routes`) with `executionAvailable: false`. Keep them in the model as intent; do not strip them to make the model bind, and do not call the model executable |
| Blocks binding (`PLAY0268`) | `@pii`/`@sensitive` concepts (probed: "compliance attributes require portable data-subject semantics"), command `handler` (never binds; a command cannot declare both `produces` and `handler`, `PLAY0035`), bare `rule <Name>`, `require` or conditions over read-model paths, dates and `today` in comparisons, `$context.tenant`/claims/roles/causation in `produces`, `$env` conditions, `file` constraints, unquoted `import` of an external contract, a read model whose keyed queries in its own slice do not share one `by` property (none, or two different properties; several queries over the same property bind), any query other than `=> <ReadModel> optional` with one caller-supplied `by` argument (so also observable, filtered, scoped and performer-backed queries), `$causedBy` and templates in projections |
| Blocks binding (`PLAY0271`, legacy meaning) | Command `reads` and `concurrency` |
| Deferred (`PLAY0269`, information) | Screens, layouts, templates, forms, contributions, UI profiles, themes, behaviors and `on`/`uses` |
| Metadata only (`PLAY0270`, information) | `domain`, `seed`, `persona`, trigger and other descriptions, and `file` provenance on declarations |

The table is a snapshot, not a contract (rows without "probed" are carried from
v4.31.0 and v4.66.0 documentation): ask the binder (MCP `executable-diagnostics`
view) rather than extrapolating from it. Neither `screenplay` nor
`cratis screenplay validate` binds, so a clean validation says nothing about this table. Retain valid source that the
backend cannot represent rather than downgrading it to a stub. The MCP does not
run specifications, compile embedded code, generate an application, or follow
realization files. Stage owns rendering and runtime admission.

## Not in the language yet

Decision 0006 shipped in Screenplay 4.31.0: a reaction trigger may declare
`reads <View> [as <alias>] [by <trigger value>]` (see
`cratis-screenplay-captures-and-reactions`). At v4.66.0 a direct-producing
reaction with `reads` fails binding (`PLAY0268`); an invokes-only reaction reports
the reads as information, and the invoked command must protect its own
dependencies. On Cratis CLI 3.27.1 and earlier every reaction failed binding.

Do not infer availability from an accepted decision. Event generations and typed
diagnostic repairs now exist; see the event and MCP references rather than the
old blanket claim that decisions 0011–0014 are unimplemented. Generations describe
full historical shapes, not deployed-schema immutability or a working migrator.
Code attachment/source-map support likewise does not prove code round-trip
execution equivalence.

Decision 0023's generated values and `returns`, operations and named event
sources/streams are **authorable** at v4.66.0 (syntax only, see the table above and
`commands.md`, `operations.md`, `event-sources.md` in the Screenplay documentation):
write them, but binding reports `PLAY0268` and nothing executes them until
the allocated ESM versions are implemented (the highest implemented is v6). Do not drop them for the sake of a green bind.
Protected reads and `derive`/`provide` (allocated v11) have no documented syntax at
v4.66.0: do not teach or invent one. Affected-instance declarations, per-event data
subjects, external event origin and query paging/sorting/change-set delivery also
remain unavailable here.

`Type optional` is canonical for admitted type references; `Type?` remains
compatible with information `PLAY0479`. The modifier follows `[]` for an optional
collection. It changes no `IsOptional` meaning or ESM bytes. Keep the exceptional
one-shot result `query Q => observable?` when the type itself is named
`observable`: `observable optional` would be parsed as a live result of a type
named `optional`. Screen data, behavior parameters, concept bases and
`reads X optional` do not accept optionality.

## Editor support

Monaco uses `@cratis/screenplay-language`; VS Code uses `cratis.screenplay`.
Neither highlighting nor completion establishes compiler validity. Verify the
complete folder with the compiler after changes, and verify the owning downstream
runtime separately if execution is the goal.
