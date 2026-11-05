---
title: Restrict an AI provider to specific team members
description: Configure which team members may use a provider, and what honoring that selection means for a consumer.
---

A provider's credential is shared by everyone who can reach it. Restricting who may use a provider
is a selection that belongs to the **provider** - the same shape as its harness and concurrency
settings - not to each team member or each agent.

## Set a provider's allowed team members

Execute `SetAIProviderAllowedTeamMembers` with the provider's `AIProviderId` and the **complete**
`AllowedTeamMembers` list. Each call replaces the prior selection; it does not add to it. The
command rejects duplicate team members. `TeamMemberId` is an opaque identifier - whatever a consumer
already uses to name a person (a login, an email, or an internal user id); this package does not
resolve it against a directory, so it carries no display name or avatar.

The selection is recorded as `AIProviderAllowedTeamMembersSet` on the provider's stream. `AIProvider`
(the public listing) and `ConfiguredAIProvider` (the credential-bearing, server-side model) both
expose `AllowedTeamMembers` and `HasAllowedTeamMembersSelection`. Check the flag: `false` means the
provider has no explicit selection and is open to everyone, while an empty list with `true` means
every team member was deliberately denied. A provider configured before this restriction existed
replays with `HasAllowedTeamMembersSelection` false, so nothing already configured suddenly loses
access the day this ships.

## What the package does not do

This package does not look up who is making a request, and it does not refuse a call on a
provider's behalf. **Enforcing the selection is the consumer's responsibility**, the same way
harness and concurrency selections are enforced by whoever dispatches work, not by this package -
see decision [`0001-agent-identity-and-causation.md`](./decisions/0001-agent-identity-and-causation.md)
for why authorization in general is a product concern this package deliberately does not own.

Use `AIProviderMemberAccess.IsAllowedFor(provider, member)` wherever a completion, job, or pool
candidate is about to be dispatched on behalf of a specific team member. It returns `true` when the
provider has no explicit selection, or the member is one of its `AllowedTeamMembers`:

- Check it against the identity of whoever started the unit of work **before** dispatching to a
  provider, and keep checking against that same identity for every step of the work, including a
  retry, a follow-up call, or a different pool member tried after a failure - a person's access does
  not change partway through something they already started.
- Check it again at **every** member a pool considers, not only the first one tried: a pool can
  contain providers with different team member selections, exactly as it can contain providers with
  different harness selections. `PoolDispatcher`/`PoolMemberSelector` do not filter pool members by
  this selection themselves - they have no notion of who is asking - so a consumer that wants a pool
  to skip a member the current user cannot use filters the candidate list with `IsAllowedFor` before
  handing it to `PoolDispatcher.Dispatch`, the same way it would filter by harness compatibility.
- Decide what "no selection" means for a provider added before this restriction existed: this
  package's own default is open to everyone, matching every provider's behavior before the
  selection existed, but a consumer with a different access policy makes that call itself.

This package carries no notion of a signed-in human anywhere in its own dispatch path -
`ILanguageModel.Complete`, pool selection, and worker dispatch all travel with an agent or purpose,
never a team member. A consumer that starts a unit of work on a team member's behalf is responsible
for carrying that member's identity through to every point it calls `IsAllowedFor`.

A frontend's avatar-and-checkbox picker over `AllowedTeamMembers` is built in the consuming
product, against its own identity directory - this package resolves no display name or avatar for a
`TeamMemberId` and ships no UI (see [`architecture.md`](./architecture.md) for why `Cratis.AI` never
references a consumer's domain types).
