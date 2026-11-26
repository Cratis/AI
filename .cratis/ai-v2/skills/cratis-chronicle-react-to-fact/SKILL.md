---
name: cratis-chronicle-react-to-fact
compatibility: .NET SDK and Chronicle reactor APIs.
description: Use when a Chronicle reactor must notify another system or invoke a follow-up command after commit. Not for an operation needed before commit (cratis-arc-declare-operation) or an inbox subscription (cratis-chronicle-publish-contract).
---

# Deliver a repeatable effect

1. Name the committed fact and the external effect. A registration notice failing does not undo AuthorRegistered. **Done:** the caller can distinguish an accepted registration from a pending notice.
2. Implement `IReactor`; return the asynchronous downstream operation from the typed handler. Pass a stable key to a receiver that atomically remembers completed effects. For example:

```csharp
public class RegistrationNotice(INotices notices) : IReactor
{
    public Task Registered(AuthorRegistered fact, ReactorDelivery delivery) =>
        notices.Send(delivery.Id, fact.Name);
}
```

**Done:** two deliveries of the same fact to this reactor use the same `delivery.Id`, not a fresh request ID; a failed downstream result throws or otherwise fails the handler instead of advancing it.
3. Substitute a receiver that commits the notice but loses the acknowledgement on the first attempt. Deliver again. **Done:** the first call visibly fails, the second succeeds and only one notice exists. A local receipt written after a non-idempotent call leaves a crash window. Read references/replay-and-retries.md before replaying an observer with effects.

Run `dotnet test -c Release` in the application's reactor spec project. Deliver the same fact twice: both calls must use the same delivery key and the receiver must apply the effect only once. If the receiver duplicates it despite equal keys, verify the receiver's idempotency contract before retrying.
