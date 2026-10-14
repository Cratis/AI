<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Shop generation choices

## Choosing a strategy

Render only the supported part of the [shared shop model](../../cratis-screenplay-command-surface/references/shop-generation.md):
CustomerId (`cus_` + ULID), TypeID OrderId and NanoID InviteCode. ApiKey remains
secret with no generated property; do not turn .NET Bytes(32) credential generation
into a promise of Stage secret generation. The Arc context-aware OrderId is not
Stage's wall-clock TypeID factory or tenant isolation.

Select the strategy on the model's concept, not in managed C#: implicit UUID for
ordinary identity, UUIDv7/ULID for time-ordered values, TypeID for typed text,
NanoID for opaque text or bytes for an exact entropy budget. Read the shared
[strategy, fixture and renderer reference](../../cratis-screenplay-command-surface/references/generated-values-and-responses.md)
for exact shapes and refusals. Time-ordered factories use wall clock, not
receipt-time `GenerationContext`; neither strict millisecond order nor `given clock`
ID synthesis is promised.

## Pitfalls

Do not generate client-owned inputs, idempotency keys, gapless invoice numbers or
secrets. Generation is not authorization, projection readiness or external-effect
success. Pattern/random/rule execution, sequences and clock specs remain unsupported.
At ESM v15, Stage emits explicit whole-source concurrency scopes; below v15 it
keeps unguarded handlers. This is not a general freshness API.
