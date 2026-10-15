<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Shop generation choices

## Choosing a strategy

Render only the supported part of the [shared shop model](../../cratis-screenplay-command-surface/references/shop-generation.md):
CustomerId (`cus_` + ULID), TypeID OrderId and NanoID InviteCode. ApiKey remains
secret with no generated property; do not turn .NET Bytes(32) credential generation
into a promise of Stage secret generation. The Arc context-aware OrderId is not
tenant isolation: Stage's TypeID factory uses the command receipt time, not the
tenant. InvoiceNumber pattern/checksum and random Int TicketNumber are valid ESM
v21 model choices, but are not rendered. Preserve those contracts for gap-fill.

Select the strategy on the model's concept, not in managed C#: implicit UUID for
ordinary identity, UUIDv7/ULID for time-ordered values, TypeID for typed text,
NanoID for opaque text or bytes for an exact entropy budget. Read the shared
[strategy, fixture and renderer reference](../../cratis-screenplay-command-surface/references/generated-values-and-responses.md)
for exact shapes and refusals. Time-ordered factories use receipt-time
`GenerationContext`.
Neither strict millisecond order nor `given clock` ID synthesis is promised.
Requires Stage 4.94.0 for receipt-time factories; older factories use wall clock.
Requires Stage 4.109.0 for v20 rule-bearing generated concepts; older renderers
refuse v20. It emits both New() and ConceptValidator; generated values failing
rules are server defects after authorization/input validation, never redraws.
Every rule-bearing generated property in a rendered spec needs a pin, even if
Proven. Invalid pins refuse STAGE-ESM-011; warning/info-severity concept rules
refuse STAGE-ESM-038.

## When not to

Do not generate client-owned inputs, idempotency keys, gapless invoice numbers or
secrets. Generation is not authorization, projection readiness or external-effect
success. Patterns are not gapless/sequential allocators or secrets; check digits
catch typos, not forgery. Short codes need uniqueness separate from whole-source
freshness. ESM v21 pattern/random/rule strategies and sequences remain unsupported
by Stage; admitted command clock specs render. Stage emits explicit whole-source scopes when the model
serializes a strategy; models with only implicit UUID stay Unguarded even at v20.
This is not a general freshness API. The renderer-facing RuleConsistency API
allows capable targets to distinguish Proven from Unproven, but does not remove
Stage's rule-bearing pin requirement.

Requires Stage 4.95.0 for command clock specs; older renderers refuse them.
