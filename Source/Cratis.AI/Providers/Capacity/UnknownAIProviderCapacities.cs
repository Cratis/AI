// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// An <see cref="IAIProviderCapacities"/> that knows nothing - every provider's capacity is
/// <see cref="AIProviderCapacitySource.Unknown"/>, which ranks and admits it as fully available. What
/// a caller constructed without capacities gets, so behavior is exactly what it was before capacity
/// existed.
/// </summary>
/// <param name="timeProvider">The <see cref="TimeProvider"/> observations are stamped with.</param>
internal sealed class UnknownAIProviderCapacities(TimeProvider timeProvider) : IAIProviderCapacities
{
    /// <inheritdoc/>
    public Task<AIProviderCapacity> For(AIProviderId provider, CancellationToken cancellationToken = default) =>
        Task.FromResult(Unknown(provider));

    /// <inheritdoc/>
    public Task<IReadOnlyDictionary<AIProviderId, AIProviderCapacity>> ForMany(IReadOnlyCollection<AIProviderId> providers, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyDictionary<AIProviderId, AIProviderCapacity>>(providers.Distinct().ToDictionary(provider => provider, Unknown));

    /// <inheritdoc/>
    public void Forget(AIProviderId provider)
    {
        // Nothing is remembered, so there is nothing to forget.
    }

    AIProviderCapacity Unknown(AIProviderId provider)
    {
        var now = timeProvider.GetUtcNow();
        return AIProviderCapacityCalculator.Compute(provider, AIProviderCapacitySource.Unknown, [], null, now, null, now, 0d);
    }
}
