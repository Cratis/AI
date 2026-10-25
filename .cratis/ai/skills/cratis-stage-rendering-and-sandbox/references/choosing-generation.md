<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Shop generation choices

## Choosing a strategy

Render only the supported part of the [shared shop model](../../cratis-screenplay-command-surface/references/shop-generation.md):
CustomerId (`cus_` + ULID), TypeID OrderId and NanoID InviteCode. ApiKey remains
secret with no generated property; do not turn .NET Bytes(32) credential generation
into a promise of Stage secret generation. The Arc context-aware OrderId is not
tenant isolation: Stage's TypeID factory uses the command receipt time, not the
tenant. InvoiceNumber pattern/checksum and random Int TicketNumber render as
Fundamentals Pattern/Integer factories; dated patterns use receipt-time context.
Read [admission.md](admission.md) for checksum validation and pattern/random
rendering prerequisites and their STAGE-ESM-042/-028 refusals on older renderers.

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
Requires Stage 4.115.0 for all-Proven unpinned rendered specs; older renderers
require pins even when Proven. Any Unproven/Refuted rule still needs a pin (-038).
Invalid pins refuse STAGE-ESM-011; opaque/unsupported rules refuse -005 before
pin evaluation. Every severity is enforced at runtime.
Requires Stage 4.117.0 for warning/info-severity concept rules; older renderers refuse them with STAGE-ESM-038.

## When not to

Do not generate client-owned inputs, idempotency keys, gapless invoice numbers or
secrets. Generation is not authorization, projection readiness or external-effect
success. Patterns are not gapless/sequential allocators or secrets; check digits
catch typos, not forgery. Short codes need uniqueness separate from whole-source
freshness. `generate rule` renders only from Stage 4.136.0 (STAGE-ESM-028 before it, and in the Host), and
sequence is refused by Screenplay. Admitted command clock specs render. Stage
emits explicit whole-source scopes when the model serializes a strategy; models
with only implicit UUID stay Unguarded even at v20. This is not a general freshness
API. Unpinned rendered captures assert shape/range, rules and the fixed UTC date
for dated patterns; the independent executor still requires deterministic pins.

Requires Stage 4.95.0 for command clock specs; older renderers refuse them.
