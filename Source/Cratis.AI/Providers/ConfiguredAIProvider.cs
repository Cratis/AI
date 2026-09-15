// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// The credential-bearing shape of a configured AI provider, resolved from its own events - what an
/// <see cref="IAIProviderClient"/> calls a vendor with.
/// </summary>
/// <param name="Id">The provider's identity.</param>
/// <param name="Type">Which vendor this provider talks to.</param>
/// <param name="ApiKey">The API key this provider authenticates with.</param>
/// <param name="Endpoint">The endpoint this provider is reached at, for the vendors that need one.</param>
/// <param name="MaxConcurrentJobs">How many worker sessions may run on this provider at once - zero for no limit.</param>
/// <remarks>
/// <b>Intentionally minimal for now.</b> Direct's donor equivalent (<c>AIProviders.Resolving.ConfiguredAIProvider</c>)
/// is a Chronicle <c>[ReadModel]</c> projected from six provider-added event types plus
/// reconfiguration, rate-limiting, concurrency and tier-model events - none of which exist in the
/// package yet (plan Section 5.2 steps 4-6: commands/projections, pools, resolution). This record
/// carries only the fields <see cref="IAIProviderClient"/> needs to make a call, as a plain,
/// unprojected shape a consumer can construct directly until the full provider-configuration
/// subsystem lands. When it does, this record's shape should not need to change - only how it gets
/// populated does.
/// </remarks>
public record ConfiguredAIProvider(
    AIProviderId Id,
    AIProviderType Type,
    AIProviderApiKey ApiKey,
    AIProviderEndpoint? Endpoint = null,
    MaxConcurrentJobs? MaxConcurrentJobs = null);
