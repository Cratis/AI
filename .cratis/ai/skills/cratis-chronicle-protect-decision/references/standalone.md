# Guard a standalone append

Choose this path for a writer outside the Arc command pipeline. Use the same `IEventStore` (including namespace) for the decision and write. Import `Cratis.Chronicle`, `Cratis.Chronicle.Events`, `Cratis.Chronicle.EventSequences` and `Cratis.Chronicle.ReadModels`. Here `source` is the book's `EventSourceId`, and the enclosing method returns `Task<bool>`:

```csharp
var stock = await eventStore.GetDecisionReads().GetDetached<BookStock>(source);
if (!stock.IsProtected || stock.Instance is not { Available: > 0 }) return false;

var result = await eventStore.EventLog.AppendMany(
    [new EventForEventSourceId(source, new BookBorrowed())],
    guardedBy: [stock]);
return result.IsSuccess;
```

The detached read alone doesn't guard a write: the append must carry it. To distinguish a stale decision from other failures, inspect `result.GetDecisionConflicts([stock])`. Read again and re-evaluate the rule before attempting another append.

## Keep nested appends inside the transaction or receipt

In a custom owner, open `IUnitOfWork.RefuseImmediateAppends()` before invoking callbacks. A native immediate append throws `ImmediateAppendRefused` before transport, even through an already captured sequence. The refusal lasts until the owning frame is disposed, not merely until commit. This is separate from read protection.

```csharp
var captured = eventStore.EventLog;
var unit = eventStore.UnitOfWorkManager.Begin(correlationId);
using var refusal = unit.RefuseImmediateAppends();
unit.UseEffectReceipt(key, response);
await captured.Transactional.Append(source, fact);
await refusal.Commit();
// Inspect the unit’s commit result before reporting success.
```

This example assumes no existing completion owner or enforced reads. If the unit already has a completion owner, keep that path and hold the refusal frame through completion. Borrowers may stage events but must not commit or roll back. In a spec, capture the sequence before opening the frame; attempt an immediate append through it, assert refusal with no write, then verify the transactional fact and receipt commit together. Check the refusal still holds between commit and disposal.
