<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Screenplay language reference for authoring

The `.play` source is plain UTF-8 text. Nesting is indentation-based, without
braces or terminators. A construct owns the content indented beneath it. `//`
starts a comment; escape reserved words inside a block with a leading `@`.

## Accepted constructs

**Top level:** `domain`, `import`, `concept`, `type`, `policy`, `persona`,
`authentication`, `module`, `seed`, `trigger`, `ui profile`, `theme`, `layout`.

**Inside a module:** `description`, `screen`/`dialog` templates, `form`,
`contribute`, `feature`.

**Inside a feature:** `description`, nested `feature`, `slice`, `contribute`.

| Slice type | Meaning | Typical contents |
| --- | --- | --- |
| `StateChange` | Change the system | Command, events, validation, constraints |
| `StateView` | Read the system | Read model, projection, query, screen |
| `Automation` | React to something happening | Reaction |
| `Translate` | Translate external data into events | Capture |

Any slice can contain `description`, `event`, `command`, `query`, `projection`,
`capture`, `reaction`, `screen`, `constraint`, `specification`, `readmodel` and
`reducer`. An unknown slice construct is only a warning and its block is skipped;
never accept a warning-free claim without compiling the entire document set.

Concept primitives are `Uuid`, `String`, `Int`, `Decimal`, `Bool`, `Date`,
`DateTime` and `Enum`. Enum members are indented below their concept. Concepts
can carry `@pii`, `@sensitive`, reasons and validation.

Projections and captures use their dedicated sub-grammars. Query the MCP's
`syntax-schema` instead of inventing JSON members or translating names from
memory.

## Canonical complete model

The RegisterProject conformance vector is the narrow executable example shared
by downstream tooling. Its source is shipped in `Cratis.Screenplay.CanonicalCorpus`.

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

The parser accepts more than ESM v1 can execute. Automation/translation slices,
imports, policies, personas, triggers, authorization, opaque handlers and many
advanced query/projection forms may be valid source but unsupported by the
backend. Authoring must retain that source rather than downgrade it to a stub.

Check `sourceSuccess`/authoring diagnostics and `executableReady`/backend
diagnostics separately. The MCP does not run specifications, compile embedded
code, generate an application or follow external realization files. Stage owns
rendering and runtime admission.

## Editor support

Monaco uses `@cratis/screenplay-language`; VS Code uses `cratis.screenplay`.
Neither highlighting nor completion establishes compiler validity. Verify the
complete folder with the compiler after changes, and verify the owning downstream
runtime separately if execution is the goal.
