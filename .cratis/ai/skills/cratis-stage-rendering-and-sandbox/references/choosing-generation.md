<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Choosing a generation strategy / when not to

Select the strategy on the model's concept, not in managed C#: implicit UUID for
ordinary identity, UUIDv7/ULID for time-ordered values, TypeID for typed text,
NanoID for opaque text or bytes for an exact entropy budget. Read the shared
[strategy, fixture and renderer reference](../../cratis-screenplay-command-surface/references/generated-values-and-responses.md)
for exact shapes and refusals. Time-ordered factories use wall clock, not
receipt-time `GenerationContext`; neither strict millisecond order nor `given clock`
ID synthesis is promised.

Do not generate client-owned inputs, idempotency keys, gapless invoice numbers or
secrets. Generation is not authorization, projection readiness or external-effect
success. Pattern/random/rule execution, sequences and clock specs remain unsupported.
At v15, Stage 4.89.1 emits explicit whole-source concurrency scopes; below v15 it
keeps unguarded handlers. This is not delivery of Arc#3129's future freshness API.
Sources: Stage `v4.89.1:Documentation/reference/generated-values-rendering.md:62-83,138-146`;
Screenplay `v4.151.0:Documentation/screenplay/generated-values/choosing.md:8-29`.
