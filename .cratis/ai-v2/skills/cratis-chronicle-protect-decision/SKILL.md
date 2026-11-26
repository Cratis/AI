---
name: cratis-chronicle-protect-decision
compatibility: .NET SDK and a disposable Chronicle kernel for the race.
description: Use when a command decision needs optimistic concurrency for a Chronicle decision read or a dynamic consistency boundary. Not for unique property ownership or once-per-source appends (cratis-chronicle-constrain-append).
---

# Refuse a decision based on stale facts

1. State the read that changes the decision: for example, create a draft only for an existing author. An absent instance also represents a decision input. Record the source, stream if narrower, and events that could invalidate it. **Done:** a competing removal changes the answer; a write for an unrelated author does not.
2. In Arc, start with an eligible plain read-model `Handle` parameter under effective protection `On` (the default unless overridden). Check application, command and maximum mode settings. `Measure` does not enforce ordinary parameter reads. Don't substitute a Mongo read, preflight query, or immediate append. Read references/scope-selection.md when the key is ambiguous. **Done:** the decision sees a fresh fold and stages its write under the guard that protects that same read.
For an explicit Chronicle unit, acquire with `await store.GetDecisionReads().GetFor<Author>(unit, source)` inside `unit.EnforceReadProtection()`. Inspect `Exists` even when no instance was returned. Stage on that same unit and let its commit owner complete it; independently querying the model and constructing a new unit at write time loses the decision boundary.

3. Pause after acquisition, append an invalidating fact independently, then commit. Distinguish admission failure from stale data; read references/conflict-outcomes.md when reporting the refusal. **Done:** no contradictory event, a fresh attempt reads the changed state and changes the decision. Never retry just the stale write.

Check the refused unit of work for the source that invalidated the decision:

```csharp
        Assert.False(first.IsSuccess);
        Assert.Contains(first.GetConcurrencyViolations(), violation => violation.EventSourceId == source);
```

Run `dotnet test -c Release` in the application's decision spec project against a disposable kernel. The stale decision must not append; a fresh protected read must see the winning fact. If both appends succeed, check that read protection was enforced on the unit of work that committed, not only measured.
