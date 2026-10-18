---
title: Choose harnesses for an AI provider
description: Configure which coding-agent CLIs may run jobs using a provider.
---

A job runs through a coding-agent CLI, while a chat completion calls its provider directly. A
harness selection therefore belongs to the **provider** whose credential and endpoint the job will
use, not to each agent role. You can give one provider both Claude Code and Pi, and disable worker
jobs on another without stopping chat completions.

## Claude model compatibility

The Claude worker image pins Claude Code **2.1.285**, resolved from npm's `stable`
dist-tag. Models that require Claude Code 2.1.251 or later cannot run with the
older 2.1.236 image. Upgrade the worker image as well as selecting a compatible
provider; changing only the model name does not update the CLI inside a container.
Provider access to the selected model must still be verified with that provider's
credential and endpoint.

## Set a provider's harnesses

Execute `SetAIProviderHarnesses` with the provider's `AIProviderId` and the **complete**
`SupportedHarnesses` list. Each call replaces the prior selection; it does not add to it. The
command rejects duplicate harnesses, unknown providers, and harnesses the provider vendor or its
current credential cannot run. For example, OpenAI cannot run the Claude Code harness, and an
Anthropic OAuth credential cannot run Pi. An empty list explicitly disables harness dispatch.

The selection is recorded as `AIProviderHarnessesSet` on the provider's stream. `AIProvider`
(the public listing) and `ConfiguredAIProvider` (the credential-bearing, server-side model) both
expose `SupportedHarnesses` and `HasHarnessSelection`. Check the flag: `false` means a pre-existing
provider has not had its selection configured, while an empty list with `true` means it was
deliberately disabled. An unconfigured provider's list can also materialize as empty.
Do not expose `ConfiguredAIProvider` to a client: it contains the provider's secret.

## Preview a tier change

Before submitting `ConfigureAgent`, call `AgentTierPreview.PreviewAgentTier(agentId, tier)`
with the configured agent's identity and proposed `ModelTier`. It returns one row for the
agent's assigned provider, or one for **every member** of its assigned pool. Each row identifies
`AgentId`, `ProviderId`, and `PoolId` (`NotSet` for a direct assignment), and carries a `Resolution`
with the proposed `Tier`, resolved `Model`, `Source`, `Reason`, `ModelDiscoveryFailure`, and
`ModelsDiscoveredAt`.

Before submitting `SetAIProviderTierModels`, call
`ProviderTierResolution.PreviewProviderTierModels(providerId, fast, balanced, powerful, premier)`.
The four optional model arguments are scalar `ModelName` values rather than a nested mapping
object, so clients can use Arc's generated query proxy. Omit a tier argument, pass `null` in C#,
or pass an empty model value (`ModelName.NotSet` in C#) to clear that tier and derive it from the
catalog. The query replaces the complete
mapping **in the preview only** and returns one `ProviderTierResolution` for each of the four tiers.
It does not merge unset entries with the old mapping. Use
`ProviderTierResolution.ResolveTiersFor(providerId)` to inspect the current mapping instead.

Both previews use the same model-resolution rules as runtime requests. `Source` is `Configured`,
`Derived`, `Borrowed`, `SubscriptionAlias`, or `Unsatisfied`. Display `Reason` for borrowed and
refused tiers; `Unsatisfied` has no usable model. Unknown agents, providers, missing pools, empty
pools, and agents without an assignment produce explicit refusal rows rather than an empty preview.
A missing provider in a pool remains visible alongside the other members.

These are read-only snapshot queries: they append no events, never contact a vendor, and expose
no credentials. They use the recorded catalog and report its last successful discovery time and
last failure. A preview does not verify subscription entitlement, agent capability compatibility,
harness support, quota, concurrency, or which pool member will be chosen. It previews a tier change
on the agent's **current assignment**, not a simultaneous provider or pool reassignment. Refresh
the preview after editing the proposed values and before applying; it does not reserve the observed
configuration against concurrent changes. This package has no configuration dialog; consuming
frontends should show the query results before executing the corresponding command.

## Upgrade from per-agent harnesses

`ConfigureAgent` still accepts the optional `Harness` parameter (defaulting to Pi) in its original
position before `Effort`, but it is deprecated for new configuration. `AgentConfigured` continues
to record it, and the `Agent` read model projects it during historical replay. Existing callers
can keep supplying a harness while migrating; a previously chosen harness is not lost on replay.

Update worker dispatch to resolve the provider **after** selecting a pool member, if applicable.
When `HasHarnessSelection` is true, use only that provider's `SupportedHarnesses` (including an
empty list, which disables dispatch); do not use `Agent.Harness` to override it. When the resolved
provider has no explicit selection, use the agent's historical harness preference as the fallback.
A pool can contain providers with different harness selections. The package does not choose a
harness or enforce the selection during dispatch: consumers must check the vendor's current
credential support at launch time, especially after a credential change.

Copilot providers project into both the public `AIProvider` listing and the server-side
`ConfiguredAIProvider` after being added; connecting or disconnecting updates the configured
credential. Copilot is a worker-harness provider, not a direct chat-completion provider.
