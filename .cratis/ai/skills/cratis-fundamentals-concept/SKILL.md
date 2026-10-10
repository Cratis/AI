---
name: cratis-fundamentals-concept
description: Create strongly typed Cratis domain values with ConceptAs and Chronicle event-source identities with EventSourceId. Use when a C# domain value has meaning beyond its primitive or when an identity is actually used as a Chronicle event-source/stream ID. Do not use for enums, DTO-only transport values, arbitrary non-stream entity IDs, or event schema migration.
license: MIT
---

# Cratis domain concepts and event-source identities

Replace a primitive only when the domain gives it distinct meaning. Keep value
concepts and Chronicle stream identities separate.

## Verified product sources

This skill is verified against these exact public releases:

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Fundamentals` | `7.23.0` | `Cratis.Concepts.ConceptAs<T>`, `IGeneratable<TSelf>` and `GenerateValue` |
| `Cratis.Chronicle` | `18.3.0` | `Cratis.Chronicle.Events.EventSourceId` and `EventSourceId<T>` |

Reverify product sources before claiming support for another version.

## Choose the type

- Derive a name, amount, code, number, or non-stream entity ID from
  `ConceptAs<T>`.
- Derive an identity from `EventSourceId<T>` only when that value is actually
  passed to Chronicle as the event-source/stream ID.
- Do not use `ConceptAs<Guid>` for a Chronicle stream identity.
- Do not use `EventSourceId<T>` merely because a value is called an ID.
- Do not wrap an enum. An enum already expresses a closed domain concept.
- Keep DTO-only transport values primitive unless the domain type belongs in the
  public contract.

Both generic bases require an underlying type that implements `IComparable`.

## Create a value concept

A value concept contains exactly one wrapped value. Do not add extra properties;
Fundamentals converters assume the concept is a single-value type and additional
state can be lost during serialization.

```csharp
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Concepts;

namespace <NamespaceRoot>.<Feature>;

/// <summary>
/// Represents the <description>.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record <ConceptName>(<ComparableUnderlyingType> Value) :
    ConceptAs<<ComparableUnderlyingType>>(Value);
```

`ConceptAs<T>` supplies implicit conversion from the concept to `T`. Add the
reverse conversion only when it improves the domain API:

```csharp
public static implicit operator <ConceptName>(<ComparableUnderlyingType> value) =>
    new(value);
```

Primitive-to-concept conversion is optional; it is not a Fundamentals
requirement.

### Absence and sentinels

`ConceptAs<T>` rejects a null wrapped value. Represent absence with a nullable
concept reference such as `<ConceptName>?` when absence is valid.

A `NotSet` or `Empty` value is optional domain policy. Add one only when the
chosen primitive value is impossible or explicitly reserved in that domain.
Do not assume `string.Empty`, `0`, or `Guid.Empty` is universally invalid.

## Let a concept generate its own value

Check the Cratis.Fundamentals version the project resolves first. Arc and
Chronicle can bring an older one; when it is below 7.23.0, add a direct
`Cratis.Fundamentals` 7.23.0 or later package reference, or keep the existing
`static New()` (without the interface) until you can.

When the system, not the caller, creates a value, the concept declares how by
implementing `IGeneratable<TSelf>` (`Cratis.Concepts`, Cratis.Fundamentals
7.23.0 or later). The interface requires `static abstract TSelf New()`, so
generic code constrained on `where T : IGeneratable<T>` calls `T.New()` without
reflection. Generate a UUID with `GenerateValue`, never with `Guid.NewGuid()` in
scattered call sites and never with `System.Random`:

```csharp
using Cratis.Concepts;

public record <ConceptName>(Guid Value) : ConceptAs<Guid>(Value), IGeneratable<<ConceptName>>
{
    public static <ConceptName> New() => new(GenerateValue.Uuid());
}
```

Both helpers return a `Guid` with the RFC 9562 variant and fill their random
bits from `RandomNumberGenerator`:

- `GenerateValue.Uuid()` — version 4, 122 random bits. The default.
- `GenerateValue.UuidV7()` — version 7: Unix-epoch milliseconds first, then 74
  random bits. Choose it only when database index locality or rough creation
  order matters, after checking how the database stores and compares UUIDs. It reveals the creation time, it is **not** monotonic within a
  millisecond, and clock adjustments can reorder values.

Neither helper guarantees uniqueness; a collision is extremely unlikely, not
impossible. `IGeneratable<TSelf>` is not limited to Guid-backed concepts, but
`GenerateValue` only produces UUIDs.

Do not generate when:

- The client supplies the identifier. It is an input; keep it.
- The value must be secret or authenticate someone. A UUID is an identifier,
  not a token; use a dedicated secure-token API.
- The same input must yield the same value. Random generation is not
  idempotency; derive the value deterministically, or persist and reuse the
  first one.

In specifications, construct the concept from a known value
(`new <ConceptName>(Guid.Parse("…"))`) and assert against it. Do not seed or
replace the generator. Guide: `/fundamentals/csharp/generating-values/`.

## Create a Guid-backed Chronicle stream identity

Use this shape only for an identity actually supplied to Chronicle append/read
operations as the event-source ID.

```csharp
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Events;
using Cratis.Concepts;

