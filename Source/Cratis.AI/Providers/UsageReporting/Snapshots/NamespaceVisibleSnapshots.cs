// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.UsageReporting.Snapshots;

/// <summary>
/// Filters the process-wide usage readings to the providers configured in the current namespace.
/// Kept off <see cref="AIProviderUsageSnapshot"/>: Arc exposes every static method on a read model,
/// public or not, as a query endpoint.
/// </summary>
internal static class NamespaceVisibleSnapshots
{
    /// <summary>
    /// Keeps the readings whose provider is configured in the namespace <paramref name="readModels"/> reads from.
    /// </summary>
    /// <param name="readings">The process-wide latest readings.</param>
    /// <param name="readModels">The current namespace's read models.</param>
    /// <returns>The readings visible in the current namespace.</returns>
    internal static async Task<IEnumerable<AIProviderUsageSnapshot>> Filter(IEnumerable<AIProviderUsageSnapshot> readings, IReadModels readModels)
    {
        var visible = new List<AIProviderUsageSnapshot>();
        foreach (var reading in readings)
        {
            if (await IsVisible(reading, readModels))
            {
                visible.Add(reading);
            }
        }

        return visible;
    }

    static async Task<bool> IsVisible(AIProviderUsageSnapshot reading, IReadModels readModels)
    {
        try
        {
            return await readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)reading.Id) is not null;
        }
        catch (Exception)
        {
            // A failed lookup must not end the subscriber's stream. Leaving the reading out keeps the
            // namespace boundary intact; the next refresh emits it again once the lookup succeeds.
            return false;
        }
    }
}
