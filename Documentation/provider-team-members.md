---
title: Restrict an AI provider to specific team members
description: Configure provider access and preserve the authenticated initiator across a journey.
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Restrict an AI provider to specific team members

A provider's credential is shared. Its allowed-team-members selection controls which person's work
may use it, independently of which agent acts on that person's behalf.

## Set the selection

Execute `SetAIProviderAllowedTeamMembers` with the provider's `AIProviderId` and the complete
`AllowedTeamMembers` list. Each call replaces the previous selection. The command requires Arc
authentication (`[Authorize]`) and an `IProviderSelectionAuthority` that permits the caller to change
that provider. **The default authority denies every change**, including direct command handling.
The host must register its own authority, using its authenticated caller context and administrative
policy. Direct command handling throws `AIProviderSelectionNotAuthorized`, an
`UnauthorizedAccessException`, when the authority denies the change. Being allowed to use a provider does not authorize changing its selection.

Validation rejects unknown providers, duplicate members, null selections, and blank identifiers.
`TeamMemberId` is an opaque, ordinal, case-sensitive identifier. The host supplies a stable canonical
identity; the package does not resolve a directory, display name, or avatar.

`AIProviderAllowedTeamMembersSet` records the selection. Both `AIProvider` and
`ConfiguredAIProvider` expose `AllowedTeamMembers` and `HasAllowedTeamMembersSelection`:

- `false`: no restriction, including providers configured before this feature.
- `true` with members: only work initiated by those members is allowed.
- `true` with an empty list: nobody is allowed.

## Establish the work initiator

Inject `IWorkInitiation` and open a scope at the authenticated entry point:

```csharp
using var journey = initiation.Begin(WorkInitiator.By(authenticatedTeamMember));
await languageModel.Complete(prompt, purpose);
```

The member must come from the host's authenticated principal, **never from a command, query, request
payload, model output, or agent identity**. The library propagates and enforces this identity; the
host authenticates it. Do not expose an API that lets callers choose their initiator.

`WorkInitiator.None` explicitly represents unattributed work. Both it and `TeamMemberId.NotSet`
fail closed on restricted providers; unrestricted providers retain their existing behavior.
An unknown member or one absent from the list is denied. A nested scope cannot change an existing
member; a nested `None` preserves that member. Scopes flow across awaits, isolate parallel flows,
and restore their previous value on disposal.

`IAgentExecution.As` continues to attribute events to the **agent**, while adding the initiating
member as `initiator` in causation. It does not replace the work initiator.

### Persisted and resumed journeys

The host must record the authenticated initiator when a journey starts, persist it alongside the
journey, and re-establish that recorded identity for every resumed phase, retry, or follow-up.
An ambient scope alone does not survive a queue, process boundary, or restart. Do not substitute the
person who last touched the journey or the agent executing the next step. Scheduled work must
record its creator's or editor's authenticated member identity when the schedule is saved and
re-establish it at every firing; an unattributed schedule uses `None` and cannot use restricted providers.

The identity stays fixed, but permission does not: access is re-read from the current tenant's
provider read model at **every dispatch**. Removing a member takes effect on the next dispatch in
that same journey, once the updated read model is available. Do not cache access decisions.

## Enforced dispatch paths

| Path | Behavior |
| --- | --- |
| `ProviderAwareLanguageModel` | Checks direct providers and every pool attempt, before the vendor call; denial is a non-transient failure. |
| `PooledChatClient` | Checks blocking and streaming calls before constructing the vendor client; unavailable access surfaces as `AIChatClientUnavailable`. |
| `AIProviderPoolDispatcher` | Reads authoritative access rather than trusting the supplied provider snapshot; skips denied members and fails closed when none remain. |
| `DockerWorkerRuntime.Start` / `KubernetesWorkerRuntime.Start` | Checks inside the concrete runtime, including direct calls, before contacting the container backend. Denial returns `WorkerLaunchOutcome.ProviderAccessDenied`. |

Hosts using dependency injection must register the AI services (`AddCratisAI`) as well as
the worker runtime services. Provider access, pool dispatch, and worker runtimes are resolved per use
so they do not retain another tenant's read models. Direct pool/runtime constructors must receive an
`IProviderMemberAccess` backed by the current tenant's read models and shared `IWorkInitiation`;
a missing access service denies provider-backed dispatch.

### Worker credential obligation

**Set `WorkerJob.Provider` whenever injecting a provider credential**, including on retries and
relaunches. A job without a provider is intentionally not gated: the library cannot infer a provider
from arbitrary secrets. There is no worker-job initiator field; launches use the trusted ambient
scope. Running workers retain credentials until they end; removal blocks new launches, not an
already running container. Hosts requiring immediate revocation must stop those workers themselves.
Consumers with exhaustive outcome switches must handle `ProviderAccessDenied`.

## Boundaries owned by the host

Low-level vendor clients, raw `PoolDispatcher`/`PoolMemberSelector`, arbitrary consumer dispatch,
and administrative operations (configuration, model discovery, usage refresh, connectivity tests)
are not work-initiator gates. Protect those entry points with host authorization. Pool usage refresh
may contact a denied provider to read administrative usage before selecting a work provider.
For custom dispatch, use `IProviderMemberAccess.IsAllowed` at the last dispatch boundary with fresh
tenant state; `AIProviderMemberAccess.Evaluate` evaluates a snapshot but does not refresh it.

The consuming product owns the avatar-and-checkbox picker over its identity directory. This package
ships no UI or directory lookup and never treats a frontend selection as authenticated identity.
