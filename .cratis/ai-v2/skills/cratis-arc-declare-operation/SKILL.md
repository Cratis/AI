---
name: cratis-arc-declare-operation
description: Use when a command needs an ICommandOperation to execute and compensate a provider write. Not for a reaction after commit (cratis-chronicle-react-to-fact).
---

# Declare a reversible provider action

1. Identify the resource, tenant, authorized owner and attempt identity. Make the provider bind an attempt to its request and prevent reversal of an earlier finalized success. **Done:** retrying a key against different data is rejected and an old reservation survives another attempt's failure. If the provider cannot distinguish ownership, stop before promising compensation.
2. Return an `ICommandOperation` record from `Handle()` instead of performing the write there. Carry immutable request data; let Arc inject the provider and cancellation token into public instance `Execute` and `Compensate` methods. **Done:** calling the handler merely constructs the declaration; pipeline execution performs exactly one provider call.
3. Exercise the pipeline with a recording provider: success; failure after the provider acted; refusal before it acted. When there is no commit participant or it reports no commit, recovery can include the throwing operation and proceeds in reverse attempt order. A committed, mixed or unknown outcome must not trigger blind reversal. **Done:** `dotnet test` shows the actual call sequence, and the original failure remains visible even if compensation also fails. Record unresolved attempts for reconciliation; timeouts alone don't establish absence, and compensation isn't crash recovery.
