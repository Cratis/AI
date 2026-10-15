# Generated values, rule proofs and responses

## Contents

- Choosing a strategy
- When not to
- The concept declares how; the property declares that
- Inspect and edit generation through MCP
- Generated-concept rules (ESM v20)
- Version and freshness
- Responses and pre-generation boundaries
- What the CLI and Stage realize

`generated` properties and `returns` bind/reference-execute (ESM v7).
Concept generation strategies and whole-source freshness bind as ESM v15. The CLI and Stage
render the supported strategies, scalar/named responses, fixtures and `then returns` when their
bundled compiler and renderer admit v15. Binding is not rendering.

Requires Screenplay 4.147.0 or later (`screenplay --version`) for concept generation strategies and whole-source freshness (ESM v15).

Sources: Cratis/Screenplay `Documentation/screenplay/generated-values.md`,
`generated-values/strategies.md`,
`Source/DotNET/Screenplay/Semantics/SemanticModelBinder.Generation.cs`;
Cratis/Stage
`Documentation/reference/generated-values-rendering.md`.
Only the released generation phase is taught here.

## Choosing a strategy

Use the [threaded shop model](shop-generation.md): CustomerId is `cus_` + ULID,
OrderId is TypeID, InviteCode is NanoID, InvoiceNumber is a readable pattern with
Luhn check digit, and TicketNumber is a random Int value. Keep short references
separate from event-source identities. The table below owns exact strategy shapes.

## When not to

Client-minted values remain inputs. Generation is not authorization, idempotency,
gapless/sequential invoice allocation or a credential contract. A pattern is not
an allocator; check digits catch typing mistakes, not forgery. Preserve ApiKey's
`secret` classification without generated properties: generated secrets remain
refused, not a reason to strip protection.

## The concept declares how; the property declares that

The complete reference-executable [shop example](shop-generation.md) declares
strategies on concepts and `generated`/`generated identifier` on properties.
It includes whole-value fixture pins and returned IDs.

A generated property must be a required scalar **concept**, not a bare primitive,
optional value or collection. Uuid/String generation and Int `random` are executable.
A Uuid concept implicitly generates `uuid`; String needs an explicit strategy.
Each concept owns at most one `generate` line; there is no per-property override.
Generated identifiers need Uuid or String backing and at least 64 random bits.

| Strategy | Backing | Exact default shape / options |
| --- | --- | --- |
| `uuid` | Uuid, String | UUID v4, RFC variant, lowercase canonical D text; 122 random bits |
| `uuidv7` | Uuid, String | UUID v7, RFC variant; 74 random bits; reveals time, not monotonic within a millisecond |
| `ulid` | String | 26 uppercase Crockford symbols, first 0–7; 80 random bits; reveals time, not strict millisecond ordering |
| `typeid "user"` | String | TypeID 0.3, lowercase Crockford UUIDv7 suffix; 74 random bits; prefix 1–63 lowercase letters/underscores, no leading/trailing underscore; empty prefix omits separator |
| `nanoid [size]` | String | Default 21 symbols from `A-Za-z0-9_-`; size 1–256; entropy is size × log2(alphabet size) |
| `bytes <count> base64url` / `hex` / `base32` | String | Count 1–512; 8 × count random bits; RFC 4648 without padding; hex lowercase, base32 uppercase; unused trailing bits zero |
| `pattern "INV-{yyyy}{MM}-#{7}" checksum luhn` | String | Finite readable reference; UTC dates and check digits add no entropy |
| `random 100000..999999` | Int | Inclusive signed Int64 interval; numeric value, not an identifier |
| `rule Name` | String | Exactly one file or tagged fence; opaque ValueGeneration implementation with Now/Tenant context and unknown entropy |

Modifiers occur once each, in any authored order. `prefix "text"` is printable
ASCII, at most 32 characters, on uuid/uuidv7/ulid/nanoid/bytes; UUID prefixes need
String backing. `case lower|upper` applies only to String uuid/uuidv7, ulid and
hex/base32 bytes; it never changes the prefix. `alphabet "chars"` replaces
NanoID's alphabet with 2–256 distinct printable ASCII characters (the repertoire
has only 95). TypeID has its own prefix and accepts none of these modifiers.
Time and prefixes add no entropy. Below 64 random bits is PLAY0684 (error) for an
identifier; non-identifiers warn PLAY0683 unless a single-property unique
constraint covers the mapped event property. That suppression is not a runtime collision guarantee; use the constraint when
collisions must reject the command.

