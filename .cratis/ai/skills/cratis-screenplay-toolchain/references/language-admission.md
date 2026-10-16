<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Language admission: batches, described bodies, text and reads

Select the highest version required by constructs in the model. A newer version
alone never opts into either application mode. Consumers must explicitly admit
exact language/semantic pairs; binding, reference execution and rendering are separate.

| ESM | Selecting construct | Binding/reference behavior | Stage boundary |
| --- | --- | --- | --- |
| v22 | Application-root `reaction batches atomic` | Direct productions per trigger occurrence and each selected refusal branch are separate atomic batches; commands remain independent | v22 refused STAGE-ESM-016; mode in admitted v23/v24 refused STAGE-ESM-043 |
| v23 | Pending `handler implementation` beside unconditional `produces` | Payload-only body; PLAY0695 information; reaching body gives Unsupported ImplementationBody | v23 admitted, body refused STAGE-IMPL-002 in renderer/Host/executor, even Stub mode |
| v24 | `contains`, `not contains`, `starts with`, `ends with` property/concept rules | Ordinal UTF-16, absent optional passes; not text-condition operators | v24 admitted; semantic Host/executor and generated ordinal comparisons preserve rules |
| v25 | Application-root `command reads protected` | Admitted reads in requirements/mappings, absence Validation, matching decide/commit changes Conflict | v25 refused STAGE-ESM-016 |

Requires Screenplay 4.181.0 or later (`screenplay --version`) for atomic batches; older compilers cannot admit the preamble.

Requires Screenplay 4.182.0 or later (`screenplay --version`) for described handlers; older binders report PLAY0268.

Requires Screenplay 4.184.0 or later (`screenplay --version`) for literal text rules; older binders do not admit those rules.

Requires Screenplay 4.193.0 or later (`screenplay --version`) for protected reads; older binders retain PLAY0271/PLAY0268.

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

Stage's semantic engines admit exact v1–v21, v23 and v24 pairs. V22/v25 and mixed
pairs refuse STAGE-ESM-016. Admission of v23/v24 is not admission of described bodies
or atomic mode. A CLI may bundle an older compiler/Stage pair: run no-write render
admission rather than transferring a standalone verdict. Pattern diagnostics arise
in Screenplay before rendering; diagnostic arguments add no ESM version or new tool.
