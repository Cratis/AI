# 0007 - Pin explicit event type ids on every provider CRUD event

Status: Accepted - the id *values* chosen here (fresh guids) were wrong for Direct's actual cutover;
see decision 0008, which corrects them to match Direct's own pre-existing implicit ids. The
standing rule this record establishes (always pin explicitly) is unchanged and still in force.
Related: [Cratis/AI#341](https://github.com/Cratis/AI/issues/341), decision 0002, decision 0006,
decision 0008.

## Context

Bumping Direct onto `Cratis.AI` 2.17.0 (provider CRUD, decision 0006) broke Direct's entire spec
suite at Chronicle event-type discovery:

```text
Cratis.Chronicle.Events.MultipleEventTypesWithSameIdFound: Multiple CLR types represent generation 1
of event type 'AIProviderRemoved': AIProviderRemoved, AIProviderRemoved.
```

`Cratis.Chronicle.Events.EventTypeExtensions.ResolveId` falls back to the bare CLR type name -
`type.Name`, with no namespace qualification - whenever an `[EventType]` attribute carries no
explicit id. All 12 of this package's provider CRUD event types (`Providers/Adding/*Added`,
`Providers/Reconfiguring/*Reconfigured`, `AIProviderRenamed`, `AIProviderRemoved`) were left on that
implicit default. Direct's own pre-migration code has types of the exact same short names, in its own
`Direct.AIProviders.*` namespaces - different namespace, same `type.Name`, same resolved id, and
Chronicle's discovery does not tolerate two CLR types claiming one event type id.

`AgentSessionUsageRecorded` (the package's very first event type) already got this right - its own
remarks say explicitly: "the explicit id is pinned and must never change." This batch of 12 simply
missed the same convention when it shipped, and nothing caught it until a real consumer's own
same-named types collided with it in practice.

## Decision

Pin an explicit `EventTypeId` const, generated once and never changed, on all 12 events - the exact
same shape `AgentSessionUsageRecorded` already uses (`[EventType(EventTypeId)]` +
`public const string EventTypeId = "<guid>";`). Applies retroactively, safely: nothing has produced a
real event through any of these 12 types yet (Direct and Studio both still run their own pre-migration
provider commands as of this record), so there is no stored data whose id changes underneath it -
this is exactly the kind of change decision 0002's own evolution policy exists to allow before a type
has ever been used, not an exception to it.

## Consequences

- This is now the standing rule for every future event type the package adds, not only provider CRUD:
  **always pin an explicit id, never rely on Chronicle's type-name fallback.** A shared package's
  event types are the one case where a same-named collision with an arbitrary consumer's own code is
  not a hypothetical - Direct's own `AIProviderRemoved` proved it immediately, on the very first
  migration slice that shared a name with anything pre-existing.
- Worth a lint/analyzer rule or a corpus self-check (`Source/Verification/verify.ts` already gates a
  few package-wide invariants) that fails the build on a bare `[EventType]` with no explicit id,
  rather than relying on a human catching it in review or a downstream consumer's test suite catching
  it the hard way, as happened here. Not implemented yet - tracked as a follow-up, not blocking this
  fix.
