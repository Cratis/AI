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
