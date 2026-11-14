// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>Reads fresh access state instead of trusting a selection-time snapshot.</summary>
/// <param name="readModels">The current tenant's provider read models.</param>
/// <param name="initiation">The independently scoped work initiator.</param>
public class ProviderMemberAccess(IReadModels? readModels = null, IWorkInitiation? initiation = null) : IProviderMemberAccess
{
    /// <inheritdoc/>
    public async Task<bool> IsAllowed(AIProviderId provider)
    {
        if (readModels is null) return false;
        var current = await readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)provider);
        return current is not null && AIProviderMemberAccess.Evaluate(current, initiation?.Current ?? WorkInitiator.None).IsAllowed;
    }
}
