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
3. Give each review a unique `publicationId` before the first attempt and retain it with the inputs for retry. Append the review to the event log, then the listing to the outbox. Key each write: they are not atomic.

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
    public static async Task<AppendResult> Publish(IEventStore producer, AuthorId id, string name, Guid publicationId)
    {
        var review = await producer.EventLog.AppendOnce(id, new AuthorReviewed(), new IdempotencyKey($"review:{publicationId:N}"));
        if (!review.IsSuccess || review.HasIdempotencyConflicts) return review;
        var outbox = producer.GetEventSequence(EventSequenceId.Outbox);
        return await outbox.AppendOnce(id, new AuthorListed(name), new IdempotencyKey($"listing:{publicationId:N}"));
    }
}
```

`AuthorId` comes from Name a domain value (the `cratis-fundamentals-name-value` skill, when installed). Require `result.IsSuccess && !result.HasIdempotencyConflicts` for publication success.

## Check the public handoff

Use disposable stores for this one-off wiring check. If the public/private boundary is an uncovered application promise, extend the existing backend check (the `cratis-specifications-exercise-backend` skill, when installed); don't add a hosted spec of Chronicle forwarding. In the directory, resolve `consumer` from a fresh service scope as above. Select `var inbox = consumer.GetEventSequence($"{EventSequenceId.InboxPrefix}library");` and read `await inbox.GetFromSequenceNumber(EventSequenceNumber.First, id)`. Forwarding and consumption have separate checkpoints; subscribing does not by itself route an explicit consumer observer to the inbox. Route it to the intended per-source sequence. Delivery is asynchronous: repeat that read until it returns the listing, stopping with a timeout after 30 seconds. In this fresh fixture, verify `AuthorListed` carries the public name and `AuthorReviewed` is absent. That does not establish exactly-once forwarding.

## Avoid

- Don't treat `[Public]` as a write: append to the outbox.
- Don't omit `WithEventType<AuthorListed>()`; without a selection the subscription builder includes all registered event types.

## When it goes off the usual path

- **An acknowledgement is lost:** either write may have committed before its reply was lost. Retry `Publish` with the original `publicationId`, author and name. Each matching keyed append that already committed writes nothing; a missing listing can still be appended. Stop on a key conflict rather than generating a fresh key.
- **The directory did not update:** repeat the `inbox` read above. If the listing arrived, check `await consumer.Observers.GetAll()` for the listing observer on that sequence. If the outbox has the listing but the inbox does not, verify `WithEventType<AuthorListed>()` in the directory's subscription setup. Replaying forwarding can create a new inbox row; for a listing published once per author, use `AuthorId` to upsert the listing instead of keying it by inbox position.

## Related skills

- Choose a Chronicle client (the `cratis-chronicle-select-client` skill, when installed) before implementing the consumer in another language.

- [Append an event](../../cratis-chronicle-record-event/SKILL.md)
- [Send a post-commit notice](../../cratis-chronicle-react-to-fact/SKILL.md)