Requires Screenplay 4.172.0 or later (`screenplay --version`) for pattern/random/rule
and String-concept `validate checksum luhn|mod11|mod97` (ESM v21); older compilers
refuse them with PLAY0268. Pattern `#` draws a digit, `?` an uppercase letter,
`*` an uppercase letter or digit; positive ASCII classes and `{n}`/`{m,n}` repeats
up to 64 are supported. `{yyyy}`, `{yy}`, `{MM}`, `{dd}` use one UTC date.
The expanded value, including check digits, is at most 256 characters. Only pattern
accepts `checksum`; write literals/classes rather than prefix/case/alphabet modifiers.
Read Cratis/Screenplay `Documentation/screenplay/generated-values/patterns.md`
for escaping and support limits. PLAY0691 means support counting exhausted its
budget; PLAY0692 means some date in the 100-year assessment horizon has empty
support. Neither is a proof warning or permission to redraw.

Checksum generation appends one Luhn/Mod11 digit or two Mod97 digits over preceding
ASCII digits, including date/literal digits. Author `validate checksum` separately
for arithmetic validation of supplied/stored values and fixtures; generation alone
checks only suffix shape on fixtures. `generate sequence` stays reserved (PLAY0682),
and compliance markers on generated concepts, including secrets, remain refused.
Never remove classification to make a model bind.

## Inspect and edit generation through MCP

A concept `generation` summary and entropy repairs are available.
Use `screenplay_declaration_details` with `kind: "Concept"`, `view: "summary"`:
only authored `generate` gets a block, with strategy, set modifiers,
`arguments`, `supportCount`, `entropyBits`, `entropyUnknownReason` when null,
`valuesAtOnePercentCollision` and `executable.status`. Status is `admitted` only
after whole-model binding, `refused` for errors at this concept/generation, or
`notAssessed` with a reason for unrelated binding failures. Empty local codes do
not prove admission; large collision counts may exceed client numeric range.

Set/change/remove `generate` through `screenplay_propose_ast` (replace the concept's
`GenerationSyntax`, omit/null `generation` to remove) or reviewed
`screenplay_propose_source`; do not hand-edit the text. Inspect executable
diagnostics independently of authoring acceptance: sequence PLAY0682;
support failures PLAY0691/0692; generated-rule proofs PLAY0688/0689. Review, run candidate
specifications where executable, then apply with revisions.

`screenplay_repair_capabilities` advertises PLAY0683/0684; workspace repairs supply
the selected `diagnosticCode` and `subject` for `screenplay_propose_repair`.
The concept subject raises NanoID to the smallest size reaching 64 random bits
for its alphabet, or bytes count to 8 (possibly in another document). PLAY0683
also offers uniqueness for a non-identifier command-property subject only when
exactly one production maps it to exactly one event property. Both require
individual review and `CanonicalizeTouchedDocuments`, with no pinned evidence.
Length changes affect all concept uses; uniqueness changes append-time behavior.
PLAY0688 repair replaces a refuted rule with the strategy-derived `matches`
pattern. Review input/stored-value uses because this changes their validation,
not just generation. A deterministic bounded pattern repair also adds the declared
checksum validation if absent; review both rule changes. Ambiguous derived regexes
have no repair. Date/checksum digit shapes alone do not prove containment.
A CLI-bundled MCP can lack this summary and these repairs; it still
supports existing typed concept proposals.

