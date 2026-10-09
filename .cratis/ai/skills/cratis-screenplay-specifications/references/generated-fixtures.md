## Generated fixtures and return expectations (ESM v7)

Standalone `screenplay` 4.68.0 or later binds and runs these; the cratis CLI 3.28.3 (bundled 4.66.0) does not
bind them, and Stage does not render ESM v7 yet (`STAGE-ESM-016`, tracked in Stage#201), so they pin the
contract of a hand-written command. The model and rules are in `cratis-screenplay-command-surface`; the
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
  UUID spellings on generated values normalize to lowercase hyphenated form.
- A reaction-invoked command that reaches generation is `Unsupported(IdentityAllocation)` (no fixture channel); a
  response-only command runs and its response is discarded.