namespace <NamespaceRoot>.<Feature>;

/// <summary>
/// Represents the event-source identity of a <description>.
/// </summary>
/// <param name="Value">The underlying Guid value.</param>
public record <ConceptName>(Guid Value) : EventSourceId<Guid>(Value), IGeneratable<<ConceptName>>
{
    /// <summary>
    /// Creates a new <ConceptName>.
    /// </summary>
    /// <returns>A new <ConceptName>.</returns>
    public static <ConceptName> New() => new(GenerateValue.Uuid());

    /// <summary>
    /// Converts a Guid to a <ConceptName>.
    /// </summary>
    public static implicit operator <ConceptName>(Guid value) => new(value);
}
```

`New()` (through `IGeneratable<TSelf>`) and the primitive-to-derived conversion
are conveniences on this domain type. `EventSourceId<T>` does not construct an arbitrary derived identity for
you.

## Create a non-Guid Chronicle stream identity

Use a factory only when the domain has an authoritative way to create the
underlying value.

```csharp
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Events;

namespace <NamespaceRoot>.<Feature>;

/// <summary>
/// Represents the event-source identity of a <description>.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record <ConceptName>(<ComparableUnderlyingType> Value) :
    EventSourceId<<ComparableUnderlyingType>>(Value)
{
    /// <summary>
    /// Converts the underlying value to a <ConceptName>.
    /// </summary>
    public static implicit operator <ConceptName>(<ComparableUnderlyingType> value) =>
        new(value);
}
```

The exact `EventSourceId<T>` base supports conversions among `T`, string,
untyped `EventSourceId`, and `EventSourceId<T>`. Those operators do not create
your derived `<ConceptName>` from `T`, string, or untyped `EventSourceId`.
Declare only the derived-type conversions your domain API needs.

String and Guid are the safest round-trip primitives. Chronicle also supports
constructible `ConceptAs<string>` and `ConceptAs<Guid>` values. Other comparable
values rely on `Convert.ChangeType`; verify round-trip behavior before using
them as stream IDs.

### Unspecified and sensitive identities

`EventSourceId.Unspecified` belongs to the untyped string-backed ID.
`Guid.Empty`, `0`, `0L`, and similar typed values become real, specified stream
IDs after conversion; they are not Chronicle's unspecified value. Treat any
sentinel on a typed identity as explicit domain policy, not framework behavior.

Never use a sensitive natural identifier directly as an event-source ID.
Chronicle cannot encrypt event-source IDs. Use a random surrogate stream ID and
store the sensitive value separately under the approved compliance model.

## Use the identity with Chronicle

Pass the typed identity as the append/read event-source ID. Merely declaring an
`EventSourceId<T>` property does not select the event stream.

Do not add `[Key]` or `[Subject]` to an `EventSourceId<T>`-derived member;
Chronicle analyzer `CHR0026` reports that misuse. Do not add `[PII]` or
`[Encrypted]` to an event-source ID; analyzers `CHR0034` and `CHR0052` reject them.

## Placement is an application convention

In a Cratis application, place the concept with the feature that owns its
meaning rather than in a generic `Concepts/` folder. Put genuinely cross-feature
concepts in `Common/`. Do not introduce a top-level `Features/` wrapper.

This placement is a Cratis application convention, not a Fundamentals or
Chronicle API requirement. Framework and client repositories follow their own
repository structure.

## Verify

- `ConceptAs<T>` and `EventSourceId<T>` use an `IComparable` underlying type.
- A concept contains exactly one wrapped value and no extra properties.
- Enums remain enums.
- A concept that creates its own value implements `IGeneratable<TSelf>`; a
  Guid-backed one uses `GenerateValue`, not `Guid.NewGuid()` or `Random`.
  Client-supplied, secret or idempotent values are not generated.
- Null absence uses a nullable concept reference rather than a null wrapped
  value.
- Primitive-to-derived conversions and sentinels exist only when justified by
  the domain.
- An `EventSourceId<T>` type represents a real Chronicle stream identity.
- The typed identity is passed explicitly to Chronicle operations.
- No `[Key]`, `[Subject]`, `[PII]`, or `[Encrypted]` attribute is placed on the stream identity.
- Sensitive natural identifiers use a surrogate stream ID.
- The file carries the repository license header.
- The project builds and its relevant specifications pass against the verified
  package versions.
