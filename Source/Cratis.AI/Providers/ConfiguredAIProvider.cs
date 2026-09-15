// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.Reconfiguring;
using Cratis.AI.Providers.Removing;

namespace Cratis.AI.Providers;

/// <summary>
/// The credential-bearing shape of a configured AI provider, resolved from its own events - what an
/// <see cref="IAIProviderClient"/> calls a vendor with. Ported from Direct's
/// <c>AIProviders.Resolving.ConfiguredAIProvider</c> (plan Section 5.2 steps 4-6).
/// </summary>
/// <param name="Id">The provider's identity.</param>
/// <param name="Type">Which vendor this provider talks to.</param>
/// <param name="ApiKey">The API key this provider authenticates with.</param>
/// <param name="Endpoint">The endpoint this provider is reached at, for the vendors that need one.</param>
/// <param name="MaxConcurrentJobs">How many worker sessions may run on this provider at once - zero for no limit.</param>
/// <remarks>
/// <para>
/// <b>No display name.</b> Same as Direct's own donor - a name is what a person picks a provider by,
/// which is a listing concern (plan Section 5.2 step 4's still-unported <c>Listing.AIProvider</c>),
/// not something an <see cref="IAIProviderClient"/> making a call ever needs.
/// </para>
/// <para>
/// <b>Still narrower than Direct's own donor</b> - <c>ConfiguredAIProvider</c> there additionally
/// accumulates a usage-reporting credential, a rate-limited-until timestamp and resolved tier
/// models, from subsystems (usage reporting, rate limiting, tier-model configuration) that do not
/// exist in the package yet (plan Section 5.2 steps 5-6). This record's own shape should not need to
/// change when those land - only its <c>[FromEvent]</c>/<c>[SetFrom]</c> wiring gains more sources.
/// </para>
/// </remarks>
[ReadModel]
[Passive]
[FromEvent<AnthropicProviderAdded>]
[FromEvent<OpenAIProviderAdded>]
[FromEvent<AzureOpenAIProviderAdded>]
[FromEvent<OpenAICompatibleProviderAdded>]
[FromEvent<ZAIProviderAdded>]
[RemovedWith<AIProviderRemoved>]
public record ConfiguredAIProvider(
    AIProviderId Id,
    [SetValue<AnthropicProviderAdded>(AIProviderType.Anthropic)]
    [SetValue<OpenAIProviderAdded>(AIProviderType.OpenAI)]
    [SetValue<AzureOpenAIProviderAdded>(AIProviderType.AzureOpenAI)]
    [SetValue<OpenAICompatibleProviderAdded>(AIProviderType.OpenAICompatible)]
    [SetValue<ZAIProviderAdded>(AIProviderType.ZAI)]
    AIProviderType Type,
    [SetFrom<AnthropicProviderAdded>(nameof(AnthropicProviderAdded.ApiKey))]
    [SetFrom<OpenAIProviderAdded>(nameof(OpenAIProviderAdded.ApiKey))]
    [SetFrom<AzureOpenAIProviderAdded>(nameof(AzureOpenAIProviderAdded.ApiKey))]
    [SetFrom<OpenAICompatibleProviderAdded>(nameof(OpenAICompatibleProviderAdded.ApiKey))]
    [SetFrom<ZAIProviderAdded>(nameof(ZAIProviderAdded.ApiKey))]
    [SetFrom<AnthropicProviderReconfigured>(nameof(AnthropicProviderReconfigured.ApiKey))]
    [SetFrom<OpenAIProviderReconfigured>(nameof(OpenAIProviderReconfigured.ApiKey))]
    [SetFrom<AzureOpenAIProviderReconfigured>(nameof(AzureOpenAIProviderReconfigured.ApiKey))]
    [SetFrom<OpenAICompatibleProviderReconfigured>(nameof(OpenAICompatibleProviderReconfigured.ApiKey))]
    [SetFrom<ZAIProviderReconfigured>(nameof(ZAIProviderReconfigured.ApiKey))]
    AIProviderApiKey ApiKey,
    [SetFrom<AzureOpenAIProviderAdded>(nameof(AzureOpenAIProviderAdded.Endpoint))]
    [SetFrom<OpenAICompatibleProviderAdded>(nameof(OpenAICompatibleProviderAdded.Endpoint))]
    [SetFrom<ZAIProviderAdded>(nameof(ZAIProviderAdded.Endpoint))]
    [SetFrom<AzureOpenAIProviderReconfigured>(nameof(AzureOpenAIProviderReconfigured.Endpoint))]
    [SetFrom<OpenAICompatibleProviderReconfigured>(nameof(OpenAICompatibleProviderReconfigured.Endpoint))]
    [SetFrom<ZAIProviderReconfigured>(nameof(ZAIProviderReconfigured.Endpoint))]
    AIProviderEndpoint? Endpoint = null,
    [SetFrom<AnthropicProviderAdded>(nameof(AnthropicProviderAdded.MaxConcurrentJobs))]
    [SetFrom<OpenAIProviderAdded>(nameof(OpenAIProviderAdded.MaxConcurrentJobs))]
    [SetFrom<AzureOpenAIProviderAdded>(nameof(AzureOpenAIProviderAdded.MaxConcurrentJobs))]
    [SetFrom<OpenAICompatibleProviderAdded>(nameof(OpenAICompatibleProviderAdded.MaxConcurrentJobs))]
    [SetFrom<ZAIProviderAdded>(nameof(ZAIProviderAdded.MaxConcurrentJobs))]
    MaxConcurrentJobs? MaxConcurrentJobs = null);
