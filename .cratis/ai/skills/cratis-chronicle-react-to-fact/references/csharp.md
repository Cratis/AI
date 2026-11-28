# Notify the author directory after registration

Implement the local automation with a reactor, an observer that acts on a committed fact rather than building a read model or importing outside data.

1. Reference `Cratis.Chronicle`. Put `RegistrationNotice` in the feature that sends directory notices. Import `AuthorRegistered` from [Record an event](../../cratis-chronicle-record-event/SKILL.md).
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

[Reactor("Library.Features.Authors.Directory.RegistrationNotice")]
[StartAtTail]
public class RegistrationNotice(IAuthorDirectory directory) : IReactor
{
    [OnceOnly]
    public Task Registered(AuthorRegistered @event, ReactorDelivery delivery) =>
        directory.Announce(delivery.IdempotencyKeyFor("announce"), @event.Name);
}
```

## Retry a notice after a lost acknowledgement

One-off wiring check with a disposable receiver. If the application owns deduplication, commit a spec of that decision at the receiver; don't add a hosted spec of Chronicle retry. See the `cratis-specifications-exercise-backend` skill (in `cratis/application`).

With client and kernel 19.70.0 or later, seed pre-registration history and confirm the new reactor sends no notice for it. Append a new occurrence while stopped; restarting the same observer must resume its saved position and send that notice. Replaying with `[OnceOnly]` must not invoke the notice handler.

Have the directory save the first notice, then fail before acknowledging it. Deliver the same occurrence again; assert one notice with the expected name. Keep the effect name unchanged on retry so the receiver sees the same key. An author ID would collapse distinct occurrences.

If the same delivery also sends email, pass `delivery.IdempotencyKeyFor("email")` to the email adapter's `IdempotencyKey` parameter. Each receiver must deduplicate its own key atomically with its effect, so a retry can finish the email without repeating the announcement.

## When it goes off the usual path

- **Historical events must not resend the notice:** `[StartAtTail]` skips initial history only on first registration, while `[OnceOnly]` skips explicit replay. Neither suppresses ordinary redelivery or deduplicates external effects. A `[Replay]` handler can replace the ordinary handler during replay when historical events need different work.

- **The follow-up makes its own local business decision:** return a command invocation as shown below. For a leased occurrence rather than a reactor delivery, see "Execute a command once per occurrence effect" in `cratis-arc-invoke-command`.
- **An existing reactor moves or is renamed:** preserve its observer ID to keep its position. Keep the explicit `[Reactor]` ID shown in the example, even after moving or renaming the class.

## Related skills

- Inspect reactor progress (`cratis-chronicle-inspect-observer` skill in `cratis/chronicle/client-dotnet`) if a recorded registration never reaches the directory.

- Call a provider during a command (`cratis-arc-declare-operation` skill in `cratis/application/arc-chronicle`)
- [Publish a public event](../../cratis-chronicle-publish-contract/SKILL.md)

## Route returned work and isolate failures

When a returned fact belongs to a different history, return `EventForEventSourceId` deliberately; preserve the intended source type, stream and tags. For a related read-model parameter the event source ID is the usual key; use `ICanResolveReadModelKey` only when the relationship uses another key. A materialized dependency can lag. Prefer the triggering event, not a fresh global lookup. Apply delivery filters to append metadata, including replay and catch-up; keep mutable per-delivery state off the handler because different partitions can overlap.

For an explicit batch, receive `EventBatch` and handle each entry's own context. Report a failed partition with `batch.Fail(context, exception)` or defer the partition with `batch.Defer(context, retryAfter)` if supported. Do not represent an unperformed effect as success. If the business outcome needs a visible transition, give it to its existing owner; a failed partition is an operational failure, not that business transition. For local command outcomes use the refusal handling below; for leased occurrence work use the executor in `cratis-arc-invoke-command`.

If the work is durable but not a domain fact, [record an occurrence](occurrences.md) with a stable ID. A lease can redeliver. Transactional `UseEffectReceipt` is not a receipt from an external service. Do not put personal information in a trigger payload or a secret in a stored receipt.

## Handle a refused follow-up command

With Arc 22.88.0 or later, return a `CommandInvocation` (`Cratis.Arc.Chronicle.Reactors`) to attach refusal handling to one command. For an application with a `UniqueDirectoryName` constraint, an `AuthorRegistered` handler can return:

```csharp
public CommandInvocation Registered(AuthorRegistered fact) =>
    Invoke.Command(new ReserveDirectoryName(fact.Name))
        .OnRefused(Refused.ByConstraint("UniqueDirectoryName"), r => new DirectoryNameRefused(r.Message))
        .Acknowledge(Refused.ByAuthorization);
```

Use the actual case-sensitive constraint name. Return a fact only for a modeled outcome, and acknowledge only when no fact is needed. Select with `ByValidation`, `ByConstraint(name)`, `ByAnyConstraint`, `ByAuthorization` or `Any`; `Any` matches validation and constraints, not authorization. The first matching branch wins. A handled refusal stops later commands in that delivery; earlier appends remain committed. Concurrency, temporary and framework failures are not refusals and still fail the delivery. In a reactor pipeline spec, return a successful invocation, a handled refusal and a third invocation; assert the earlier append remains and the third command never runs. Refusal analysis requires Arc 22.97.0 and Chronicle 19.63.0 or later.
