---
name: cratis-chronicle-publish-contract
description: Publishes a selected Chronicle event from one event store to another. Use when delivering a public contract through outbox and inbox. Not for notifying a receiver within a store (use cratis-chronicle-react-to-fact).
compatibility: .NET SDK and disposable producer and consumer stores.
---

# Publish an author's listing without sharing the internal review

1. Reference `Cratis.Chronicle` in both services. Put the public event in a project both reference. Mark it `[Public]` and name its originating store. Keep `InternalReview` in the library service.
2. In the directory's `Program.cs`, call `await consumer.Subscriptions.Subscribe("library-listings", "library", subscription => subscription.WithEventType<AuthorListed>());` with the directory's `IEventStore`. Import `Library.Contracts`. This subscription belongs in the consumer, not the library's publishing class.
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
using Library.Authors.Registration;
using Library.Contracts;

namespace Library.Authors.Publication;

[EventType] public record InternalReview;

public static class ListingExchange
{
    public static async Task<AppendResult> Publish(IEventStore producer, AuthorId id, string name)
    {
        var review = await producer.EventLog.Append(id, new InternalReview());
        if (!review.IsSuccess) return review;
        return await producer.GetEventSequence(EventSequenceId.Outbox).Append(id, new AuthorListed(name));
    }
}
```

`AuthorId` comes from [Record an event](../cratis-chronicle-record-event/SKILL.md). Check `result.IsSuccess` for the returned publication result. In the directory, after delivery, select `var inbox = consumer.GetEventSequence($"{EventSequenceId.InboxPrefix}library");` and read `await inbox.GetFromSequenceNumber(EventSequenceNumber.First, id)`. For a newly published author expect a single `AuthorListed` with the public name, not `InternalReview`.

## Avoid

- Don't treat `[Public]` as a write: append to the outbox.
- Don't omit `WithEventType<AuthorListed>()`; without a selection the subscription builder includes all registered event types.
- Don't report that the review was rolled back if the separate outbox append failed.

## Related skills

- [Append an event](../cratis-chronicle-record-event/SKILL.md)
- [Send a post-commit notice](../cratis-chronicle-react-to-fact/SKILL.md)
