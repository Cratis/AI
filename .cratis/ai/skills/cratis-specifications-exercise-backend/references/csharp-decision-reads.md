# Prove guarded reads and competing writes in C#

Applies when a command claims uniqueness, or decides from history that another writer could change before the commit.

## Prove a uniqueness claim

Exercise a real claim, then a conflicting one from a different source. The scenario has two seeding paths, and only one of them reaches the constraint:

- `_scenario.EventScenario.Given.ForEventSource(id).Events(...)` appends to the scenario's event log. Constraints see these events.
- `_scenario.Given.ForEventSource(id).Events(...)` supplies the state the command's read models are built from.

This fragment assumes the application registers a unique-name constraint over `AuthorRegistered.Name` and exposes its registered name as `AuthorConstraintNames.UniqueName`. Seeding an event does not register a constraint.

```csharp
public class when_registering_an_author_with_a_taken_name : Specification
{
    readonly EventSourceId _existing = EventSourceId.New();
    readonly EventSourceId _author = EventSourceId.New();
    readonly CommandScenario<RegisterAuthor> _scenario = new();
    CommandResult _result = null!;

    Task Establish() => _scenario.EventScenario.Given.ForEventSource(_existing).Events(new AuthorRegistered("Aster"));
    async Task Because() => _result = await _scenario.Execute(new RegisterAuthor(_author, "Aster"));
    void Destroy() => _scenario.Dispose();

    [Fact] public void should_name_the_violated_constraint() => _result.ShouldHaveConstraintViolationFor(AuthorConstraintNames.UniqueName);
    [Fact] public async Task should_append_nothing_for_the_refused_author() => (await _scenario.EventLog.HasEventsFor(_author)).ShouldBeFalse();
}
```

`ShouldHaveConstraintViolationFor` checks both the `ConstraintViolation` reason and the exact name, so a missing read model or a different constraint cannot satisfy it. Keep the no-events fact: it verifies storage, which the result does not.

## Prove a guarded decision

A command that declares read protection, `[ProtectedDecision]`, a `DecisionRead<T>` parameter or a per-stream read model is run in decision mode automatically. One shared log then supplies seeded history, the guarded read and the commit.

- Seed with `_scenario.Given.ForEventSource(id).Events(...)`. `_scenario.EventScenario` throws in this mode.
- Give the command state and assert the outcome. Do not invent sequence numbers or decision tokens, and do not simulate a concurrent writer: the guard itself is the framework's behavior, already covered there.
- `EnableDecisionReads()` exists only for an untyped `CommandScenario<object>` that executes protected commands; call it before seeding. A typed scenario needs no switch.
- `AppendConcurrently(source, events)` is hidden from editor completion and exists to verify the framework's concurrency handling. Use it only when the task explicitly asks to prove a guard against an interleaved writer.

To prove a concurrency rule on a direct append rather than a command, pass the real expected tail in the concurrency scope and assert `ShouldHaveConcurrencyViolations()` on the append result. `ConcurrencyScope.None` proves that no guard applies.

## Check that every guarded read is admitted

Chronicle refuses a guarded read of a model it cannot protect, and with read protection `On` that refusal stops the host at startup by default. One assembly-wide spec catches it before deployment without executing a command:

```csharp
using Cratis.Arc.Chronicle.Testing.Commands;

public class when_checking_decision_read_admission
{
    [Fact]
    public void should_admit_every_protected_decision_read() =>
        DecisionReadAdmissions.ShouldAdmitDecisionReadsIn(typeof(RegisterAuthor).Assembly);
}
```

A failure throws `DecisionReadsAreRefused` and lists each command, read model and refusal reason. The helper cannot see an `IDecisionReads.Get<T>(key)` call inside a method body; run that command in a scenario instead.
