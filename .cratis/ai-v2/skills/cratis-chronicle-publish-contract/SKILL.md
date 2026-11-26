---
name: cratis-chronicle-publish-contract
description: Use when publishing a selected Chronicle event as a public contract between event stores through outbox and inbox. Not for notifying a receiver within a store (use cratis-chronicle-react-to-fact).
compatibility: .NET SDK and disposable producer and consumer stores.
---

# Publish an author's listing without sharing the internal review

1. Reference `Cratis.Chronicle` in both services. Put the public event in a project both reference. Mark it `[Public]` and name its originating store. Keep the private `AuthorReviewed` event in the library service's `Features/Authors/Publication/AuthorReviewed.cs`.
2. Configure the directory host's Chronicle store as `directory`. In its `Program.cs`, after `app.UseCratisChronicle()` and before `app.RunAsync()`, resolve its scoped `IEventStore` and register the subscription. Import `Cratis.Chronicle`, `Library.Contracts` and `Microsoft.Extensions.DependencyInjection`.

```csharp
using (var scope = app.Services.CreateScope())
{
    var consumer = scope.ServiceProvider.GetRequiredService<IEventStore>();
    await consumer.Subscriptions.Subscribe("library-listings", "library",
        subscription => subscription.WithEventType<AuthorListed>());
}
```
3. In the library's publishing feature, append the internal review to the event log. Only after acceptance, append the public listing to the outbox for the same `AuthorId`.

```csharp
// Library.Contracts/AuthorListed.cs
using Cratis.Chronicle.Events;

namespace Library.Contracts;

[EventType, Public, EventStore("library")]
public record AuthorListed(string PublicName);
```

```csharp
// Features/Authors/Publication/ListingExchange.cs
using Cratis.Chronicle;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Library.Features.Authors;
using Library.Contracts;

namespace Library.Features.Authors.Publication;

// Features/Authors/Publication/AuthorReviewed.cs (same namespace)
[EventType] public record AuthorReviewed;

public static class ListingExchange
{
    public static async Task<AppendResult> Publish(IEventStore producer, AuthorId id, string name)
    {
        var review = await producer.EventLog.Append(id, new AuthorReviewed());
        if (!review.IsSuccess) return review;
        return await producer.GetEventSequence(EventSequenceId.Outbox).Append(id, new AuthorListed(name));
    }
}
```

`AuthorId` comes from [Name a domain value](../cratis-fundamentals-name-value/SKILL.md). Check `result.IsSuccess` for the returned publication result. In the directory's integration test, resolve `consumer` from a fresh service scope as above. Select `var inbox = consumer.GetEventSequence($"{EventSequenceId.InboxPrefix}library");` and read `await inbox.GetFromSequenceNumber(EventSequenceNumber.First, id)`. Delivery is asynchronous: repeat that read until it returns the listing, failing the test after 30 seconds. For a newly published author expect a single `AuthorListed` with the public name, not `AuthorReviewed`.

## Avoid

- Don't treat `[Public]` as a write: append to the outbox.
- Don't omit `WithEventType<AuthorListed>()`; without a selection the subscription builder includes all registered event types.
- Don't report that the review was rolled back if the separate outbox append failed.

## Related skills

- [Append an event](../cratis-chronicle-record-event/SKILL.md)
- [Send a post-commit notice](../cratis-chronicle-react-to-fact/SKILL.md)
