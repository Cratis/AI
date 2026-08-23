---
name: cratis-fundamentals-concept
description: Create strongly typed Cratis domain values and event-source identities with ConceptAs<T> or EventSourceId<T>. Use whenever a Cratis C# model introduces a meaningful Guid, string, number, name, code, amount, or entity identity instead of leaving it as a raw primitive.
license: MIT
---

# Cratis Fundamentals concepts

Create a strongly typed concept around every primitive value with domain meaning.

## Choose value or identity

- Derive names, amounts, codes, and other values from `ConceptAs<T>`.
- Derive event-source or entity identities from `EventSourceId<T>`.
- Do not use `ConceptAs<Guid>` for an event-source identity. `EventSourceId<T>` already provides Chronicle-compatible conversions.

## Value concept

```csharp
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Concepts;

namespace <NamespaceRoot>.<Feature>;

/// <summary>
/// Represents the <description>.
/// </summary>
/// <param name="Value">The underlying <type> value.</param>
public record <ConceptName>(<UnderlyingType> Value) : ConceptAs<<UnderlyingType>>(Value)
{
    /// <summary>
    /// Represents an unset <ConceptName>.
    /// </summary>
    public static readonly <ConceptName> NotSet = new(<emptyValue>);

    /// <summary>
    /// Implicitly converts a <UnderlyingType> to a <ConceptName>.
    /// </summary>
    public static implicit operator <ConceptName>(<UnderlyingType> value) => new(value);
}
```

## Guid-backed event-source identity

Use this template only when the underlying identity type is `Guid`.

```csharp
using Cratis.Chronicle.Events;

namespace <NamespaceRoot>.<Feature>;

/// <summary>
/// Represents the identity of a <description>.
/// </summary>
/// <param name="Value">The underlying Guid value.</param>
public record <ConceptName>(Guid Value) : EventSourceId<Guid>(Value)
{
    public static readonly <ConceptName> NotSet = new(Guid.Empty);
    public static <ConceptName> New() => new(Guid.NewGuid());
    public static implicit operator <ConceptName>(Guid value) => new(value);
}
```

## Non-Guid event-source identity

For string, integer, or other identity primitives, do not call `Guid.NewGuid()`.
Expose a typed factory only when the domain has a valid way to create that
primitive.

```csharp
using Cratis.Chronicle.Events;

namespace <NamespaceRoot>.<Feature>;

/// <summary>
/// Represents the identity of a <description>.
/// </summary>
/// <param name="Value">The underlying <type> value.</param>
public record <ConceptName>(<UnderlyingType> Value) : EventSourceId<<UnderlyingType>>(Value)
{
    public static readonly <ConceptName> NotSet = new(<emptyValue>);
    public static implicit operator <ConceptName>(<UnderlyingType> value) => new(value);
}
```

Do not redeclare conversions between `EventSourceId`, `T`, or `string`; the base type supplies them.

## Sentinel values

| Underlying type | Sentinel |
| --- | --- |
| `Guid` | `Guid.Empty` |
| `string` | `string.Empty` |
| `int` | `0` |
| `long` | `0L` |

## Placement

Place the concept with the feature that owns its meaning rather than in a generic `Concepts/` folder. Put genuinely cross-feature concepts in `Common/`. Do not introduce a top-level `Features/` wrapper.

## Verify

- The type derives from `ConceptAs<T>` or `EventSourceId<T>` as appropriate.
- It has a `static readonly NotSet` or semantically equivalent sentinel.
- It has an implicit conversion from the primitive.
- A `Guid`-backed identity has a typed `New()` factory; non-Guid identities use only a domain-valid factory.
- An identity does not duplicate conversions supplied by `EventSourceId<T>`.
- The file carries the repository license header.
- `dotnet build` passes.
