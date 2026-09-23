// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Decisions.Adding;
using Cratis.AI.Decisions.Reconfiguring;
using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.Configuring;
using Cratis.AI.Providers.Reconfiguring;
using Cratis.AI.Providers.Removing;
using Cratis.AI.Providers.UsageReporting.SettingCredential;

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
/// <param name="MaxConcurrentJobs">How many worker sessions may run on this provider at once - zero for no limit. Direct's concept only - unset for every provider configured through Studio's shape (<see cref="Configuring"/>), which has no equivalent.</param>
/// <param name="Model">The model/deployment identifier a provider itself is pinned to. Studio's concept only - unset for every provider configured through Direct's shape (<see cref="Adding"/>/<see cref="Reconfiguring"/>), where an agent supplies the model instead.</param>
/// <remarks>
/// <para>
/// <b>No display name.</b> Same as Direct's own donor - a name is what a person picks a provider by,
/// which is a listing concern (plan Section 5.2 step 4's still-unported <c>Listing.AIProvider</c>),
/// not something an <see cref="IAIProviderClient"/> making a call ever needs.
/// </para>
/// <para>
/// <b>Serves two real, differently-shaped donors</b> - Direct's (<see cref="Adding"/>/
/// <see cref="Reconfiguring"/>/<see cref="Renaming"/>/<see cref="Removing"/>: separate Added/
/// Reconfigured events, a <see cref="MaxConcurrentJobs"/> bound) and Studio's
/// (<see cref="Configuring"/>: one Configured event doubles as both, a <see cref="Model"/> identifier
/// instead). Both accumulate into the same <see cref="Id"/>/<see cref="Type"/>/<see cref="ApiKey"/>/
/// <see cref="Endpoint"/> fields - see <see cref="Configuring.AnthropicModelConfigured"/>'s remarks
/// for why this package carries both shapes rather than forcing one onto the other.
/// </para>
/// <para>
/// <b>Narrower than either donor in one remaining respect</b> - <c>ConfiguredAIProvider</c> there
/// additionally accumulates a rate-limited-until timestamp and resolved tier models, from subsystems
/// (rate limiting, tier-model configuration) that do not exist in the package yet (plan Section 5.2
/// step 6). This record's own shape should not need to change when those land - only its
/// <c>[FromEvent]</c>/<c>[SetFrom]</c> wiring gains more sources.
/// </para>
/// </remarks>
[ReadModel]
[Passive]
[FromEvent<AnthropicProviderAdded>]
[FromEvent<OpenAIProviderAdded>]
[FromEvent<AzureOpenAIProviderAdded>]
[FromEvent<OpenAICompatibleProviderAdded>]
[FromEvent<ZAIProviderAdded>]
[FromEvent<DecisionEngineProviderAdded>]
[FromEvent<DecisionEngineProviderReconfigured>]
[FromEvent<AnthropicModelConfigured>]
[FromEvent<OpenAIModelConfigured>]
[FromEvent<AzureOpenAIModelConfigured>]
[FromEvent<OpenAICompatibleModelConfigured>]
[FromEvent<AIProviderUsageCredentialSet>]
[FromEvent<AIProviderUsageCredentialCleared>]
[RemovedWith<AIProviderRemoved>]
[RemovedWith<AIModelRemoved>]
public record ConfiguredAIProvider(
    AIProviderId Id,
    [SetValue<AnthropicProviderAdded>(AIProviderType.Anthropic)]
    [SetValue<OpenAIProviderAdded>(AIProviderType.OpenAI)]
    [SetValue<AzureOpenAIProviderAdded>(AIProviderType.AzureOpenAI)]
    [SetValue<OpenAICompatibleProviderAdded>(AIProviderType.OpenAICompatible)]
    [SetValue<ZAIProviderAdded>(AIProviderType.ZAI)]
    [SetValue<DecisionEngineProviderAdded>(AIProviderType.DecisionEngine)]
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
    [SetFrom<DecisionEngineProviderAdded>(nameof(DecisionEngineProviderAdded.ApiKey))]
    [SetFrom<DecisionEngineProviderReconfigured>(nameof(DecisionEngineProviderReconfigured.ApiKey))]
    [SetFrom<AnthropicProviderReconfigured>(nameof(AnthropicProviderReconfigured.ApiKey))]
    [SetFrom<OpenAIProviderReconfigured>(nameof(OpenAIProviderReconfigured.ApiKey))]
    [SetFrom<AzureOpenAIProviderReconfigured>(nameof(AzureOpenAIProviderReconfigured.ApiKey))]
    [SetFrom<OpenAICompatibleProviderReconfigured>(nameof(OpenAICompatibleProviderReconfigured.ApiKey))]
    [SetFrom<ZAIProviderReconfigured>(nameof(ZAIProviderReconfigured.ApiKey))]
    [SetFrom<AnthropicModelConfigured>(nameof(AnthropicModelConfigured.ApiKey))]
    [SetFrom<OpenAIModelConfigured>(nameof(OpenAIModelConfigured.ApiKey))]
    [SetFrom<AzureOpenAIModelConfigured>(nameof(AzureOpenAIModelConfigured.ApiKey))]
    [SetFrom<OpenAICompatibleModelConfigured>(nameof(OpenAICompatibleModelConfigured.ApiKey))]
    AIProviderApiKey ApiKey,
    [SetFrom<AzureOpenAIProviderAdded>(nameof(AzureOpenAIProviderAdded.Endpoint))]
    [SetFrom<OpenAICompatibleProviderAdded>(nameof(OpenAICompatibleProviderAdded.Endpoint))]
    [SetFrom<ZAIProviderAdded>(nameof(ZAIProviderAdded.Endpoint))]
    [SetFrom<DecisionEngineProviderAdded>(nameof(DecisionEngineProviderAdded.Endpoint))]
    [SetFrom<DecisionEngineProviderReconfigured>(nameof(DecisionEngineProviderReconfigured.Endpoint))]
    [SetFrom<AzureOpenAIProviderReconfigured>(nameof(AzureOpenAIProviderReconfigured.Endpoint))]
    [SetFrom<OpenAICompatibleProviderReconfigured>(nameof(OpenAICompatibleProviderReconfigured.Endpoint))]
    [SetFrom<ZAIProviderReconfigured>(nameof(ZAIProviderReconfigured.Endpoint))]
    [SetFrom<AzureOpenAIModelConfigured>(nameof(AzureOpenAIModelConfigured.Endpoint))]
    [SetFrom<OpenAICompatibleModelConfigured>(nameof(OpenAICompatibleModelConfigured.Endpoint))]
    AIProviderEndpoint? Endpoint = null,
    [SetFrom<AnthropicProviderAdded>(nameof(AnthropicProviderAdded.MaxConcurrentJobs))]
    [SetFrom<OpenAIProviderAdded>(nameof(OpenAIProviderAdded.MaxConcurrentJobs))]
    [SetFrom<AzureOpenAIProviderAdded>(nameof(AzureOpenAIProviderAdded.MaxConcurrentJobs))]
    [SetFrom<OpenAICompatibleProviderAdded>(nameof(OpenAICompatibleProviderAdded.MaxConcurrentJobs))]
    [SetFrom<ZAIProviderAdded>(nameof(ZAIProviderAdded.MaxConcurrentJobs))]
    MaxConcurrentJobs? MaxConcurrentJobs = null,
    [SetFrom<AnthropicModelConfigured>(nameof(AnthropicModelConfigured.Model))]
    [SetFrom<OpenAIModelConfigured>(nameof(OpenAIModelConfigured.Model))]
    [SetFrom<AzureOpenAIModelConfigured>(nameof(AzureOpenAIModelConfigured.DeploymentName))]
    [SetFrom<OpenAICompatibleModelConfigured>(nameof(OpenAICompatibleModelConfigured.Model))]
    [SetFrom<DecisionEngineProviderAdded>(nameof(DecisionEngineProviderAdded.Model))]
    [SetFrom<DecisionEngineProviderReconfigured>(nameof(DecisionEngineProviderReconfigured.Model))]
    ModelName? Model = null)
{
    /// <summary>
    /// Gets the Admin API key this provider's vendor usage-and-cost report is read through -
    /// <see cref="AIProviderApiKey.NotSet"/> until one is configured.
    /// </summary>
    /// <remarks>
    /// A non-nullable sentinel-default property, not a nullable one, deliberately matching Direct's
    /// own donor shape (<c>Resolving.ConfiguredAIProvider.UsageApiKey</c>): a nullable member on a
    /// <c>[Passive]</c> read model comes back <see langword="null"/> from the running kernel no
    /// matter what the events say, while an in-process specification populates it happily - so a
    /// real production gap here is invisible to every specification that would otherwise catch it.
    /// Cleared by setting the sentinel rather than by <c>[ClearWith]</c>, for the same reason.
    /// </remarks>
    [SetFrom<AIProviderUsageCredentialSet>(nameof(AIProviderUsageCredentialSet.UsageApiKey))]
    [SetValue<AIProviderUsageCredentialCleared>("")]
    public AIProviderApiKey UsageApiKey { get; init; } = AIProviderApiKey.NotSet;
}
