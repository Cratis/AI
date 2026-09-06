---
name: cratis-screenplay-model-authoring
description: Author and verify a Cratis Screenplay `.play` event model — the file shape, the constructs the compiler actually accepts, the `screenplay` dotnet tool, and the gap between what parses and what any downstream runtime admits. Use when writing, reviewing, or compiling a `.play` file, or when deciding whether a construct is safe to model. Do not use for rendering a model into an application, and do not use for hand-written Arc or Chronicle C#.
license: MIT
---

# Author a Screenplay `.play` model

Screenplay is a declarative, indentation-based language that describes a whole
event-sourced CQRS system in one document set: concepts, events, commands,
queries, projections, screens and specifications. This repository owns the
language and its compiler front end.

⚠️ **Screenplay is experimental, and it is a front end.** It parses, validates
and prints `.play` source, and binds a deliberately narrow subset to a versioned
executable semantic model. **It does not generate, render or run an
application.** Nothing in it emits C#, TypeScript or any target artifact — that
is Stage's job, and Stage admits less than Screenplay parses. Author against that
reality, not against the ecosystem diagram.

## Verified product sources

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Screenplay` | `4.12.1` | The compiler: parser, syntax tree, validator, diagnostics, printer, semantic model |
| `Cratis.Screenplay.Tool` | `4.12.1` | The `screenplay` dotnet tool |
| `Cratis.Screenplay.CanonicalCorpus` | `4.12.1` | The frozen `RegisterProject` conformance vector downstream tools verify against |

Behavior below is read from the repository at revision `7e2d91d`. Reverify before
claiming another version behaves the same.

## Verify a model

```shell
dotnet tool install -g Cratis.Screenplay.Tool
screenplay                      # or: screenplay path/to/model
```

The tool takes **one positional argument** — a directory or a single `.play`
file, defaulting to the current directory — plus `--no-color` and
`--warnaserror`. That is the entire surface: no verbs, no `--help`, no
`--version`, and no output or emit flag.

⚠️ **It only verifies. It never writes anything.** A tool invocation that appears
to have "generated" something did not.

A directory is compiled as **one application**, recursively over `**/*.play`, so
a name declared in one file resolves from another. A single file is compiled
alone. Exit code is `1` when there is any error, or any warning under
`--warnaserror`; otherwise `0`. Diagnostics print compiler-style with the
offending line and a caret:

```text
<file>(<line>,<column>): error PLAY0042: <message>
   42 | <the offending line>
      |        ^
```

Codes run `PLAY0001` through `PLAY0276`. Embed the same compiler with
`dotnet add package Cratis.Screenplay`.

## The file shape

Plain text, UTF-8, `.play`. Nesting is by **indentation** — no braces, no
terminators. A construct owns everything indented beneath it. `//` starts a
comment. Reserved words inside a block are escaped with a leading `@`.

## What the compiler accepts

These are the constructs the parser dispatches on, not a documentation summary.

**Top level:** `domain`, `import`, `concept`, `type`, `policy`, `persona`,
`authentication`, `module`, `seed`, `trigger`, `ui profile`, `theme`, `layout`.
Anything else is `Unexpected '<word>' at the top level`.

**Inside `module`:** `description`, `screen` (a screen template), `dialog` (a
dialog template), `form`, `contribute`, `feature`.

**Inside `feature`:** `description`, `feature` (nested to any depth), `slice`,
`contribute`.

**`slice <Type> <Name>`** takes one of four types — an unknown one is
`Unknown slice type '<x>' - expected StateChange, StateView, Automation or
Translate`:

| Slice type | What it models | Constructs it carries |
| --- | --- | --- |
| `StateChange` | something changes the system | `command` → `event` via `produces`, with `validate`, `authorize`, `constraint` |
| `StateView` | something reads the system | `readmodel`, `projection`, `query`, `screen` |
| `Automation` | something runs when something happens | `reaction` |
| `Translate` | outside data becomes events | `capture` |

**Inside any slice:** `description`, `event`, `command`, `query`, `projection`,
`capture`, `reaction`, `screen`, `constraint`, `specification`, `readmodel`,
`reducer`. An unrecognised word here is a **warning**, not an error, and its
block is skipped — a typo can silently drop a whole construct, so treat slice
warnings as failures.

A `concept` is based on one of `Uuid`, `String`, `Int`, `Decimal`, `Bool`,
`Date`, `DateTime`, or `Enum` with its values indented beneath. Concepts carry
`@pii` and `@sensitive` attributes and their own `validate` block, and every use
of the concept inherits them.

Projections are written in the Projection Declaration Language and captures in
the Change Data Capture Language; both are sub-grammars of the same file, parsed
by dedicated parsers rather than passed through as text.

## A complete model

This is the canonical conformance vector — the smallest complete program the
whole toolchain is verified against, quoted from
`Screenplay.CanonicalCorpus`'s `RegisterProject` source:

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

The same corpus ships as a NuGet package precisely so downstream tools verify
against these exact bytes. When in doubt about a construct's shape, start from
this file rather than from prose.

The repository's own showcase, `invoicing.play`, is a 981-line file that parses
with zero diagnostics and is pinned by 120 assertions. It is the
best available reference for the wider language — policies, personas,
authentication providers, composite `type` declarations, PDL joins, CDL captures,
screens and triggers.

## The boundary that matters: parsed is not admitted

The parser accepts far more than anything can execute or render. Between the
syntax tree and any runtime sits the **executable semantic model (ESM v1)**, and
it fails closed.

⚠️ `SemanticSliceKind` has exactly two members, `StateChange` and `StateView`.
An `Automation` or `Translate` slice is rejected outright with
`Slice '<name>' of type '<type>' is not admitted by ESM v1.` It parses, it
validates, and it binds to nothing.

Around forty further constructs bind to an `UnsupportedSemanticSyntax` error
rather than a weaker model — imports, policies, personas, triggers, `authorize`,
imperative `handler` bodies, code-backed `validate` rules, conditional
`produces … when`, query filters and performers, non-`by` queries, non-scalar
query results, `@pii`/`@sensitive` concepts, non-direct projection mappings,
parent keys and `sequence` among them.

The repository states the admitted set plainly: *"The minimum evaluator currently
admits the RegisterProject-style vertical: `not empty` validation, unconditional
event production, one affected read-model instance, optional snapshot lookup, and
exact ordered specification results. Unsupported reachable capabilities block
plan creation rather than producing a partial or stubbed execution."*

So: model the wider language when the `.play` file is the artifact you want —
documentation, review, a shared description of a system. Stay inside the
RegisterProject vertical when the model has to reach a runtime. Never assume a
construct works downstream because `screenplay` reported no diagnostics.

## Editor support

The language service ships two ways: the Monaco package
`@cratis/screenplay-language`, and the VS Code extension `cratis.screenplay`
(marketplace id `cratis.screenplay`), which is the same service plus a `.play`
file icon.

⚠️ Its keyword list has drifted from the parser. `theme`, `ui`, `form`,
`contribute`, `dialog` and `reducer` appear nowhere in the Monaco package,
although all six are real constructs the compiler accepts. They get no
highlighting and no completion. Absent highlighting is not evidence that a
construct is wrong — check `screenplay` instead.

The repository's TypeScript workspaces are **not** built, linted or tested by any
pull-request workflow; they run only inside the release job. Do not read a green
pull request as evidence the language service still compiles.

## Verify

- `screenplay <model>` reports zero errors **and** zero warnings — an unknown
  slice construct is only a warning and silently drops its block.
- Every name referenced across files resolves when the whole folder is compiled,
  not just the file being edited.
- Concepts carrying personal data declare `@pii` with a reason, so the
  classification travels with every use.
- If the model is meant to reach a runtime, every slice is `StateChange` or
  `StateView` and stays inside the admitted vertical.
- Specifications express the intended behavior, including the rejection cases.

## Route near misses

- Turning a model into an application, or the runtime sandbox:
  `cratis-stage-rendering-and-sandbox`.
- Designing an event model as a diagram rather than as a `.play` file:
  `cratis-event-model-diagram`.
- Writing the Chronicle projections, reactors or read models by hand: the
  Chronicle guidance.
- Writing the Arc commands and queries by hand: `cratis-arc-command`.
