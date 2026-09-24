// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingConcurrency;

/// <summary>
/// Command for bounding how many units of work may run on a configured AI provider at once -
/// vendor-agnostic, since the bound is about the provider's capacity rather than anything the vendor
/// exposes. Zero means no limit.
/// </summary>
/// <param name="Provider">The provider to bound.</param>
/// <param name="MaxConcurrentJobs">How many units of work may run on it at once - zero for no limit.</param>
[Command]
public record SetAIProviderConcurrency(AIProviderId Provider, MaxConcurrentJobs MaxConcurrentJobs)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AIProviderConcurrencySet"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public AIProviderConcurrencySet Handle() => new(MaxConcurrentJobs);
}

/// <summary>
/// Event raised when a configured AI provider's concurrency bound has been set.
/// </summary>
/// <param name="MaxConcurrentJobs">How many units of work may run on the provider at once - zero for no limit.</param>
[EventType]
public record AIProviderConcurrencySet(MaxConcurrentJobs MaxConcurrentJobs);
