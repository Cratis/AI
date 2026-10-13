<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Choosing a generation strategy / when not to

For a server-owned new value, choose implicit UUID for an ordinary identity,
UUIDv7 for time-ordered UUIDs, ULID for compact time-ordered text, TypeID for
recognizable typed text, NanoID for opaque text, or bytes for an exact random-bit
budget. Inspect entropy separately from executable admission; prefixes add no
random bits and identifiers need at least 64. Time-ordered is not strict
millisecond ordering. Use the existing [strategy and MCP reference](../../cratis-screenplay-command-surface/references/generated-values-and-responses.md),
not a per-property strategy: the concept owns `generate`, the command property
says `generated identifier` or `generated`.

Do not replace client-minted inputs, authorization, idempotency keys or a gapless
invoice allocator with generation. Secret generation, pattern/random/rule execution
and generated-concept rule consistency are not released capabilities. Preserve
refused rules instead of deleting them or inventing a repair.
Source: Screenplay `v4.151.0:Documentation/screenplay/generated-values/choosing.md:6-29,49-51`;
`Documentation/screenplay/generated-values.md:70-72`.
