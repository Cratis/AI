---
name: cratis-chronicle-evolve-event
compatibility: .NET SDK and Chronicle event migration APIs.
description: Use when a registered Chronicle event needs a new schema generation and stored events must remain readable. Not for a new event declaration (cratis-chronicle-record-event) or an EF migration (cratis-arc-connect-storage).
---

# Keep both generations readable

1. Compare the registered schema to the proposed contract, using examples from retained data, including missing optional values. Don't repurpose the existing type ID for a different fact. **Done:** identify a breaking change that actually requires a generation, not just a display label.
2. Preserve the previous record. Give the current record the same event type ID and next generation, and bind the prior one with `EventTypeGenerationFor<T>`. Implement adjacent `Upcast` and `Downcast` recipes on `EventTypeMigration<TCurrent,TPrevious>`. For `Name` becoming `DisplayName`, map by rename in both directions, not by splitting on spaces. **Done:** old and new reader contracts each have a defined result for writes in either generation. Read references/generation-fixtures.md before treating a lossy transform as reversible.
Example upcast body (the downcast swaps source and target):

```csharp
builder.Properties(p => p.RenamedFrom(t => t.DisplayName, s => s.Name));
```

3. Register both shapes and the recipe on a disposable clone; append in each generation and inspect results from each reader. For existing events, wait for backfill before checking stored representations. **Done:** original values survive in both reader shapes after backfill; report unsupported cases rather than silently substituting defaults. A successful build or recipe registration is not a backfill test.

Run `dotnet test -c Release` in the application's migration spec project. Assert that old and new readers recover the expected values in both directions. If an old field is empty on downcast, check the reverse mapping before migrating retained data.