Requires Screenplay 4.173.0 or later (`screenplay --version`) for `arguments`,
exact support counts, `derivedPattern` and authored-order `rules[]`; older servers
can expose `previewArguments` instead. Read `rules[].status`, `witness` and `reason`
instead of parsing diagnostic text. Use `derivedPattern` as `matches` through a
typed proposal; use the discovered PLAY0688 repair to replace a refuted rule.
A refuted rule without `diagnosticCode` was not checked by the compiler (for example,
an unused UUID concept), so do not invent a repair. Full fields and mapping limits: [MCP generation guide](../../cratis-screenplay-model-authoring/references/mcp-tools.md#concept-generation).
Sources: Cratis/Screenplay `Documentation/screenplay/generated-values.md`,
`Source/DotNET/Screenplay.Mcp/McpGenerationDetails.cs`,
`Source/DotNET/Screenplay/Workspaces/WorkspaceGenerationRepairs.cs`.

## Generated-concept rules (ESM v20)

Requires Screenplay 4.164.0 or later (`screenplay --version`) for generated-concept rules; older compilers report PLAY0268.

```screenplay
concept InviteCode : String
  generate nanoid
  validate
    matches "^[A-Za-z0-9_-]{21}$"
```

The compiler proves `not empty`, text length/min/max, equality/inequality and
`matches` against the exact strategy shape. Proven rules bind silently; Refuted
rules fail with PLAY0688 and a violating example; Unproven rules warn PLAY0689
with a reason. A warning is not proof. Regex proof uses a bounded ASCII regular
subset (classes, groups, alternation, repetition and end anchors, not lookaround,
backreferences or flags) and proves containment only for unambiguous patterns
that cannot backtrack on generated values. Passing samples alone prove nothing.
Providers validate generated values too: a failing fixture is a Contract violation,
not client rejection or a reason to redraw. Opaque rules need a target.

Generated-concept validation rules select ESM v20 even on implicit UUID generation.
No proof status is serialized;
strategy changes do not silently change rules on stored/input values.

Requires Screenplay 4.174.0 or later (`screenplay --version`) for the renderer-facing
`RuleConsistency.Check(SemanticConcept concept, int? utcAssessmentYear = null)` in
`Cratis.Screenplay.Semantics.Generation`; older consumers must not infer proofs
from absent serialized status. Results parallel `concept.Validations` in authored
order, including implicit UUID on concepts used by generated properties. A target
that supports unpinned generation may allow it when all rules are Proven; any
Unproven rule requires pins. The reference evaluator still always requires pins.
Supply the UTC assessment year to reproduce a proof; do not serialize stale status.
See Cratis/Screenplay `Documentation/screenplay/generated-values/strategies.md`,
“Proof status for renderers.”

## Version and freshness

A serialized concept `generation` member selects **v15**. Implicit Uuid generation
and explicit unmodified Uuid `generate uuid` omit it and preserve earlier executable
bytes/revision. Any model with a serialized strategy guards **all** generated destinations,
including its implicit UUIDs; ESM version alone does not enable the guard. An append whose destination equals any value generated in that
invocation requires the **whole source** to have no existing facts, regardless
of stream or event type. Multiple initial facts in one invocation are allowed;
a skipped production makes no freshness claim. Reuse rejects the whole command
with `Concurrency`, appends nothing and does not silently regenerate or retry.
Models without a serialized strategy are Unguarded and retain legacy fixture
reuse, even if rules select v20.

Freshness is neither authorization nor idempotency. Client-minted identifiers
remain inputs; protect their invariants with constraints. Never use generation
as a deduplication key, a gapless sequence, or proof that a projection is ready.

Specifications pin values, not seeds: `for` pins a generated identifier;
`generated <name> = <value>` pins another generated property. The reference
evaluator draws no randomness. From v15 every pin must match exact strategy
encoding, size, case, UUID version/variant and zero trailing bits. Invalid pins
are Contract rejections, not client validation failures. Rule-bearing concepts
also check rules, including implicit UUID. Pin date segments with `given clock`;
all segments must match the same UTC instant. Without a clock only digit widths
are checked, never the wall clock. Opaque generation rules consume String pins
without executing attached code; opaque validation still yields Unsupported.
Older rule-free implicit-UUID models retain
canonical UUID checks without a version check. Complete executable examples:
[generated responses](../../cratis-screenplay-toolchain/references/generated-responses-example.md)
and [generation strategies](../../cratis-screenplay-toolchain/references/generation-strategies-example.md).

## Responses and pre-generation boundaries

- Generated values are not request inputs, form fields, invocation arguments or
  ordinary specification values. Authorization/validation precede generation:
  policies (including a generated identifier's implicit `subject`), rules and
  requirements cannot read them (PLAY0273). Reactions map request inputs only.
- `returns <property>` exposes a scalar; a `returns` block has ordered
  `<name> [<Type>] = <property>` fields over direct command properties. An
  annotation must match source type/optionality. Collections, read aliases,
  arithmetic and whole read models are unsupported. One unconditional response,
  as a command sibling. `returns @name` forces a response; `@returns Type` is a property.
- Only acceptance has a response. Rejection, denial or unsupported outcomes have
  none; later settlement/query failure clears it. Response-only commands record
  no facts. Field names are an external contract: renaming changes revision.
- A generated identifier is the implicit inline production destination; a plain
  destination-less `produces` retains a separate allocation channel. A fixture
  never satisfies that channel.
- Screenplay resolves response names in form submit and execute-success
  continuations without changing ESM. An older CLI compiler lacks that
  resolution, and Stage does not provide Scene runtime continuation
  binding. Requires Screenplay 4.148.0 or later (`screenplay --version`) for the resolution. See UI composition [response continuations](../../cratis-screenplay-ui-composition/references/response-continuations.md).

## What the CLI and Stage realize

Stage emits strategy-specific `IGeneratable<T>.New()` factories over Fundamentals
7.24.0 or later (via the Arc scaffold pin in Stage's `references/rendered-application.md`). v15 generated destinations use explicit
`EventsWithConcurrencyScopes` with `BeforeFirst` whole-source scopes; Chronicle
checks atomically at append: a batch's scopes are checked once against the state before
the batch, all or nothing, and a storage retry that renumbers the append checks them again. Generated rejection specs assert
`ValidationResultReason.ConcurrencyViolation`, not Arc's message text. This is
Stage's explicit realization, not a claim that Arc delivers the same guard.
Time-based factories use the command's receipt time through `IGeneratableInContext<T>`
and `GenerationContext`, the same instant as `$context.occurred`.

Requires Stage 4.94.0 or later for receipt-time generation; older factories use wall clock.

| Refusal | Still unsupported |
| --- | --- |
| STAGE-ESM-028 | Unknown strategies, non-concepts, optional/collection generation; every explicit strategy on the legacy syntax engine |
| STAGE-ESM-011 | A fixture that does not match its strategy shape or concept rules |
| STAGE-ESM-038 | Routing combined with generation/responses; generated-property rules/requirements or non-error-severity concept rules; occurrence parameter/response/factory name collisions; unsupported response sources/composites/collections; generated identifier plus destination-less plain production |
| STAGE-ESM-038 | Unpinned generation with unordered event, read-model or query expectations |
| STAGE-ESM-004 / -006 | StateChange slices without commands / expression or enum production conditions |

Sequence generation is refused at binding (PLAY0682) and never reaches Stage;
command `given clock` fixtures render when whole milliseconds at or after 1970;
`when clock` and reaction/query/direct-append clocks remain refused.

Requires Stage 4.95.0 for command clock fixtures, 4.98.0 for multiple commands and
conditional productions, and 4.100.0 for generated text unique constraints; older
renderers refuse those shapes.

Requires Stage 4.109.0 for ESM v20 factories plus `ConceptValidator`, rule-valid
pins and rejection of warning/info-severity generated-concept rules (-038);
older renderers refuse v20. Every rule-bearing generated property in a rendered
specification needs a pin, even with Proven rules: Stage does not yet use the
renderer proof API for unpinned generation. ESM v21 strategies are not rendered
by Stage; Arc's released Screenplay generator does not recover them either.
Keep the model and report the target gap, not a fallback secret or deleted rule.

Missing pins in generated Debug specs use `AllowGeneration()` with relational
assertions against captured values; v15 captures also check strategy shape.
The in-memory Stage executor instead requires deterministic fixtures and returns
Unsupported(IdentityAllocation) when missing. Build and run generated Debug
specifications separately; source reading is not a render or runtime result.
