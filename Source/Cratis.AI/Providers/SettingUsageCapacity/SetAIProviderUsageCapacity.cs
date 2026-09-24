// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingUsageCapacity;

/// <summary>
/// Command for bounding how many tokens a configured AI provider may consume within its
/// usage-reporting window - vendor APIs report consumption, not allowance, so this is what turns a
/// vendor-reported (or, absent a usage credential, locally-burnt) number into "how much room is
/// left", which capacity-aware pool selection ranks members by (issue #1061). Zero means no ceiling,
/// which is what a provider starts with - a provider without one configured simply falls back to the
/// existing least-burnt ranking.
/// </summary>
/// <param name="Provider">The provider to bound.</param>
/// <param name="UsageCapacity">How many tokens it may consume within its usage window - zero for no ceiling.</param>
[Command]
public record SetAIProviderUsageCapacity(AIProviderId Provider, AIProviderUsageCapacity UsageCapacity)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AIProviderUsageCapacitySet"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public AIProviderUsageCapacitySet Handle() => new(UsageCapacity);
}

/// <summary>
/// Event raised when a configured AI provider's usage capacity ceiling has been set.
/// </summary>
/// <param name="UsageCapacity">The new ceiling, in tokens - zero for no ceiling.</param>
[EventType]
public record AIProviderUsageCapacitySet(AIProviderUsageCapacity UsageCapacity);
