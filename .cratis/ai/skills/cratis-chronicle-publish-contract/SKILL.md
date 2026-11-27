---
name: cratis-chronicle-publish-contract
description: Use when a maintainer needs to publish a selected public event between Chronicle stores through an outbox and inbox. Not for notifying a receiver within a store (use cratis-chronicle-react-to-fact).
compatibility: .NET SDK and disposable producer and consumer stores.
---

# Publish an author's listing without sharing the internal review

For outbound translation, adapt the private review fact to the public listing contract. The outbox and inbox transport that contract; a subscription does not translate it into the receiver's local vocabulary.

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
3. In the library's publishing feature, append the internal review to the event log. These writes are not atomic. Only after acceptance, append the public listing to the outbox for the same `AuthorId`.

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

`AuthorId` comes from [Name a domain value](../cratis-fundamentals-name-value/SKILL.md). Check `result.IsSuccess` for the returned publication result.

## Check the public handoff

Use disposable stores for this one-off wiring check. If the public/private boundary is an uncovered application promise, extend the existing [backend check](../cratis-specifications-exercise-backend/SKILL.md); don't add a hosted spec of Chronicle forwarding. In the directory, resolve `consumer` from a fresh service scope as above. Select `var inbox = consumer.GetEventSequence($"{EventSequenceId.InboxPrefix}library");` and read `await inbox.GetFromSequenceNumber(EventSequenceNumber.First, id)`. Forwarding and consumption have separate checkpoints; subscribing does not by itself route an explicit consumer observer to the inbox. Route it to the intended per-source sequence. Delivery is asynchronous: repeat that read until it returns the listing, stopping with a timeout after 30 seconds. In this fresh fixture, verify `AuthorListed` carries the public name and `AuthorReviewed` is absent. That does not establish exactly-once forwarding.

## Avoid

- Don't treat `[Public]` as a write: append to the outbox.
- Don't omit `WithEventType<AuthorListed>()`; without a selection the subscription builder includes all registered event types.

## When it goes off the usual path

- **The review commits but publication fails:** read `await producer.GetEventSequence(EventSequenceId.Outbox).GetFromSequenceNumber(EventSequenceNumber.First, id)`. If the intended listing is already there, don't append it again. For a confirmed missing listing, retry just the `Outbox` append shown above, not `Publish`.
- **The directory did not update:** repeat the `inbox` read above. If the listing arrived, check `await consumer.Observers.GetAll()` for the listing observer on that sequence. If the outbox has the listing but the inbox does not, verify `WithEventType<AuthorListed>()` in the directory's subscription setup. Replaying forwarding can create a new inbox row; for a listing published once per author, use `AuthorId` to upsert the listing instead of keying it by inbox position.

## Related skills

- [Choose a Chronicle client](../cratis-chronicle-select-client/SKILL.md) before implementing the consumer in another language.

- [Append an event](../cratis-chronicle-record-event/SKILL.md)
- [Send a post-commit notice](../cratis-chronicle-react-to-fact/SKILL.md)
