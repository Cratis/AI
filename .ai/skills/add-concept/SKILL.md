---
name: add-concept
description: Use this skill when asked to create a strongly-typed domain identifier or value (such as ProjectId, AuthorName, InvoiceNumber) in a Cratis-based project. Produces a ConceptAs<T> record with the correct conversions and sentinel values.
---

Create a strongly-typed Concept that wraps a primitive domain value.

## Never use raw primitives in domain models

Replace `Guid`, `string`, `int`, etc. with a `ConceptAs<T>` record whenever the value has domain meaning.

## Pick the base: value vs identity

- **Value concept** (name, amount, code) → derive from `ConceptAs<T>`.
- **Identity concept** (an entity's event-source id) → derive from `EventSourceId<T>`. **Never** use `ConceptAs<Guid>` for an event-source id — `EventSourceId<T>` carries the conversions to and from the untyped `EventSourceId`, so Chronicle resolves the key automatically.

`EventSourceId<T>` declares exactly five operators: `T` → `EventSourceId<T>`, `EventSourceId<T>` → `T`, `string` → `EventSourceId<T>`, `EventSourceId<T>` → `EventSourceId`, and `EventSourceId` → `EventSourceId<T>`. **There is no `EventSourceId<T>` → `string`** — `string s = authorId;` is `CS0029`. Use `authorId.ToString()` or, when `T` is `string`, the inherited `Value`.

## Value concept template

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

## Identity concept template (event-source id)

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
    public static <ConceptName> New() => new(Guid.NewGuid());   // when backed by Guid
    public static implicit operator <ConceptName>(<UnderlyingType> value) => new(value);
}
```

**Keep the `implicit operator <ConceptName>(<UnderlyingType>)` — it is not redundant.** C# does not inherit user-defined conversion operators, so the base's `T` → `EventSourceId<T>` only ever produces an `EventSourceId<T>`, never your derived type. Without this one line, `<ConceptName> id = someGuid;` does not compile.

The conversions that *are* inherited and must **not** be redeclared are the ones between your concept and `EventSourceId` / `T` (they operate on the base type, which your record is): `EventSourceId` ⇄ `EventSourceId<T>` and `EventSourceId<T>` ⇄ `T`.

## Empty/sentinel values

| Underlying type | Use             |
|-----------------|-----------------|
| `Guid`          | `Guid.Empty`    |
| `string`        | `string.Empty`  |
| `int`           | `0`             |
| `long`          | `0L`            |

## Placement rules

- Do NOT create a `Concepts/` folder
- Place the file in the folder that **semantically owns** the concept
  - `ProjectId` → `Projects/` (the feature folder, directly under the source root — no `Features/` wrapper)
  - Shared cross-feature concepts → `Common/`

## Checklist

- [ ] Inherits `ConceptAs<T>` (value) or `EventSourceId<T>` (identity / event-source id)
- [ ] Has a `static readonly NotSet` (or `Empty`) sentinel
- [ ] Has implicit conversion **from** the primitive — **including** identity concepts; conversion operators are not inherited
- [ ] Identity concept: does **not** redeclare the inherited `EventSourceId` ⇄ `EventSourceId<T>` / `EventSourceId<T>` ⇄ `T` conversions
- [ ] No code assumes an implicit `EventSourceId<T>` → `string` — it does not exist
- [ ] Has `New()` factory if `Guid`-backed
- [ ] Copyright header present
- [ ] `dotnet build` passes
