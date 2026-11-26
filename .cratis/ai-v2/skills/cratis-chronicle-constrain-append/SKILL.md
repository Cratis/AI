---
name: cratis-chronicle-constrain-append
compatibility: .NET SDK and a disposable Chronicle kernel for append checks.
description: Use when a Chronicle constraint must reserve a unique value or permit an event type once per source. Not for input validation (cratis-arc-validate-command) or a guarded decision read (cratis-chronicle-protect-decision).
---

# Enforce the invariant at append

1. Write two appends that cannot both win. Distinguish a source claiming a property value from an event occurring once in that source. A unique author name is a separate product decision, not implied by registration. **Done:** the example states whether the conflict is between different owners or repeated occurrences under one owner.
2. Start model-bound. Use `[property: Unique(...)]` on the identifying value for ownership; place `[Unique]` on the registered event type to limit occurrences per source. A separate `IConstraint` is for a rule requiring separate composition. **Done:** the discovered definition has the intended name and scope. For example:

```csharp
[EventType]
[Unique(name: "one-registration", message: "Author already registered.")]
public record AuthorRegistered(string Name);
```

3. Race the writes without a preflight lock. Check the losing append's constraint name, not just an exception or validation message. Read references/creation-guards.md when a preflight query appears to enforce the rule. **Done:** one success, one `one-registration` violation, exactly one matching fact under that source; an independent source can register.

Run `dotnet test -c Release` in the application's constraint spec project against a disposable kernel. If both appends succeed, check that the constraint was discovered and the competing writes used the same constrained key. The spec passes only when the loser reports the named constraint and no second fact was stored.
