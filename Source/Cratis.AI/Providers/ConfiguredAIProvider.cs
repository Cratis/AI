// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.AvailableModels;
using Cratis.AI.Providers.Codex;
using Cratis.AI.Providers.Configuring;
using Cratis.AI.Providers.OpenAI;
using Cratis.AI.Providers.RateLimiting;
using Cratis.AI.Providers.Reconfiguring;
using Cratis.AI.Providers.Refreshing;
using Cratis.AI.Providers.Removing;
using Cratis.AI.Providers.SettingConcurrency;
using Cratis.AI.Providers.SettingTierModels;
using Cratis.AI.Providers.SettingUsageCapacity;
using Cratis.AI.Providers.UsageReporting.SettingCredential;

namespace Cratis.AI.Providers;

/// <summary>
/// Everything needed to actually talk to a configured provider, assembled from the provider's own
/// events - the credential, where to reach it, what it may be asked for, and what it published.
/// </summary>
/// <remarks>
/// <para>
/// Every property below is non-nullable with a sentinel default, and that is load-bearing rather
/// than stylistic: a nullable property on a <c language="csharp">[Passive]</c> read model comes back
/// null from the running kernel no matter what the events say, while in-process scenarios populate
/// it happily - so nothing in the specifications can see it. Direct spent a fortnight with a tier
/// mapping, an endpoint, a usage key, a discovered catalog and a rate-limit cooldown that were all
/// configured, all recorded, and all invisible to the code that resolves a provider. The sentinels
/// are what make the same value readable in both places.
/// </para>
/// <para>
/// <c language="csharp">[Passive]</c> means it is computed on demand from the provider's own stream
/// rather than maintained in a sink, so it is strongly consistent even a moment after the provider
/// was registered. That is what lets a registration reactor run the same command a person presses
/// Refresh on, without racing its own append.
/// </para>
/// </remarks>
/// <param name="Id">The provider's identity.</param>
/// <param name="Type">The vendor the provider talks to.</param>
/// <param name="ApiKey">The credential completions are authenticated with.</param>
[ReadModel]
[Passive]
[FromEvent<AnthropicProviderAdded>]
[FromEvent<OpenAIProviderAdded>]
[FromEvent<AzureOpenAIProviderAdded>]
[FromEvent<OpenAICompatibleProviderAdded>]
[FromEvent<ZAIProviderAdded>]
[FromEvent<OpenAICodexProviderAdded>]
[FromEvent<AnthropicModelConfigured>]
[FromEvent<OpenAIModelConfigured>]
[FromEvent<AzureOpenAIModelConfigured>]
[FromEvent<OpenAICompatibleModelConfigured>]
[FromEvent<AIProviderUsageCredentialSet>]
[FromEvent<AIProviderUsageCredentialCleared>]
[FromEvent<AIProviderUsageCapacitySet>]
[FromEvent<AIProviderModelsDiscovered>]
[FromEvent<AIProviderModelDiscoveryFailed>]
[RemovedWith<AIProviderRemoved>]
[RemovedWith<AIModelRemoved>]
public record ConfiguredAIProvider(
    AIProviderId Id,
    [SetValue<AnthropicProviderAdded>(AIProviderType.Anthropic)]
    [SetValue<OpenAIProviderAdded>(AIProviderType.OpenAI)]
    [SetValue<AzureOpenAIProviderAdded>(AIProviderType.AzureOpenAI)]
    [SetValue<OpenAICompatibleProviderAdded>(AIProviderType.OpenAICompatible)]
    [SetValue<ZAIProviderAdded>(AIProviderType.ZAI)]
    [SetValue<OpenAICodexProviderAdded>(AIProviderType.OpenAICodex)]
    [SetValue<AnthropicModelConfigured>(AIProviderType.Anthropic)]
    [SetValue<OpenAIModelConfigured>(AIProviderType.OpenAI)]
    [SetValue<AzureOpenAIModelConfigured>(AIProviderType.AzureOpenAI)]
    [SetValue<OpenAICompatibleModelConfigured>(AIProviderType.OpenAICompatible)]
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
    [SetFrom<AnthropicModelConfigured>(nameof(AnthropicModelConfigured.ApiKey))]
    [SetFrom<OpenAIModelConfigured>(nameof(OpenAIModelConfigured.ApiKey))]
    [SetFrom<AzureOpenAIModelConfigured>(nameof(AzureOpenAIModelConfigured.ApiKey))]
    [SetFrom<OpenAICompatibleModelConfigured>(nameof(OpenAICompatibleModelConfigured.ApiKey))]
    [SetFrom<OpenAISubscriptionCredentialRefreshed>(nameof(OpenAISubscriptionCredentialRefreshed.ApiKey))]
    [SetFrom<OpenAICodexProviderDisconnected>(nameof(OpenAICodexProviderDisconnected.ApiKey))]
    AIProviderApiKey ApiKey)
{
    /// <summary>
    /// Gets where the provider is reached, for the vendors that are not at a fixed address.
    /// </summary>
    [SetFrom<AzureOpenAIProviderAdded>(nameof(AzureOpenAIProviderAdded.Endpoint))]
    [SetFrom<OpenAICompatibleProviderAdded>(nameof(OpenAICompatibleProviderAdded.Endpoint))]
    [SetFrom<ZAIProviderAdded>(nameof(ZAIProviderAdded.Endpoint))]
    [SetFrom<AzureOpenAIProviderReconfigured>(nameof(AzureOpenAIProviderReconfigured.Endpoint))]
    [SetFrom<OpenAICompatibleProviderReconfigured>(nameof(OpenAICompatibleProviderReconfigured.Endpoint))]
    [SetFrom<ZAIProviderReconfigured>(nameof(ZAIProviderReconfigured.Endpoint))]
    [SetFrom<AzureOpenAIModelConfigured>(nameof(AzureOpenAIModelConfigured.Endpoint))]
    [SetFrom<OpenAICompatibleModelConfigured>(nameof(OpenAICompatibleModelConfigured.Endpoint))]
    public AIProviderEndpoint Endpoint { get; init; } = AIProviderEndpoint.NotSet;

    /// <summary>
    /// Gets the single model a provider configured model-first is pinned to.
    /// </summary>
    [SetFrom<AnthropicModelConfigured>(nameof(AnthropicModelConfigured.Model))]
    [SetFrom<OpenAIModelConfigured>(nameof(OpenAIModelConfigured.Model))]
    [SetFrom<AzureOpenAIModelConfigured>(nameof(AzureOpenAIModelConfigured.DeploymentName))]
    [SetFrom<OpenAICompatibleModelConfigured>(nameof(OpenAICompatibleModelConfigured.Model))]
    public ModelName Model { get; init; } = ModelName.NotSet;

    /// <summary>
    /// Gets how much work the provider may be given at once.
    /// </summary>
    [SetFrom<AnthropicProviderAdded>(nameof(AnthropicProviderAdded.MaxConcurrentJobs))]
    [SetFrom<OpenAIProviderAdded>(nameof(OpenAIProviderAdded.MaxConcurrentJobs))]
    [SetFrom<AzureOpenAIProviderAdded>(nameof(AzureOpenAIProviderAdded.MaxConcurrentJobs))]
    [SetFrom<OpenAICompatibleProviderAdded>(nameof(OpenAICompatibleProviderAdded.MaxConcurrentJobs))]
    [SetFrom<ZAIProviderAdded>(nameof(ZAIProviderAdded.MaxConcurrentJobs))]
    [SetFrom<AIProviderConcurrencySet>(nameof(AIProviderConcurrencySet.MaxConcurrentJobs))]
    public MaxConcurrentJobs MaxConcurrentJobs { get; init; } = MaxConcurrentJobs.NotSet;

    /// <summary>
    /// Gets the separate credential a vendor's usage and billing surface is read with.
    /// </summary>
    /// <remarks>
    /// Cleared by setting the sentinel rather than by <c language="csharp">[ClearWith]</c>: clearing
    /// means null, and a nullable member here is exactly what made the key invisible to the running
    /// kernel.
    /// </remarks>
    [SetFrom<AIProviderUsageCredentialSet>(nameof(AIProviderUsageCredentialSet.UsageApiKey))]
    [SetValue<AIProviderUsageCredentialCleared>("")]
    public AIProviderApiKey UsageApiKey { get; init; } = AIProviderApiKey.NotSet;

    /// <summary>
    /// Gets the moment the vendor said it would accept work again.
    /// </summary>
    [SetFrom<AIProviderRateLimited>(nameof(AIProviderRateLimited.Until))]
    public DateTimeOffset RateLimitedUntil { get; init; }

    /// <summary>
    /// Gets the operator's own mapping of capability tier to model.
    /// </summary>
    [SetFrom<AIProviderTierModelsSet>(nameof(AIProviderTierModelsSet.Models))]
    public TierModels TierModels { get; init; } = TierModels.NotSet;

    /// <summary>
    /// Gets how much the provider may be spent against before it is considered exhausted.
    /// </summary>
    [SetFrom<AIProviderUsageCapacitySet>(nameof(AIProviderUsageCapacitySet.UsageCapacity))]
    public AIProviderUsageCapacity UsageCapacity { get; init; } = AIProviderUsageCapacity.NotSet;

    /// <summary>
    /// Gets the models the provider published the last time it was asked.
    /// </summary>
    [SetFrom<AIProviderModelsDiscovered>(nameof(AIProviderModelsDiscovered.Models))]
    public IEnumerable<ModelName> AvailableModels { get; init; } = [];

    /// <summary>
    /// Gets when the catalog was last read successfully.
    /// </summary>
    [SetFrom<AIProviderModelsDiscovered>(nameof(AIProviderModelsDiscovered.DiscoveredAt))]
    public DateTimeOffset ModelsDiscoveredAt { get; init; }

    /// <summary>
    /// Gets why the last catalog read failed, empty when the last one succeeded.
    /// </summary>
    [SetValue<AIProviderModelsDiscovered>("")]
    [SetFrom<AIProviderModelDiscoveryFailed>(nameof(AIProviderModelDiscoveryFailed.Reason))]
    public string ModelDiscoveryFailure { get; init; } = string.Empty;
}
