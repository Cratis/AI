// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Reactive.Subjects;
using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.AvailableModels;
using Cratis.AI.Providers.Codex;
using Cratis.AI.Providers.OpenAI;
using Cratis.AI.Providers.RateLimiting;
using Cratis.AI.Providers.SettingConcurrency;
using Cratis.AI.Providers.SettingTierModels;
using Cratis.AI.Providers.SettingUsageCapacity;
using Cratis.AI.Providers.UsageReporting.SettingCredential;
using MongoDB.Driver;
using CratisAIAdding = Cratis.AI.Providers.Adding;
using CratisAIRemoving = Cratis.AI.Providers.Removing;
using CratisAIRenaming = Cratis.AI.Providers.Renaming;

namespace Cratis.AI.Providers.Listing;

/// <summary>
/// Read model for listing configured AI providers - what the client-facing table and every
/// provider-picking dropdown bind to. Deliberately carries no API key: see
/// <c>ConfiguredAIProvider</c> for the credential-bearing counterpart, resolved
/// server-side only. <see cref="Endpoint"/> auto-populates from whichever vendor's Added event
/// carries one (Azure OpenAI, OpenAI-compatible, Z.ai) and stays unset for the others.
/// </summary>
/// <param name="Id">The provider's identity.</param>
/// <param name="Name">The provider's display name.</param>
/// <param name="Type">Which vendor this provider talks to.</param>
/// <param name="Endpoint">The endpoint this provider is reached at, for the vendors that need one.</param>
/// <param name="MaxConcurrentJobs">How many units of work may run on this provider at once - zero for no limit. Set at creation from the vendor's Added event, and overridable afterwards via <see cref="AIProviderConcurrencySet"/>.</param>
/// <param name="IsSubscription">Whether this provider is on a ChatGPT subscription rather than a metered API key - which decides where it can be spent, and is not otherwise visible without the credential this model deliberately does not carry.</param>
/// <param name="SubscriptionExpiresAt">When the subscription's current access token runs out. Direct refreshes it before dispatch, so this moving forward is the sign the credential is healthy - and it standing still is the sign it is not.</param>
/// <param name="TierModels">Which concrete models this provider offers for each capability tier - <see langword="null"/> until configured, and unset tiers derived from the catalog the provider published (#865, #1187).</param>
/// <param name="UsageCapacity">How many tokens this provider may consume within its usage-reporting window - <see langword="null"/> until configured (issue #1061).</param>
/// <param name="ModelsDiscoveredAt">When this provider last published its model catalog - <see langword="null"/> when it never has (#1187).</param>
/// <param name="ModelDiscoveryFailure">Why the catalog could not be read last time it was asked - an empty string when it could.</param>
/// <param name="HasUsageCredential">Whether a usage-reporting Admin API key is configured. Carried so the credentials dialog can say which of the two keys is actually set without this model ever holding either of them.</param>
/// <param name="RateLimitedUntil">When the vendor is worth trying again after it turned calls away over its own limits - <see langword="null"/> when it never has. Carried here, not only on <c>ConfiguredAIProvider</c>, because a provider the vendor is currently refusing looks identical to a healthy idle one on the settings page, and that is exactly the state somebody needs to see.</param>
[ReadModel]
[FromEvent<CratisAIAdding.AnthropicProviderAdded>]
[FromEvent<OpenAIProviderAdded>]
[FromEvent<CratisAIAdding.AzureOpenAIProviderAdded>]
[FromEvent<CratisAIAdding.OpenAICompatibleProviderAdded>]
[FromEvent<CratisAIAdding.ZAIProviderAdded>]
[FromEvent<OpenAICodexProviderAdded>]
[FromEvent<AIProviderModelsDiscovered>]
[FromEvent<AIProviderModelDiscoveryFailed>]
[FromEvent<AIProviderUsageCredentialSet>]
[FromEvent<AIProviderUsageCredentialCleared>]
[FromEvent<AIProviderRateLimited>]
[RemovedWith<CratisAIRemoving.AIProviderRemoved>]
public record AIProvider(
    AIProviderId Id,
    [SetFrom<CratisAIRenaming.AIProviderRenamed>(nameof(CratisAIRenaming.AIProviderRenamed.Name))]
    AIProviderName Name,
    [SetValue<CratisAIAdding.AnthropicProviderAdded>(AIProviderType.Anthropic)]
    [SetValue<OpenAIProviderAdded>(AIProviderType.OpenAI)]
    [SetValue<CratisAIAdding.AzureOpenAIProviderAdded>(AIProviderType.AzureOpenAI)]
    [SetValue<CratisAIAdding.OpenAICompatibleProviderAdded>(AIProviderType.OpenAICompatible)]
    [SetValue<CratisAIAdding.ZAIProviderAdded>(AIProviderType.ZAI)]
    [SetValue<OpenAICodexProviderAdded>(AIProviderType.OpenAICodex)]
    AIProviderType Type,
    AIProviderEndpoint? Endpoint = null,
    [SetFrom<AIProviderConcurrencySet>(nameof(AIProviderConcurrencySet.MaxConcurrentJobs))]
    MaxConcurrentJobs? MaxConcurrentJobs = null,
    [SetValue<OpenAISubscriptionCredentialConfigured>(true)]
    [SetValue<OpenAIProviderApiKeyConfigured>(false)]
    [SetValue<OpenAICodexProviderDisconnected>(false)]
    bool IsSubscription = false,
    [SetFrom<OpenAISubscriptionCredentialConfigured>(nameof(OpenAISubscriptionCredentialConfigured.ExpiresAt))]
    DateTimeOffset? SubscriptionExpiresAt = null,
    [SetFrom<AIProviderTierModelsSet>(nameof(AIProviderTierModelsSet.Models))]
    TierModels? TierModels = null,
    [SetFrom<AIProviderUsageCapacitySet>(nameof(AIProviderUsageCapacitySet.UsageCapacity))]
    AIProviderUsageCapacity? UsageCapacity = null,
    [SetFrom<AIProviderModelsDiscovered>(nameof(AIProviderModelsDiscovered.DiscoveredAt))]
    DateTimeOffset? ModelsDiscoveredAt = null,
    [SetValue<AIProviderModelsDiscovered>("")]
    [SetFrom<AIProviderModelDiscoveryFailed>(nameof(AIProviderModelDiscoveryFailed.Reason))]
    string ModelDiscoveryFailure = "",
    [SetValue<AIProviderUsageCredentialSet>(true)]
    [SetValue<AIProviderUsageCredentialCleared>(false)]
    bool HasUsageCredential = false,
    [SetFrom<AIProviderRateLimited>(nameof(AIProviderRateLimited.Until))]
    DateTimeOffset? RateLimitedUntil = null)
{
    /// <summary>
    /// Observes every configured AI provider.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the providers.</param>
    /// <returns>An observable of every provider.</returns>
    public static ISubject<IEnumerable<AIProvider>> AllAIProviders(IMongoCollection<AIProvider> collection) =>
        collection.Observe();
}
