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

- **Old-generation consumers stay deployed:** use the [two-generation rollout check](deployed-readers.md) when you need to verify compatibility across the deployment.
- **The business outcome was wrong:** append a compensating fact to correct what happened, not a new generation of the same fact.
- **A third shape is needed:** mark the former current payload `[EventTypeGenerationFor<AuthorRegistered>(2)]` and retain generation one. Define two adjacent migrations; check the oldest payload through the full chain.

## Related skills

- [Declare a registration](../../cratis-chronicle-record-event/SKILL.md)
- [Project registrations](../../cratis-chronicle-project-view/SKILL.md)

## Roll out against old history

A property rename changes a path, not a stored enum or code. Builder paths address serialized JSON properties, not raw CLR names; nested paths need compatible schema metadata. Do not make a required new field nullable merely because V1 lacked it. Keep external idempotency keys stable independently of migration.

For a route whose V1 `Lane` is exactly two space-separated tokens, split `"North East"` into `Region` and `Branch` on upcast and combine them on downcast. With V1 and V2 endpoints declared as above and old/current code properties named `Code`, use the following bodies:

```csharp
// Upcast
builder.Properties(p => p
    .Split(t => t.Region, s => s.Lane, PropertySeparator.Space, SplitPartIndex.First)
    .Split(t => t.Branch, s => s.Lane, PropertySeparator.Space, SplitPartIndex.Second));
// Downcast
builder.Properties(p => p.Combine(t => t.Lane, PropertySeparator.Space, s => s.Region, s => s.Branch));
// MapValues: For takes current, then previous; Map pairs previous, then current.
builder.For(current => current.Code, previous => previous.Code, map => map
    .Map("queued", "pending")
    .Map("waiting", "pending"));
```

This many-to-one translation intentionally uses the first declared reverse pair: downcast `"pending"` to `"queued"`, not an inferred original. In the migration spec, upcast a stored V1 payload `(Lane: "North East", Code: "waiting")` to `(Region: "North", Branch: "East", Code: "pending")`, then downcast that representation to `("North East", "queued")`. If callers require the original distinction, retain it instead of collapsing the codes.

Upgrade every kernel silo before registering new generations. Automatic backfill adds missing representations in the **default namespace’s event log only**; it does not replace an existing representation when you edit the mapping. Inventory other namespaces and sequences separately. Compatibility delivery is not an exact generation pin. Use a supported unambiguous pin and verify real delivery to the older reader; introducing a new generation does not move a previously resolved pin. A read-model scenario alone cannot establish that delivery. Ordinary records can use normal discovery; with explicit or aliased artifacts register the endpoint pair and resolve their IDs through the target store’s registry.

For an exceptional in-place repair, use the separate [bulk repair checklist](bulk-repair.md), not this rollout.
