---
name: add-concept
description: Use this legacy local skill name when creating a strongly typed Cratis domain value or Chronicle event-source identity. Apply the same product-authoritative rules as the canonical cratis-fundamentals-concept skill; do not use it for enums, DTO-only values, arbitrary non-stream IDs, or event migration.
---

# Add a Cratis concept

This is the legacy repository-local entry point. The canonical package skill is
`skills/cratis-fundamentals-concept/SKILL.md`; keep behavior aligned until legacy
adapters retire.

## Choose the base

- Domain value or non-stream entity ID → `ConceptAs<T>` from
  `Cratis.Fundamentals`.
- Identity actually used as a Chronicle event-source/stream ID →
  `EventSourceId<T>` from `Cratis.Chronicle`.
- Enum → keep the enum.
- DTO-only primitive without domain meaning → keep the primitive.

Both generic bases require an `IComparable` underlying type.

## Value concept

Use a positional record with exactly one wrapped, non-null value. Do not add
extra properties; Fundamentals serialization assumes a single-value concept.

```csharp
public record InvoiceNumber(string Value) : ConceptAs<string>(Value)
{
    public static implicit operator InvoiceNumber(string value) => new(value);
}
```

The reverse primitive → derived conversion is optional. `ConceptAs<T>` already
provides concept → `T`. Represent absence with `InvoiceNumber?`, not a concept
wrapping null.

A `NotSet`/`Empty` sentinel is optional domain policy. Add one only when its
backing value is explicitly reserved in the domain.

## Chronicle stream identity

```csharp
public record OrderId(Guid Value) : EventSourceId<Guid>(Value)
{
    public static OrderId New() => new(Guid.NewGuid());
    public static implicit operator OrderId(Guid value) => new(value);
}
```

`New()`, sentinels, and primitive → derived-ID conversions are optional domain
conveniences. Base operators do not construct every derived domain record.
Typed empty/zero values are real specified stream IDs, not
`EventSourceId.Unspecified`.

Pass the typed ID explicitly to Chronicle append/read operations. Do not add
`[Key]`, `[Subject]`, or `[PII]` to an `EventSourceId<T>`-derived member;
Chronicle analyzers `CHR0026` and `CHR0034` protect those boundaries. Sensitive
natural identifiers use a random surrogate stream ID.

## Placement convention

In an application, place the concept with the feature/module that owns its
meaning; use `Common/` only for genuinely cross-feature concepts. Do not create
a top-level `Features/` wrapper. Framework and client repositories follow their
own structure.

## Verify

- one-value concept with an `IComparable` underlying type;
- optional conversions, factories, and sentinels are domain-justified;
- event-source identity represents and is passed as the actual Chronicle stream
  ID;
- relevant analyzers, build, and specifications pass;
- file has the repository license header.
