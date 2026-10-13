## Generated fixtures and return expectations (ESM v7 and v15)

### Choosing a strategy / when not to

Choose the concept's strategy for the job, then pin a whole value matching it:
`for` for its generated identifier, named `generated` fixtures for other values.
Use the shared [strategy reference](../../cratis-screenplay-command-surface/references/generated-values-and-responses.md)
for UUID, time-ordered, typed/opaque text and byte-budget choices and exact shapes.
`given clock` supplies `$context.occurred`, not a generated time-ordered ID;
a seed is not a portable fixture.

Pins do not prove randomness, authorization, idempotency, storage freshness or
secret safety. Client-minted IDs stay inputs; gapless invoice numbering needs an
allocator, not a random fixture. Pattern/random/rule and secret generation remain
unadmitted. Source: Screenplay
`v4.151.0:Documentation/screenplay/generated-values/choosing.md:8-29,49-51`.

### Fixtures and outcomes

Standalone `screenplay` 4.68.0 or later binds and runs these, and so does the current cratis bundle (the
cratis 3.28.3 bundle, 4.66.0, did not); CLI 3.57.0 / Stage 4.89.1 render supported UUID/String generation strategies,
scalar/named responses, fixtures and `then returns`. Unsupported types/result combinations
remain `STAGE-ESM-028`/`-038`; preserve refused specifications as gap-fill contracts. The model and rules are in `cratis-screenplay-command-surface`; the
complete example is `cratis-screenplay-toolchain` `references/generated-responses-example.md`. Read that file when writing generated-value fixtures or scalar and record return expectations and needing a complete reference-executable model.

```screenplay excerpt
specification RegisteringReturnsIdentifiers
  when RegisterProject
    for "11111111-1111-1111-1111-111111111111"
    generated receiptId = "22222222-2222-2222-2222-222222222222"
    name = "Apollo"
  then ProjectRegistered
    for "11111111-1111-1111-1111-111111111111"
    name = "Apollo"
  then returns
    receiptId = "22222222-2222-2222-2222-222222222222"
```

- `for` beneath `when` supplies the generated identifier and an indented `generated <name> = <value>` supplies any other
  generated value; neither goes on the `when` header, and neither is a request mapping. Ordinary `generated = <value>`
  is an input mapping for a property named `generated`.
- A scalar response is `then returns <value>`; a record uses `then returns` with a non-empty subset of its named
  fields (unknown, duplicate, nongenerated or identifier fixture targets are rejected). Values are concrete literals or
  structured values. A return expectation needs a command action, occurs at most once and cannot accompany
  `then error` or `then denied`; event and state assertions may coexist.
- The reference runner compares scalar values by semantic equality and records by the asserted subset, reporting
  differences in response field order. An absent optional source yields `Null`; arrays compare in order.
- `then returns` counts as a success outcome but does not relax event comparison: a command specification with
  no expected events still asserts that no facts were produced.
- If execution reaches generation without every generated value supplied, the run is `Unsupported(IdentityAllocation)` and
  the specification never passes; nothing is invented. A denial or validation failure happens before generation and
  keeps its own outcome.
- For a generated identifier `for` is the generation fixture, not a destination assertion: expected events state their
  own destinations. For commands without a generated identifier `when ... for` keeps the destination assertion.
  UUID fixtures require canonical lowercase hyphenated form. From v15, pins must also match
  exact strategy size, case, UUID version/variant and zero trailing encoding bits; invalid pins are
  Contract rejections. Earlier models check canonical UUID type, not its version.
- A serialized concept generation strategy selects v15 and Guarded whole-source freshness for all
  generated destinations, including implicit UUIDs. Reusing a generated source with existing facts
  rejects the entire command with Concurrency, without append, response or silent retry. Below v15
  fixtures retain legacy reuse. See the complete [strategy example](../../cratis-screenplay-toolchain/references/generation-strategies-example.md)
  and command-surface `references/generated-values-and-responses.md` for tagged sources.
- `given clock` supplies `$context.occurred`; it does not synthesize UUIDv7, ULID or
  TypeID from that instant. Pin the whole identifier, never a seed. Stage 4.89.1's
  time-ordered factories use wall clock, not command-receipt time, and its clock
  specifications remain unsupported. Sources: Screenplay
  `v4.151.0:Documentation/screenplay/generated-values/choosing.md:51`; Stage
  `v4.89.1:Documentation/reference/generated-values-rendering.md:138`.
- A reaction-invoked command that reaches generation is `Unsupported(IdentityAllocation)` (no fixture channel); a
  response-only command runs and its response is discarded.
