---
name: event-type-migrations
description: Evolve a Cratis Chronicle event schema without breaking replay — add a new generation and an EventTypeMigration so old stored events upcast into the new shape. Use when an event needs a new required property, a renamed property, or a structural change after events of the prior shape already exist.
---

# Event Type Migrations

Chronicle stores events forever. When an event's schema must change, you write a **migration** rather than editing the original record — Chronicle auto-discovers migrations and applies them when reading old events.

> **You only need this once events of the prior shape exist somewhere you can't regenerate** (a real environment's event log). Before that — in greenfield development with disposable data — rename event types and change schemas freely; a migration just adds dead code that hides the real schema in `git log`.

## When you need it

- An `[EventType]` needs a new required property (adding it would break observers reading old events).
- A property is renamed; old events carry the old name.
- The event shape changes structurally.

> **Never add a nullable value type to an `[EventType]` to represent "absent on old events"** — Chronicle's analyzer warns on nullable event members. Add a migration with a default instead.

## Generations

Every `[EventType]` has a **generation** (starts at `1`). Each schema change increments it. Chronicle routes stored events through the migration chain before delivering them to projections/reducers.

```
Generation 1 (stored) → Migration 1→2 → Migration 2→3 → Current (Generation 3)
```

**Chronicle keys generations by the `[EventType]` *id*, not by the C# type name.** `EventTypeAttribute(string id = "", uint generation = 1)` defaults the id to the type name — so two records named `OrderPlaced` and `OrderPlacedV1` default to two *different* ids and are, as far as Chronicle is concerned, unrelated event types. The migration chain never forms and old events are never upcast.

This is the one place a `[EventType]` **must** take arguments: every generation of the same event carries the **same explicit id** and differs only by `generation`. Analyzer **CHR0037** reports it when they don't — a Warning, so a build failure under the zero-warning gate.

## Steps

### 1. Keep the prior record and bump the generation on the new one

Both records carry the **same explicit id**; only the generation differs:

```csharp
// The prior shape, kept so the migration can name it as TPrevious.
[EventType("OrderPlaced", generation: 1)]   // a new event takes no arguments; only migrated generations do
public record OrderPlacedV1(OrderId OrderId);

// The current shape.
[EventType("OrderPlaced", generation: 2)]   // same id — never change it once chosen — next generation
public record OrderPlaced(OrderId OrderId, Currency Currency);
```

The C# type names are free to differ (`OrderPlacedV1` vs `OrderPlaced`) precisely *because* the shared id — not the type name — is what ties them together. Pick the id once, when you write the first migration, and never change it again.

### 2. Write the migration

Implement `EventTypeMigration<TUpgrade, TPrevious>` — `TUpgrade` is the current shape, `TPrevious` the prior. Chronicle extracts the generations, validates they're consecutive, and discovers the migration automatically (no registration).

`Upcast` and `Downcast` are both `public abstract void` and take an `IEventMigrationBuilder<TTarget, TSource>` — you describe the change declaratively through `builder.Properties(...)`, you do not construct the record by hand:

```csharp
public class OrderPlacedV1ToV2 : EventTypeMigration<OrderPlaced, OrderPlacedV1>
{
    public override void Upcast(IEventMigrationBuilder<OrderPlaced, OrderPlacedV1> builder) =>
        builder.Properties(p => p.DefaultValue(_ => _.Currency, Currency.From("NOK")));   // new field's default

    public override void Downcast(IEventMigrationBuilder<OrderPlacedV1, OrderPlaced> builder) =>
        builder.Properties(_ => { });   // map back for any consumers still on gen 1
}
```

The property builder exposes `DefaultValue`, `RenamedFrom`, `Split`, and `Combine` — use them to express the change declaratively. Both `Upcast` and `Downcast` are abstract on the base, so both must be implemented (`Downcast` may be a no-op `builder.Properties(_ => { })` when no consumer needs the gen-1 shape).

### 3. Chain across generations

For three generations, write two migrations (`1→2`, `2→3`) — each only knows its adjacent pair; Chronicle chains them.

## Common pitfalls

| Pitfall | Why it breaks |
|---|---|
| Two generations without a **shared explicit** `[EventType]` id | The id defaults to the type name, so Chronicle sees two unrelated event types and the migration silently never applies — CHR0037 |
| Editing the stored event record without bumping `generation` | Old events still carry the old schema; Chronicle won't migrate them |
| Adding a nullable value type to handle "missing old data" | Analyzer-flagged anti-pattern; use a migration default |
| A migration that throws on a null/missing old field | Old events may lack fields entirely — null-coalesce / default |
| Splitting one event into two inside `Upcast` | `Upcast` returns one event; model a split as a reactor/command, not a schema migration |

## Quality gate

- [ ] Build is clean — in particular no **CHR0037**, which means every generation shares one explicit `[EventType]` id.
- [ ] Old-generation events upcast to the current shape when replayed through a `ReadModelScenario<T>`.
- [ ] No nullable value types introduced on `[EventType]` records.

## See also

- `vertical-slices.md` — event type rules (non-nullable, naming).
- `event-modeling` — deciding when a fact is a new event vs a migration.
