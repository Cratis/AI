## Generated values and responses (ESM v7)

A `generated` command property and `returns` response bind and reference-execute
as ESM v7. Current pins are standalone Screenplay 4.125.0 and CLI 3.41.0
(bundled Screenplay 4.114.0/Stage 4.51.3); `cratis-screenplay-toolchain`
`references/versions.md` owns the table. CLI#261 is closed: CLI now admits v7
to Stage planning, but its v7 canonical corpus receives Stage generated-value
and response refusals STAGE-ESM-028/029. Do not turn this into a blanket compiler
refusal or promise a render from binding alone. Preserve the contract for gap-fill
where admission refuses. Historical rules below were read at 4.68.0. Complete compiled example:
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

Operations remain authorable/unadmitted (PLAY0268). Named event sources,
streams and command/specification routes instead bind and reference-execute as
ESM v8 at 4.125.0; CLI 3.41.0 render refuses versions above v7 before planning
(CLI-RENDER-004). Syntax/MCP acceptance alone is not execution. Source/stream
forms and realization boundary: `cratis-screenplay-toolchain`
`references/sources-and-streams.md`. Do not infer further syntax or provider
admission from decision numbers.

