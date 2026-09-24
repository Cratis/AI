// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.RemovingProvider;

/// <summary>
/// Command for removing a provider from a pool.
/// </summary>
/// <param name="Pool">The pool to remove from.</param>
/// <param name="Provider">The provider to remove.</param>
[Command]
public record RemoveProviderFromPool(AIProviderPoolId Pool, AIProviderId Provider) : ICanProvideEventSourceId
{
    /// <inheritdoc/>
    /// <remarks>
    /// Stated rather than inferred - the pool is what loses a provider; the provider travels in the event as a value. With two identity properties on the record,
    /// leaving it implicit makes the choice depend on declaration order.
    /// </remarks>
    public EventSourceId GetEventSourceId() => Pool;

    /// <summary>
    /// Handles the command by appending a <see cref="ProviderRemovedFromPool"/> event to the pool's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public ProviderRemovedFromPool Handle() => new(Provider);
}

/// <summary>
/// Event raised when a provider has been removed from a pool.
/// </summary>
/// <param name="Provider">The provider that was removed.</param>
[EventType]
public record ProviderRemovedFromPool(AIProviderId Provider);
