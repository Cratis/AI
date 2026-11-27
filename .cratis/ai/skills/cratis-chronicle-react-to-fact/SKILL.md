---
name: cratis-chronicle-react-to-fact
description: Use when a maintainer needs a Chronicle reactor to notify a downstream service after commit without duplicating side effects on retry. Not for publishing an inter-service event contract (use cratis-chronicle-publish-contract).
compatibility: .NET SDK and Chronicle reactor APIs.
---

# Notify the author directory after registration

Implement the local automation with a reactor, an observer that acts on a committed fact rather than building a read model or importing outside data.

1. Reference `Cratis.Chronicle`. Put `RegistrationNotice` in the feature that sends directory notices. Import `AuthorRegistered` from [Record an event](../cratis-chronicle-record-event/SKILL.md).
2. Implement `IReactor`. Take `AuthorRegistered` and `ReactorDelivery` in the public handler. In the host, register the actual adapter with `builder.Services.AddScoped<IAuthorDirectory, AuthorDirectory>();`, where `AuthorDirectory` implements `IAuthorDirectory`. With default discovery, a concrete `IReactor` in the backend assembly needs no separate reactor registration.
3. Pass `delivery.IdempotencyKeyFor("announce")` with the author's name. The directory must recognize repeated calls with that key. Return its `Task` without catching exceptions so Chronicle can record the failure and retry delivery.

```csharp
// Features/Authors/Directory/RegistrationNotice.cs
using Cratis.Chronicle.EventSequences;
using Cratis.Chronicle.Reactors;
using Library.Features.Authors.Registration;

namespace Library.Features.Authors.Directory;

public interface IAuthorDirectory
{
    Task Announce(IdempotencyKey key, string name);
}

public class RegistrationNotice(IAuthorDirectory directory) : IReactor
{
    public Task Registered(AuthorRegistered @event, ReactorDelivery delivery) =>
        directory.Announce(delivery.IdempotencyKeyFor("announce"), @event.Name);
}
```

## Retry a notice after a lost acknowledgement

One-off wiring check with a disposable receiver. If the application owns deduplication, commit a spec of that decision at the receiver; don't add a hosted spec of Chronicle retry. See [exercise the backend](../cratis-specifications-exercise-backend/SKILL.md).

Have the directory save the first notice, then fail before acknowledging it. Deliver the same occurrence again; assert one notice with the expected name. Keep the effect name unchanged on retry so the receiver sees the same key. An author ID would collapse distinct occurrences.

If the same delivery also sends email, pass `delivery.IdempotencyKeyFor("email")` to the email adapter's `IdempotencyKey` parameter. Each receiver must deduplicate its own key atomically with its effect, so a retry can finish the email without repeating the announcement.

## When it goes off the usual path

- **Historical events must not resend the notice:** `[OnceOnly]` skips replay, not ordinary retry. A `[Replay]` handler can replace the ordinary handler during replay when historical events need different work. Neither marker deduplicates external effects.

- **The follow-up makes its own local business decision:** inject `ICommandPipeline` from `Cratis.Arc.Commands` in the Arc host and use `var result = await pipeline.Execute(command);` with the follow-up command. Check `result.IsSuccess`. Handle an explicit permanent refusal separately; let transient failures surface so Chronicle can retry. Make the command safe to invoke again.
- **An existing reactor moves or is renamed:** preserve its observer ID to keep its position. For this class, set `[Reactor("Library.Features.Authors.Directory.RegistrationNotice")]` on the renamed class.

## Related skills

- [Inspect reactor progress](../cratis-chronicle-inspect-observer/SKILL.md) if a recorded registration never reaches the directory.

- [Call a provider during a command](../cratis-arc-declare-operation/SKILL.md)
- [Publish a public event](../cratis-chronicle-publish-contract/SKILL.md)
