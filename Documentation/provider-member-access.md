---
title: Restrict an AI provider to specific team members
description: Configure which team members may use a provider, and how a consumer enforces it.
---

An AI provider can carry a credential that costs real money or draws on a shared subscription
window. `SetAIProviderAllowedMembers` lets an operator restrict a provider to an explicit list of
team members, the same way `SetAIProviderHarnesses` (see [`provider-harnesses.md`](./provider-harnesses.md))
restricts which coding-agent CLIs may dispatch jobs to it - a separate, independent selection on the
same provider.

## Set a provider's allowed members

Execute `SetAIProviderAllowedMembers` with the provider's `AIProviderId` and the **complete**
`AllowedMembers` list of `TeamMemberId` values. Each call replaces the prior selection; it does not
add to it. The command rejects duplicate members. An empty list explicitly disables the provider
for every team member.

The selection is recorded as `AIProviderAllowedMembersSet` on the provider's stream. `AIProvider`
(the public listing) and `ConfiguredAIProvider` (the credential-bearing, server-side model) both
expose `AllowedMembers` and `HasAllowedMembersSelection`. Check the flag: `false` means a
pre-existing provider has not had its selection configured and remains open to every team member,
while an empty list with `true` means it was deliberately restricted to nobody. An unconfigured
provider's list can also materialize as empty.

`TeamMemberId` is an opaque identity - this package does not resolve a display name, avatar, or
directory entry for it. A consuming frontend's own identity directory supplies those for the
checkbox list the issue this capability covers describes.

## Enforcing the selection

The package does not choose a provider or enforce this selection during dispatch - the same
division of responsibility `provider-harnesses.md` describes for harness selection. Use
`AIProviderMemberAccess.IsAllowedFor(provider, member)` wherever a completion, job, or pool
candidate is about to be dispatched on behalf of a specific team member; it returns `true` when the
provider has no explicit selection, or the member is one of its `AllowedMembers`.

This package carries no notion of a signed-in human anywhere in its own dispatch path -
`ILanguageModel.Complete`, pool selection, and worker dispatch all travel with an agent or purpose,
never a team member. A consumer that starts a unit of work on a team member's behalf is responsible
for carrying that member's identity through to every point it calls `IsAllowedFor`, including a
pool failover: a pool member a provider's own `AllowedMembers` excludes must not be tried as a
fallback for that member, even though the pool itself remains unaware of who is asking.
