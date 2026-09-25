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
`module`, `seed`.

**Inside a module:** `description`, `authorize`, `screen`/`dialog` templates,
`form`, `contribute`, `on`/`uses` behavior attachments, `feature`.

**Inside a feature:** `description`, `authorize`, nested `feature`, `slice`,
`contribute`, `on`/`uses` behavior attachments.

| Slice type | Meaning | Typical contents |
| --- | --- | --- |
| `StateChange` | Change the system | Command, events, validation, constraints |
| `StateView` | Read the system | Read model, projection, query, screen |
| `Automation` | React to something happening | Reaction |
| `Translate` | Translate external data into events | Capture |

Any slice can contain `description`, `file`, `event`, `command`, `query`,
`projection`, `capture`, `reaction`, `screen`, `constraint`, `specification`,
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

## Canonical complete model

The RegisterProject conformance vector is the narrow executable example shared
by downstream tooling. Its source is shipped in `Cratis.Screenplay.CanonicalCorpus`.
At v4.31.0 it compiles with zero diagnostics, binds to ESM v1, and both
specifications pass the reference runner.

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
        produces ProjectRegistered
          for projectId
          projectId = projectId
          name = name
      event ProjectRegistered
        projectId ProjectId
        name ProjectName
      specification RegisteringAProject
        when RegisterProject
          projectId = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
          name = "Screenplay"
        then ProjectRegistered
          projectId = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
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
      query ProjectById => ProjectSummary?
        by projectId ProjectId
      projection ProjectSummaryProjection => ProjectSummary
        from ProjectRegistered key projectId
          name = name
```

## Source validity is not execution

A construct can be in one of four states. Say which one you checked.

| State | What establishes it | What it does not prove |
| --- | --- | --- |
| **Parsed** | `screenplay <folder> --warnaserror` or MCP authoring diagnostics: syntax plus model consistency | Binding, execution, or anything about attached code (the tool never reads `file` attachments) |
| **Bound** | Semantic binding to the executable semantic model (ESM): MCP `executableReady`, executable diagnostics | That the reference execution plan admits the model, or that any specification passes |
| **Reference-executed** | The reference runner passes the specification | Target behavior; opaque code never runs here |
| **Target-executed** | Stage or a rendered application runs it with the implementations supplied | Nothing further in Screenplay |

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

Binding is not the last gate before the reference runner. The runner needs an
execution plan, and the plan is created only when every reachable capability is
admitted. One refused construct blocks the whole plan, so no specification in
the model runs, including specifications that never touch it.

What binds today, what the reference execution plan refuses, what is opaque, and
what blocks binding (Screenplay v4.31.0):

| Disposition | Constructs |
| --- | --- |
| Binds and runs in the reference runner | `StateChange`/`StateView` slices; `produces` including `when` conditions over command properties and literal tags; the portable validation rules, `matches email`, quoted `matches` patterns and `require` over command properties; declarative policies and `authorize` on modules, features, commands and keyed queries; `unique` constraints; projections as Chronicle lowers them, including variants, except the projection constructs in the next row; specifications, including `given caller`, `then denied` and `when append` |
| Binds, but the reference execution plan refuses it | A projection-level `remove via join`; `all` beside removals, `children` or `nested`; a `join`, `children` or `remove via join` inside `nested`; any event-context value other than the event source identity in a projection mapping or key, such as `$eventContext.occurred`, `$eventContext.sequenceNumber` or `$eventContext.causedBy.subject` (`$eventSourceId` and `$eventContext.eventSourceId` run) |
| Binds as opaque code (v3); reference runner reports unsupported | Bodied reducers, bodied named rules, fenced `validate` blocks, code or file policies |
| Blocks binding (`PLAY0268`) | `Automation` and `Translate` slices, reactions (with or without trigger `reads`), captures, top-level `trigger`, `persona`, `@pii`/`@sensitive` concepts, command `handler`, bare `rule <Name>`, `require` or conditions over read-model paths, dates and `today` in comparisons, `$context.tenant`/claims/roles/causation in `produces`, `$env` conditions, `file` constraints, a read model whose keyed queries in its own slice do not share one `by` property (none, or two different properties; several queries over the same property bind), any query other than `=> <ReadModel>?` with one caller-supplied `by` argument (so also observable, filtered, scoped and performer-backed queries), `$causedBy` and templates in projections |
| Blocks binding (`PLAY0271`, legacy meaning) | Command `reads` and `concurrency` |
| Deferred (`PLAY0269`, information) | Screens, layouts, templates, forms, contributions, UI profiles, themes, behaviors and `on`/`uses` |
| Metadata only (`PLAY0270`, information) | `domain`, `seed`, descriptions and `file` provenance on declarations |

The table is a snapshot, not a contract: ask the binder (MCP executable
diagnostics) rather than extrapolating from it. Retain valid source that the
backend cannot represent rather than downgrading it to a stub. The MCP does not
run specifications, compile embedded code, generate an application, or follow
realization files. Stage owns rendering and runtime admission.

## Not in the language yet

Decision 0006 shipped in Screenplay 4.31.0: a reaction trigger may declare
`reads <View> [as <alias>] [by <trigger value>]` (see
`cratis-screenplay-captures-and-reactions`). Reactions still block binding, so
those reads are declared, not enforced.

Screenplay decisions 0007 to 0014 are accepted but not implemented. Do not write
their syntax: affected-instance declarations, per-event data subjects, external event origin, query paging/sorting/change-set delivery, event
generations, a typed context descriptor or command-handler role, code round-trip
equivalence, or typed diagnostic repairs. Model today's syntax and record the
gap in prose or an issue.

## Editor support

Monaco uses `@cratis/screenplay-language`; VS Code uses `cratis.screenplay`.
Neither highlighting nor completion establishes compiler validity. Verify the
complete folder with the compiler after changes, and verify the owning downstream
runtime separately if execution is the goal.
