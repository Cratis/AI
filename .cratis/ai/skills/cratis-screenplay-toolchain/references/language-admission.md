<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Language admission: batches, described bodies, text, reads, dates and composite keys

Select the highest version required by constructs in the model. A newer version
alone never opts into either application mode. Consumers must explicitly admit
exact language/semantic pairs; binding, reference execution and rendering are separate.

| ESM | Selecting construct | Binding/reference behavior | Stage boundary |
| --- | --- | --- | --- |
| v22 | Application-root `reaction batches atomic` | Direct productions per trigger occurrence and each selected refusal branch are separate atomic batches; commands remain independent | v22 refused STAGE-ESM-016; mode in admitted v23–v26 refused STAGE-ESM-043 |
| v23 | Pending `handler implementation` beside unconditional `produces` | Payload-only body; PLAY0695 information; reaching body gives Unsupported ImplementationBody | v23 admitted, body refused STAGE-IMPL-002 in renderer/Host/executor, even Stub mode |
| v24 | `contains`, `not contains`, `starts with`, `ends with` property/concept rules | Ordinal UTF-16, absent optional passes; not text-condition operators | v24 admitted; semantic Host/executor and generated ordinal comparisons preserve rules |
| v25 | Application-root `command reads protected` | Admitted reads in requirements/mappings, absence Validation, matching decide/commit changes Conflict | v25 admitted; Cratis C# renderer refuses STAGE-ESM-044; semantic Host/executor execute reads, non-Error protected requirements refuse STAGE-ESM-045 |
| v26 | Chronological command Date/DateTime comparisons | Same-primitive `==`, `!=`, `>`, `>=`, `<`, `<=`; DateTime UTC ticks and pre-rule offset validation | v26 admitted; Host/executor run it, renderer and legacy engines refuse STAGE-ESM-046 |
| v27 | A read model with two or more `key` marks | Untyped projection `key` blocks, equality-filter lists, single-instance `by` blocks, per-part fixtures | v27 refused STAGE-ESM-016 |
| v28 | `==`/`!=` between Uuid values in command `require` and `produces when` | Uuid properties, Uuid concepts and identities, canonical literals; protected read paths in `require` only | v28 refused STAGE-ESM-016 |

Requires Screenplay 4.181.0 or later (`screenplay --version`) for atomic batches; older compilers cannot admit the preamble.

Requires Screenplay 4.182.0 or later (`screenplay --version`) for described handlers; older binders report PLAY0268.

Requires Screenplay 4.184.0 or later (`screenplay --version`) for literal text rules; older binders do not admit those rules.

Requires Screenplay 4.193.0 or later (`screenplay --version`) for protected reads; older binders retain PLAY0271/PLAY0268.

Requires Screenplay 4.199.0 (ESM v26; `screenplay --version`) for date comparisons; older binders report PLAY0268.

Requires Screenplay 4.204.0 (ESM v27; `screenplay --version`) for composite read-model keys; older binders report PLAY0268.

Requires Screenplay 4.205.0 (ESM v28; `screenplay --version`) for Uuid equality in command conditions; older binders report PLAY0268.

Requires Stage 4.124.0 for v24 text-rule admission (`cratis --version` identifies the CLI bundle); older renderers refuse v24 with STAGE-ESM-016. V23 admission alone does not implement described bodies.

Requires Stage 4.127.0 for v25 version admission; older renderers refuse v25 with STAGE-ESM-016. The Cratis C# renderer still refuses protected reads with STAGE-ESM-044; no artifacts are emitted.

Requires Stage 4.129.0 for semantic Host/executor protected reads; older engines refuse STAGE-ESM-044. Absence rejects before requirements/generation; read properties feed requirements and productions. Non-Error protected requirements refuse STAGE-ESM-045, including reaction invocations. Legacy Host/structural runner retain -044. The Host faults on any outside append, stricter than reference dependency-scoped conflicts; see [sandbox boundaries](../../cratis-stage-rendering-and-sandbox/references/sandbox-and-specrunner.md#protected-command-reads).

Read [atomic batches and event-source invocation mappings](../../cratis-screenplay-captures-and-reactions/references/atomic-batches-and-source-mappings.md)
for atomic boundaries and the source-identity mapping prerequisite. Start new models
with atomic mode; explicitly review opt-in for legacy models. Keep protection when
Stage refuses: do not remove the declaration or promise a target release date.

Read [described handlers](../../cratis-screenplay-command-surface/references/described-handlers.md)
for the payload result contract and [protected reads](../../cratis-screenplay-command-surface/references/protected-reads.md)
for finite event-source-keyed view admission, single-level paths and repair guards.
Text comparisons and matching are in [text and match rules](../../cratis-screenplay-command-surface/references/text-and-match-rules.md).
`matches` uses the portable linear dialect without selecting a new ESM version;
PLAY0699 refuses nonportable constructs, PLAY0367 invalid syntax, PLAY0787 warns
on exact Studio text-rule patterns and offers a literal-rule repair.

For v26, `require`/`produces when` compare a required scalar command property to
a required same-primitive property or literal. Command/property validation rules
compare only to literals. Date is a calendar date; DateTime is a UTC instant at
seven-fractional-digit tick precision. Participating DateTime inputs without an
offset or `Z` reject with Validation before any rule, even if a comparison is skipped.
`then` matching, keys, constraints and freshness remain ordinal. PLAY0268 retains
mixed Date/DateTime, optional condition operands, `$context` (including occurred),
`today`, protected read paths, concept date rules and reaction `where`. In admitted
positions, invalid date literals or offset-less DateTime literals use PLAY0273.
Read [date comparisons](../../cratis-screenplay-command-surface/references/date-comparisons.md)
for the complete interval example and input/target boundaries.

For v27, read read-surface [named keys](../../cratis-screenplay-read-surface/references/named-keys.md)
for the one complete example and every refusal. Only a model with a read model of two or
more key parts selects v27; one `key` mark keeps its earlier version and bytes. To see the
selected version, open the model with the `screenplay` MCP server and call `read-workspace`
with `view` `executable-model`: `languageVersion` reads `27.0`.

For v28, read command-surface [Uuid equality](../../cratis-screenplay-command-surface/references/uuid-equality.md)
for the operand, literal and refusal rules. Only a command condition that compares Uuids selects v28;
the same condition without Uuid operands keeps its earlier version. To see the selected version, open
the model with the `screenplay` MCP server and call `read-workspace` with `view` `executable-model`:
`languageVersion` reads `28.0`.

Stage's semantic engines admit exact v1–v21 and v23–v26 pairs. V22/v27/v28 and mixed
pairs refuse STAGE-ESM-016. Requires Stage 4.135.0 for v26 admission; older Stage
refuses v26 with STAGE-ESM-016. Admission of v23–v26 is not admission of described bodies,
atomic mode or rendered protected reads. A CLI may bundle an older compiler/Stage pair: run no-write render
admission rather than transferring a standalone verdict. Pattern diagnostics arise
in Screenplay before rendering; diagnostic arguments add no ESM version or new tool.
