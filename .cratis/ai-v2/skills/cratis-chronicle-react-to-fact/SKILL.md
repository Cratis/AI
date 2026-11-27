---
name: cratis-chronicle-react-to-fact
description: Use when a reactor should notify a downstream service after Chronicle commits an event. Not for publishing an inter-service event contract (use cratis-chronicle-publish-contract).
compatibility: .NET SDK and Chronicle reactor APIs.
---

# Notify the author directory after registration

Implement the local automation with a reactor, an observer that acts on a committed fact rather than building a read model or importing outside data.

1. Reference `Cratis.Chronicle`. Put `RegistrationNotice` in the feature that sends directory notices. Import `AuthorRegistered` from [Record an event](../cratis-chronicle-record-event/SKILL.md).
2. Implement `IReactor`. Take `AuthorRegistered` and `ReactorDelivery` in the public handler. Register the library's directory adapter for `IAuthorDirectory` in the host's services so Chronicle can construct the reactor. With default discovery, a concrete `IReactor` in the backend assembly needs no separate reactor registration.
3. Pass `delivery.Id` with the author's name. The directory must recognize repeated calls with that key. Return its `Task` without catching exceptions so Chronicle can record the failure and retry delivery.

```csharp
// Features/Authors/Directory/RegistrationNotice.cs
using Cratis.Chronicle.Reactors;
using Library.Features.Authors.Registration;

namespace Library.Features.Authors.Directory;

public interface IAuthorDirectory
{
    Task Announce(DeliveryId key, string name);
}

public class RegistrationNotice(IAuthorDirectory directory) : IReactor
{
    public Task Registered(AuthorRegistered @event, ReactorDelivery delivery) =>
        directory.Announce(delivery.Id, @event.Name);
}
```

## Retry a notice after a lost acknowledgement

Have the directory save the first notice, then fail before acknowledging it. Call the handler again with the same delivery; check that the directory contains only one notice with the expected name.

## When it goes off the usual path

- **A failed partition is recovering:** use the same `delivery.Id` for the provider request. `[OnceOnly]` skips replay, not recovery; a new key on every retry can repeat the effect and an author ID can collapse distinct notices.
- **An existing reactor moves or is renamed:** preserve its observer ID to keep its position. For this class, set `[Reactor("Library.Features.Authors.Directory.RegistrationNotice")]` on the renamed class.

## Related skills

- [Inspect reactor progress](../cratis-chronicle-inspect-observer/SKILL.md) if a recorded registration never reaches the directory.

- [Call a provider during a command](../cratis-arc-declare-operation/SKILL.md)
- [Publish a public event](../cratis-chronicle-publish-contract/SKILL.md)
