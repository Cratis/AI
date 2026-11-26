---
name: cratis-chronicle-reduce-state
compatibility: .NET SDK and Chronicle reducers.
description: Use when writing a Chronicle reducer that decides the next read-model state from its prior state. Not for straight field mappings or cross-source joins (cratis-chronicle-project-view).
---

# Fold one source at a time

1. Write the empty state and two transitions whose result depends on order. If the only requirement is copying AuthorRegistered.Name to Author.Name, give the mapping to [Map events into keyed rows](../cratis-chronicle-project-view/SKILL.md). **Done:** the example explains why a direct mapping is insufficient.
2. Put a public static `Reduce` method on the read model for each event it handles. Treat missing `current` as the first event, and return the next state; do not read the clock, another source, or a live service. **Done:** replay needs only the same ordered facts and deterministic rules. Example extension: keep the first registered name, count subsequent registrations without overwriting it.

```csharp
public record RegistrationHistory(string FirstName, int Count)
{
    public static RegistrationHistory Reduce(AuthorRegistered fact, RegistrationHistory? current) =>
        current is null ? new(fact.Name, 1) : current with { Count = current.Count + 1 };
}
```

3. Feed interleaved histories, rebuild from empty state and compare both keys. A shared count means the fold or test mixed partitions. Read references/active-or-passive.md when choosing where the result lives. **Done:** Aster then Birch for A yields `(Aster, 2)` regardless of registrations for B; B retains its own first name and count.

For the specification structure, give the initial state, ordered inputs and expected state to [Specify one decision without a host](../cratis-specifications-isolate-behavior/SKILL.md).

Run `dotnet test -c Release` in the application's reducer spec project. Assert the state after each ordered event and after folding the same history from empty state. If the first transition fails on null state, handle the empty history before reading prior values.
