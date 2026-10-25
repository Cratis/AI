// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// Defines the system that answers how much of a configured provider's allowance is left, and
/// whether it is worth starting work on - the figure pool selection ranks members by.
/// </summary>
public interface IAIProviderCapacities
{
    /// <summary>
    /// Gets a provider's capacity. Vendor figures are cached for
    /// <see cref="AIProviderOptions.CapacityFreshness"/>; a rate limit recorded against the provider
    /// is always applied as of now.
    /// </summary>
    /// <param name="provider">The provider.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The <see cref="AIProviderCapacity"/>.</returns>
    Task<AIProviderCapacity> For(AIProviderId provider, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the capacity of several providers at once, read concurrently.
    /// </summary>
    /// <param name="providers">The providers.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The capacity per provider.</returns>
    Task<IReadOnlyDictionary<AIProviderId, AIProviderCapacity>> ForMany(IReadOnlyCollection<AIProviderId> providers, CancellationToken cancellationToken = default);

    /// <summary>
    /// Forgets a provider's cached figures, so the next read asks its vendor again - for when the
    /// provider has just turned work away over its own limit.
    /// </summary>
    /// <param name="provider">The provider.</param>
    void Forget(AIProviderId provider);
}
