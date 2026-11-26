---
name: cratis-arc-declare-operation
description: Use when a command needs an ICommandOperation for rollback or undo of a provider write. Not for a reaction after commit (cratis-chronicle-react-to-fact).
compatibility: Requires the .NET SDK.
---

# Declare a reversible provider action

1. Identify the resource, tenant, authorized owner and attempt identity. Make the provider bind an attempt to its request and prevent reversal of an earlier finalized success. **Done:** retrying a key against different data is rejected and an old reservation survives another attempt's failure. If the provider cannot distinguish ownership, stop before promising compensation.
2. Return an `ICommandOperation` record from `Handle()` instead of performing the write there. Carry immutable request data; let Arc inject the provider and cancellation token into public instance `Execute` and `Compensate` methods. **Done:** calling the handler merely constructs the declaration; pipeline execution performs exactly one provider call.
3. Exercise the pipeline with a recording provider: success; failure after the provider acted; refusal before it acted. When there is no commit participant or it reports no commit, recovery can include the throwing operation and proceeds in reverse attempt order. A committed, mixed or unknown outcome must not trigger blind reversal. **Done:** `dotnet test -c Release` in the application's pipeline-spec project verifies the actual call sequence, and the original failure remains visible even if compensation also fails. Record unresolved attempts for reconciliation; timeouts alone don't establish absence, and compensation isn't crash recovery.

For example, keep the attempted reservation's identity on the operation so compensation cannot remove a pre-existing reservation:

```csharp
public record Reserve(Guid AttemptId) : ICommandOperation
{
    bool inserted;
    public void Execute(Provider provider)
    {
        if (!provider.Reservations.Add(AttemptId)) throw new InvalidOperationException("Attempt already exists");
        inserted = true;
        if (provider.FailAfterWrite) throw new InvalidOperationException("Interrupted after reservation");
    }
    public void Compensate(Provider provider) { if (inserted) provider.Reservations.Remove(AttemptId); }
}
```
