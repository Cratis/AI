## Generated values and responses (ESM v7)

A `generated` command property and a `returns` response bind and execute from the standalone
`screenplay` 4.68.0 (ESM v7, decision 0026; `commands.md` "Generated values and responses" at
`v4.68.0`). The cratis CLI 3.28.3 bundles 4.66.0 and reports `PLAY0268` for them, and Stage 4.24.2
refuses ESM v7 with `STAGE-ESM-016` (tracked in Stage#201), so a command that uses them is
**not rendered yet**: hand-write it (gap-fill) with the model as the contract. Complete compiled example:
`cratis-screenplay-toolchain` `references/generated-responses-example.md`.

```screenplay excerpt
command RegisterProject
  projectId ProjectId generated identifier
  receiptId ReceiptId generated
  name ProjectName
  returns
    projectId = projectId
    receiptId ReceiptId = receiptId
```

Rules (all read at `v4.68.0`):

- `generated` is command-only and needs a required, scalar concept backed by `Uuid` (not bare `Uuid`, not
  optional, not a collection). Modifier order is `Type optional generated identifier`.
- A generated value is not a request input, form field, invocation argument or ordinary specification value.
  The command runs authorization and validation first, then generates, then productions and the response, so
  authorization policies (also inherited and the implicit `subject` of a generated identifier), property rules
  and requirements cannot reference one (`PLAY0273`), and a concept with any validation rule cannot back a
  generated property (`PLAY0268`). Reactions map request inputs only.
- `returns <property>` is a scalar response; bare `returns` opens an ordered record of `<name> [<Type>] = <property>`
  fields over direct properties of this command. A type annotation must equal the source's type and
  optionality. Collections, read aliases, arithmetic and whole read models are not supported. At most one
  unconditional response, as a command sibling.
- A two-token `returns name` is a response when `name` is another property of this command; otherwise it is a
  property named `returns`. `returns @name` forces a response, `@returns Type` a property.
- A response exists only on acceptance. Rejection, denial or an unsupported outcome has none; a later reaction or
  scenario-query failure keeps the accepted facts and clears the response. A response-only command records no
  facts. Field names are an external contract: renaming one changes the revision.
- A generated identifier is the implicit destination of inline productions. A plain `produces` without `for` keeps
  its own allocation channel and a generation fixture never satisfies it.
- Generated values give no idempotency, retry or deduplication guarantee. Specifications supply fixtures and assert
  the response: `cratis-screenplay-specifications`.

Other decision 0023 constructs are still **authorable, never executable** (binding reports `PLAY0268`, so
they stop a model at V1): operations, and named event sources and streams with command routes
(`eventsource`, `stream`, `streamId`). **No supported ESM version admits them**, and they have no version number
yet (decision 0025 numbers a version only at its release-ready admission). Syntax or MCP acceptance is not proof of
execution. A model using sources, streams or routes can be authored and validated, but
not bound, run or rendered; hand-write the code with the model as contract
(`cratis-screenplay-toolchain` `references/sources-and-streams.md`). `derive` and `provide` have no documented syntax at that tag; treat them as
planned and do not write them.

