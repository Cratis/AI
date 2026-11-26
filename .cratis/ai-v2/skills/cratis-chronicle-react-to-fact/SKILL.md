---
name: cratis-chronicle-react-to-fact
description: Delivers a notification after Chronicle commits an event. Use when a reactor should notify a downstream service. Not for publishing an inter-service event contract (use cratis-chronicle-publish-contract).
compatibility: .NET SDK and Chronicle reactor APIs.
---

# Notify the author directory after registration

1. Reference `Cratis.Chronicle`. Put `RegistrationNotice` in the feature that sends directory notices. Import `AuthorRegistered` from [Record an event](../cratis-chronicle-record-event/SKILL.md).
2. Implement `IReactor`. Take `AuthorRegistered` and `ReactorDelivery` in the public handler. Register the library's directory adapter for `IAuthorDirectory` in the host's services so Chronicle can construct the reactor. With default discovery, a concrete `IReactor` in the backend assembly needs no separate reactor registration.
3. Pass `delivery.Id` with the author's name. The directory must recognize repeated calls with that key. Return its `Task` without catching exceptions so Chronicle can record the failure and retry delivery.

```csharp
// Features/Authors/Directory/RegistrationNotice.cs
using Cratis.Chronicle.Reactors;
using Library.Authors.Registration;

namespace Library.Authors.Directory;

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

## Avoid

- Don't create a new key on retry or use the author's ID as the key for every notice. Use `delivery.Id`.
- Don't use `[OnceOnly]` to deduplicate retries; it affects replay, not recovery.
- Don't change the observer ID when moving an existing reactor. For this class, retain the old identity on the renamed class with `[Reactor("Library.Authors.Directory.RegistrationNotice")]`.

## Related skills

- [Call a provider during a command](../cratis-arc-declare-operation/SKILL.md)
- [Publish a public event](../cratis-chronicle-publish-contract/SKILL.md)
