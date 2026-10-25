<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Chronicle.Kotlin 7 migration

Source review: releases 6.13.1–7.1.0 and tagged 7.1.0
`concepts/ConceptAs.kt`, `concepts/EventSourceIdConcepts.kt`,
`correlation/CorrelationIdManager.kt` and `observation/OnceOnly.kt`.
This does not extend the skill's earlier compile/runtime verification.

## Shared concepts and correlation

7.0.0 is breaking. Import `ConceptAs` from
`io.cratis.fundamentals.concepts` and implement `value()`, not a property/getter.
Java record accessors satisfy this interface directly. Import `CorrelationId`
from `io.cratis.fundamentals.execution`, use `NOT_SET` and `value()`, and recompile
consumers. The old Chronicle names are warning-level Kotlin typealiases for this
major version, not a permanent alternative API. Typed source-id overloads now
consume Fundamentals concepts. Follow the product's
[migration guide](https://github.com/Cratis/Chronicle.Kotlin/blob/main/Documentation/guides/migrate-to-fundamentals.md).

Since 7.1.0, the module-level `correlationIdManager` delegates to Fundamentals
0.6.0's shared `CorrelationIdContext`. Its own API still takes/returns UUIDs;
separately constructed managers remain independent. State is thread-bound, not
coroutine-bound: pass correlation explicitly for suspending/thread-hopping work
and clear the ambient context at the boundary. Never assume a pooled thread is a
request or tenant scope.

Since 7.0.1, event/read-model enum values are written as ordinal numbers to match
their schemas. Stored names remain readable; undefined ordinals, including numeric
strings, are rejected. Do not rearrange persisted enum ordinals casually.

## Observer and transport upgrades

`@StartAtTail` (6.15.0) applies to reactor classes in Kotlin and Java. It skips
history only on first registration; existing positions remain. `@OnceOnly` only
excludes replay, not initial catch-up or redelivery. Upgrade contracts and kernel
to 19.70.0 first; older servers ignore the tail flag.

`store.observers.fastForward(...)` (6.14.0) accepts an identifier or reactor/reducer
class and returns `FastForwardResult`, with a Java bridge. It needs kernel
19.56.0+ and deliberately skips work; it is not recovery or deduplication.

`ChronicleOptions.maxReceiveMessageSize` and `withMaxReceiveMessageSize()`
(6.13.1) default to 100 MB; `null` retains grpc-java's own default. The constructor
and `copy()` have a trailing parameter; earlier constructor overloads remain.
Recompile affected calls rather than treating transport capacity as a query bound.
