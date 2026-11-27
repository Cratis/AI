---
name: cratis-chronicle-evolve-event
description: Use when a maintainer changes a stored event shape and needs a new generation with upcasting and downcasting. Not for relational schema migrations (use cratis-arc-migrate-relational-schema).
compatibility: .NET SDK and Chronicle event migrations.
---

# Rename AuthorRegistered.Name without breaking older readers

1. Reference `Cratis.Chronicle`. In the registration feature, keep the old `Name` payload, the current `DisplayName` payload and the migration together. Keep any existing constraint on the renamed property.
2. Keep the stored ID `AuthorRegistered` and increment the generation. Mark the old type with `[EventTypeGenerationFor<AuthorRegistered>(1)]`. Both types must resolve to the same ID and their generations must be adjacent.
3. Put `AuthorRegisteredMigration` in the backend assembly with the event records. With default client discovery no separate migration registration is needed. In both methods, specify the destination property first, then the source property.

```csharp
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Events.Migrations;

namespace Library.Features.Authors.Registration;

[EventType(generation: 2)] public record AuthorRegistered(string DisplayName);
[EventTypeGenerationFor<AuthorRegistered>(1)] public record AuthorRegisteredV1(string Name);

public class AuthorRegisteredMigration : EventTypeMigration<AuthorRegistered, AuthorRegisteredV1>
{
    public override void Upcast(IEventMigrationBuilder<AuthorRegistered, AuthorRegisteredV1> builder) =>
        builder.Properties(p => p.RenamedFrom(t => t.DisplayName, s => s.Name));

    public override void Downcast(IEventMigrationBuilder<AuthorRegisteredV1, AuthorRegistered> builder) =>
        builder.Properties(p => p.RenamedFrom(t => t.Name, s => s.DisplayName));
}
```

Roll out readers capable of handling the new shape before switching writers. Keep the old generation and transforms while either shape is consumed; never rewrite history to roll back a reader.

## Check the compatibility promise

In the repository's existing migration specs, cover both directions of the rename once: old `Name = "Aster"` becomes current `DisplayName = "Aster"`; current `DisplayName = "Birch"` becomes old `Name = "Birch"`. No extra project or live kernel is needed for the ordinary migration spec.

## When to choose another path

- **Old-generation consumers stay deployed:** use the [two-generation rollout check](references/deployed-readers.md) when you need to verify compatibility across the deployment.
- **The business outcome was wrong:** append a compensating fact to correct what happened, not a new generation of the same fact.
- **A third shape is needed:** mark the former current payload `[EventTypeGenerationFor<AuthorRegistered>(2)]` and retain generation one. Define two adjacent migrations; check the oldest payload through the full chain.

## Related skills

- [Declare a registration](../cratis-chronicle-record-event/SKILL.md)
- [Project registrations](../cratis-chronicle-project-view/SKILL.md)
